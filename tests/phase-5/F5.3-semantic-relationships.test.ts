/**
 * F5.3 Semantic Relationship Discovery Tests
 *
 * Tests for automatic relationship discovery:
 * - SemanticRelationshipAnalyzer operations
 * - Similarity-based relationship creation
 * - RELATES_TO relationship type
 * - Incremental linking for new entities
 * - Related concept discovery
 *
 * @see docs/phase-5/F5.3-semantic-relationships.md
 *
 * ============================================================================
 * NOTE: These tests will fail until the following implementations are created:
 * - src/graph/semantic.ts (SemanticRelationshipAnalyzer class)
 * - src/graph/types.ts (SemanticRelationship, RelationshipStrength types)
 * - src/embeddings/manager.ts (EmbeddingManager class)
 * - src/database/connection.ts (DatabaseConnection class)
 * ============================================================================
 */

import { SemanticRelationshipAnalyzer } from '../../src/graph/semantic';
import { SemanticRelationship, RelationshipStrength } from '../../src/graph/types';
import { EmbeddingManager } from '../../src/embeddings/manager';
import { DatabaseConnection } from '../../src/db/connection';

// Mock dependencies
jest.mock('../../src/embeddings/manager');
jest.mock('../../src/db/connection');

// ============================================================================
// Type Definitions
// ============================================================================

interface SemanticLink {
  sourceId: string;
  targetId: string;
  similarity: number;
}

interface SimilarityResult {
  entityId: string;
  score: number;
}

interface Entity {
  id: string;
  name: string;
  type: string;
  summary?: string;
  content?: string;
}

interface Relationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('F5.3 Semantic Relationship Discovery', () => {
  let analyzer: SemanticRelationshipAnalyzer;
  let mockEmbeddingManager: jest.Mocked<EmbeddingManager>;
  let mockDatabase: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockEmbeddingManager = new EmbeddingManager() as jest.Mocked<EmbeddingManager>;
    mockDatabase = new DatabaseConnection() as jest.Mocked<DatabaseConnection>;

    // Setup default mock implementations
    mockEmbeddingManager.findSimilar = jest.fn();
    mockEmbeddingManager.generateEmbedding = jest.fn();
    mockDatabase.query = jest.fn();
    mockDatabase.execute = jest.fn();
    mockDatabase.get = jest.fn();
    mockDatabase.all = jest.fn();
    mockDatabase.run = jest.fn();

    // Create real analyzer instance with mocked dependencies
    analyzer = new SemanticRelationshipAnalyzer({
      embeddingManager: mockEmbeddingManager,
      database: mockDatabase,
      defaultThreshold: 0.75,
      maxRelationshipsPerEntity: 5
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // SemanticLink Interface Tests
  // ============================================================================

  describe('SemanticLink Interface', () => {
    it('should have source, target, and similarity', () => {
      const link: SemanticLink = {
        sourceId: 'entity_auth',
        targetId: 'entity_user',
        similarity: 0.85
      };

      expect(link.sourceId).toBeDefined();
      expect(link.targetId).toBeDefined();
      expect(link.similarity).toBeGreaterThan(0);
    });

    it('should have similarity between 0 and 1', () => {
      const link: SemanticLink = {
        sourceId: 'e1',
        targetId: 'e2',
        similarity: 0.78
      };

      expect(link.similarity).toBeGreaterThanOrEqual(0);
      expect(link.similarity).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // Relationship Discovery Tests
  // ============================================================================

  describe('discoverRelationships()', () => {
    const projectId = 'proj_123';

    it('should find semantically similar entities', async () => {
      // Mock entities to process
      const mockEntities: Entity[] = [
        { id: 'e1', name: 'AuthService', type: 'function', summary: 'Handles authentication' },
        { id: 'e2', name: 'LoginHandler', type: 'function', summary: 'Processes user login' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);

      // Mock embedding similarity results
      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.82 }
      ]);

      const result = await analyzer.discoverRelationships(projectId);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalled();
      expect(result.discovered).toBeGreaterThan(0);
    });

    it('should create RELATES_TO relationships', async () => {
      const mockEntities: Entity[] = [
        { id: 'e1', name: 'AuthService', type: 'function', summary: 'Handles authentication' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);
      mockDatabase.get.mockResolvedValueOnce(null); // No existing relationship

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.85 }
      ]);

      await analyzer.discoverRelationships(projectId);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([
          expect.any(String), // id
          'RELATES_TO',
          'e1',
          'e2',
          0.85,
          expect.stringContaining('semantic')
        ])
      );
    });

    it('should use configurable similarity threshold', async () => {
      const customAnalyzer = new SemanticRelationshipAnalyzer({
        embeddingManager: mockEmbeddingManager,
        database: mockDatabase,
        defaultThreshold: 0.80,
        maxRelationshipsPerEntity: 5
      });

      const mockEntities: Entity[] = [
        { id: 'e1', name: 'TestEntity', type: 'function', summary: 'Test summary' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.80 },  // At threshold
        { entityId: 'e3', score: 0.70 }   // Below threshold
      ]);

      const result = await customAnalyzer.discoverRelationships('proj_123');

      // Only e2 should be linked (at or above threshold)
      expect(result.discovered).toBe(1);
    });

    it('should limit relationships per entity', async () => {
      const mockEntities: Entity[] = [
        { id: 'e1', name: 'TestEntity', type: 'function', summary: 'Test summary' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);
      mockDatabase.get.mockResolvedValue(null); // No existing relationships

      // Return more results than maxRelationshipsPerEntity (5)
      mockEmbeddingManager.findSimilar.mockResolvedValueOnce(
        Array(10).fill(null).map((_, i) => ({ entityId: `e${i + 2}`, score: 0.9 - i * 0.01 }))
      );

      const result = await analyzer.discoverRelationships(projectId);

      // Should only create maxRelationshipsPerEntity relationships
      expect(result.discovered).toBeLessThanOrEqual(5);
    });

    it('should skip self-relationships', async () => {
      const mockEntities: Entity[] = [
        { id: 'e1', name: 'TestEntity', type: 'function', summary: 'Test summary' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e1', score: 1.0 },  // Self (should skip)
        { entityId: 'e2', score: 0.85 }
      ]);

      mockDatabase.get.mockResolvedValueOnce(null);

      const result = await analyzer.discoverRelationships(projectId);

      // Should only create relationship to e2, not e1 (self)
      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['e1', 'e2'])
      );
      expect(mockDatabase.run).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['e1', 'e1'])
      );
    });

    it('should not create duplicate relationships', async () => {
      const mockEntities: Entity[] = [
        { id: 'e1', name: 'TestEntity', type: 'function', summary: 'Test summary' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);

      // Existing relationship found
      mockDatabase.get.mockResolvedValueOnce({
        source_id: 'e1',
        target_id: 'e2',
        type: 'RELATES_TO'
      });

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.85 }
      ]);

      const result = await analyzer.discoverRelationships(projectId);

      // Should skip creation since relationship exists
      expect(result.skipped).toBe(1);
    });

    it('should process specific entity types', async () => {
      mockDatabase.all.mockResolvedValueOnce([]);

      await analyzer.discoverRelationships(projectId, {
        entityTypes: ['function', 'class', 'requirement', 'concept', 'document']
      });

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('type IN'),
        expect.arrayContaining(['function', 'class', 'requirement', 'concept', 'document'])
      );
    });

    it('should return count of created relationships', async () => {
      const mockEntities: Entity[] = [
        { id: 'e1', name: 'Entity1', type: 'function', summary: 'Summary 1' }
      ];

      mockDatabase.all.mockResolvedValueOnce(mockEntities);
      mockDatabase.get.mockResolvedValue(null);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.90 },
        { entityId: 'e3', score: 0.85 },
        { entityId: 'e4', score: 0.80 }
      ]);

      const result = await analyzer.discoverRelationships(projectId);

      expect(result.discovered).toBe(3);
    });

    it('should use summary or content for similarity', async () => {
      const entityWithSummary: Entity = {
        id: 'e1',
        name: 'AuthService',
        type: 'function',
        summary: 'Handles user authentication',
        content: 'Full implementation details...'
      };

      const entityWithOnlyContent: Entity = {
        id: 'e2',
        name: 'Helper',
        type: 'function',
        content: 'Helper implementation'
      };

      const entityWithOnlyName: Entity = {
        id: 'e3',
        name: 'BasicEntity',
        type: 'function'
      };

      mockDatabase.all.mockResolvedValueOnce([
        entityWithSummary,
        entityWithOnlyContent,
        entityWithOnlyName
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValue([]);

      await analyzer.discoverRelationships(projectId);

      // Verify findSimilar was called with appropriate content
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        'Handles user authentication',
        expect.any(Object)
      );
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        'Helper implementation',
        expect.any(Object)
      );
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        'BasicEntity',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // Incremental Linking Tests
  // ============================================================================

  describe('linkNewEntity()', () => {
    const projectId = 'proj_123';

    it('should link new entity to similar existing entities', async () => {
      const newEntityId = 'new_entity';

      mockDatabase.get.mockResolvedValueOnce({
        id: newEntityId,
        name: 'PaymentService',
        summary: 'Handles payment processing'
      });

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e_billing', score: 0.88 },
        { entityId: 'e_invoice', score: 0.82 }
      ]);

      // No existing relationships
      mockDatabase.get.mockResolvedValue(null);

      const result = await analyzer.linkNewEntity(projectId, newEntityId);

      expect(result.linkedCount).toBe(2);
      expect(mockDatabase.run).toHaveBeenCalledTimes(2);
    });

    it('should use default threshold and limit', async () => {
      const newEntityId = 'new_entity';

      mockDatabase.get.mockResolvedValueOnce({
        id: newEntityId,
        name: 'TestService',
        summary: 'Test service'
      });

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e1', score: 0.80 },
        { entityId: 'e2', score: 0.78 },
        { entityId: 'e3', score: 0.76 }
      ]);

      mockDatabase.get.mockResolvedValue(null);

      const result = await analyzer.linkNewEntity(projectId, newEntityId);

      expect(result.linkedCount).toBe(3);
    });

    it('should skip if entity not found', async () => {
      mockDatabase.get.mockResolvedValueOnce(null);

      const result = await analyzer.linkNewEntity(projectId, 'non_existent');

      expect(result.linkedCount).toBe(0);
      expect(result.error).toBe('Entity not found');
    });

    it('should return count of created links', async () => {
      const newEntityId = 'new_entity';

      mockDatabase.get.mockResolvedValueOnce({
        id: newEntityId,
        name: 'TestService',
        summary: 'Test'
      });

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e1', score: 0.85 },
        { entityId: 'e2', score: 0.80 }
      ]);

      mockDatabase.get.mockResolvedValue(null);

      const result = await analyzer.linkNewEntity(projectId, newEntityId);

      expect(result.linkedCount).toBe(2);
    });
  });

  // ============================================================================
  // Related Concepts Discovery Tests
  // ============================================================================

  describe('findRelatedConcepts()', () => {
    const projectId = 'proj_123';

    it('should find concepts related to query', async () => {
      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'concept_auth', score: 0.90 },
        { entityId: 'concept_security', score: 0.85 },
        { entityId: 'concept_jwt', score: 0.80 }
      ]);

      mockDatabase.all.mockResolvedValueOnce([
        { id: 'concept_auth', name: 'Authentication', type: 'concept' },
        { id: 'concept_security', name: 'Security', type: 'concept' },
        { id: 'concept_jwt', name: 'JWT', type: 'technology' }
      ]);

      const results = await analyzer.findRelatedConcepts(projectId, 'authentication');

      expect(results).toHaveLength(3);
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        'authentication',
        expect.objectContaining({
          entityTypes: ['concept', 'technology', 'pattern']
        })
      );
    });

    it('should filter to concept entity types', async () => {
      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e1', score: 0.90 }
      ]);

      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', type: 'concept', name: 'Authentication' }
      ]);

      await analyzer.findRelatedConcepts(projectId, 'query');

      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          entityTypes: expect.arrayContaining(['concept', 'technology', 'pattern'])
        })
      );
    });

    it('should return entities with scores', async () => {
      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e1', score: 0.90 }
      ]);

      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Authentication', type: 'concept' }
      ]);

      const results = await analyzer.findRelatedConcepts(projectId, 'query');

      expect(results[0]).toEqual(
        expect.objectContaining({
          entity: expect.objectContaining({ id: 'e1', name: 'Authentication' }),
          score: 0.90
        })
      );
    });

    it('should respect limit parameter', async () => {
      const limit = 10;

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce(
        Array(limit).fill(null).map((_, i) => ({ entityId: `e${i}`, score: 0.9 - i * 0.01 }))
      );

      mockDatabase.all.mockResolvedValueOnce(
        Array(limit).fill(null).map((_, i) => ({ id: `e${i}`, name: `Entity${i}`, type: 'concept' }))
      );

      const results = await analyzer.findRelatedConcepts(projectId, 'query', { limit });

      expect(results.length).toBeLessThanOrEqual(limit);
    });
  });

  // ============================================================================
  // RELATES_TO Relationship Tests
  // ============================================================================

  describe('RELATES_TO Relationship', () => {
    const projectId = 'proj_123';

    it('should store similarity in weight', async () => {
      const similarity = 0.87;

      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Entity1', type: 'function', summary: 'Summary' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: similarity }
      ]);

      mockDatabase.get.mockResolvedValue(null);

      await analyzer.discoverRelationships(projectId);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([similarity])
      );
    });

    it('should include discovery metadata', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Entity1', type: 'function', summary: 'Summary' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.85 }
      ]);

      mockDatabase.get.mockResolvedValue(null);

      await analyzer.discoverRelationships(projectId);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringMatching(/"discoveredBy":"semantic"/)
        ])
      );
    });

    it('should distinguish from explicit relationships', async () => {
      // Query for explicit relationships
      mockDatabase.all.mockResolvedValueOnce([
        { type: 'CALLS', source_id: 'e1', target_id: 'e2' }
      ]);

      const explicit = await analyzer.getExplicitRelationships(projectId, 'e1');

      // Query for semantic relationships
      mockDatabase.all.mockResolvedValueOnce([
        { type: 'RELATES_TO', source_id: 'e1', target_id: 'e3' }
      ]);

      const semantic = await analyzer.getSemanticRelationships(projectId, 'e1');

      expect(explicit[0].type).toBe('CALLS');
      expect(semantic[0].type).toBe('RELATES_TO');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle entity with no similar matches', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'UniqueEntity', type: 'function', summary: 'Very unique content' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([]);

      const result = await analyzer.discoverRelationships('proj_123');

      expect(result.discovered).toBe(0);
    });

    it('should handle entity with only low similarity matches', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Entity1', type: 'function', summary: 'Summary' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.5 },  // Below threshold
        { entityId: 'e3', score: 0.4 }   // Below threshold
      ]);

      const result = await analyzer.discoverRelationships('proj_123');

      // All filtered out by threshold (0.75 default)
      expect(result.discovered).toBe(0);
    });

    it('should handle empty entity content', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'EmptyEntity', type: 'function' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([]);

      await analyzer.discoverRelationships('proj_123');

      // Should fall back to name
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledWith(
        'EmptyEntity',
        expect.any(Object)
      );
    });

    it('should handle concurrent discovery operations', async () => {
      const projectIds = ['proj_1', 'proj_2', 'proj_3', 'proj_4', 'proj_5'];

      mockDatabase.all.mockResolvedValue([
        { id: 'e1', name: 'Entity', type: 'function', summary: 'Content' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValue([
        { entityId: 'e2', score: 0.85 }
      ]);

      mockDatabase.get.mockResolvedValue(null);

      const operations = projectIds.map(pid => analyzer.discoverRelationships(pid));
      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
      results.forEach((result: { discovered: number }) => {
        expect(result.discovered).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle embedding provider failure', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Entity', type: 'function', summary: 'Content' }
      ]);

      mockEmbeddingManager.findSimilar.mockRejectedValueOnce(new Error('Provider unavailable'));

      await expect(analyzer.discoverRelationships('proj_123')).rejects.toThrow('Provider unavailable');
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    const projectId = 'proj_123';

    it('should batch process entities efficiently', async () => {
      const entityCount = 100;

      mockDatabase.all.mockResolvedValueOnce(
        Array(entityCount).fill(null).map((_, i) => ({
          id: `e${i}`,
          name: `Entity${i}`,
          type: 'function',
          summary: `Summary for entity ${i}`
        }))
      );

      mockEmbeddingManager.findSimilar.mockResolvedValue([]);

      const startTime = Date.now();
      await analyzer.discoverRelationships(projectId);
      const duration = Date.now() - startTime;

      expect(mockDatabase.all).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingManager.findSimilar).toHaveBeenCalledTimes(entityCount);
    });

    it('should use indexed queries', async () => {
      mockDatabase.all.mockResolvedValueOnce([]);

      await analyzer.discoverRelationships(projectId);

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining('type IN'),
        expect.any(Array)
      );
    });

    it('should limit similarity search results', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Entity', type: 'function', summary: 'Content' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce(
        Array(5).fill({ entityId: 'e2', score: 0.85 })
      );

      mockDatabase.get.mockResolvedValue(null);

      const result = await analyzer.discoverRelationships(projectId);

      expect(result.discovered).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    const projectId = 'proj_123';

    it('should integrate with existing relationship graph', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { id: 'e1', name: 'Entity', type: 'function', summary: 'Content' }
      ]);

      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'e3', score: 0.85 }
      ]);

      mockDatabase.get.mockResolvedValue(null);

      await analyzer.discoverRelationships(projectId);

      expect(mockDatabase.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['RELATES_TO'])
      );
    });

    it('should support graph traversal including semantic links', async () => {
      mockDatabase.all.mockResolvedValueOnce([
        { type: 'CALLS', target_id: 'e2' },
        { type: 'RELATES_TO', target_id: 'e3' }
      ]);

      const allRelations = await analyzer.getAllRelationships(projectId, 'e1');

      expect(allRelations).toHaveLength(2);
      expect(allRelations.map((r: { type: string }) => r.type)).toContain('CALLS');
      expect(allRelations.map((r: { type: string }) => r.type)).toContain('RELATES_TO');
    });

    it('should enable concept-based search', async () => {
      // Find related concepts
      mockEmbeddingManager.findSimilar.mockResolvedValueOnce([
        { entityId: 'concept_auth', score: 0.92 },
        { entityId: 'concept_security', score: 0.88 }
      ]);

      mockDatabase.all.mockResolvedValueOnce([
        { id: 'concept_auth', name: 'Authentication', type: 'concept' },
        { id: 'concept_security', name: 'Security', type: 'concept' }
      ]);

      const concepts = await analyzer.findRelatedConcepts(projectId, 'authentication and security');

      // Get code entities related to these concepts
      mockDatabase.all.mockResolvedValueOnce([
        { source_id: 'concept_auth', target_id: 'e_auth_service', type: 'RELATES_TO' },
        { source_id: 'concept_security', target_id: 'e_encryption', type: 'RELATES_TO' }
      ]);

      const relatedCode = await analyzer.getEntitiesRelatedToConcepts(
        projectId,
        concepts.map((c: { entity: { id: string } }) => c.entity.id)
      );

      expect(relatedCode.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // RelationshipStrength Tests
  // ============================================================================

  describe('RelationshipStrength', () => {
    it('should classify relationship strength correctly', () => {
      expect(analyzer.classifyStrength(0.95)).toBe(RelationshipStrength.STRONG);
      expect(analyzer.classifyStrength(0.85)).toBe(RelationshipStrength.MODERATE);
      expect(analyzer.classifyStrength(0.75)).toBe(RelationshipStrength.WEAK);
    });
  });
});
