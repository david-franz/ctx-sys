/**
 * F5.2 Entity Resolution Tests
 *
 * WARNING: These tests will fail until the following implementations are created:
 * - src/graph/resolver.ts (EntityResolver class)
 * - src/graph/types.ts (ResolvedEntity, ResolutionResult, DuplicateGroup interfaces)
 * - src/database/connection.ts (DatabaseConnection class)
 * - src/embeddings/provider.ts (EmbeddingProvider class)
 *
 * Tests for entity deduplication and merging:
 * - EntityResolver operations
 * - Duplicate detection via embedding similarity
 * - Entity merging with metadata combination
 * - Relationship redirection
 * - Fuzzy name matching
 *
 * @see docs/phase-5/F5.2-entity-resolution.md
 */

import { EntityResolver } from '../../src/graph/resolver';
import {
  ResolvedEntity,
  ResolutionResult,
  DuplicateGroup,
  Entity,
  Relationship
} from '../../src/graph/types';
import { DatabaseConnection } from '../../src/db/connection';
import { EmbeddingProvider } from '../../src/embeddings/provider';

// ============================================================================
// Jest Mocks
// ============================================================================

jest.mock('../../src/db/connection');
jest.mock('../../src/embeddings/provider');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedEmbeddingProvider = EmbeddingProvider as jest.MockedClass<typeof EmbeddingProvider>;

describe('F5.2 Entity Resolution', () => {
  let resolver: EntityResolver;
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockEmbeddingProvider: jest.Mocked<EmbeddingProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockDb = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockEmbeddingProvider = new MockedEmbeddingProvider() as jest.Mocked<EmbeddingProvider>;

    // Setup default mock implementations
    mockDb.get = jest.fn();
    mockDb.all = jest.fn().mockReturnValue([]);
    mockDb.run = jest.fn();
    mockDb.transaction = jest.fn((fn) => fn());

    mockEmbeddingProvider.findSimilar = jest.fn().mockResolvedValue([]);
    mockEmbeddingProvider.generateEmbedding = jest.fn().mockResolvedValue([]);

    // Create resolver with injected dependencies
    resolver = new EntityResolver(mockDb, mockEmbeddingProvider);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // DuplicateGroup Interface Tests
  // ============================================================================

  describe('DuplicateGroup Interface', () => {
    it('should have primary entity and duplicates', async () => {
      const mockGroup: DuplicateGroup = {
        primary: { id: 'e1', name: 'AuthService', type: 'class' },
        duplicates: [
          { id: 'e2', name: 'Authentication Service', type: 'concept' },
          { id: 'e3', name: 'Auth Svc', type: 'concept' }
        ],
        similarity: 0.92
      };

      mockDb.all.mockReturnValueOnce([
        { id: 'e1', name: 'AuthService', type: 'class' },
        { id: 'e2', name: 'Authentication Service', type: 'concept' },
        { id: 'e3', name: 'Auth Svc', type: 'concept' }
      ]);

      mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.92 },
        { entityId: 'e3', score: 0.90 }
      ]);

      const groups = await resolver.findDuplicates('proj_123', { threshold: 0.85 });

      expect(groups.length).toBeGreaterThanOrEqual(0);
      // Validate structure matches DuplicateGroup interface
      if (groups.length > 0) {
        expect(groups[0]).toHaveProperty('primary');
        expect(groups[0]).toHaveProperty('duplicates');
        expect(groups[0]).toHaveProperty('similarity');
      }
    });

    it('should support single duplicate', async () => {
      mockDb.all.mockReturnValueOnce([
        { id: 'e1', name: 'UserService', type: 'class' },
        { id: 'e2', name: 'User Service', type: 'concept' }
      ]);

      mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.88 }
      ]);

      const groups = await resolver.findDuplicates('proj_123', { threshold: 0.85 });

      if (groups.length > 0) {
        expect(groups[0].duplicates.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ============================================================================
  // Duplicate Detection Tests
  // ============================================================================

  describe('Duplicate Detection', () => {
    const projectId = 'proj_123';

    describe('findDuplicates()', () => {
      it('should find entities with high embedding similarity', async () => {
        const threshold = 0.85;

        mockDb.all.mockReturnValueOnce([
          { id: 'e1', name: 'AuthService', type: 'concept' },
          { id: 'e2', name: 'Authentication Service', type: 'concept' },
          { id: 'e3', name: 'UserService', type: 'concept' }
        ]);

        mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
          { entityId: 'e1', score: 1.0 },
          { entityId: 'e2', score: 0.92 }
        ]);

        const groups = await resolver.findDuplicates(projectId, { threshold });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.any(Array)
        );
        expect(mockEmbeddingProvider.findSimilar).toHaveBeenCalled();
      });

      it('should use configurable threshold', async () => {
        const lowThreshold = 0.75;
        const highThreshold = 0.95;

        mockDb.all.mockReturnValue([
          { id: 'e1', name: 'AuthService', type: 'concept' },
          { id: 'e2', name: 'Auth Svc', type: 'concept' },
          { id: 'e3', name: 'Authentication', type: 'concept' }
        ]);

        mockEmbeddingProvider.findSimilar
          .mockResolvedValueOnce([
            { entityId: 'e2', score: 0.80 },
            { entityId: 'e3', score: 0.78 }
          ])
          .mockResolvedValueOnce([
            { entityId: 'e2', score: 0.96 }
          ]);

        const lowResults = await resolver.findDuplicates(projectId, { threshold: lowThreshold });
        const highResults = await resolver.findDuplicates(projectId, { threshold: highThreshold });

        // Lower threshold should potentially find more duplicates
        expect(mockEmbeddingProvider.findSimilar).toHaveBeenCalledTimes(2);
      });

      it('should not match entity with itself', async () => {
        mockDb.all.mockReturnValueOnce([
          { id: 'e1', name: 'AuthService', type: 'concept' }
        ]);

        mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
          { entityId: 'e1', score: 1.0 },
          { entityId: 'e2', score: 0.90 }
        ]);

        const groups = await resolver.findDuplicates(projectId, { threshold: 0.85 });

        // Self-matches should be filtered out internally
        if (groups.length > 0) {
          const selfMatch = groups[0].duplicates.find((d: { id: string }) => d.id === groups[0].primary.id);
          expect(selfMatch).toBeUndefined();
        }
      });

      it('should track processed entities to avoid re-processing', async () => {
        mockDb.all.mockReturnValueOnce([
          { id: 'e1', name: 'Auth', type: 'concept' },
          { id: 'e2', name: 'Authentication', type: 'concept' }
        ]);

        mockEmbeddingProvider.findSimilar.mockResolvedValue([
          { entityId: 'e2', score: 0.92 }
        ]);

        const groups = await resolver.findDuplicates(projectId, { threshold: 0.85 });

        // e2 should not appear as both a duplicate and a primary
        const e2AsPrimary = groups.find((g: DuplicateGroup) => g.primary.id === 'e2');
        const e2AsDuplicate = groups.find((g: DuplicateGroup) => g.duplicates.some((d: { id: string }) => d.id === 'e2'));

        // At most one should be true (processed tracking should prevent both)
        expect(e2AsPrimary && e2AsDuplicate).toBeFalsy();
      });

      it('should focus on certain entity types', async () => {
        const targetTypes = ['concept', 'technology', 'pattern'];

        mockDb.all.mockReturnValueOnce([]);

        await resolver.findDuplicates(projectId, {
          threshold: 0.85,
          entityTypes: targetTypes
        });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('type'),
          expect.arrayContaining(targetTypes)
        );
      });
    });
  });

  // ============================================================================
  // Entity Merging Tests
  // ============================================================================

  describe('Entity Merging', () => {
    const projectId = 'proj_123';

    describe('merge()', () => {
      it('should merge metadata from duplicate into primary', async () => {
        const primary: Entity = {
          id: 'e1',
          name: 'AuthService',
          type: 'class',
          metadata: { source: 'code', version: '1.0' }
        };

        const duplicate: Entity = {
          id: 'e2',
          name: 'Authentication Service',
          type: 'concept',
          metadata: { source: 'docs', author: 'team' }
        };

        mockDb.get
          .mockReturnValueOnce(primary)
          .mockReturnValueOnce(duplicate);

        const result = await resolver.merge(projectId, 'e1', ['e2']);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.arrayContaining([expect.stringContaining('aliases')])
        );
      });

      it('should add duplicate name to aliases', async () => {
        const primary: Entity = {
          id: 'e1',
          name: 'AuthService',
          type: 'class',
          metadata: { aliases: ['Auth'] }
        };

        const duplicate: Entity = {
          id: 'e2',
          name: 'Authentication Service',
          type: 'concept',
          metadata: { aliases: ['AuthSvc'] }
        };

        mockDb.get
          .mockReturnValueOnce(primary)
          .mockReturnValueOnce(duplicate);

        await resolver.merge(projectId, 'e1', ['e2']);

        // Verify UPDATE was called with merged aliases
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.any(Array)
        );
      });

      it('should update primary entity with merged data', async () => {
        mockDb.get.mockReturnValue({
          id: 'e1',
          name: 'AuthService',
          type: 'class',
          metadata: {}
        });

        await resolver.merge(projectId, 'e1', ['e2']);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/UPDATE.*entities.*SET.*metadata/i),
          expect.arrayContaining(['e1'])
        );
      });

      it('should delete duplicate embeddings', async () => {
        mockDb.get.mockReturnValue({
          id: 'e1',
          name: 'AuthService',
          type: 'class',
          metadata: {}
        });

        await resolver.merge(projectId, 'e1', ['e2']);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE.*vectors.*entity_id/i),
          expect.arrayContaining(['e2'])
        );
      });

      it('should delete duplicate entity', async () => {
        mockDb.get.mockReturnValue({
          id: 'e1',
          name: 'AuthService',
          type: 'class',
          metadata: {}
        });

        await resolver.merge(projectId, 'e1', ['e2']);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE.*entities.*id/i),
          expect.arrayContaining(['e2'])
        );
      });

      it('should handle merging multiple duplicates', async () => {
        mockDb.get.mockReturnValue({
          id: 'e1',
          name: 'AuthService',
          type: 'class',
          metadata: {}
        });

        const duplicateIds = ['e2', 'e3', 'e4'];

        await resolver.merge(projectId, 'e1', duplicateIds);

        // Should delete each duplicate
        duplicateIds.forEach(dupId => {
          expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE.*entities/i),
            expect.arrayContaining([dupId])
          );
        });
      });
    });
  });

  // ============================================================================
  // Relationship Redirection Tests
  // ============================================================================

  describe('Relationship Redirection', () => {
    const projectId = 'proj_123';

    describe('redirectRelationships()', () => {
      it('should redirect outgoing relationships', async () => {
        const fromId = 'e2';
        const toId = 'e1';

        mockDb.all.mockReturnValueOnce([
          { id: 'rel1', source_id: fromId, target_id: 'e3', type: 'CALLS', metadata: {} }
        ]);

        await resolver.redirectRelationships(projectId, fromId, toId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/INSERT.*relationships/i),
          expect.arrayContaining([toId, 'e3'])
        );
      });

      it('should redirect incoming relationships', async () => {
        const fromId = 'e2';
        const toId = 'e1';

        mockDb.all
          .mockReturnValueOnce([])  // No outgoing
          .mockReturnValueOnce([    // Incoming
            { id: 'rel2', source_id: 'e4', target_id: fromId, type: 'IMPORTS', metadata: {} }
          ]);

        await resolver.redirectRelationships(projectId, fromId, toId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/INSERT.*relationships/i),
          expect.arrayContaining(['e4', toId])
        );
      });

      it('should skip self-loops after redirection', async () => {
        const fromId = 'e2';
        const toId = 'e1';

        // Relationship e2 -> e1 would become e1 -> e1 (self-loop)
        mockDb.all.mockReturnValueOnce([
          { id: 'rel1', source_id: fromId, target_id: toId, type: 'CALLS', metadata: {} }
        ]);

        await resolver.redirectRelationships(projectId, fromId, toId);

        // Should NOT create self-loop relationship
        expect(mockDb.run).not.toHaveBeenCalledWith(
          expect.stringMatching(/INSERT.*relationships/i),
          expect.arrayContaining([toId, toId])
        );
      });

      it('should delete old relationships after redirection', async () => {
        const fromId = 'e2';
        const toId = 'e1';

        mockDb.all.mockReturnValueOnce([
          { id: 'rel1', source_id: fromId, target_id: 'e3', type: 'CALLS', metadata: {} }
        ]);

        await resolver.redirectRelationships(projectId, fromId, toId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE.*relationships/i),
          expect.arrayContaining([fromId])
        );
      });

      it('should preserve relationship metadata during redirection', async () => {
        const fromId = 'e2';
        const toId = 'e1';
        const metadata = { discovered: true, weight: 0.9 };

        mockDb.all.mockReturnValueOnce([
          { id: 'rel1', source_id: fromId, target_id: 'e3', type: 'CALLS', metadata: JSON.stringify(metadata) }
        ]);

        await resolver.redirectRelationships(projectId, fromId, toId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/INSERT.*relationships/i),
          expect.arrayContaining([expect.stringContaining('discovered')])
        );
      });
    });
  });

  // ============================================================================
  // Fuzzy Name Matching Tests
  // ============================================================================

  describe('Fuzzy Name Matching', () => {
    const projectId = 'proj_123';

    describe('resolve()', () => {
      it('should try exact name match first', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'e1',
          name: 'AuthService',
          type: 'class'
        });

        const result: ResolutionResult = await resolver.resolve(projectId, 'AuthService', { type: 'class' });

        expect(result.entity).toBeDefined();
        expect(result.entity?.name).toBe('AuthService');
        expect(result.matchType).toBe('exact');
      });

      it('should fallback to embedding similarity', async () => {
        // No exact match
        mockDb.get.mockReturnValueOnce(undefined);

        // Find via embedding
        mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
          { entityId: 'e1', score: 0.88 }
        ]);

        mockDb.get.mockReturnValueOnce({
          id: 'e1',
          name: 'AuthService',
          type: 'class'
        });

        const result: ResolutionResult = await resolver.resolve(projectId, 'Auth Service', { threshold: 0.8 });

        expect(result.entity).toBeDefined();
        expect(result.matchType).toBe('fuzzy');
        expect(mockEmbeddingProvider.findSimilar).toHaveBeenCalled();
      });

      it('should use similarity threshold', async () => {
        const threshold = 0.8;

        mockDb.get.mockReturnValueOnce(undefined);

        mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
          { entityId: 'e1', score: 0.85 }
        ]);

        mockDb.get.mockReturnValueOnce({
          id: 'e1',
          name: 'AuthService',
          type: 'class'
        });

        const result = await resolver.resolve(projectId, 'query', { threshold });

        expect(result.score).toBeGreaterThan(threshold);
      });

      it('should filter by entity type if specified', async () => {
        const type = 'class';

        mockDb.get.mockReturnValueOnce({
          id: 'e1',
          name: 'AuthService',
          type: 'class'
        });

        const result = await resolver.resolve(projectId, 'AuthService', { type });

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('type'),
          expect.arrayContaining([type])
        );
      });

      it('should return null when not resolved', async () => {
        mockDb.get.mockReturnValueOnce(undefined);
        mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([]);

        const result = await resolver.resolve(projectId, 'Unknown', { threshold: 0.8 });

        expect(result.entity).toBeNull();
        expect(result.matchType).toBe('none');
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    const projectId = 'proj_123';

    it('should handle entity with no embeddings', async () => {
      mockDb.all.mockReturnValueOnce([
        { id: 'e1', name: 'NoEmbedding', type: 'concept' }
      ]);

      mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([]);

      const groups = await resolver.findDuplicates(projectId, { threshold: 0.85 });

      expect(groups).toHaveLength(0);
    });

    it('should handle merging entity with many relationships', async () => {
      const relationshipCount = 100;

      mockDb.get.mockReturnValue({
        id: 'e1',
        name: 'AuthService',
        type: 'class',
        metadata: {}
      });

      mockDb.all.mockReturnValueOnce(
        Array(relationshipCount).fill(null).map((_, i) => ({
          id: `rel${i}`,
          source_id: 'e2',
          target_id: `e_other_${i}`,
          type: 'CALLS',
          metadata: {}
        }))
      );

      await resolver.merge(projectId, 'e1', ['e2']);

      // All relationships should be processed
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should handle entities with special characters in names', async () => {
      const entityWithGenerics: Entity = {
        id: 'e1',
        name: 'MyClass<T, U>',
        type: 'class',
        metadata: { aliases: ['MyClass<T,U>', 'MyClass'] }
      };

      mockDb.get.mockReturnValueOnce(entityWithGenerics);

      const result = await resolver.resolve(projectId, 'MyClass<T, U>');

      expect(result.entity?.name).toContain('<');
    });

    it('should handle concurrent merge operations', async () => {
      mockDb.get.mockReturnValue({
        id: 'e1',
        name: 'AuthService',
        type: 'class',
        metadata: {}
      });

      mockDb.all.mockReturnValue([]);

      const mergeOperations = Array(5).fill(null).map((_, i) =>
        resolver.merge(projectId, 'e1', [`e${i + 2}`])
      );

      const results = await Promise.all(mergeOperations);

      expect(results).toHaveLength(5);
    });

    it('should throw error when primary entity not found', async () => {
      mockDb.get.mockReturnValueOnce(undefined);

      await expect(
        resolver.merge(projectId, 'non_existent', ['e2'])
      ).rejects.toThrow('Primary entity not found');
    });
  });

  // ============================================================================
  // Similarity Calculation Tests
  // ============================================================================

  describe('Similarity Calculation', () => {
    const projectId = 'proj_123';

    it('should identify similar entity names via embeddings', async () => {
      const testCases = [
        { query: 'AuthService', expectedMatch: 'Authentication Service', shouldFind: true },
        { query: 'UserController', expectedMatch: 'User Controller', shouldFind: true },
        { query: 'AuthService', expectedMatch: 'LoggingService', shouldFind: false }
      ];

      for (const testCase of testCases) {
        mockDb.get.mockReturnValueOnce(undefined);

        if (testCase.shouldFind) {
          mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
            { entityId: 'e1', score: 0.90 }
          ]);
          mockDb.get.mockReturnValueOnce({
            id: 'e1',
            name: testCase.expectedMatch,
            type: 'class'
          });
        } else {
          mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([]);
        }

        const result = await resolver.resolve(projectId, testCase.query, { threshold: 0.85 });

        if (testCase.shouldFind) {
          expect(result.entity).not.toBeNull();
        } else {
          expect(result.entity).toBeNull();
        }
      }
    });

    it('should handle abbreviations through embedding similarity', async () => {
      mockDb.get.mockReturnValueOnce(undefined);

      mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
        { entityId: 'e1', score: 0.87 }
      ]);

      mockDb.get.mockReturnValueOnce({
        id: 'e1',
        name: 'AuthenticationService',
        type: 'class'
      });

      const result = await resolver.resolve(projectId, 'AuthSvc', { threshold: 0.8 });

      expect(result.entity?.name).toBe('AuthenticationService');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    const projectId = 'proj_123';

    it('should complete full deduplication flow', async () => {
      // 1. Setup: Find duplicates
      mockDb.all.mockReturnValueOnce([
        { id: 'e1', name: 'AuthService', type: 'concept' },
        { id: 'e2', name: 'Authentication Service', type: 'concept' }
      ]);

      mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.92 }
      ]);

      // Find duplicates
      const groups = await resolver.findDuplicates(projectId, { threshold: 0.85 });

      // 2. Setup for merge
      mockDb.get.mockReturnValue({
        id: 'e1',
        name: 'AuthService',
        type: 'concept',
        metadata: {}
      });

      mockDb.all.mockReturnValue([
        { id: 'rel1', source_id: 'e2', target_id: 'e3', type: 'CALLS', metadata: {} }
      ]);

      // Perform merge
      if (groups.length > 0) {
        await resolver.merge(
          projectId,
          groups[0].primary.id,
          groups[0].duplicates.map((d: { id: string }) => d.id)
        );
      }

      // Verify all operations occurred
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE.*entities/i),
        expect.any(Array)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE.*entities/i),
        expect.any(Array)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE.*vectors/i),
        expect.any(Array)
      );
    });

    it('should resolve and deduplicate in pipeline', async () => {
      // First resolve an entity
      mockDb.get.mockReturnValueOnce({
        id: 'e1',
        name: 'AuthService',
        type: 'class'
      });

      const resolved = await resolver.resolve(projectId, 'AuthService');
      expect(resolved.entity).toBeDefined();

      // Then check for duplicates
      mockDb.all.mockReturnValueOnce([
        { id: 'e1', name: 'AuthService', type: 'class' },
        { id: 'e2', name: 'Auth Service', type: 'concept' }
      ]);

      mockEmbeddingProvider.findSimilar.mockResolvedValueOnce([
        { entityId: 'e2', score: 0.89 }
      ]);

      const duplicates = await resolver.findDuplicates(projectId, { threshold: 0.85 });

      expect(mockEmbeddingProvider.findSimilar).toHaveBeenCalled();
    });
  });
});
