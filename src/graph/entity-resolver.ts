import { EntityStore, Entity, EntityType } from '../entities';
import { EmbeddingManager } from '../embeddings';
import { RelationshipStore } from './relationship-store';

/**
 * A group of duplicate entities.
 */
export interface DuplicateGroup {
  /** The primary (canonical) entity */
  primary: Entity;
  /** Entities identified as duplicates of the primary */
  duplicates: Entity[];
  /** Average similarity score between primary and duplicates */
  similarity: number;
}

/**
 * Options for duplicate detection.
 */
export interface DuplicateDetectionOptions {
  /** Minimum similarity threshold (0-1) */
  threshold?: number;
  /** Entity types to check for duplicates */
  types?: EntityType[];
  /** Maximum duplicates per group */
  maxDuplicates?: number;
}

/**
 * Options for entity merging.
 */
export interface MergeOptions {
  /** Whether to keep aliases from merged entities */
  keepAliases?: boolean;
  /** Whether to redirect relationships from duplicates */
  redirectRelationships?: boolean;
  /** Whether to delete duplicates after merging */
  deleteDuplicates?: boolean;
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** The merged primary entity */
  entity: Entity;
  /** Number of duplicates merged */
  mergedCount: number;
  /** Number of relationships redirected */
  relationshipsRedirected: number;
  /** Aliases added from merged entities */
  aliasesAdded: string[];
}

/**
 * Resolves and deduplicates entities based on semantic similarity.
 */
export class EntityResolver {
  constructor(
    private entityStore: EntityStore,
    private embeddingManager: EmbeddingManager,
    private relationshipStore: RelationshipStore
  ) {}

  /**
   * Find groups of duplicate entities.
   */
  async findDuplicates(options?: DuplicateDetectionOptions): Promise<DuplicateGroup[]> {
    const threshold = options?.threshold ?? 0.85;
    const types = options?.types ?? ['concept', 'technology', 'pattern'];
    const maxDuplicates = options?.maxDuplicates ?? 10;

    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    // Get entities of the specified types
    const entities = await this.entityStore.getByType(types);

    for (const entity of entities) {
      if (processed.has(entity.id)) continue;

      // Find similar entities using embeddings
      const content = entity.content || entity.summary || entity.name;
      const similar = await this.embeddingManager.findSimilar(content, {
        limit: maxDuplicates + 1,
        threshold,
        entityTypes: types as string[]
      });

      // Filter out self and already processed
      const duplicates: Entity[] = [];
      let totalSimilarity = 0;

      for (const match of similar) {
        if (match.entityId === entity.id) continue;
        if (processed.has(match.entityId)) continue;

        const dupEntity = await this.entityStore.get(match.entityId);
        if (dupEntity) {
          duplicates.push(dupEntity);
          totalSimilarity += match.score;
          processed.add(match.entityId);
        }
      }

      if (duplicates.length > 0) {
        groups.push({
          primary: entity,
          duplicates,
          similarity: totalSimilarity / duplicates.length
        });
        processed.add(entity.id);
      }
    }

    return groups;
  }

  /**
   * Merge duplicate entities into a primary entity.
   */
  async merge(
    primaryId: string,
    duplicateIds: string[],
    options?: MergeOptions
  ): Promise<MergeResult> {
    const keepAliases = options?.keepAliases ?? true;
    const redirectRelationships = options?.redirectRelationships ?? true;
    const deleteDuplicates = options?.deleteDuplicates ?? true;

    const primary = await this.entityStore.get(primaryId);
    if (!primary) {
      throw new Error(`Primary entity not found: ${primaryId}`);
    }

    const aliasesAdded: string[] = [];
    let relationshipsRedirected = 0;
    let mergedCount = 0;

    for (const dupId of duplicateIds) {
      const duplicate = await this.entityStore.get(dupId);
      if (!duplicate) continue;

      // Collect aliases
      if (keepAliases) {
        // Add the duplicate's name as an alias if different
        if (duplicate.name !== primary.name) {
          aliasesAdded.push(duplicate.name);
        }

        // Add any existing aliases from the duplicate
        const dupAliases = duplicate.metadata?.aliases as string[] | undefined;
        if (dupAliases) {
          aliasesAdded.push(...dupAliases.filter(a => a !== primary.name));
        }
      }

      // Redirect relationships
      if (redirectRelationships) {
        const redirected = await this.redirectRelationships(dupId, primaryId);
        relationshipsRedirected += redirected;
      }

      // Delete duplicate
      if (deleteDuplicates) {
        await this.embeddingManager.deleteForEntity(dupId);
        await this.entityStore.delete(dupId);
      }

      mergedCount++;
    }

    // Update primary with merged metadata
    if (aliasesAdded.length > 0) {
      const existingAliases = primary.metadata?.aliases as string[] | undefined ?? [];
      const allAliases = [...new Set([...existingAliases, ...aliasesAdded])];

      await this.entityStore.update(primaryId, {
        metadata: { aliases: allAliases }
      });
    }

    const updatedPrimary = await this.entityStore.get(primaryId);
    if (!updatedPrimary) {
      throw new Error('Failed to retrieve updated primary entity');
    }

    return {
      entity: updatedPrimary,
      mergedCount,
      relationshipsRedirected,
      aliasesAdded
    };
  }

  /**
   * Redirect relationships from one entity to another.
   */
  private async redirectRelationships(
    fromId: string,
    toId: string
  ): Promise<number> {
    const relationships = await this.relationshipStore.getForEntity(fromId, 'both');
    let redirected = 0;

    for (const rel of relationships) {
      const newSourceId = rel.sourceId === fromId ? toId : rel.sourceId;
      const newTargetId = rel.targetId === fromId ? toId : rel.targetId;

      // Skip self-loops that would be created
      if (newSourceId === newTargetId) continue;

      // Check if this relationship already exists
      const exists = await this.relationshipStore.exists(
        newSourceId,
        newTargetId,
        rel.relationship
      );

      if (!exists) {
        await this.relationshipStore.create({
          sourceId: newSourceId,
          targetId: newTargetId,
          relationship: rel.relationship,
          weight: rel.weight,
          metadata: rel.metadata
        });
        redirected++;
      }
    }

    // Delete old relationships
    await this.relationshipStore.deleteForEntity(fromId);

    return redirected;
  }

  /**
   * Resolve a name to an entity, using fuzzy matching if needed.
   */
  async resolve(
    name: string,
    options?: { type?: EntityType; threshold?: number }
  ): Promise<Entity | null> {
    const type = options?.type;
    const threshold = options?.threshold ?? 0.8;

    // Try exact match first
    const exact = await this.entityStore.getByName(name, type);
    if (exact) return exact;

    // Try qualified name match
    const qualified = await this.entityStore.getByQualifiedName(name);
    if (qualified) return qualified;

    // Try searching by name pattern
    const searchResults = await this.entityStore.search(name, {
      type,
      limit: 5
    });

    // Return first result if it's a good match
    if (searchResults.length > 0) {
      const first = searchResults[0];
      // Simple string similarity check
      if (this.nameSimilarity(name, first.name) >= threshold) {
        return first;
      }
    }

    // Try embedding-based similarity
    const similar = await this.embeddingManager.findSimilar(name, {
      limit: 1,
      threshold,
      entityTypes: type ? [type] : undefined
    });

    if (similar.length > 0) {
      return this.entityStore.get(similar[0].entityId);
    }

    return null;
  }

  /**
   * Resolve multiple names to entities.
   */
  async resolveMany(
    names: string[],
    options?: { type?: EntityType; threshold?: number }
  ): Promise<Map<string, Entity | null>> {
    const results = new Map<string, Entity | null>();

    for (const name of names) {
      const entity = await this.resolve(name, options);
      results.set(name, entity);
    }

    return results;
  }

  /**
   * Find entities that might be aliases of each other.
   */
  async findPotentialAliases(
    entityId: string,
    options?: { threshold?: number; limit?: number }
  ): Promise<Array<{ entity: Entity; similarity: number }>> {
    const threshold = options?.threshold ?? 0.8;
    const limit = options?.limit ?? 10;

    const entity = await this.entityStore.get(entityId);
    if (!entity) return [];

    const content = entity.content || entity.summary || entity.name;
    const similar = await this.embeddingManager.findSimilar(content, {
      limit: limit + 1,
      threshold
    });

    const results: Array<{ entity: Entity; similarity: number }> = [];

    for (const match of similar) {
      if (match.entityId === entityId) continue;

      const matchEntity = await this.entityStore.get(match.entityId);
      if (matchEntity) {
        results.push({
          entity: matchEntity,
          similarity: match.score
        });
      }
    }

    return results;
  }

  /**
   * Get all aliases for an entity.
   */
  async getAliases(entityId: string): Promise<string[]> {
    const entity = await this.entityStore.get(entityId);
    if (!entity) return [];

    const aliases = entity.metadata?.aliases as string[] | undefined;
    return aliases ?? [];
  }

  /**
   * Add an alias to an entity.
   */
  async addAlias(entityId: string, alias: string): Promise<void> {
    const entity = await this.entityStore.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const existingAliases = entity.metadata?.aliases as string[] | undefined ?? [];
    if (!existingAliases.includes(alias) && alias !== entity.name) {
      await this.entityStore.update(entityId, {
        metadata: { aliases: [...existingAliases, alias] }
      });
    }
  }

  /**
   * Remove an alias from an entity.
   */
  async removeAlias(entityId: string, alias: string): Promise<void> {
    const entity = await this.entityStore.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const existingAliases = entity.metadata?.aliases as string[] | undefined ?? [];
    const updatedAliases = existingAliases.filter(a => a !== alias);

    await this.entityStore.update(entityId, {
      metadata: { aliases: updatedAliases }
    });
  }

  /**
   * Calculate simple name similarity (Jaccard on character n-grams).
   */
  private nameSimilarity(a: string, b: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const aNorm = normalize(a);
    const bNorm = normalize(b);

    if (aNorm === bNorm) return 1;
    if (aNorm.length === 0 || bNorm.length === 0) return 0;

    // Generate character bigrams
    const bigramsA = new Set<string>();
    const bigramsB = new Set<string>();

    for (let i = 0; i < aNorm.length - 1; i++) {
      bigramsA.add(aNorm.substring(i, i + 2));
    }
    for (let i = 0; i < bNorm.length - 1; i++) {
      bigramsB.add(bNorm.substring(i, i + 2));
    }

    // Calculate Jaccard similarity
    let intersection = 0;
    for (const bigram of bigramsA) {
      if (bigramsB.has(bigram)) intersection++;
    }

    const union = bigramsA.size + bigramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
