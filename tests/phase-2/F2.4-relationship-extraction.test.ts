/**
 * F2.4 Relationship Extraction Tests
 *
 * IMPORTANT: These tests will FAIL with "Cannot find module" errors until
 * the actual implementations are created at the imported paths.
 *
 * Tests for extracting code relationships (imports, calls, inheritance)
 * and building the knowledge graph.
 *
 * @see docs/phase-2/F2.4-relationship-extraction.md
 */

// Real imports - will fail until implementations exist
import { RelationshipStore } from '../../src/relationships/store';
import { RelationshipExtractor } from '../../src/relationships/extractor';
import {
  Relationship,
  RelationshipType
} from '../../src/relationships/types';
import {
  TraversalResult,
  TraversalOptions
} from '../../src/graph/types';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities/store';

// Mock the dependencies
jest.mock('../../src/db/connection');
jest.mock('../../src/entities/store');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedEntityStore = EntityStore as jest.MockedClass<typeof EntityStore>;

describe('F2.4 Relationship Extraction', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockEntityStore: jest.Mocked<EntityStore>;
  let relationshipStore: RelationshipStore;
  let relationshipExtractor: RelationshipExtractor;
  const projectId = 'proj_test123';

  beforeEach(() => {
    // Create mock instances
    mockDb = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockDb.run = jest.fn();
    mockDb.get = jest.fn();
    mockDb.all = jest.fn();
    mockDb.transaction = jest.fn((fn) => fn());

    mockEntityStore = new MockedEntityStore(mockDb, projectId) as jest.Mocked<EntityStore>;
    mockEntityStore.get = jest.fn();
    mockEntityStore.getByType = jest.fn();
    mockEntityStore.getByFilePath = jest.fn();

    // Create real instances with mocked dependencies
    relationshipStore = new RelationshipStore(mockDb, projectId);
    relationshipExtractor = new RelationshipExtractor(relationshipStore, mockEntityStore, projectId);

    jest.clearAllMocks();
  });

  // ============================================================================
  // RelationshipStore Tests
  // ============================================================================

  describe('RelationshipStore', () => {
    describe('create', () => {
      it('should create relationship with auto-generated ID', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'entity-1',
          targetId: 'entity-2',
          type: RelationshipType.CALLS
        });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining(['entity-1', 'entity-2', 'CALLS'])
        );
        expect(result.id).toMatch(/^rel-/);
        expect(result.sourceId).toBe('entity-1');
        expect(result.targetId).toBe('entity-2');
        expect(result.type).toBe(RelationshipType.CALLS);
      });

      it('should store default weight of 1.0', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'entity-1',
          targetId: 'entity-2',
          type: RelationshipType.IMPORTS
        });

        expect(result.weight).toBe(1.0);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([1.0])
        );
      });

      it('should store metadata as JSON', async () => {
        const metadata = { line: 25, callCount: 3 };
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'entity-1',
          targetId: 'entity-2',
          type: RelationshipType.CALLS,
          metadata
        });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([JSON.stringify(metadata)])
        );
        expect(result.metadata).toEqual(metadata);
      });
    });

    describe('createMany', () => {
      it('should create multiple relationships in transaction', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = [
          { sourceId: 'e1', targetId: 'e2', type: RelationshipType.CALLS },
          { sourceId: 'e2', targetId: 'e3', type: RelationshipType.CALLS },
          { sourceId: 'e3', targetId: 'e4', type: RelationshipType.CALLS }
        ];

        const results = await relationshipStore.createMany(relationships);

        expect(mockDb.transaction).toHaveBeenCalled();
        expect(results).toHaveLength(3);
        expect(mockDb.run).toHaveBeenCalledTimes(3);
      });

      it('should use INSERT OR IGNORE to handle duplicates', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        await relationshipStore.createMany([
          { sourceId: 'e1', targetId: 'e2', type: RelationshipType.IMPORTS }
        ]);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT OR IGNORE'),
          expect.any(Array)
        );
      });
    });

    describe('get', () => {
      it('should retrieve relationship by ID', async () => {
        const mockRow = {
          id: 'rel-123',
          source_id: 'entity-1',
          target_id: 'entity-2',
          type: 'CALLS',
          weight: 1.0,
          metadata: '{}',
          created_at: new Date().toISOString()
        };
        mockDb.get.mockReturnValue(mockRow);

        const result = await relationshipStore.get('rel-123');

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          ['rel-123']
        );
        expect(result).toBeDefined();
        expect(result?.id).toBe('rel-123');
        expect(result?.sourceId).toBe('entity-1');
        expect(result?.targetId).toBe('entity-2');
      });

      it('should parse metadata from JSON', async () => {
        const metadata = { line: 10, isDirectImport: true };
        mockDb.get.mockReturnValue({
          id: 'rel-1',
          source_id: 'e1',
          target_id: 'e2',
          type: 'IMPORTS',
          weight: 1.0,
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString()
        });

        const result = await relationshipStore.get('rel-1');

        expect(result?.metadata).toEqual(metadata);
        expect(result?.metadata?.line).toBe(10);
        expect(result?.metadata?.isDirectImport).toBe(true);
      });

      it('should return undefined for non-existent relationship', async () => {
        mockDb.get.mockReturnValue(undefined);

        const result = await relationshipStore.get('non-existent');

        expect(result).toBeUndefined();
      });
    });

    describe('getForEntity', () => {
      it('should get outgoing relationships (direction: out)', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'entity-1', target_id: 'entity-2', type: 'CALLS', weight: 1.0, metadata: '{}' },
          { id: 'rel-2', source_id: 'entity-1', target_id: 'entity-3', type: 'CALLS', weight: 1.0, metadata: '{}' }
        ]);

        const results = await relationshipStore.getForEntity('entity-1', { direction: 'out' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('source_id'),
          expect.arrayContaining(['entity-1'])
        );
        expect(results).toHaveLength(2);
        results.forEach(r => expect(r.sourceId).toBe('entity-1'));
      });

      it('should get incoming relationships (direction: in)', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'entity-2', target_id: 'entity-1', type: 'CALLS', weight: 1.0, metadata: '{}' },
          { id: 'rel-2', source_id: 'entity-3', target_id: 'entity-1', type: 'CALLS', weight: 1.0, metadata: '{}' }
        ]);

        const results = await relationshipStore.getForEntity('entity-1', { direction: 'in' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('target_id'),
          expect.arrayContaining(['entity-1'])
        );
        expect(results).toHaveLength(2);
        results.forEach(r => expect(r.targetId).toBe('entity-1'));
      });

      it('should get both directions (direction: both)', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'entity-1', target_id: 'entity-2', type: 'CALLS', weight: 1.0, metadata: '{}' },
          { id: 'rel-2', source_id: 'entity-3', target_id: 'entity-1', type: 'CALLS', weight: 1.0, metadata: '{}' }
        ]);

        const results = await relationshipStore.getForEntity('entity-1', { direction: 'both' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringMatching(/source_id.*OR.*target_id/),
          expect.arrayContaining(['entity-1', 'entity-1'])
        );
        expect(results).toHaveLength(2);
      });

      it('should filter by relationship type', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'entity-1', target_id: 'entity-2', type: 'CALLS', weight: 1.0, metadata: '{}' }
        ]);

        const results = await relationshipStore.getForEntity('entity-1', {
          direction: 'out',
          types: [RelationshipType.CALLS]
        });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('type IN'),
          expect.any(Array)
        );
        expect(results).toHaveLength(1);
        expect(results[0].type).toBe(RelationshipType.CALLS);
      });
    });

    describe('getByType', () => {
      it('should get all relationships of a type', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'f1', target_id: 'f2', type: 'IMPORTS', weight: 1.0, metadata: '{}' },
          { id: 'rel-2', source_id: 'f2', target_id: 'f3', type: 'IMPORTS', weight: 1.0, metadata: '{}' },
          { id: 'rel-3', source_id: 'f3', target_id: 'f4', type: 'IMPORTS', weight: 1.0, metadata: '{}' }
        ]);

        const results = await relationshipStore.getByType(RelationshipType.IMPORTS);

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('type = ?'),
          ['IMPORTS']
        );
        expect(results).toHaveLength(3);
        results.forEach(r => expect(r.type).toBe(RelationshipType.IMPORTS));
      });
    });

    describe('traverse', () => {
      it('should traverse graph with depth limit', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'entity-1', target_id: 'entity-2', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 },
          { id: 'rel-2', source_id: 'entity-2', target_id: 'entity-3', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 2 }
        ]);

        const result: TraversalResult = await relationshipStore.traverse('entity-1', { maxDepth: 2 });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('WITH RECURSIVE'),
          expect.arrayContaining(['entity-1', 2])
        );
        expect(result.relationships).toHaveLength(2);
        expect(result.startId).toBe('entity-1');
      });

      it('should use recursive CTE for traversal', async () => {
        mockDb.all.mockReturnValue([]);

        await relationshipStore.traverse('entity-1', { maxDepth: 3 });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringMatching(/WITH RECURSIVE.*UNION ALL/s),
          expect.any(Array)
        );
      });

      it('should handle circular dependencies', async () => {
        // Path tracking prevents infinite loops
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'a', target_id: 'b', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 },
          { id: 'rel-2', source_id: 'b', target_id: 'c', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 2 }
          // Should NOT include c->a even if it exists, due to cycle detection
        ]);

        const result = await relationshipStore.traverse('a', { maxDepth: 5 });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('NOT LIKE'),
          expect.any(Array)
        );
        expect(result.entityIds.size).toBeLessThanOrEqual(3);
      });

      it('should return traversal result with entity IDs', async () => {
        mockDb.all.mockReturnValue([
          { id: 'rel-1', source_id: 'entity-1', target_id: 'entity-2', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 }
        ]);

        const result = await relationshipStore.traverse('entity-1', { maxDepth: 2 });

        expect(result.startId).toBe('entity-1');
        expect(result.entityIds).toBeInstanceOf(Set);
        expect(result.entityIds.has('entity-1')).toBe(true);
        expect(result.entityIds.has('entity-2')).toBe(true);
      });

      it('should filter by direction (out)', async () => {
        mockDb.all.mockReturnValue([]);

        await relationshipStore.traverse('entity-1', { maxDepth: 2, direction: 'out' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('source_id'),
          expect.any(Array)
        );
      });

      it('should filter by direction (in)', async () => {
        mockDb.all.mockReturnValue([]);

        await relationshipStore.traverse('entity-1', { maxDepth: 2, direction: 'in' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('target_id'),
          expect.any(Array)
        );
      });

      it('should filter by relationship types', async () => {
        mockDb.all.mockReturnValue([]);

        await relationshipStore.traverse('entity-1', {
          maxDepth: 2,
          types: [RelationshipType.CALLS, RelationshipType.IMPORTS]
        });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('type IN'),
          expect.any(Array)
        );
      });
    });

    describe('delete', () => {
      it('should delete relationship by ID', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 0 });

        const result = await relationshipStore.delete('rel-1');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          ['rel-1']
        );
        expect(result).toBe(true);
      });

      it('should return false when relationship not found', async () => {
        mockDb.run.mockReturnValue({ changes: 0, lastInsertRowid: 0 });

        const result = await relationshipStore.delete('non-existent');

        expect(result).toBe(false);
      });
    });

    describe('deleteForEntity', () => {
      it('should delete all relationships involving entity', async () => {
        mockDb.run.mockReturnValue({ changes: 5, lastInsertRowid: 0 });

        const deletedCount = await relationshipStore.deleteForEntity('entity-1');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE.*source_id.*OR.*target_id/s),
          ['entity-1', 'entity-1']
        );
        expect(deletedCount).toBe(5);
      });
    });

    describe('deleteBySourceFile', () => {
      it('should delete relationships from entities in file', async () => {
        mockDb.run.mockReturnValue({ changes: 3, lastInsertRowid: 0 });

        const deletedCount = await relationshipStore.deleteBySourceFile('src/old-file.ts');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE.*source_id IN.*SELECT.*file_path/s),
          ['src/old-file.ts']
        );
        expect(deletedCount).toBe(3);
      });
    });
  });

  // ============================================================================
  // RelationshipExtractor Tests
  // ============================================================================

  describe('RelationshipExtractor', () => {
    describe('extractAll', () => {
      it('should extract relationships from all files', async () => {
        mockEntityStore.getByType.mockResolvedValue([
          { id: 'file-1', filePath: 'src/a.ts', type: 'file', name: 'a.ts', qualifiedName: 'src/a.ts' },
          { id: 'file-2', filePath: 'src/b.ts', type: 'file', name: 'b.ts', qualifiedName: 'src/b.ts' }
        ]);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const results = await relationshipExtractor.extractAll();

        expect(mockEntityStore.getByType).toHaveBeenCalledWith('file');
        expect(results.filesProcessed).toBe(2);
      });
    });

    describe('extractFromFile', () => {
      it('should extract CONTAINS relationships', async () => {
        const fileEntity = { id: 'file-1', type: 'file', name: 'auth.ts', filePath: 'src/auth.ts' };
        const methodEntity = { id: 'method-1', type: 'method', name: 'login', filePath: 'src/auth.ts' };

        mockEntityStore.getByFilePath.mockResolvedValue([fileEntity, methodEntity]);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = await relationshipExtractor.extractFromFile('src/auth.ts');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['file-1', 'method-1', 'CONTAINS'])
        );
        expect(relationships.some(r => r.type === RelationshipType.CONTAINS)).toBe(true);
      });

      it('should extract IMPORTS relationships', async () => {
        const fileEntity = {
          id: 'file-1',
          type: 'file',
          name: 'auth.ts',
          filePath: 'src/auth.ts',
          metadata: {
            imports: [{ source: './utils', specifiers: [{ name: 'formatDate' }] }]
          }
        };
        const targetFile = { id: 'file-2', type: 'file', name: 'utils.ts', filePath: 'src/utils.ts' };

        mockEntityStore.getByFilePath.mockResolvedValue([fileEntity]);
        mockEntityStore.get.mockResolvedValue(targetFile);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = await relationshipExtractor.extractFromFile('src/auth.ts');

        expect(relationships.some(r => r.type === RelationshipType.IMPORTS)).toBe(true);
      });
    });

    describe('resolveImport', () => {
      it('should resolve relative imports', async () => {
        mockEntityStore.get.mockResolvedValue({
          id: 'file-1',
          filePath: 'src/services/utils.ts'
        });

        const resolvedPath = await relationshipExtractor.resolveImport(
          'src/services/auth.ts',
          './utils'
        );

        expect(resolvedPath).toBe('src/services/utils.ts');
      });

      it('should try multiple extensions', async () => {
        mockEntityStore.get
          .mockResolvedValueOnce(null) // .ts not found
          .mockResolvedValueOnce(null) // .tsx not found
          .mockResolvedValueOnce({ id: 'file-1', filePath: 'src/utils.js' }); // .js found

        const resolvedPath = await relationshipExtractor.resolveImport(
          'src/index.ts',
          './utils'
        );

        expect(mockEntityStore.get).toHaveBeenCalledTimes(3);
        expect(resolvedPath).toBe('src/utils.js');
      });

      it('should try index file', async () => {
        mockEntityStore.get
          .mockResolvedValueOnce(null) // Direct file not found
          .mockResolvedValueOnce({ id: 'file-1', filePath: 'src/components/index.ts' }); // index.ts found

        const resolvedPath = await relationshipExtractor.resolveImport(
          'src/app.ts',
          './components'
        );

        expect(resolvedPath).toBe('src/components/index.ts');
      });

      it('should return null for package imports', async () => {
        const resolvedPath = await relationshipExtractor.resolveImport(
          'src/app.ts',
          'lodash'
        );

        expect(resolvedPath).toBeNull();
        expect(mockEntityStore.get).not.toHaveBeenCalled();
      });

      it('should handle parent directory imports', async () => {
        mockEntityStore.get.mockResolvedValue({
          id: 'file-1',
          filePath: 'src/services/types.ts'
        });

        const resolvedPath = await relationshipExtractor.resolveImport(
          'src/services/auth/login.ts',
          '../types'
        );

        expect(resolvedPath).toBe('src/services/types.ts');
      });
    });

    describe('extractCallRelationships', () => {
      it('should create CALLS relationships', async () => {
        const callerFunc = {
          id: 'func-caller',
          type: 'function',
          name: 'processData',
          metadata: { calls: ['validateInput'] }
        };
        const calleeFunc = { id: 'func-callee', type: 'function', name: 'validateInput' };

        mockEntityStore.getByFilePath.mockResolvedValue([callerFunc, calleeFunc]);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = await relationshipExtractor.extractCallRelationships('src/data.ts');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['func-caller', 'func-callee', 'CALLS'])
        );
        expect(relationships.some(r => r.type === RelationshipType.CALLS)).toBe(true);
      });

      it('should create CONTAINS from class to methods', async () => {
        const classEntity = {
          id: 'class-1',
          type: 'class',
          name: 'AuthService',
          filePath: 'src/auth.ts'
        };
        const methodEntity = {
          id: 'method-1',
          type: 'method',
          name: 'login',
          filePath: 'src/auth.ts',
          metadata: { parentClass: 'AuthService' }
        };

        mockEntityStore.getByFilePath.mockResolvedValue([classEntity, methodEntity]);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = await relationshipExtractor.extractFromFile('src/auth.ts');

        expect(relationships.some(
          r => r.type === RelationshipType.CONTAINS &&
               r.sourceId === 'class-1' &&
               r.targetId === 'method-1'
        )).toBe(true);
      });
    });

    describe('extractInheritanceRelationships', () => {
      it('should create EXTENDS relationships', async () => {
        const childClass = {
          id: 'child-class',
          type: 'class',
          name: 'AdminUser',
          metadata: { extends: 'User' }
        };
        const parentClass = { id: 'parent-class', type: 'class', name: 'User' };

        mockEntityStore.getByFilePath.mockResolvedValue([childClass]);
        mockEntityStore.get.mockResolvedValue(parentClass);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = await relationshipExtractor.extractInheritanceRelationships('src/user.ts');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['child-class', 'parent-class', 'EXTENDS'])
        );
        expect(relationships.some(r => r.type === RelationshipType.EXTENDS)).toBe(true);
      });

      it('should create IMPLEMENTS relationships', async () => {
        const classEntity = {
          id: 'class-impl',
          type: 'class',
          name: 'UserRepository',
          metadata: { implements: ['Repository', 'Queryable'] }
        };
        const repoInterface = { id: 'interface-1', type: 'interface', name: 'Repository' };
        const queryInterface = { id: 'interface-2', type: 'interface', name: 'Queryable' };

        mockEntityStore.getByFilePath.mockResolvedValue([classEntity]);
        mockEntityStore.get
          .mockResolvedValueOnce(repoInterface)
          .mockResolvedValueOnce(queryInterface);
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const relationships = await relationshipExtractor.extractInheritanceRelationships('src/repo.ts');

        expect(relationships.filter(r => r.type === RelationshipType.IMPLEMENTS)).toHaveLength(2);
      });
    });

    describe('findClassByName', () => {
      it('should find in same file first', async () => {
        const classEntity = {
          id: 'class-1',
          type: 'class',
          name: 'AuthService',
          qualifiedName: 'src/auth.ts::AuthService'
        };
        mockEntityStore.get.mockResolvedValue(classEntity);

        const result = await relationshipExtractor.findClassByName('AuthService', 'src/auth.ts');

        expect(mockEntityStore.get).toHaveBeenCalledWith(
          expect.objectContaining({ qualifiedName: 'src/auth.ts::AuthService' })
        );
        expect(result?.id).toBe('class-1');
      });

      it('should search across project if not in same file', async () => {
        mockEntityStore.get
          .mockResolvedValueOnce(null) // Not found in same file
          .mockResolvedValueOnce({ id: 'class-1', name: 'BaseService', type: 'class' });

        const result = await relationshipExtractor.findClassByName('BaseService', 'src/auth.ts');

        expect(mockEntityStore.get).toHaveBeenCalledTimes(2);
        expect(result?.name).toBe('BaseService');
      });

      it('should search interfaces if class not found', async () => {
        mockEntityStore.get
          .mockResolvedValueOnce(null) // Class not found in same file
          .mockResolvedValueOnce(null) // Class not found in project
          .mockResolvedValueOnce({ id: 'iface-1', name: 'Serializable', type: 'interface' });

        const result = await relationshipExtractor.findClassByName('Serializable', 'src/data.ts');

        expect(mockEntityStore.get).toHaveBeenLastCalledWith(
          expect.objectContaining({ type: 'interface', name: 'Serializable' })
        );
        expect(result?.type).toBe('interface');
      });
    });
  });

  // ============================================================================
  // Relationship Types Tests
  // ============================================================================

  describe('relationship types', () => {
    const relationshipTypes: RelationshipType[] = [
      RelationshipType.IMPORTS,
      RelationshipType.CALLS,
      RelationshipType.EXTENDS,
      RelationshipType.IMPLEMENTS,
      RelationshipType.USES_TYPE,
      RelationshipType.CONTAINS,
      RelationshipType.EXPORTS,
      RelationshipType.INSTANTIATES
    ];

    it('should support all relationship types', async () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      for (const type of relationshipTypes) {
        const result = await relationshipStore.create({
          sourceId: 'source',
          targetId: 'target',
          type
        });
        expect(result.type).toBe(type);
      }

      expect(mockDb.run).toHaveBeenCalledTimes(relationshipTypes.length);
    });

    describe('IMPORTS', () => {
      it('should connect file to file/module', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'file-a',
          targetId: 'file-b',
          type: RelationshipType.IMPORTS
        });

        expect(result.type).toBe(RelationshipType.IMPORTS);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['IMPORTS'])
        );
      });

      it('should have metadata for direct import', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'file-a',
          targetId: 'file-b',
          type: RelationshipType.IMPORTS,
          metadata: { isDirectImport: true }
        });

        expect(result.metadata?.isDirectImport).toBe(true);
      });
    });

    describe('CALLS', () => {
      it('should connect function to function', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'func-caller',
          targetId: 'func-callee',
          type: RelationshipType.CALLS
        });

        expect(result.type).toBe(RelationshipType.CALLS);
      });

      it('should track call count', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'func-caller',
          targetId: 'func-callee',
          type: RelationshipType.CALLS,
          metadata: { callCount: 5 }
        });

        expect(result.metadata?.callCount).toBe(5);
      });
    });

    describe('EXTENDS', () => {
      it('should connect class to parent class', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'child-class',
          targetId: 'parent-class',
          type: RelationshipType.EXTENDS
        });

        expect(result.type).toBe(RelationshipType.EXTENDS);
      });
    });

    describe('IMPLEMENTS', () => {
      it('should connect class to interface', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'class-impl',
          targetId: 'interface',
          type: RelationshipType.IMPLEMENTS
        });

        expect(result.type).toBe(RelationshipType.IMPLEMENTS);
      });
    });

    describe('CONTAINS', () => {
      it('should connect file to symbol', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'file',
          targetId: 'function',
          type: RelationshipType.CONTAINS
        });

        expect(result.type).toBe(RelationshipType.CONTAINS);
      });

      it('should connect class to method', async () => {
        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await relationshipStore.create({
          sourceId: 'class',
          targetId: 'method',
          type: RelationshipType.CONTAINS
        });

        expect(result.type).toBe(RelationshipType.CONTAINS);
      });
    });
  });

  // ============================================================================
  // Graph Traversal Tests
  // ============================================================================

  describe('graph traversal', () => {
    it('should find direct neighbors', async () => {
      mockDb.all.mockReturnValue([
        { id: 'rel-1', source_id: 'center', target_id: 'neighbor-1', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 },
        { id: 'rel-2', source_id: 'center', target_id: 'neighbor-2', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 }
      ]);

      const result = await relationshipStore.traverse('center', { maxDepth: 1 });

      expect(result.relationships).toHaveLength(2);
      result.relationships.forEach(r => expect(r.sourceId).toBe('center'));
    });

    it('should find 2-hop neighbors', async () => {
      mockDb.all.mockReturnValue([
        { id: 'rel-1', source_id: 'center', target_id: 'n1', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 },
        { id: 'rel-2', source_id: 'n1', target_id: 'n2', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 2 }
      ]);

      const result = await relationshipStore.traverse('center', { maxDepth: 2 });

      expect(result.relationships).toHaveLength(2);
      expect(result.entityIds.has('n2')).toBe(true);
    });

    it('should respect max depth', async () => {
      const maxDepth = 3;
      mockDb.all.mockReturnValue([
        { id: 'rel-1', source_id: 'a', target_id: 'b', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 },
        { id: 'rel-2', source_id: 'b', target_id: 'c', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 2 },
        { id: 'rel-3', source_id: 'c', target_id: 'd', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 3 }
      ]);

      const result = await relationshipStore.traverse('a', { maxDepth });

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([maxDepth])
      );
      expect(result.relationships).toHaveLength(3);
    });

    it('should collect unique entity IDs', async () => {
      mockDb.all.mockReturnValue([
        { id: 'rel-1', source_id: 'a', target_id: 'b', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 1 },
        { id: 'rel-2', source_id: 'b', target_id: 'c', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 2 },
        { id: 'rel-3', source_id: 'c', target_id: 'a', type: 'CALLS', weight: 1.0, metadata: '{}', depth: 3 }
      ]);

      const result = await relationshipStore.traverse('a', { maxDepth: 3 });

      expect(result.entityIds.size).toBe(3);
      expect(result.entityIds.has('a')).toBe(true);
      expect(result.entityIds.has('b')).toBe(true);
      expect(result.entityIds.has('c')).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle self-referencing relationships', async () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = await relationshipStore.create({
        sourceId: 'recursive-func',
        targetId: 'recursive-func',
        type: RelationshipType.CALLS
      });

      expect(result.sourceId).toBe(result.targetId);
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should handle multiple relationships between same entities', async () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const rel1 = await relationshipStore.create({
        sourceId: 'class-a',
        targetId: 'interface-b',
        type: RelationshipType.IMPLEMENTS
      });

      const rel2 = await relationshipStore.create({
        sourceId: 'class-a',
        targetId: 'interface-b',
        type: RelationshipType.USES_TYPE
      });

      expect(rel1.type).not.toBe(rel2.type);
      expect(rel1.id).not.toBe(rel2.id);
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });

    it('should handle orphan entities', async () => {
      mockDb.all.mockReturnValue([]);

      const results = await relationshipStore.getForEntity('orphan-entity', { direction: 'both' });

      expect(mockDb.all).toHaveBeenCalled();
      expect(results).toHaveLength(0);
    });

    it('should handle very deep inheritance chains', async () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const depth = 10;
      const relationships: Relationship[] = [];

      for (let i = 0; i < depth; i++) {
        const rel = await relationshipStore.create({
          sourceId: `class-${i + 1}`,
          targetId: `class-${i}`,
          type: RelationshipType.EXTENDS
        });
        relationships.push(rel);
      }

      expect(relationships).toHaveLength(10);
      expect(mockDb.run).toHaveBeenCalledTimes(10);
    });

    it('should handle diamond inheritance', async () => {
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      // A extends B and C, B extends D, C extends D
      const diamondRelationships = [
        { sourceId: 'A', targetId: 'B', type: RelationshipType.EXTENDS },
        { sourceId: 'A', targetId: 'C', type: RelationshipType.EXTENDS },
        { sourceId: 'B', targetId: 'D', type: RelationshipType.EXTENDS },
        { sourceId: 'C', targetId: 'D', type: RelationshipType.EXTENDS }
      ];

      const results = await relationshipStore.createMany(diamondRelationships);

      expect(results).toHaveLength(4);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});
