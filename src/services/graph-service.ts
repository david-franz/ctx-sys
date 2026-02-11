/**
 * F10i.1: Graph RAG domain service.
 */

import { AppContext } from '../context';
import { RelationshipStore, GraphTraversal } from '../graph';
import {
  CreateRelationshipInput, RelationshipQueryOptions,
  GraphQueryOptions, GraphQueryResult, GraphStats
} from './types';

export class GraphService {
  private relationshipStores = new Map<string, RelationshipStore>();
  private graphTraversals = new Map<string, GraphTraversal>();

  constructor(private context: AppContext) {}

  private getRelationshipStore(projectId: string): RelationshipStore {
    if (!this.relationshipStores.has(projectId)) {
      this.relationshipStores.set(projectId, new RelationshipStore(this.context.db, projectId));
    }
    return this.relationshipStores.get(projectId)!;
  }

  private getGraphTraversal(projectId: string): GraphTraversal {
    if (!this.graphTraversals.has(projectId)) {
      const relationshipStore = this.getRelationshipStore(projectId);
      const entityStore = this.context.getEntityStore(projectId);
      this.graphTraversals.set(projectId, new GraphTraversal(
        this.context.db,
        projectId,
        relationshipStore,
        entityStore
      ));
    }
    return this.graphTraversals.get(projectId)!;
  }

  async addRelationship(projectId: string, input: CreateRelationshipInput): Promise<{ id: string }> {
    const relationshipStore = this.getRelationshipStore(projectId);
    const relationship = await relationshipStore.create({
      sourceId: input.sourceId,
      targetId: input.targetId,
      relationship: input.type,
      weight: input.weight,
      metadata: input.metadata
    });
    return { id: relationship.id };
  }

  async getRelationships(projectId: string, entityId: string, options?: RelationshipQueryOptions): Promise<any[]> {
    const relationshipStore = this.getRelationshipStore(projectId);
    return relationshipStore.getForEntity(entityId, 'both', {
      types: options?.types,
      minWeight: options?.minWeight,
      limit: options?.limit
    });
  }

  async queryGraph(projectId: string, startEntityId: string, options?: GraphQueryOptions): Promise<GraphQueryResult> {
    const graphTraversal = this.getGraphTraversal(projectId);
    const entityStore = this.context.getEntityStore(projectId);

    const neighborhood = await graphTraversal.getNeighborhood(startEntityId, {
      maxDepth: options?.depth || 2,
      direction: options?.direction || 'both',
      types: options?.relationships
    });

    const entities: GraphQueryResult['entities'] = [];
    for (const rel of neighborhood.relationships) {
      const targetId = rel.source === startEntityId ? rel.target : rel.source;
      const entity = await entityStore.get(targetId);
      if (entity && !entities.find(e => e.id === entity.id)) {
        entities.push({
          id: entity.id,
          name: entity.name,
          type: entity.type,
          depth: 1
        });
      }
    }

    return {
      startEntity: startEntityId,
      entities,
      relationships: neighborhood.relationships.map((r, idx) => ({
        id: `rel-${idx}`,
        source: r.source,
        target: r.target,
        type: r.type,
        weight: r.weight
      })),
      totalNodes: entities.length + 1,
      totalEdges: neighborhood.relationships.length
    };
  }

  async getGraphStats(projectId: string): Promise<GraphStats> {
    const entityStore = this.context.getEntityStore(projectId);
    const relationshipStore = this.getRelationshipStore(projectId);
    const stats = await relationshipStore.getStatsByType();
    const avgDegree = await relationshipStore.getAverageDegree();
    const totalEdges = await relationshipStore.count();
    const totalNodes = await entityStore.count();

    return {
      totalNodes,
      totalEdges,
      averageDegree: avgDegree,
      byType: stats
    };
  }

  clearProjectCache(projectId: string): void {
    this.relationshipStores.delete(projectId);
    this.graphTraversals.delete(projectId);
  }
}
