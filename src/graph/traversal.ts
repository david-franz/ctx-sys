import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { EntityStore, Entity, EntityType } from '../entities';
import { RelationshipStore } from './relationship-store';
import {
  SubgraphResult,
  PathResult,
  PathInfo,
  GraphStatistics,
  TraversalOptions,
  GraphRelationshipType,
  StoredRelationship
} from './types';

/**
 * Graph traversal and analysis operations.
 */
export class GraphTraversal {
  private relTableName: string;
  private projectPrefix: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string,
    private relationshipStore: RelationshipStore,
    private entityStore: EntityStore
  ) {
    this.projectPrefix = sanitizeProjectId(projectId);
    this.relTableName = `${this.projectPrefix}_relationships`;
  }

  /**
   * Get the neighborhood of an entity up to a certain depth.
   */
  async getNeighborhood(
    entityId: string,
    options?: TraversalOptions
  ): Promise<SubgraphResult> {
    const maxDepth = options?.maxDepth ?? 2;
    const direction = options?.direction ?? 'both';
    const types = options?.types;
    const minWeight = options?.minWeight;

    const visitedEntities = new Set<string>();
    const collectedRelationships: StoredRelationship[] = [];

    // BFS traversal
    const queue: Array<{ id: string; depth: number }> = [{ id: entityId, depth: 0 }];
    visitedEntities.add(entityId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth >= maxDepth) continue;

      // Get relationships for this entity
      const rels = await this.relationshipStore.getForEntity(id, direction, {
        types,
        minWeight
      });

      for (const rel of rels) {
        collectedRelationships.push(rel);

        // Determine the neighbor
        const neighborId = rel.sourceId === id ? rel.targetId : rel.sourceId;

        if (!visitedEntities.has(neighborId)) {
          visitedEntities.add(neighborId);
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }

    // Hydrate entities
    const entities: Entity[] = [];
    for (const entId of visitedEntities) {
      const entity = await this.entityStore.get(entId);
      if (entity) entities.push(entity);
    }

    // Deduplicate relationships by id
    const seenRelIds = new Set<string>();
    const uniqueRels = collectedRelationships.filter(rel => {
      if (seenRelIds.has(rel.id)) return false;
      seenRelIds.add(rel.id);
      return true;
    });

    return {
      entities,
      relationships: uniqueRels.map(rel => ({
        source: rel.sourceId,
        target: rel.targetId,
        type: rel.relationship,
        weight: rel.weight
      }))
    };
  }

  /**
   * Find all paths between two entities.
   */
  async findPaths(
    fromId: string,
    toId: string,
    options?: { maxDepth?: number; types?: GraphRelationshipType[] }
  ): Promise<PathResult> {
    const maxDepth = options?.maxDepth ?? 5;
    const types = options?.types;

    const paths: PathInfo[] = [];

    // DFS with path tracking
    const dfs = async (
      currentId: string,
      targetId: string,
      visited: Set<string>,
      currentPath: string[],
      currentEdges: GraphRelationshipType[],
      totalWeight: number,
      depth: number
    ): Promise<void> => {
      if (depth > maxDepth) return;

      if (currentId === targetId) {
        paths.push({
          nodes: [...currentPath],
          edges: [...currentEdges],
          totalWeight,
          length: currentPath.length - 1
        });
        return;
      }

      // Get outgoing relationships
      const rels = await this.relationshipStore.getForEntity(currentId, 'out', { types });

      for (const rel of rels) {
        if (!visited.has(rel.targetId)) {
          visited.add(rel.targetId);
          currentPath.push(rel.targetId);
          currentEdges.push(rel.relationship);

          await dfs(
            rel.targetId,
            targetId,
            visited,
            currentPath,
            currentEdges,
            totalWeight + rel.weight,
            depth + 1
          );

          currentPath.pop();
          currentEdges.pop();
          visited.delete(rel.targetId);
        }
      }
    };

    const visited = new Set<string>([fromId]);
    await dfs(fromId, toId, visited, [fromId], [], 0, 0);

    // Sort paths by length (shortest first)
    paths.sort((a, b) => a.length - b.length);

    return {
      paths: paths.slice(0, 10), // Limit to 10 paths
      found: paths.length > 0
    };
  }

  /**
   * Find the shortest path between two entities.
   */
  async findShortestPath(
    fromId: string,
    toId: string,
    options?: { types?: GraphRelationshipType[] }
  ): Promise<PathInfo | null> {
    const types = options?.types;

    // BFS for shortest path
    const queue: Array<{
      id: string;
      path: string[];
      edges: GraphRelationshipType[];
      weight: number;
    }> = [{ id: fromId, path: [fromId], edges: [], weight: 0 }];

    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const { id, path, edges, weight } = queue.shift()!;

      if (id === toId) {
        return {
          nodes: path,
          edges,
          totalWeight: weight,
          length: path.length - 1
        };
      }

      const rels = await this.relationshipStore.getForEntity(id, 'out', { types });

      for (const rel of rels) {
        if (!visited.has(rel.targetId)) {
          visited.add(rel.targetId);
          queue.push({
            id: rel.targetId,
            path: [...path, rel.targetId],
            edges: [...edges, rel.relationship],
            weight: weight + rel.weight
          });
        }
      }
    }

    return null;
  }

  /**
   * Get all entities reachable from a starting entity.
   */
  async getReachable(
    entityId: string,
    options?: TraversalOptions
  ): Promise<string[]> {
    const maxDepth = options?.maxDepth ?? Infinity;
    const direction = options?.direction ?? 'out';
    const types = options?.types;

    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: entityId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      if (depth >= maxDepth) continue;

      const rels = await this.relationshipStore.getForEntity(id, direction, { types });

      for (const rel of rels) {
        const neighborId = direction === 'out' ? rel.targetId :
                          direction === 'in' ? rel.sourceId :
                          (rel.sourceId === id ? rel.targetId : rel.sourceId);

        if (!visited.has(neighborId)) {
          queue.push({ id: neighborId, depth: depth + 1 });
        }
      }
    }

    // Remove the starting entity from results
    visited.delete(entityId);
    return Array.from(visited);
  }

  /**
   * Get entities that depend on (point to) a given entity.
   */
  async getDependents(entityId: string, depth: number = 1): Promise<string[]> {
    return this.getReachable(entityId, { maxDepth: depth, direction: 'in' });
  }

  /**
   * Get entities that a given entity depends on (points to).
   */
  async getDependencies(entityId: string, depth: number = 1): Promise<string[]> {
    return this.getReachable(entityId, { maxDepth: depth, direction: 'out' });
  }

  /**
   * Get graph statistics.
   */
  async getStatistics(): Promise<GraphStatistics> {
    const entityCount = await this.entityStore.count();
    const relationshipCount = await this.relationshipStore.count();
    const averageDegree = await this.relationshipStore.getAverageDegree();
    const relationshipsByType = await this.relationshipStore.getStatsByType();
    const topConnectedEntities = await this.relationshipStore.getMostConnected(10);

    return {
      entityCount,
      relationshipCount,
      averageDegree,
      relationshipsByType,
      topConnectedEntities
    };
  }

  /**
   * Find common neighbors between two entities.
   */
  async findCommonNeighbors(entityId1: string, entityId2: string): Promise<string[]> {
    const neighbors1 = new Set(await this.getReachable(entityId1, { maxDepth: 1, direction: 'both' }));
    const neighbors2 = await this.getReachable(entityId2, { maxDepth: 1, direction: 'both' });

    return neighbors2.filter(id => neighbors1.has(id));
  }

  /**
   * Calculate the degree (number of connections) for an entity.
   */
  async getDegree(entityId: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<number> {
    const rels = await this.relationshipStore.getForEntity(entityId, direction);
    return rels.length;
  }

  /**
   * Check if two entities are connected (directly or indirectly).
   */
  async areConnected(
    entityId1: string,
    entityId2: string,
    maxDepth: number = 5
  ): Promise<boolean> {
    const path = await this.findShortestPath(entityId1, entityId2);
    if (path && path.length <= maxDepth) return true;

    // Try reverse direction
    const reversePath = await this.findShortestPath(entityId2, entityId1);
    return reversePath !== null && reversePath.length <= maxDepth;
  }

  /**
   * Get a subgraph containing only specific entity types.
   */
  async getSubgraphByEntityTypes(
    entityTypes: EntityType[],
    relationshipTypes?: GraphRelationshipType[]
  ): Promise<SubgraphResult> {
    // Get all entities of the specified types
    const entities = await this.entityStore.getByType(entityTypes);
    const entityIds = new Set(entities.map(e => e.id));

    // Get all relationships between these entities
    const relationships: Array<{
      source: string;
      target: string;
      type: GraphRelationshipType;
      weight: number;
    }> = [];

    for (const entity of entities) {
      const rels = await this.relationshipStore.getForEntity(entity.id, 'out', {
        types: relationshipTypes
      });

      for (const rel of rels) {
        if (entityIds.has(rel.targetId)) {
          relationships.push({
            source: rel.sourceId,
            target: rel.targetId,
            type: rel.relationship,
            weight: rel.weight
          });
        }
      }
    }

    return { entities, relationships };
  }
}
