/**
 * F1.3 Entity Storage Tests
 *
 * Tests for EntityStore class covering CRUD operations,
 * content hashing, qualified names, and FTS search.
 *
 * These tests will FAIL until the actual implementations are created.
 * Expected source files:
 * - src/entities/store.ts (EntityStore class)
 * - src/entities/types.ts (Entity, EntityType, CreateEntityInput types)
 * - src/database/connection.ts (DatabaseConnection class)
 *
 * @see docs/phase-1/F1.3-entity-storage.md
 */

// Import actual implementations - these will fail until implemented
import { EntityStore } from '../../src/entities/store';
import {
  Entity,
  EntityType,
  CreateEntityInput,
  UpdateEntityInput,
  SearchOptions
} from '../../src/entities/types';
import { DatabaseConnection } from '../../src/db/connection';

// Import mock helpers
import { createMockDatabase, MockDatabase, hashContent } from '../helpers/mocks';

// Mock the database connection
jest.mock('../../src/db/connection');

describe('F1.3 Entity Storage', () => {
  let mockDb: MockDatabase;
  let entityStore: EntityStore;
  const projectId = 'proj_test123';

  beforeEach(() => {
    mockDb = createMockDatabase();

    // Mock DatabaseConnection to return our mock db
    (DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>).mockImplementation(() => ({
      db: mockDb,
      close: jest.fn(),
      transaction: mockDb.transaction,
    } as unknown as DatabaseConnection));

    entityStore = new EntityStore(new DatabaseConnection(':memory:'), projectId);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // EntityStore CRUD Operations
  // ============================================================================

  describe('EntityStore', () => {
    describe('create', () => {
      it('should create an entity with auto-generated ID', async () => {
        mockDb.mockRun({ changes: 1, lastInsertRowid: 1 });

        const input: CreateEntityInput = {
          type: 'function',
          name: 'testFunction',
          content: 'function testFunction() {}',
          filePath: 'src/test.ts',
          startLine: 1,
          endLine: 3,
          metadata: {}
        };

        const entity = await entityStore.create(input);

        expect(entity).toBeDefined();
        expect(entity.id).toMatch(/^entity-[a-z0-9]+$/);
        expect(entity.type).toBe('function');
        expect(entity.name).toBe('testFunction');
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.any(Array)
        );
      });

      it('should compute content hash automatically', async () => {
        mockDb.mockRun({ changes: 1 });

        const content = 'function testFunction() { return true; }';
        const input: CreateEntityInput = {
          type: 'function',
          name: 'testFunction',
          content,
          filePath: 'src/test.ts',
          startLine: 1,
          endLine: 3,
          metadata: {}
        };

        const entity = await entityStore.create(input);

        expect(entity.hash).toBeDefined();
        expect(entity.hash!.length).toBeGreaterThan(0);
      });

      it('should generate qualified name if not provided', async () => {
        mockDb.mockRun({ changes: 1 });

        const input: CreateEntityInput = {
          type: 'function',
          name: 'formatDate',
          filePath: 'src/utils/helpers.ts',
          startLine: 1,
          endLine: 5,
          metadata: {}
        };

        const entity = await entityStore.create(input);

        // Expected: src/utils/helpers.ts::formatDate
        expect(entity.qualifiedName).toBe('src/utils/helpers.ts::formatDate');
      });

      it('should generate qualified name for domain entities', async () => {
        mockDb.mockRun({ changes: 1 });

        const input: CreateEntityInput = {
          type: 'concept',
          name: 'rate-limiting',
          metadata: {}
        };

        const entity = await entityStore.create(input);

        // Expected: concept::rate-limiting
        expect(entity.qualifiedName).toBe('concept::rate-limiting');
      });

      it('should store metadata as JSON', async () => {
        mockDb.mockRun({ changes: 1 });

        const metadata = {
          visibility: 'public',
          isAsync: true,
          decorators: ['@Injectable']
        };

        const input: CreateEntityInput = {
          type: 'class',
          name: 'TestClass',
          filePath: 'src/test.ts',
          startLine: 1,
          endLine: 10,
          metadata
        };

        await entityStore.create(input);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([JSON.stringify(metadata)])
        );
      });

      it('should handle null content', async () => {
        mockDb.mockRun({ changes: 1 });

        const input: CreateEntityInput = {
          type: 'concept',
          name: 'test-concept',
          metadata: {}
        };

        const entity = await entityStore.create(input);

        expect(entity).toBeDefined();
        expect(entity.content).toBeUndefined();
      });

      it('should handle null summary', async () => {
        mockDb.mockRun({ changes: 1 });

        const input: CreateEntityInput = {
          type: 'function',
          name: 'testFunc',
          content: 'function testFunc() {}',
          filePath: 'src/test.ts',
          startLine: 1,
          endLine: 1,
          metadata: {}
        };

        const entity = await entityStore.create(input);

        expect(entity.summary).toBeUndefined();
      });

      it('should validate entity type', async () => {
        const invalidType = 'invalid_type' as EntityType;

        const input: CreateEntityInput = {
          type: invalidType,
          name: 'test',
          metadata: {}
        };

        await expect(entityStore.create(input)).rejects.toThrow('Invalid entity type');
      });
    });

    describe('get', () => {
      it('should retrieve entity by ID', async () => {
        mockDb.mockGet({
          id: 'entity-abc123',
          type: 'function',
          name: 'testFunction',
          qualified_name: 'src/test.ts::testFunction',
          content: 'function testFunction() {}',
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const entity = await entityStore.get('entity-abc123');

        expect(entity).toBeDefined();
        expect(entity!.id).toBe('entity-abc123');
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          ['entity-abc123']
        );
      });

      it('should return null for non-existent entity', async () => {
        mockDb.mockGet(undefined);

        const entity = await entityStore.get('nonexistent');

        expect(entity).toBeNull();
      });

      it('should parse JSON metadata', async () => {
        const metadata = { isAsync: true, visibility: 'private' };

        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'test',
          qualified_name: 'src/test.ts::test',
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const entity = await entityStore.get('entity-1');

        expect(entity!.metadata.isAsync).toBe(true);
        expect(entity!.metadata.visibility).toBe('private');
      });
    });

    describe('getByName', () => {
      it('should retrieve entity by name', async () => {
        mockDb.mockGet({
          id: 'entity-1',
          type: 'class',
          name: 'AuthService',
          qualified_name: 'src/auth.ts::AuthService',
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const entity = await entityStore.getByName('AuthService');

        expect(entity).toBeDefined();
        expect(entity!.name).toBe('AuthService');
      });

      it('should filter by type when specified', async () => {
        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'validate',
          qualified_name: 'src/utils.ts::validate',
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const entity = await entityStore.getByName('validate', 'function');

        expect(entity!.type).toBe('function');
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('type ='),
          expect.arrayContaining(['validate', 'function'])
        );
      });

      it('should return null when name exists but type does not match', async () => {
        mockDb.mockGet(undefined);

        const entity = await entityStore.getByName('validate', 'class');

        expect(entity).toBeNull();
      });
    });

    describe('getByQualifiedName', () => {
      it('should retrieve entity by qualified name', async () => {
        const qualifiedName = 'src/auth/service.ts::AuthService::login';

        mockDb.mockGet({
          id: 'entity-1',
          type: 'method',
          name: 'login',
          qualified_name: qualifiedName,
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const entity = await entityStore.getByQualifiedName(qualifiedName);

        expect(entity!.qualifiedName).toBe(qualifiedName);
      });

      it('should match exact qualified name only', async () => {
        mockDb.mockGet(undefined);

        const entity = await entityStore.getByQualifiedName('src/auth/service.ts::AuthService');

        expect(entity).toBeNull();
      });
    });

    describe('getByFile', () => {
      it('should return all entities for a file', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'class', name: 'ClassA', qualified_name: 'src/service.ts::ClassA', start_line: 1, metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e2', type: 'method', name: 'methodA', qualified_name: 'src/service.ts::ClassA::methodA', start_line: 5, metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e3', type: 'method', name: 'methodB', qualified_name: 'src/service.ts::ClassA::methodB', start_line: 15, metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const entities = await entityStore.getByFile('src/service.ts');

        expect(entities).toHaveLength(3);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('file_path ='),
          ['src/service.ts']
        );
      });

      it('should order by start line', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'class', name: 'A', qualified_name: 'a', start_line: 1, metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e2', type: 'method', name: 'B', qualified_name: 'b', start_line: 10, metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e3', type: 'method', name: 'C', qualified_name: 'c', start_line: 25, metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const entities = await entityStore.getByFile('src/service.ts');

        expect(entities[0].startLine).toBeLessThan(entities[1].startLine!);
        expect(entities[1].startLine).toBeLessThan(entities[2].startLine!);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY start_line'),
          expect.any(Array)
        );
      });

      it('should return empty array for file with no entities', async () => {
        mockDb.mockAll([]);

        const entities = await entityStore.getByFile('nonexistent.ts');

        expect(entities).toEqual([]);
      });
    });

    describe('getByType', () => {
      it('should return all entities of a single type', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'function', name: 'funcA', qualified_name: 'a::funcA', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e2', type: 'function', name: 'funcB', qualified_name: 'b::funcB', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const entities = await entityStore.getByType(['function']);

        expect(entities).toHaveLength(2);
        entities.forEach((e: Entity) => expect(e.type).toBe('function'));
      });

      it('should return entities of multiple types', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'function', name: 'a', qualified_name: 'qa', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e2', type: 'method', name: 'b', qualified_name: 'qb', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e3', type: 'class', name: 'c', qualified_name: 'qc', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const entities = await entityStore.getByType(['function', 'method', 'class']);

        expect(entities).toHaveLength(3);
      });
    });

    describe('update', () => {
      it('should update specified fields', async () => {
        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'oldName',
          qualified_name: 'src/test.ts::oldName',
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        mockDb.mockRun({ changes: 1 });

        const update: UpdateEntityInput = { name: 'newName' };
        const entity = await entityStore.update('entity-1', update);

        expect(entity.name).toBe('newName');
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.any(Array)
        );
      });

      it('should recompute hash when content changes', async () => {
        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'test',
          qualified_name: 'src/test.ts::test',
          content: 'old content',
          hash: 'oldhash',
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        mockDb.mockRun({ changes: 1 });

        const newContent = 'updated function body';
        const update: UpdateEntityInput = { content: newContent };
        const entity = await entityStore.update('entity-1', update);

        expect(entity.hash).toBeDefined();
        expect(entity.hash).not.toBe('oldhash');
      });

      it('should merge metadata', async () => {
        const existingMetadata = { isAsync: false, visibility: 'public' };

        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'test',
          qualified_name: 'src/test.ts::test',
          metadata: JSON.stringify(existingMetadata),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        mockDb.mockRun({ changes: 1 });

        const update: UpdateEntityInput = { metadata: { isAsync: true } };
        const entity = await entityStore.update('entity-1', update);

        expect(entity.metadata.isAsync).toBe(true);
        expect(entity.metadata.visibility).toBe('public');
      });

      it('should update timestamp', async () => {
        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'test',
          qualified_name: 'src/test.ts::test',
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        mockDb.mockRun({ changes: 1 });

        await entityStore.update('entity-1', { name: 'newName' });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('updated_at'),
          expect.any(Array)
        );
      });

      it('should throw error for non-existent entity', async () => {
        mockDb.mockGet(undefined);

        await expect(entityStore.update('nonexistent', { name: 'new' }))
          .rejects.toThrow('Entity not found');
      });

      it('should update start and end lines', async () => {
        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'test',
          qualified_name: 'src/test.ts::test',
          start_line: 1,
          end_line: 10,
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        mockDb.mockRun({ changes: 1 });

        const entity = await entityStore.update('entity-1', { startLine: 5, endLine: 20 });

        expect(entity.startLine).toBe(5);
        expect(entity.endLine).toBe(20);
      });
    });

    describe('delete', () => {
      it('should delete entity by ID', async () => {
        mockDb.mockRun({ changes: 1 });

        const deleted = await entityStore.delete('entity-1');

        expect(deleted).toBe(true);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          ['entity-1']
        );
      });

      it('should return false when entity does not exist', async () => {
        mockDb.mockRun({ changes: 0 });

        const deleted = await entityStore.delete('nonexistent');

        expect(deleted).toBe(false);
      });
    });

    describe('deleteByFile', () => {
      it('should delete all entities for a file', async () => {
        mockDb.mockRun({ changes: 5 });

        const count = await entityStore.deleteByFile('src/deprecated.ts');

        expect(count).toBe(5);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          ['src/deprecated.ts']
        );
      });

      it('should return count of deleted entities', async () => {
        mockDb.mockRun({ changes: 3 });

        const count = await entityStore.deleteByFile('src/test.ts');

        expect(count).toBe(3);
      });
    });

    describe('deleteByType', () => {
      it('should delete all entities of a type', async () => {
        mockDb.mockRun({ changes: 10 });

        const count = await entityStore.deleteByType('message');

        expect(count).toBe(10);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          ['message']
        );
      });
    });

    describe('search', () => {
      it('should find entities matching query using FTS', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'class', name: 'authService', qualified_name: 'qa', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), rank: -1.5 },
          { id: 'e2', type: 'function', name: 'authenticate', qualified_name: 'qb', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), rank: -1.2 }
        ]);

        const options: SearchOptions = { query: 'auth*' };
        const results = await entityStore.search(options);

        expect(results).toHaveLength(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('MATCH'),
          expect.arrayContaining(['auth*'])
        );
      });

      it('should filter by type', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'class', name: 'UserService', qualified_name: 'q', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const options: SearchOptions = { query: 'user*', types: ['class'] };
        const results = await entityStore.search(options);

        expect(results).toHaveLength(1);
        expect(results[0].type).toBe('class');
      });

      it('should filter by file path', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'function', name: 'helper', qualified_name: 'q', file_path: 'src/utils/helpers.ts', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const options: SearchOptions = { query: 'helper', filePath: 'src/utils/helpers.ts' };
        const results = await entityStore.search(options);

        expect(results).toHaveLength(1);
        expect(results[0].filePath).toBe('src/utils/helpers.ts');
      });

      it('should respect limit', async () => {
        mockDb.mockAll([
          { id: 'e1', type: 'function', name: 'a', qualified_name: 'qa', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e2', type: 'function', name: 'b', qualified_name: 'qb', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e3', type: 'function', name: 'c', qualified_name: 'qc', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const options: SearchOptions = { query: 'test', limit: 3 };
        const results = await entityStore.search(options);

        expect(results.length).toBeLessThanOrEqual(3);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.any(Array)
        );
      });

      it('should respect offset', async () => {
        mockDb.mockAll([
          { id: 'e4', type: 'function', name: 'd', qualified_name: 'qd', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'e5', type: 'function', name: 'e', qualified_name: 'qe', metadata: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const options: SearchOptions = { query: 'test', limit: 2, offset: 3 };
        const results = await entityStore.search(options);

        expect(results).toHaveLength(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('OFFSET'),
          expect.any(Array)
        );
      });
    });

    describe('hash operations', () => {
      it('should detect existing content by hash', async () => {
        const content = 'function test() {}';
        const hash = hashContent(content);

        mockDb.mockGet({ count: 1 });

        const exists = await entityStore.existsByHash(hash);

        expect(exists).toBe(true);
      });

      it('should return false for non-existent hash', async () => {
        mockDb.mockGet({ count: 0 });

        const exists = await entityStore.existsByHash('nonexistent-hash');

        expect(exists).toBe(false);
      });

      it('should find entity by hash', async () => {
        const hash = hashContent('function test() {}');

        mockDb.mockGet({
          id: 'entity-1',
          type: 'function',
          name: 'test',
          qualified_name: 'src/test.ts::test',
          hash: hash,
          metadata: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const entity = await entityStore.getByHash(hash);

        expect(entity).toBeDefined();
        expect(entity!.hash).toBe(hash);
      });
    });

    describe('count', () => {
      it('should count all entities', async () => {
        mockDb.mockGet({ count: 150 });

        const count = await entityStore.count();

        expect(count).toBe(150);
      });

      it('should count entities by type', async () => {
        mockDb.mockGet({ count: 25 });

        const count = await entityStore.count('function');

        expect(count).toBe(25);
      });
    });
  });

  // ============================================================================
  // Content Hashing Tests
  // ============================================================================

  describe('content hashing', () => {
    it('should generate consistent hash for same content', async () => {
      mockDb.mockRun({ changes: 1 });

      const content = 'function test() { return true; }';
      const input1: CreateEntityInput = { type: 'function', name: 'test1', content, filePath: 'a.ts', startLine: 1, endLine: 1, metadata: {} };
      const input2: CreateEntityInput = { type: 'function', name: 'test2', content, filePath: 'b.ts', startLine: 1, endLine: 1, metadata: {} };

      const entity1 = await entityStore.create(input1);
      mockDb.mockRun({ changes: 1 });
      const entity2 = await entityStore.create(input2);

      expect(entity1.hash).toBe(entity2.hash);
    });

    it('should generate different hash for different content', async () => {
      mockDb.mockRun({ changes: 1 });

      const input1: CreateEntityInput = { type: 'function', name: 'a', content: 'function a() {}', filePath: 'a.ts', startLine: 1, endLine: 1, metadata: {} };
      const entity1 = await entityStore.create(input1);

      mockDb.mockRun({ changes: 1 });
      const input2: CreateEntityInput = { type: 'function', name: 'b', content: 'function b() {}', filePath: 'b.ts', startLine: 1, endLine: 1, metadata: {} };
      const entity2 = await entityStore.create(input2);

      expect(entity1.hash).not.toBe(entity2.hash);
    });

    it('should handle empty content', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = { type: 'concept', name: 'empty', content: '', metadata: {} };
      const entity = await entityStore.create(input);

      expect(entity.hash).toBeDefined();
    });

    it('should handle unicode content', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'variable',
        name: '名前',
        content: 'const 名前 = "テスト";',
        filePath: 'src/i18n.ts',
        startLine: 1,
        endLine: 1,
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.hash).toBeDefined();
      expect(entity.hash!.length).toBeGreaterThan(0);
    });

    it('should handle very long content', async () => {
      mockDb.mockRun({ changes: 1 });

      const longContent = 'x'.repeat(100000);
      const input: CreateEntityInput = {
        type: 'file',
        name: 'large.ts',
        content: longContent,
        filePath: 'src/large.ts',
        startLine: 1,
        endLine: 10000,
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.hash).toBeDefined();
      expect(entity.hash!.length).toBeLessThanOrEqual(64); // SHA-256 or similar
    });
  });

  // ============================================================================
  // Qualified Name Tests
  // ============================================================================

  describe('qualified names', () => {
    it('should format code entity qualified name', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'method',
        name: 'login',
        filePath: 'src/auth/service.ts',
        startLine: 10,
        endLine: 20,
        metadata: { parentClass: 'AuthService' }
      };
      const entity = await entityStore.create(input);

      // Format: filepath::class::method or filepath::function
      expect(entity.qualifiedName).toContain('::');
      expect(entity.qualifiedName).toContain('src/auth/service.ts');
    });

    it('should format document entity qualified name', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'section',
        name: 'OAuth',
        filePath: 'docs/requirements.md',
        startLine: 50,
        endLine: 100,
        metadata: { parentSection: 'Authentication' }
      };
      const entity = await entityStore.create(input);

      expect(entity.qualifiedName).toContain('docs/');
      expect(entity.qualifiedName).toContain('.md');
    });

    it('should format concept entity qualified name', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'concept',
        name: 'rate-limiting',
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.qualifiedName.startsWith('concept::')).toBe(true);
    });

    it('should format technology entity qualified name', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'technology',
        name: 'postgresql',
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.qualifiedName.startsWith('technology::')).toBe(true);
    });

    it('should be unique within project', async () => {
      mockDb.mockRun({ changes: 1 });

      const input1: CreateEntityInput = { type: 'function', name: 'funcA', filePath: 'src/a.ts', startLine: 1, endLine: 5, metadata: {} };
      const entity1 = await entityStore.create(input1);

      mockDb.mockRun({ changes: 1 });
      const input2: CreateEntityInput = { type: 'function', name: 'funcA', filePath: 'src/b.ts', startLine: 1, endLine: 5, metadata: {} };
      const entity2 = await entityStore.create(input2);

      expect(entity1.qualifiedName).not.toBe(entity2.qualifiedName);
    });
  });

  // ============================================================================
  // Entity Types Tests
  // ============================================================================

  describe('entity types', () => {
    const validTypes: EntityType[] = [
      'file', 'module', 'class', 'function', 'method',
      'interface', 'type', 'variable', 'document', 'section',
      'requirement', 'session', 'message', 'concept', 'technology',
      'pattern', 'decision'
    ];

    validTypes.forEach(type => {
      it(`should support ${type} type`, async () => {
        mockDb.mockRun({ changes: 1 });

        const input: CreateEntityInput = { type, name: `test-${type}`, metadata: {} };
        const entity = await entityStore.create(input);

        expect(entity.type).toBe(type);
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle entities with no file path', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'concept',
        name: 'domain-concept',
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.filePath).toBeUndefined();
      expect(entity.startLine).toBeUndefined();
      expect(entity.endLine).toBeUndefined();
    });

    it('should handle entities with very long names', async () => {
      mockDb.mockRun({ changes: 1 });

      const longName = 'veryLongFunctionNameThatExceedsNormalLimits'.repeat(10);
      const input: CreateEntityInput = {
        type: 'function',
        name: longName,
        filePath: 'src/test.ts',
        startLine: 1,
        endLine: 5,
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.name.length).toBeGreaterThan(100);
    });

    it('should handle special characters in names', async () => {
      const specialNames = ['$init', '_private', '__dunder__', 'method$1'];

      for (const name of specialNames) {
        mockDb.mockRun({ changes: 1 });
        const input: CreateEntityInput = { type: 'function', name, filePath: 'test.ts', startLine: 1, endLine: 1, metadata: {} };
        const entity = await entityStore.create(input);
        expect(entity.name).toBe(name);
      }
    });

    it('should handle entities with empty metadata', async () => {
      mockDb.mockRun({ changes: 1 });

      const input: CreateEntityInput = {
        type: 'function',
        name: 'test',
        filePath: 'test.ts',
        startLine: 1,
        endLine: 1,
        metadata: {}
      };
      const entity = await entityStore.create(input);

      expect(entity.metadata).toEqual({});
    });

    it('should handle concurrent entity creation', async () => {
      mockDb.mockRun({ changes: 1 });

      const inputs: CreateEntityInput[] = [
        { type: 'function', name: 'entity1', filePath: 'a.ts', startLine: 1, endLine: 1, metadata: {} },
        { type: 'function', name: 'entity2', filePath: 'b.ts', startLine: 1, endLine: 1, metadata: {} },
        { type: 'function', name: 'entity3', filePath: 'c.ts', startLine: 1, endLine: 1, metadata: {} }
      ];

      const entities = await Promise.all(inputs.map(input => {
        mockDb.mockRun({ changes: 1 });
        return entityStore.create(input);
      }));

      const uniqueIds = new Set(entities.map((e: Entity) => e.id));
      expect(uniqueIds.size).toBe(3);
    });

    it('should handle overlapping line ranges', async () => {
      mockDb.mockRun({ changes: 1 });

      // A class containing a method
      const classInput: CreateEntityInput = {
        type: 'class',
        name: 'TestClass',
        filePath: 'src/test.ts',
        startLine: 1,
        endLine: 50,
        metadata: {}
      };
      const classEntity = await entityStore.create(classInput);

      mockDb.mockRun({ changes: 1 });
      const methodInput: CreateEntityInput = {
        type: 'method',
        name: 'testMethod',
        filePath: 'src/test.ts',
        startLine: 10,
        endLine: 25,
        metadata: { parentId: classEntity.id }
      };
      const methodEntity = await entityStore.create(methodInput);

      // Method is within class range
      expect(methodEntity.startLine).toBeGreaterThanOrEqual(classEntity.startLine!);
      expect(methodEntity.endLine).toBeLessThanOrEqual(classEntity.endLine!);
    });
  });
});
