/**
 * F5.1 Graph Storage and Traversal Tests
 *
 * Tests for graph operations:
 * - GraphStore operations
 * - Multi-hop traversal with recursive CTEs
 * - Path finding between entities
 * - Subgraph extraction
 * - Graph statistics
 *
 * NOTE: These tests will fail until the following implementations are created:
 * - src/graph/store.ts (GraphStore class)
 * - src/graph/types.ts (Node, Edge, GraphQuery, SubgraphResult, PathResult, GraphStats interfaces)
 * - src/database/connection.ts (DatabaseConnection class)
 *
 * @see docs/phase-5/F5.1-graph-storage.md
 */

import { GraphStore } from '../../src/graph/store';
import {
  Node,
  Edge,
  GraphQuery,
  SubgraphResult,
  PathResult,
  GraphStats
} from '../../src/graph/types';
import { DatabaseConnection } from '../../src/db/connection';

// Mock the dependencies
jest.mock('../../src/db/connection');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;

describe('F5.1 Graph Storage and Traversal', () => {
  let graphStore: GraphStore;
  let mockDbConnection: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked database connection instance
    mockDbConnection = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;

    // Setup default mock implementations
    mockDbConnection.all = jest.fn().mockResolvedValue([]);
    mockDbConnection.get = jest.fn().mockResolvedValue(undefined);
    mockDbConnection.run = jest.fn().mockResolvedValue({ changes: 0 });

    // Create real GraphStore instance with mocked dependency
    graphStore = new GraphStore(mockDbConnection);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // SubgraphResult Interface Tests
  // ============================================================================

  describe('SubgraphResult Interface', () => {
    it('should contain entities and relationships', async () => {
      const mockSubgraph: SubgraphResult = {
        entities: [
          { id: 'e1', name: 'AuthService', type: 'class' },
          { id: 'e2', name: 'UserService', type: 'class' }
        ],
        relationships: [
          { source: 'e1', target: 'e2', type: 'CALLS', weight: 1.0 }
        ]
      };

      mockDbConnection.all
        .mockResolvedValueOnce(mockSubgraph.entities)
        .mockResolvedValueOnce(mockSubgraph.relationships);

      const result = await graphStore.getSubgraph('proj_123', 'e1', { depth: 1 });

      expect(result.entities).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
    });

    it('should support empty subgraph', async () => {
      mockDbConnection.all.mockResolvedValue([]);

      const result = await graphStore.getSubgraph('proj_123', 'isolated_node', { depth: 1 });

      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });
  });

  // ============================================================================
  // PathResult Interface Tests
  // ============================================================================

  describe('PathResult Interface', () => {
    it('should contain paths with nodes, edges, and length', async () => {
      const mockPaths: PathResult = {
        paths: [
          { nodes: ['e1', 'e2', 'e3'], edges: ['rel1', 'rel2'], length: 2 },
          { nodes: ['e1', 'e4', 'e3'], edges: ['rel3', 'rel4'], length: 2 }
        ]
      };

      mockDbConnection.all.mockResolvedValue(mockPaths.paths);

      const result = await graphStore.findPaths('proj_123', 'e1', 'e3', { maxDepth: 3 });

      expect(result.paths).toHaveLength(2);
      expect(result.paths[0].nodes).toHaveLength(3);
      expect(result.paths[0].length).toBe(2);
    });

    it('should support no paths found', async () => {
      mockDbConnection.all.mockResolvedValue([]);

      const result = await graphStore.findPaths('proj_123', 'e1', 'disconnected', { maxDepth: 5 });

      expect(result.paths).toHaveLength(0);
    });
  });

  // ============================================================================
  // GraphStore Tests
  // ============================================================================

  describe('GraphStore', () => {
    const projectId = 'proj_123';

    describe('getNeighborhood()', () => {
      it('should get direct neighbors (depth 1)', async () => {
        const entityId = 'entity_auth';
        const mockNeighbors = [
          { entity_id: 'entity_user', depth: 1, rel_type: 'CALLS' },
          { entity_id: 'entity_db', depth: 1, rel_type: 'USES' }
        ];

        mockDbConnection.all.mockResolvedValue(mockNeighbors);

        const results = await graphStore.getNeighborhood(projectId, entityId, { depth: 1 });

        expect(results).toHaveLength(2);
        expect(results.every((r: any) => r.depth === 1)).toBe(true);
        expect(mockDbConnection.all).toHaveBeenCalledWith(
          expect.stringContaining('WITH RECURSIVE'),
          expect.arrayContaining([entityId, 1])
        );
      });

      it('should get multi-hop neighbors (depth 2)', async () => {
        const entityId = 'entity_auth';
        const mockNeighbors = [
          { entity_id: 'entity_user', depth: 1 },
          { entity_id: 'entity_db', depth: 1 },
          { entity_id: 'entity_cache', depth: 2 },
          { entity_id: 'entity_logger', depth: 2 }
        ];

        mockDbConnection.all.mockResolvedValue(mockNeighbors);

        const results = await graphStore.getNeighborhood(projectId, entityId, { depth: 2 });

        expect(results.some((r: any) => r.depth === 1)).toBe(true);
        expect(results.some((r: any) => r.depth === 2)).toBe(true);
      });

      it('should filter by relationship type', async () => {
        const types = ['CALLS', 'IMPORTS'];
        const mockNeighbors = [
          { entity_id: 'e1', rel_type: 'CALLS' },
          { entity_id: 'e2', rel_type: 'IMPORTS' }
        ];

        mockDbConnection.all.mockResolvedValue(mockNeighbors);

        const results = await graphStore.getNeighborhood(projectId, 'e0', {
          depth: 1,
          relationshipTypes: types
        });

        expect(results.every((r: any) => types.includes(r.rel_type))).toBe(true);
      });

      it('should avoid cycles in traversal', async () => {
        // A -> B -> C -> A (cycle)
        const mockResults = [
          { entity_id: 'B', path: 'A->B' },
          { entity_id: 'C', path: 'A->B->C' }
          // Should not include A again
        ];

        mockDbConnection.all.mockResolvedValue(mockResults);

        const results = await graphStore.getNeighborhood(projectId, 'A', { depth: 3 });

        // A should not appear again in results
        const paths = results.map((r: any) => r.path);
        expect(paths.some((p: string) => p.endsWith('->A'))).toBe(false);
      });

      it('should hydrate entities from IDs', async () => {
        const mockEntities = [
          { id: 'e1', name: 'AuthService', type: 'class' },
          { id: 'e2', name: 'UserService', type: 'class' },
          { id: 'e3', name: 'login', type: 'function' }
        ];

        mockDbConnection.all.mockResolvedValue(mockEntities);

        const entities = await graphStore.hydrateEntities(projectId, ['e1', 'e2', 'e3']);

        expect(entities).toHaveLength(3);
        expect(entities.every((e: any) => e.id && e.name && e.type)).toBe(true);
      });
    });

    describe('findPaths()', () => {
      it('should find direct path (length 1)', async () => {
        const fromId = 'entity_a';
        const toId = 'entity_b';
        const mockPath = [{ path: 'entity_a,entity_b', depth: 1 }];

        mockDbConnection.all.mockResolvedValue(mockPath);

        const result = await graphStore.findPaths(projectId, fromId, toId, { maxDepth: 5 });

        expect(result.paths).toHaveLength(1);
        expect(result.paths[0].length).toBe(1);
      });

      it('should find multi-hop paths', async () => {
        const fromId = 'entity_a';
        const toId = 'entity_d';
        const mockPaths = [
          { nodes: ['a', 'b', 'c', 'd'], edges: ['r1', 'r2', 'r3'], length: 3 },
          { nodes: ['a', 'e', 'd'], edges: ['r4', 'r5'], length: 2 }
        ];

        mockDbConnection.all.mockResolvedValue(mockPaths);

        const result = await graphStore.findPaths(projectId, fromId, toId, { maxDepth: 5 });

        expect(result.paths).toHaveLength(2);
        expect(result.paths[0].length).not.toBe(result.paths[1].length);
      });

      it('should respect max depth limit', async () => {
        const maxDepth = 3;
        const mockPaths = [
          { nodes: ['a', 'b'], edges: ['r1'], length: 1 },
          { nodes: ['a', 'b', 'c'], edges: ['r1', 'r2'], length: 2 },
          { nodes: ['a', 'b', 'c', 'd'], edges: ['r1', 'r2', 'r3'], length: 3 }
        ];

        mockDbConnection.all.mockResolvedValue(mockPaths);

        const result = await graphStore.findPaths(projectId, 'a', 'd', { maxDepth });

        expect(result.paths.every((p: any) => p.length <= maxDepth)).toBe(true);
        expect(mockDbConnection.all).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([maxDepth])
        );
      });

      it('should return multiple paths if they exist', async () => {
        const mockPaths = [
          { nodes: ['a', 'b', 'd'], edges: ['r1', 'r2'], length: 2 },
          { nodes: ['a', 'c', 'd'], edges: ['r3', 'r4'], length: 2 },
          { nodes: ['a', 'e', 'f', 'd'], edges: ['r5', 'r6', 'r7'], length: 3 }
        ];

        mockDbConnection.all.mockResolvedValue(mockPaths);

        const result = await graphStore.findPaths(projectId, 'a', 'd', { maxDepth: 5 });

        expect(result.paths.length).toBeGreaterThan(1);
      });

      it('should return empty when no path exists', async () => {
        mockDbConnection.all.mockResolvedValue([]);

        const result = await graphStore.findPaths(projectId, 'a', 'disconnected', { maxDepth: 10 });

        expect(result.paths).toHaveLength(0);
      });

      it('should limit number of results', async () => {
        const limit = 10;
        const mockPaths = Array(10).fill(null).map((_, i) => ({
          nodes: ['a', `b${i}`, 'c'],
          edges: [`r${i}a`, `r${i}b`],
          length: 2
        }));

        mockDbConnection.all.mockResolvedValue(mockPaths);

        const result = await graphStore.findPaths(projectId, 'a', 'c', { maxDepth: 5, limit });

        expect(result.paths.length).toBeLessThanOrEqual(limit);
      });
    });

    describe('getGraphStats()', () => {
      it('should return entity count', async () => {
        mockDbConnection.get.mockResolvedValue({ count: 500 });

        const stats = await graphStore.getGraphStats(projectId);

        expect(stats.entityCount).toBe(500);
      });

      it('should return relationship count', async () => {
        mockDbConnection.get
          .mockResolvedValueOnce({ count: 500 })
          .mockResolvedValueOnce({ count: 1200 });

        const stats = await graphStore.getGraphStats(projectId);

        expect(stats.relationshipCount).toBe(1200);
      });

      it('should calculate average degree', async () => {
        mockDbConnection.get
          .mockResolvedValueOnce({ count: 500 })
          .mockResolvedValueOnce({ count: 1200 })
          .mockResolvedValueOnce({ avg_degree: 4.8 });

        const stats = await graphStore.getGraphStats(projectId);

        expect(stats.avgDegree).toBeCloseTo(4.8);
      });

      it('should return complete stats object', async () => {
        mockDbConnection.get
          .mockResolvedValueOnce({ count: 500 })
          .mockResolvedValueOnce({ count: 1200 })
          .mockResolvedValueOnce({ avg_degree: 4.8 })
          .mockResolvedValueOnce({ components: 1 });

        const stats = await graphStore.getGraphStats(projectId);

        expect(stats).toHaveProperty('entityCount');
        expect(stats).toHaveProperty('relationshipCount');
        expect(stats).toHaveProperty('avgDegree');
        expect(stats).toHaveProperty('components');
      });
    });
  });

  // ============================================================================
  // Recursive CTE Tests
  // ============================================================================

  describe('Recursive CTE Queries', () => {
    const projectId = 'proj_123';

    it('should build valid recursive CTE for traversal', async () => {
      mockDbConnection.all.mockResolvedValue([]);

      await graphStore.getNeighborhood(projectId, 'e1', { depth: 2 });

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE'),
        expect.any(Array)
      );
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('UNION ALL'),
        expect.any(Array)
      );
    });

    it('should prevent infinite loops with path checking', async () => {
      mockDbConnection.all.mockResolvedValue([]);

      await graphStore.getNeighborhood(projectId, 'e1', { depth: 5 });

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('NOT LIKE'),
        expect.any(Array)
      );
    });

    it('should track path for debugging', async () => {
      const mockResults = [
        { path: 'a->b->c', depth: 2 },
        { path: 'a->d->e->c', depth: 3 }
      ];

      mockDbConnection.all.mockResolvedValue(mockResults);

      const results = await graphStore.getNeighborhood(projectId, 'a', { depth: 3 });

      results.forEach((r: any) => {
        const nodeCount = r.path.split('->').length;
        expect(nodeCount).toBe(r.depth + 1);
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    const projectId = 'proj_123';

    it('should handle isolated entity (no relationships)', async () => {
      mockDbConnection.all.mockResolvedValue([]);

      const results = await graphStore.getNeighborhood(projectId, 'isolated_entity', { depth: 1 });

      expect(results).toHaveLength(0);
    });

    it('should handle entity with self-loop', async () => {
      const mockSelfLoop = [
        { source_id: 'e1', target_id: 'e1', type: 'SELF_REF' }
      ];

      mockDbConnection.all.mockResolvedValue(mockSelfLoop);

      const results = await graphStore.getRelationships(projectId, 'e1');

      expect(results).toHaveLength(1);
      expect(results[0].source_id).toBe(results[0].target_id);
    });

    it('should handle very deep traversal', async () => {
      const maxDepth = 10;
      const mockDeepResults = Array(maxDepth).fill(null).map((_, i) => ({
        entity_id: `e${i + 1}`,
        depth: i + 1
      }));

      mockDbConnection.all.mockResolvedValue(mockDeepResults);

      const results = await graphStore.getNeighborhood(projectId, 'e0', { depth: maxDepth });

      expect(results.length).toBeLessThanOrEqual(maxDepth);
    });

    it('should handle large number of relationships', async () => {
      const largeRelationshipCount = 10000;

      mockDbConnection.get.mockResolvedValue({ count: largeRelationshipCount });

      const stats = await graphStore.getGraphStats(projectId);

      expect(stats.relationshipCount).toBe(largeRelationshipCount);
    });

    it('should handle non-existent entity gracefully', async () => {
      mockDbConnection.get.mockResolvedValue(undefined);

      const result = await graphStore.getEntity(projectId, 'non_existent');

      expect(result).toBeUndefined();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    const projectId = 'proj_123';

    it('should use indexed columns for traversal', async () => {
      mockDbConnection.all.mockResolvedValue([]);

      await graphStore.getNeighborhood(projectId, 'e1', { depth: 1 });

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('source_id'),
        expect.any(Array)
      );
    });

    it('should limit traversal results', async () => {
      const limit = 100;
      const mockResults = Array(100).fill({ entity_id: 'e1' });

      mockDbConnection.all.mockResolvedValue(mockResults);

      const results = await graphStore.getNeighborhood(projectId, 'e0', { depth: 3, limit });

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should support pagination for large subgraphs', async () => {
      const pageSize = 50;
      const offset = 100;
      const mockResults = Array(50).fill({ entity_id: 'e1' });

      mockDbConnection.all.mockResolvedValue(mockResults);

      const results = await graphStore.getNeighborhood(projectId, 'e0', {
        depth: 3,
        limit: pageSize,
        offset
      });

      expect(results.length).toBeLessThanOrEqual(pageSize);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([pageSize, offset])
      );
    });
  });

  // ============================================================================
  // Graph Operations Tests
  // ============================================================================

  describe('Graph Operations', () => {
    const projectId = 'proj_123';

    it('should get incoming relationships', async () => {
      const mockIncoming = [
        { source_id: 'e1', target_id: 'e_target', type: 'CALLS' },
        { source_id: 'e2', target_id: 'e_target', type: 'IMPORTS' }
      ];

      mockDbConnection.all.mockResolvedValue(mockIncoming);

      const incoming = await graphStore.getIncomingRelationships(projectId, 'e_target');

      expect(incoming).toHaveLength(2);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('target_id'),
        expect.arrayContaining(['e_target'])
      );
    });

    it('should get outgoing relationships', async () => {
      const mockOutgoing = [
        { source_id: 'e_source', target_id: 'e1', type: 'CALLS' },
        { source_id: 'e_source', target_id: 'e2', type: 'CALLS' }
      ];

      mockDbConnection.all.mockResolvedValue(mockOutgoing);

      const outgoing = await graphStore.getOutgoingRelationships(projectId, 'e_source');

      expect(outgoing).toHaveLength(2);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('source_id'),
        expect.arrayContaining(['e_source'])
      );
    });

    it('should filter relationships by type', async () => {
      const mockCalls = [
        { type: 'CALLS' },
        { type: 'CALLS' }
      ];

      mockDbConnection.all.mockResolvedValue(mockCalls);

      const calls = await graphStore.getRelationshipsByType(projectId, 'CALLS');

      expect(calls.every((r: any) => r.type === 'CALLS')).toBe(true);
    });

    it('should order by relationship weight', async () => {
      const mockWeighted = [
        { target_id: 'e1', weight: 0.9 },
        { target_id: 'e2', weight: 0.7 },
        { target_id: 'e3', weight: 0.5 }
      ];

      mockDbConnection.all.mockResolvedValue(mockWeighted);

      const results = await graphStore.getRelationships(projectId, 'e0', { orderByWeight: true });

      expect(results[0].weight).toBeGreaterThan(results[1].weight);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY weight DESC'),
        expect.any(Array)
      );
    });
  });
});
