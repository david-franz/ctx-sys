import { EntityStore, Entity, EntityType } from '../entities';
import { EmbeddingManager } from '../embeddings';
import { RelationshipStore } from './relationship-store';
import { GraphRelationshipType } from './types';

/**
 * Options for semantic relationship discovery.
 */
export interface SemanticDiscoveryOptions {
  /** Minimum similarity threshold (0-1) */
  minSimilarity?: number;
  /** Maximum relationships to create per entity */
  maxPerEntity?: number;
  /** Entity types to process */
  entityTypes?: EntityType[];
  /** Relationship type to use for discovered links */
  relationshipType?: GraphRelationshipType;
  /** Whether to skip entities that already have semantic relationships */
  skipExisting?: boolean;
}

/**
 * Result of a semantic discovery operation.
 */
export interface DiscoveryResult {
  /** Number of relationships created */
  created: number;
  /** Number of entities processed */
  entitiesProcessed: number;
  /** Number of entities skipped (already linked) */
  entitiesSkipped: number;
}

/**
 * A semantic link with similarity score.
 */
export interface SemanticLink {
  sourceId: string;
  targetId: string;
  similarity: number;
}

/**
 * Options for finding related entities.
 */
export interface FindRelatedOptions {
  /** Maximum number of results */
  limit?: number;
  /** Minimum similarity threshold */
  minSimilarity?: number;
  /** Entity types to include */
  entityTypes?: EntityType[];
}

/**
 * Discovers and creates relationships based on semantic similarity.
 */
export class SemanticLinker {
  constructor(
    private entityStore: EntityStore,
    private embeddingManager: EmbeddingManager,
    private relationshipStore: RelationshipStore
  ) {}

  /**
   * Discover and create semantic relationships for all entities.
   */
  async discoverRelationships(options?: SemanticDiscoveryOptions): Promise<DiscoveryResult> {
    const minSimilarity = options?.minSimilarity ?? 0.75;
    const maxPerEntity = options?.maxPerEntity ?? 5;
    const entityTypes = options?.entityTypes ?? ['function', 'class', 'requirement', 'concept', 'document'];
    const relationshipType = options?.relationshipType ?? 'RELATES_TO';
    const skipExisting = options?.skipExisting ?? true;

    let created = 0;
    let entitiesProcessed = 0;
    let entitiesSkipped = 0;

    // Get entities of the specified types
    const entities = await this.entityStore.getByType(entityTypes);

    for (const entity of entities) {
      // Skip if already has semantic relationships
      if (skipExisting) {
        const existing = await this.relationshipStore.getForEntity(entity.id, 'out', {
          types: [relationshipType]
        });
        if (existing.length > 0) {
          entitiesSkipped++;
          continue;
        }
      }

      // Get content for similarity search
      const content = entity.summary || entity.content || entity.name;

      // Find semantically similar entities
      const similar = await this.embeddingManager.findSimilar(content, {
        limit: maxPerEntity + 1, // +1 to account for self
        threshold: minSimilarity,
        entityTypes: entityTypes as string[]
      });

      for (const match of similar) {
        // Skip self
        if (match.entityId === entity.id) continue;

        // Check if relationship already exists
        const exists = await this.relationshipStore.exists(
          entity.id,
          match.entityId,
          relationshipType
        );

        if (!exists) {
          await this.relationshipStore.create({
            sourceId: entity.id,
            targetId: match.entityId,
            relationship: relationshipType,
            weight: match.score,
            metadata: {
              discoveredBy: 'semantic',
              similarity: match.score
            }
          });
          created++;
        }
      }

      entitiesProcessed++;
    }

    return {
      created,
      entitiesProcessed,
      entitiesSkipped
    };
  }

  /**
   * Link a newly added entity to similar existing entities.
   */
  async linkNewEntity(
    entityId: string,
    options?: {
      minSimilarity?: number;
      maxLinks?: number;
      relationshipType?: GraphRelationshipType;
      bidirectional?: boolean;
    }
  ): Promise<number> {
    const minSimilarity = options?.minSimilarity ?? 0.75;
    const maxLinks = options?.maxLinks ?? 5;
    const relationshipType = options?.relationshipType ?? 'RELATES_TO';
    const bidirectional = options?.bidirectional ?? false;

    const entity = await this.entityStore.get(entityId);
    if (!entity) return 0;

    const content = entity.summary || entity.content || entity.name;
    const similar = await this.embeddingManager.findSimilar(content, {
      limit: maxLinks + 1,
      threshold: minSimilarity
    });

    let created = 0;

    for (const match of similar) {
      if (match.entityId === entityId) continue;

      // Stop if we've reached the max links
      if (created >= maxLinks) break;

      // Create outgoing relationship
      const existsOutgoing = await this.relationshipStore.exists(
        entityId,
        match.entityId,
        relationshipType
      );

      if (!existsOutgoing) {
        await this.relationshipStore.create({
          sourceId: entityId,
          targetId: match.entityId,
          relationship: relationshipType,
          weight: match.score,
          metadata: {
            discoveredBy: 'semantic',
            similarity: match.score
          }
        });
        created++;
      }

      // Optionally create bidirectional relationship
      if (bidirectional) {
        const existsIncoming = await this.relationshipStore.exists(
          match.entityId,
          entityId,
          relationshipType
        );

        if (!existsIncoming) {
          await this.relationshipStore.create({
            sourceId: match.entityId,
            targetId: entityId,
            relationship: relationshipType,
            weight: match.score,
            metadata: {
              discoveredBy: 'semantic',
              similarity: match.score
            }
          });
          created++;
        }
      }
    }

    return created;
  }

  /**
   * Find entities related to a query.
   */
  async findRelated(
    query: string,
    options?: FindRelatedOptions
  ): Promise<Array<{ entity: Entity; score: number }>> {
    const limit = options?.limit ?? 10;
    const minSimilarity = options?.minSimilarity ?? 0.5;
    const entityTypes = options?.entityTypes;

    const similar = await this.embeddingManager.findSimilar(query, {
      limit,
      threshold: minSimilarity,
      entityTypes: entityTypes as string[] | undefined
    });

    const results: Array<{ entity: Entity; score: number }> = [];

    for (const match of similar) {
      const entity = await this.entityStore.get(match.entityId);
      if (entity) {
        results.push({ entity, score: match.score });
      }
    }

    return results;
  }

  /**
   * Find related concepts for a given entity.
   */
  async findRelatedConcepts(
    entityId: string,
    options?: { limit?: number; minSimilarity?: number }
  ): Promise<Array<{ entity: Entity; score: number }>> {
    const limit = options?.limit ?? 10;
    const minSimilarity = options?.minSimilarity ?? 0.6;

    const entity = await this.entityStore.get(entityId);
    if (!entity) return [];

    const content = entity.summary || entity.content || entity.name;

    return this.findRelated(content, {
      limit: limit + 1, // +1 to account for self
      minSimilarity,
      entityTypes: ['concept', 'technology', 'pattern']
    }).then(results => results.filter(r => r.entity.id !== entityId).slice(0, limit));
  }

  /**
   * Get semantic links for an entity.
   */
  async getSemanticLinks(
    entityId: string,
    options?: { direction?: 'in' | 'out' | 'both'; minWeight?: number }
  ): Promise<SemanticLink[]> {
    const direction = options?.direction ?? 'both';
    const minWeight = options?.minWeight;

    const relationships = await this.relationshipStore.getForEntity(entityId, direction, {
      types: ['RELATES_TO'],
      minWeight
    });

    return relationships.map(rel => ({
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      similarity: rel.weight
    }));
  }

  /**
   * Update semantic links for an entity (re-discover).
   */
  async updateLinks(
    entityId: string,
    options?: {
      minSimilarity?: number;
      maxLinks?: number;
    }
  ): Promise<number> {
    // Remove existing semantic relationships
    const existing = await this.relationshipStore.getForEntity(entityId, 'out', {
      types: ['RELATES_TO']
    });

    for (const rel of existing) {
      // Only remove if it was semantically discovered
      if (rel.metadata?.discoveredBy === 'semantic') {
        await this.relationshipStore.delete(rel.id);
      }
    }

    // Re-link
    return this.linkNewEntity(entityId, options);
  }

  /**
   * Get suggested relationships based on unlinked similar entities.
   */
  async getSuggestions(
    entityId: string,
    options?: { limit?: number; minSimilarity?: number }
  ): Promise<Array<{ entity: Entity; similarity: number; reason: string }>> {
    const limit = options?.limit ?? 5;
    const minSimilarity = options?.minSimilarity ?? 0.7;

    const entity = await this.entityStore.get(entityId);
    if (!entity) return [];

    const content = entity.summary || entity.content || entity.name;
    const similar = await this.embeddingManager.findSimilar(content, {
      limit: limit * 2, // Get more to filter
      threshold: minSimilarity
    });

    const suggestions: Array<{ entity: Entity; similarity: number; reason: string }> = [];

    for (const match of similar) {
      if (match.entityId === entityId) continue;

      // Check if already linked
      const isLinked = await this.relationshipStore.exists(
        entityId,
        match.entityId
      );

      if (!isLinked) {
        const targetEntity = await this.entityStore.get(match.entityId);
        if (targetEntity) {
          const reason = this.generateLinkReason(entity, targetEntity, match.score);
          suggestions.push({
            entity: targetEntity,
            similarity: match.score,
            reason
          });

          if (suggestions.length >= limit) break;
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate a human-readable reason for suggesting a link.
   */
  private generateLinkReason(source: Entity, target: Entity, similarity: number): string {
    const strengthWord = similarity >= 0.9 ? 'very similar' :
                        similarity >= 0.8 ? 'similar' :
                        similarity >= 0.7 ? 'related' : 'possibly related';

    if (source.type === target.type) {
      return `${strengthWord} ${source.type} (${Math.round(similarity * 100)}% match)`;
    }

    return `${strengthWord} content (${Math.round(similarity * 100)}% match)`;
  }

  /**
   * Batch process multiple entities for semantic linking.
   */
  async batchLink(
    entityIds: string[],
    options?: {
      minSimilarity?: number;
      maxLinksPerEntity?: number;
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<{ totalCreated: number; processed: number }> {
    const minSimilarity = options?.minSimilarity ?? 0.75;
    const maxLinksPerEntity = options?.maxLinksPerEntity ?? 5;

    let totalCreated = 0;
    let processed = 0;

    for (const entityId of entityIds) {
      const created = await this.linkNewEntity(entityId, {
        minSimilarity,
        maxLinks: maxLinksPerEntity
      });
      totalCreated += created;
      processed++;

      if (options?.onProgress) {
        options.onProgress(processed, entityIds.length);
      }
    }

    return { totalCreated, processed };
  }

  /**
   * Remove semantic relationships below a certain threshold.
   */
  async pruneWeakLinks(minWeight: number = 0.6): Promise<number> {
    const allRelations = await this.relationshipStore.getByType('RELATES_TO');
    let removed = 0;

    for (const rel of allRelations) {
      if (rel.weight < minWeight && rel.metadata?.discoveredBy === 'semantic') {
        await this.relationshipStore.delete(rel.id);
        removed++;
      }
    }

    return removed;
  }
}
