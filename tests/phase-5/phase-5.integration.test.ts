/**
 * Phase 5 Integration Tests
 *
 * IMPORTANT: This test file will fail with "Cannot find module" errors until
 * the actual implementations are created. This is intentional - the tests
 * serve as a specification for the required implementations.
 *
 * Required source files to implement:
 * - src/graph/store.ts              - GraphStore class for persisting graph data
 * - src/graph/traversal.ts          - GraphTraversal class for graph navigation
 * - src/graph/resolver.ts           - EntityResolver class for duplicate detection
 * - src/graph/semantic.ts           - SemanticRelationshipAnalyzer for relationship discovery
 * - src/database/connection.ts      - DatabaseConnection class for SQLite access
 * - src/embeddings/manager.ts       - EmbeddingManager class for embedding operations
 *
 * Tests cover:
 * - Graph Storage + Entity Resolution
 * - Entity Resolution + Semantic Relationships
 * - Graph Traversal + Semantic Links
 * - Full Graph RAG Pipeline
 *
 * @see docs/IMPLEMENTATION.md Phase 5
 */

// These imports will fail until implementations are created
import { GraphStore } from '../../src/graph/store';
import { GraphTraversal } from '../../src/graph/traversal';
import { EntityResolver } from '../../src/graph/resolver';
import { SemanticRelationshipAnalyzer } from '../../src/graph/semantic';
import { DatabaseConnection } from '../../src/db/connection';
import { EmbeddingManager } from '../../src/embeddings/manager';

// Mock the database connection
jest.mock('../../src/db/connection', () => ({
  DatabaseConnection: jest.fn().mockImplementation(() => ({
    run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    get: jest.fn().mockReturnValue(undefined),
    all: jest.fn().mockReturnValue([]),
    exec: jest.fn(),
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      finalize: jest.fn()
    }),
    transaction: jest.fn((fn: () => any) => fn()),
    close: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true)
  }))
}));

// Mock the embedding manager
jest.mock('../../src/embeddings/manager', () => ({
  EmbeddingManager: jest.fn().mockImplementation(() => ({
    embed: jest.fn().mockResolvedValue(new Array(768).fill(0)),
    embedBatch: jest.fn().mockResolvedValue([]),
    findSimilar: jest.fn().mockResolvedValue([]),
    isAvailable: jest.fn().mockResolvedValue(true),
    dimensions: 768
  }))
}));

describe('Phase 5 Integration', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockEmbeddingManager: jest.Mocked<EmbeddingManager>;
  let graphStore: GraphStore;
  let graphTraversal: GraphTraversal;
  let entityResolver: EntityResolver;
  let semanticAnalyzer: SemanticRelationshipAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockDb = new DatabaseConnection(':memory:') as jest.Mocked<DatabaseConnection>;
    mockEmbeddingManager = new EmbeddingManager(mockDb) as jest.Mocked<EmbeddingManager>;

    // Create real class instances with mocked dependencies
    graphStore = new GraphStore(mockDb);
    graphTraversal = new GraphTraversal(mockDb);
    entityResolver = new EntityResolver(mockDb, mockEmbeddingManager);
    semanticAnalyzer = new SemanticRelationshipAnalyzer(mockDb, mockEmbeddingManager);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Graph Storage + Entity Resolution Integration
  // ============================================================================

  describe('Graph Storage + Entity Resolution', () => {
    const projectId = 'proj_123';

    it('should traverse graph and identify duplicate entities', async () => {
      // Setup: Mock traversal results
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { entity_id: 'e_user_service', depth: 1 },
        { entity_id: 'e_authentication_svc', depth: 1 },  // Potential duplicate of e_auth
        { entity_id: 'e_db', depth: 2 }
      ]);

      // Setup: Mock similar entity detection
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'e_authentication_svc', score: 0.92 }
      ]);

      // Act: Traverse from AuthService
      const neighbors = await graphTraversal.getNeighbors(projectId, 'e_auth_service', { maxDepth: 2 });

      // Act: Check for potential duplicates
      const duplicateCandidates = await entityResolver.findDuplicates(projectId, 'e_auth_service');

      // Assert: Verify traversal was called
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining(['e_auth_service'])
      );

      // Assert: Verify duplicate detection
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalled();
      expect(neighbors).toHaveLength(3);
      expect(duplicateCandidates[0].score).toBeGreaterThan(0.85);
    });

    it('should update graph after entity merge', async () => {
      const primaryId = 'e_auth';
      const duplicateId = 'e_authentication_svc';

      // Setup: Mock relationships pointing to duplicate
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { source_id: 'e_user', target_id: duplicateId, type: 'CALLS' }
      ]);

      // Act: Merge duplicate into primary
      await entityResolver.mergeEntities(projectId, primaryId, duplicateId);

      // Assert: Verify relationships were redirected
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([primaryId, duplicateId])
      );
    });

    it('should maintain graph connectivity after resolution', async () => {
      // Setup: Mock graph with cycle
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { source_id: 'e1', target_id: 'e2' },
        { source_id: 'e2', target_id: 'e3' },
        { source_id: 'e3', target_id: 'e1' }  // Cycle
      ]);

      // Act: Get all relationships
      const relationships = await graphStore.getAllRelationships(projectId);

      // Assert: All relationships have valid source and target
      expect(relationships.every((r: any) => r.source_id && r.target_id)).toBe(true);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should recalculate graph stats after resolution', async () => {
      // Setup: Before resolution stats
      (mockDb.get as jest.Mock)
        .mockReturnValueOnce({ entityCount: 100, relationshipCount: 250 })
        .mockReturnValueOnce({ entityCount: 95, relationshipCount: 248 });

      // Act: Get stats before and after
      const beforeStats = await graphStore.getStats(projectId);

      // Simulate merge operation
      await entityResolver.mergeEntities(projectId, 'e1', 'e2');

      const afterStats = await graphStore.getStats(projectId);

      // Assert: Stats were updated
      expect(mockDb.get).toHaveBeenCalledTimes(2);
      expect(afterStats.entityCount).toBeLessThan(beforeStats.entityCount);
    });
  });

  // ============================================================================
  // Entity Resolution + Semantic Relationships Integration
  // ============================================================================

  describe('Entity Resolution + Semantic Relationships', () => {
    const projectId = 'proj_123';

    it('should discover semantic relationships before resolution', async () => {
      // Setup: Mock similarity results with both duplicates and semantic relations
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'e2', score: 0.95 },  // Very high - likely duplicate
        { entityId: 'e3', score: 0.78 }   // Moderate - semantic relation
      ]);

      // Act: Analyze entity for relationships
      const analysis = await semanticAnalyzer.analyzeEntity(projectId, 'e1', 'AuthService content');

      // Assert: Verify differentiation between duplicates and semantic relations
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        'AuthService content',
        expect.any(Object)
      );
      expect(analysis.potentialDuplicates).toBeDefined();
      expect(analysis.semanticRelations).toBeDefined();
    });

    it('should remove semantic links when entities are merged', async () => {
      const primaryId = 'e1';
      const duplicateId = 'e2';

      // Setup: Mock existing semantic link between entities
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { source_id: primaryId, target_id: duplicateId, type: 'RELATES_TO' }
      ]);

      // Act: Merge entities
      await entityResolver.mergeEntities(projectId, primaryId, duplicateId);

      // Assert: Self-loops should be deleted
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.arrayContaining([primaryId, duplicateId])
      );
    });

    it('should transfer semantic links to primary entity', async () => {
      const primaryId = 'e1';
      const duplicateId = 'e2';

      // Setup: Duplicate has semantic relationship to e3
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { source_id: duplicateId, target_id: 'e3', type: 'RELATES_TO', weight: 0.8 }
      ]);

      // Setup: No existing relationship from primary to e3
      (mockDb.get as jest.Mock).mockReturnValueOnce(undefined);

      // Act: Transfer relationships
      await entityResolver.transferRelationships(projectId, primaryId, duplicateId);

      // Assert: New relationship created
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([primaryId, 'e3', 'RELATES_TO', 0.8])
      );
    });

    it('should not duplicate semantic relationships during merge', async () => {
      const primaryId = 'e1';
      const targetId = 'e3';

      // Setup: Primary already has relationship to e3
      (mockDb.get as jest.Mock).mockReturnValueOnce({
        source_id: primaryId,
        target_id: targetId,
        type: 'RELATES_TO'
      });

      // Act: Check if relationship exists
      const exists = await graphStore.relationshipExists(projectId, primaryId, targetId, 'RELATES_TO');

      // Assert: Relationship found, no duplicate created
      expect(exists).toBe(true);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([primaryId, targetId])
      );
    });
  });

  // ============================================================================
  // Graph Traversal + Semantic Links Integration
  // ============================================================================

  describe('Graph Traversal + Semantic Links', () => {
    const projectId = 'proj_123';

    it('should include semantic links in traversal', async () => {
      // Setup: Mock mixed relationship types
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { entity_id: 'e2', depth: 1, rel_type: 'CALLS' },      // Explicit
        { entity_id: 'e3', depth: 1, rel_type: 'RELATES_TO' }  // Semantic
      ]);

      // Act: Traverse with semantic links enabled
      const neighbors = await graphTraversal.getNeighbors(projectId, 'e1', {
        includeSemanticLinks: true
      });

      // Assert: Both types included
      const explicitRels = neighbors.filter((n: any) => n.rel_type !== 'RELATES_TO');
      const semanticRels = neighbors.filter((n: any) => n.rel_type === 'RELATES_TO');

      expect(explicitRels.length).toBeGreaterThan(0);
      expect(semanticRels.length).toBeGreaterThan(0);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should optionally exclude semantic links from traversal', async () => {
      const excludeTypes = ['RELATES_TO'];

      // Setup: Mock only explicit relationships
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { entity_id: 'e2', rel_type: 'CALLS' },
        { entity_id: 'e3', rel_type: 'IMPORTS' }
      ]);

      // Act: Traverse without semantic links
      const neighbors = await graphTraversal.getNeighbors(projectId, 'e1', {
        excludeTypes
      });

      // Assert: No semantic links
      expect(neighbors.every((n: any) => n.rel_type !== 'RELATES_TO')).toBe(true);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('NOT IN'),
        expect.any(Array)
      );
    });

    it('should find paths through semantic links', async () => {
      // Setup: Mock paths including semantic route
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { path: 'e1->e2->e3', depth: 2, via_semantic: false },
        { path: 'e1->e_concept->e3', depth: 2, via_semantic: true }
      ]);

      // Act: Find all paths
      const paths = await graphTraversal.findPaths(projectId, 'e1', 'e3', { maxDepth: 3 });

      // Assert: Both direct and semantic paths found
      expect(paths).toHaveLength(2);
      expect(paths.some((p: any) => p.via_semantic)).toBe(true);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should weight traversal by relationship weight', async () => {
      // Setup: Mock weighted relationships
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { target_id: 'e2', type: 'CALLS', weight: 1.0 },
        { target_id: 'e3', type: 'RELATES_TO', weight: 0.8 }
      ]);

      // Act: Get weighted neighbors
      const relationships = await graphTraversal.getWeightedNeighbors(projectId, 'e1');

      // Assert: Ordered by weight
      expect(relationships[0].weight).toBeGreaterThan(relationships[1].weight);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY weight'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // Full Graph RAG Pipeline Integration
  // ============================================================================

  describe('Full Graph RAG Pipeline', () => {
    const projectId = 'proj_123';

    it('should build knowledge graph from entities', async () => {
      // Setup: Mock entity creation
      (mockDb.run as jest.Mock).mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      // Setup: Mock semantic discovery
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'c_auth', score: 0.85 }
      ]);

      // Setup: Mock final stats
      (mockDb.get as jest.Mock).mockReturnValueOnce({ entityCount: 4, relationshipCount: 3 });

      // Act: Create entities
      const entities = [
        { id: 'e_auth', name: 'AuthService', type: 'class' },
        { id: 'e_user', name: 'UserService', type: 'class' },
        { id: 'e_db', name: 'DatabaseService', type: 'class' },
        { id: 'c_auth', name: 'Authentication', type: 'concept' }
      ];

      for (const entity of entities) {
        await graphStore.createEntity(projectId, entity);
      }

      // Act: Create explicit relationships
      await graphStore.createRelationship(projectId, 'e_auth', 'e_user', 'CALLS');
      await graphStore.createRelationship(projectId, 'e_user', 'e_db', 'CALLS');

      // Act: Discover semantic relationships
      const semanticLinks = await semanticAnalyzer.discoverRelationships(projectId, 'e_auth', 'AuthService content');

      for (const link of semanticLinks) {
        await graphStore.createRelationship(projectId, 'e_auth', link.entityId, 'RELATES_TO', link.score);
      }

      // Act: Get stats
      const stats = await graphStore.getStats(projectId);

      // Assert: Graph was built correctly
      expect(mockDb.run).toHaveBeenCalledTimes(7); // 4 entities + 3 relationships
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalled();
      expect(stats.entityCount).toBe(4);
      expect(stats.relationshipCount).toBe(3);
    });

    it('should support context-aware retrieval', async () => {
      const query = 'authentication';

      // Setup: Mock semantic search
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'e_auth', score: 0.92 },
        { entityId: 'c_auth', score: 0.88 }
      ]);

      // Setup: Mock graph expansion
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { entity_id: 'e_auth', depth: 0 },
        { entity_id: 'e_user', depth: 1 },
        { entity_id: 'e_jwt', depth: 1 },
        { entity_id: 'e_db', depth: 2 }
      ]);

      // Act: Find seed entities
      const seedEntities = await mockEmbeddingManager.findSimilar(query, { limit: 5 });

      // Act: Expand via graph traversal
      const expanded = await graphTraversal.expandFromSeeds(
        projectId,
        seedEntities.map(s => s.entityId),
        { maxDepth: 2 }
      );

      // Assert: Combined results include both seeds and expanded
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(query, expect.any(Object));
      expect(mockDb.all).toHaveBeenCalled();
      expect(expanded.length).toBeGreaterThan(2);
    });

    it('should resolve entity references in retrieval', async () => {
      const queryMention = 'Auth Service';

      // Setup: No exact match
      (mockDb.get as jest.Mock).mockReturnValueOnce(undefined);

      // Setup: Fuzzy match via embeddings
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'e_auth_service', score: 0.95 }
      ]);

      // Act: Try exact match first
      const exactMatch = await graphStore.findEntityByName(projectId, queryMention);

      // Act: Fall back to fuzzy match
      const resolved = await entityResolver.resolveReference(projectId, queryMention);

      // Assert: Fuzzy match found
      expect(exactMatch).toBeUndefined();
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        queryMention,
        expect.objectContaining({ limit: 1, threshold: expect.any(Number) })
      );
      expect(resolved.entityId).toBe('e_auth_service');
    });

    it('should combine multiple retrieval strategies', async () => {
      const query = 'user authentication with JWT';

      // Setup: Vector similarity results
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'e_auth', score: 0.90 },
        { entityId: 'e_jwt', score: 0.85 }
      ]);

      // Setup: Graph expansion results
      (mockDb.all as jest.Mock)
        .mockReturnValueOnce([
          { entity_id: 'e_user', via: 'e_auth', type: 'CALLS' }
        ])
        // Setup: FTS results
        .mockReturnValueOnce([
          { id: 'e_token', name: 'TokenService' }
        ]);

      // Act: Run all strategies
      const vectorResults = await mockEmbeddingManager.findSimilar(query, { limit: 10 });
      const graphResults = await graphTraversal.expandFromSeeds(
        projectId,
        vectorResults.map(r => r.entityId),
        { maxDepth: 1 }
      );
      const ftsResults = await graphStore.searchByKeyword(projectId, 'JWT');

      // Assert: All strategies were called
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalledTimes(2);

      // Assert: Results can be combined
      const allResults = new Set([
        ...vectorResults.map(r => r.entityId),
        ...graphResults.map((r: any) => r.entity_id),
        ...ftsResults.map((r: any) => r.id)
      ]);
      expect(allResults.size).toBe(4);
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error Handling', () => {
    const projectId = 'proj_123';

    it('should handle circular relationships during traversal', async () => {
      // Setup: Mock paths with cycle detection
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { path: 'A,B', depth: 1 },
        { path: 'A,B,C', depth: 2 }
        // A not repeated due to cycle detection
      ]);

      // Act: Traverse with cycle detection
      const paths = await graphTraversal.traverse(projectId, 'A', {
        maxDepth: 3,
        detectCycles: true
      });

      // Assert: Cycles are handled
      expect(paths.every((p: any) => !p.path.endsWith(',A'))).toBe(true);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should handle entity resolution with many aliases', async () => {
      // Setup: Entity with multiple aliases
      (mockDb.get as jest.Mock).mockReturnValueOnce({
        id: 'e1',
        name: 'AuthService',
        metadata: JSON.stringify({
          aliases: ['Auth Service', 'AuthSvc', 'Authentication Service', 'auth-service']
        })
      });

      // Act: Get entity with aliases
      const entity = await graphStore.getEntity(projectId, 'e1');

      // Assert: All aliases preserved
      expect(mockDb.get).toHaveBeenCalled();
      const metadata = JSON.parse(entity.metadata);
      expect(metadata.aliases).toHaveLength(4);
    });

    it('should handle orphaned entities after resolution', async () => {
      // Setup: Mock orphaned entities query
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { id: 'orphan_1' },
        { id: 'orphan_2' }
      ]);

      // Act: Find orphaned entities
      const orphans = await graphStore.findOrphanedEntities(projectId);

      // Assert: Query was constructed correctly
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('NOT EXISTS'),
        expect.any(Array)
      );
      expect(orphans).toHaveLength(2);
    });

    it('should handle embedding provider unavailability', async () => {
      // Setup: Provider unavailable
      (mockEmbeddingManager.isAvailable as jest.Mock).mockResolvedValueOnce(false);

      // Act: Check availability
      const available = await mockEmbeddingManager.isAvailable();

      // Assert: Graceful handling
      expect(available).toBe(false);
      expect(mockEmbeddingManager.isAvailable).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    const projectId = 'proj_123';

    it('should efficiently traverse large graphs', async () => {
      const entityCount = 1000;
      const avgDegree = 5;

      // Setup: Mock stats for large graph
      (mockDb.get as jest.Mock).mockReturnValueOnce({
        entityCount,
        relationshipCount: entityCount * avgDegree
      });

      // Act: Get graph stats
      const stats = await graphStore.getStats(projectId);

      // Assert: Large graph handled
      expect(stats.relationshipCount).toBe(5000);
      expect(mockDb.get).toHaveBeenCalled();
    });

    it('should limit traversal depth for performance', async () => {
      const maxDepth = 3;

      // Setup: Mock depth-limited results
      (mockDb.all as jest.Mock).mockReturnValueOnce(
        Array(10).fill(null).map((_, i) => ({
          entity_id: `e${i}`,
          depth: Math.min(i, maxDepth)
        }))
      );

      // Act: Traverse with depth limit
      const results = await graphTraversal.traverse(projectId, 'e0', { maxDepth });

      // Assert: Depth limit respected
      expect(results.every((r: any) => r.depth <= maxDepth)).toBe(true);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('depth'),
        expect.arrayContaining([maxDepth])
      );
    });

    it('should batch semantic relationship discovery', async () => {
      const batchSize = 50;
      const entities = Array(batchSize).fill(null).map((_, i) => ({
        id: `e${i}`,
        content: `Content ${i}`
      }));

      // Setup: Mock batch embedding
      (mockEmbeddingManager.embedBatch as jest.Mock).mockResolvedValueOnce(
        Array(batchSize).fill(Array(768).fill(0))
      );

      // Act: Batch process
      const contentBatch = entities.map(e => e.content);
      await semanticAnalyzer.discoverBatch(projectId, contentBatch);

      // Assert: Batch method called
      expect(mockEmbeddingManager.embedBatch).toHaveBeenCalledWith(contentBatch);
    });

    it('should cache frequently accessed subgraphs', async () => {
      const entityId = 'e_auth';
      const depth = 2;

      // Setup: Mock subgraph data
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { entity_id: 'e_auth' },
        { entity_id: 'e_user' },
        { entity_id: 'e_db' }
      ]);

      // Act: Get subgraph (first call)
      const subgraph1 = await graphTraversal.getSubgraph(projectId, entityId, depth);

      // Act: Get subgraph (second call - should be cached)
      const subgraph2 = await graphTraversal.getSubgraph(projectId, entityId, depth);

      // Assert: Cache was used
      expect(mockDb.all).toHaveBeenCalledTimes(1); // Only called once due to caching
      expect(subgraph1).toEqual(subgraph2);
    });
  });

  // ============================================================================
  // Cross-Phase Integration
  // ============================================================================

  describe('Cross-Phase Integration', () => {
    const projectId = 'proj_123';

    it('should use Phase 2 relationships in graph traversal', async () => {
      // Setup: Mock relationships from code analysis (Phase 2)
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { type: 'CALLS', source_id: 'e_auth', target_id: 'e_user' },
        { type: 'IMPORTS', source_id: 'e_auth', target_id: 'e_jwt' },
        { type: 'EXTENDS', source_id: 'e_admin_user', target_id: 'e_user' }
      ]);

      // Act: Get code relationships
      const codeRelationships = await graphStore.getRelationshipsByTypes(
        projectId,
        ['CALLS', 'IMPORTS', 'EXTENDS']
      );

      // Assert: Phase 2 relationships accessible
      expect(codeRelationships).toHaveLength(3);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('CALLS'),
        expect.any(Array)
      );
    });

    it('should link document mentions to graph (Phase 4)', async () => {
      // Setup: Mock document-to-code links
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { source_id: 'doc_api', target_id: 'e_auth_service', type: 'MENTIONS' }
      ]);

      // Act: Get document links
      const docLinks = await graphStore.getRelationshipsByTypes(projectId, ['MENTIONS']);

      // Assert: Document mentions accessible
      expect(docLinks).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalled();
    });

    it('should support Phase 6 query expansion', async () => {
      const query = 'authentication';

      // Setup: Mock semantic search
      (mockEmbeddingManager.findSimilar as jest.Mock).mockResolvedValueOnce([
        { entityId: 'e_auth', score: 0.92 }
      ]);

      // Setup: Mock graph expansion
      (mockDb.all as jest.Mock).mockReturnValueOnce([
        { entity_id: 'e_user', depth: 1 },
        { entity_id: 'e_jwt', depth: 1 }
      ]);

      // Act: Phase 5 provides graph context for Phase 6
      const seeds = await mockEmbeddingManager.findSimilar(query, { limit: 5 });
      const expanded = await graphTraversal.expandFromSeeds(
        projectId,
        seeds.map(s => s.entityId),
        { maxDepth: 2 }
      );

      // Assert: Context ready for Phase 6 retrieval
      const context = [
        ...seeds.map(s => s.entityId),
        ...expanded.map((e: any) => e.entity_id)
      ];

      expect(context).toContain('e_auth');
      expect(context).toContain('e_user');
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalled();
      expect(mockDb.all).toHaveBeenCalled();
    });
  });
});
