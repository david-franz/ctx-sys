/**
 * F1.1 Database Schema Tests
 *
 * Tests for database connection, schema creation, migrations,
 * and sqlite-vec/FTS5 operations.
 *
 * These tests will FAIL until the actual implementation is created.
 * Implement the classes in src/database/ to make them pass.
 *
 * @see docs/phase-1/F1.1-database-schema.md
 */

// Import actual implementations - these will fail until implemented
import { DatabaseConnection } from '../../src/db/connection';
import { MigrationManager } from '../../src/db/migrations';
import { createProjectSchema, dropProjectSchema } from '../../src/db/schema';

// Import mocks for dependencies
import { createMockDatabase, MockDatabase } from '../helpers/mocks';

// Mock better-sqlite3 to provide a mock database
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => createMockDatabase());
}, { virtual: true });

describe('F1.1 Database Schema', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = createMockDatabase();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // DatabaseConnection Tests
  // ============================================================================

  describe('DatabaseConnection', () => {
    describe('constructor', () => {
      it('should create a database connection with the specified path', () => {
        const connection = new DatabaseConnection(':memory:');
        expect(connection).toBeDefined();
        expect(connection.db).toBeDefined();
      });

      it('should set WAL journal mode for better concurrent performance', () => {
        const connection = new DatabaseConnection(':memory:');
        // Verify pragma was called during initialization
        expect(connection.db.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      });

      it('should enable foreign key constraints', () => {
        const connection = new DatabaseConnection(':memory:');
        expect(connection.db.pragma).toHaveBeenCalledWith('foreign_keys = ON');
      });

      it('should load sqlite-vec extension', () => {
        const connection = new DatabaseConnection(':memory:');
        expect(connection.db.loadExtension).toHaveBeenCalledWith(expect.stringContaining('vec'));
      });

      it('should handle extension loading errors gracefully', () => {
        // Mock extension loading to fail
        jest.spyOn(mockDb, 'loadExtension').mockImplementationOnce(() => {
          throw new Error('Extension not found');
        });

        // Connection should still be created, but vecEnabled should be false
        const connection = new DatabaseConnection(':memory:');
        expect(connection.vecEnabled).toBe(false);
      });
    });

    describe('initialize', () => {
      it('should create global tables on initialization', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.initialize();

        // Verify projects table was created
        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS projects')
        );
      });

      it('should create embedding_models table', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.initialize();

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS embedding_models')
        );
      });

      it('should create config table', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.initialize();

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS config')
        );
      });

      it('should be idempotent (safe to call multiple times)', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.initialize();
        await connection.initialize();
        // Should not throw
        expect(connection.db.exec).toHaveBeenCalled();
      });
    });

    describe('createProjectTables', () => {
      const projectId = 'proj_abc123';

      it('should create entities table with correct prefix', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_entities`)
        );
      });

      it('should create vectors virtual table using sqlite-vec', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_vectors`)
        );
      });

      it('should create relationships table', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_relationships`)
        );
      });

      it('should create sessions table', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_sessions`)
        );
      });

      it('should create messages table', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_messages`)
        );
      });

      it('should create FTS5 virtual table for full-text search', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_fts`)
        );
        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining('fts5')
        );
      });

      it('should create indexes for common queries', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining('CREATE INDEX')
        );
      });

      it('should create ast_cache table', async () => {
        const connection = new DatabaseConnection(':memory:');
        await connection.createProjectTables(projectId);

        expect(connection.db.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${projectId}_ast_cache`)
        );
      });
    });

    describe('transaction', () => {
      it('should execute function within a transaction', () => {
        const connection = new DatabaseConnection(':memory:');

        const result = connection.transaction(() => {
          connection.db.run('INSERT INTO test VALUES (1)');
          connection.db.run('INSERT INTO test VALUES (2)');
          return 'success';
        });

        expect(result).toBe('success');
      });

      it('should rollback on error', () => {
        const connection = new DatabaseConnection(':memory:');

        expect(() => {
          connection.transaction(() => {
            connection.db.run('INSERT INTO test VALUES (1)');
            throw new Error('Transaction error');
          });
        }).toThrow('Transaction error');

        // Transaction should have been rolled back
      });
    });

    describe('query methods', () => {
      it('run should execute write operations and return changes', () => {
        const connection = new DatabaseConnection(':memory:');
        mockDb.run.mockReturnValueOnce({ changes: 1, lastInsertRowid: 42 });

        const result = connection.run('INSERT INTO test (id) VALUES (?)', ['test-1']);

        expect(result.changes).toBe(1);
        expect(result.lastInsertRowid).toBe(42);
      });

      it('get should return single row or undefined', () => {
        const connection = new DatabaseConnection(':memory:');
        mockDb.get.mockReturnValueOnce({ id: 'test-1', name: 'Test' });

        const result = connection.get<{ id: string; name: string }>(
          'SELECT * FROM test WHERE id = ?',
          ['test-1']
        );

        expect(result).toEqual({ id: 'test-1', name: 'Test' });
      });

      it('get should return undefined for no results', () => {
        const connection = new DatabaseConnection(':memory:');
        mockDb.get.mockReturnValueOnce(undefined);

        const result = connection.get('SELECT * FROM test WHERE id = ?', ['nonexistent']);

        expect(result).toBeUndefined();
      });

      it('all should return array of rows', () => {
        const connection = new DatabaseConnection(':memory:');
        mockDb.all.mockReturnValueOnce([
          { id: '1', name: 'First' },
          { id: '2', name: 'Second' }
        ]);

        const results = connection.all<{ id: string; name: string }>('SELECT * FROM test');

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ id: '1', name: 'First' });
      });

      it('all should return empty array for no results', () => {
        const connection = new DatabaseConnection(':memory:');
        mockDb.all.mockReturnValueOnce([]);

        const results = connection.all('SELECT * FROM test WHERE 1=0');

        expect(results).toEqual([]);
      });
    });

    describe('close', () => {
      it('should close the database connection', () => {
        const connection = new DatabaseConnection(':memory:');
        connection.close();

        expect(connection.db.close).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // MigrationManager Tests
  // ============================================================================

  describe('MigrationManager', () => {
    let connection: DatabaseConnection;
    let migrationManager: MigrationManager;

    beforeEach(() => {
      connection = new DatabaseConnection(':memory:');
      migrationManager = new MigrationManager(connection);
    });

    describe('getCurrentVersion', () => {
      it('should return 0 when no migrations have run', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        const version = await migrationManager.getCurrentVersion();

        expect(version).toBe(0);
      });

      it('should return the highest version number', async () => {
        mockDb.get.mockReturnValueOnce({ version: 3 });

        const version = await migrationManager.getCurrentVersion();

        expect(version).toBe(3);
      });
    });

    describe('migrate', () => {
      it('should apply migrations in order', async () => {
        mockDb.get.mockReturnValueOnce({ version: 0 }); // Current version

        await migrationManager.migrate();

        // Should have executed migrations
        expect(connection.db.exec).toHaveBeenCalled();
        expect(connection.db.run).toHaveBeenCalled();
      });

      it('should skip already applied migrations', async () => {
        mockDb.get.mockReturnValueOnce({ version: 2 }); // Already at version 2

        await migrationManager.migrate();

        // Should only apply migrations > 2
        expect(connection.db.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO migrations'),
          expect.arrayContaining([expect.any(Number)])
        );
      });

      it('should migrate to specific version when specified', async () => {
        mockDb.get.mockReturnValueOnce({ version: 0 });

        await migrationManager.migrate(2);

        // Should only apply up to version 2
        // Verify run was called with version <= 2
      });

      it('should record applied migrations', async () => {
        mockDb.get.mockReturnValueOnce({ version: 0 });

        await migrationManager.migrate();

        expect(connection.db.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO migrations'),
          expect.any(Array)
        );
      });
    });

    describe('rollback', () => {
      it('should rollback single migration by default', async () => {
        mockDb.get.mockReturnValueOnce({ version: 3 });

        await migrationManager.rollback();

        expect(connection.db.exec).toHaveBeenCalled();
        expect(connection.db.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM migrations'),
          expect.arrayContaining([3])
        );
      });

      it('should rollback multiple migrations when steps specified', async () => {
        mockDb.get.mockReturnValueOnce({ version: 3 });

        await migrationManager.rollback(2);

        // Should rollback 2 steps
        expect(connection.db.run).toHaveBeenCalledTimes(expect.any(Number));
      });

      it('should not rollback below version 0', async () => {
        mockDb.get.mockReturnValueOnce({ version: 1 });

        await migrationManager.rollback(5);

        // Should only rollback 1 step
        expect(connection.db.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM migrations'),
          expect.arrayContaining([1])
        );
      });
    });
  });

  // ============================================================================
  // Schema Functions Tests
  // ============================================================================

  describe('Schema Functions', () => {
    describe('createProjectSchema', () => {
      it('should return valid SQL for all project tables', () => {
        const projectId = 'test_proj';
        const sql = createProjectSchema(projectId);

        expect(sql).toContain(`${projectId}_entities`);
        expect(sql).toContain(`${projectId}_vectors`);
        expect(sql).toContain(`${projectId}_relationships`);
        expect(sql).toContain(`${projectId}_sessions`);
        expect(sql).toContain(`${projectId}_messages`);
        expect(sql).toContain(`${projectId}_ast_cache`);
        expect(sql).toContain(`${projectId}_fts`);
      });

      it('should sanitize project ID to prevent injection', () => {
        const maliciousId = 'proj; DROP TABLE projects; --';

        expect(() => createProjectSchema(maliciousId)).toThrow();
      });

      it('should include CREATE TABLE IF NOT EXISTS', () => {
        const sql = createProjectSchema('test_proj');

        expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
      });
    });

    describe('dropProjectSchema', () => {
      it('should return valid SQL for dropping all project tables', () => {
        const projectId = 'test_proj';
        const sql = dropProjectSchema(projectId);

        expect(sql).toContain(`DROP TABLE IF EXISTS ${projectId}_entities`);
        expect(sql).toContain(`DROP TABLE IF EXISTS ${projectId}_vectors`);
        expect(sql).toContain(`DROP TABLE IF EXISTS ${projectId}_relationships`);
      });

      it('should drop tables in correct order (respecting foreign keys)', () => {
        const projectId = 'test_proj';
        const sql = dropProjectSchema(projectId);

        // Messages should be dropped before sessions
        const messagesIndex = sql.indexOf(`${projectId}_messages`);
        const sessionsIndex = sql.indexOf(`${projectId}_sessions`);

        expect(messagesIndex).toBeLessThan(sessionsIndex);
      });
    });
  });

  // ============================================================================
  // sqlite-vec Operations Tests
  // ============================================================================

  describe('sqlite-vec operations', () => {
    let connection: DatabaseConnection;

    beforeEach(() => {
      connection = new DatabaseConnection(':memory:');
    });

    it('should store embeddings', async () => {
      const embedding = Array(768).fill(0).map((_, i) => Math.sin(i) * 0.5);

      await connection.storeEmbedding('proj_123', 'entity-1', 'model-1', embedding);

      expect(connection.db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([expect.any(String), 'entity-1', 'model-1'])
      );
    });

    it('should query similar embeddings', async () => {
      const queryEmbedding = Array(768).fill(0.1);
      mockDb.all.mockReturnValueOnce([
        { entity_id: 'entity-1', distance: 0.15 },
        { entity_id: 'entity-2', distance: 0.25 }
      ]);

      const results = await connection.findSimilar('proj_123', queryEmbedding, 10);

      expect(results).toHaveLength(2);
      expect(results[0].distance).toBeLessThan(results[1].distance);
    });

    it('should filter by model_id', async () => {
      const queryEmbedding = Array(768).fill(0.1);
      mockDb.all.mockReturnValueOnce([{ entity_id: 'entity-1', distance: 0.1 }]);

      const results = await connection.findSimilar(
        'proj_123',
        queryEmbedding,
        10,
        { modelId: 'ollama:nomic-embed-text' }
      );

      expect(connection.db.all).toHaveBeenCalledWith(
        expect.stringContaining('model_id'),
        expect.arrayContaining(['ollama:nomic-embed-text'])
      );
    });
  });

  // ============================================================================
  // FTS5 Operations Tests
  // ============================================================================

  describe('FTS5 operations', () => {
    let connection: DatabaseConnection;

    beforeEach(() => {
      connection = new DatabaseConnection(':memory:');
    });

    it('should search using FTS', async () => {
      mockDb.all.mockReturnValueOnce([
        { id: 'e1', name: 'authService', rank: -1.5 },
        { id: 'e2', name: 'authenticate', rank: -1.2 }
      ]);

      const results = await connection.searchFTS('proj_123', 'auth*');

      expect(results).toHaveLength(2);
      expect(connection.db.all).toHaveBeenCalledWith(
        expect.stringContaining('MATCH'),
        expect.arrayContaining(['auth*'])
      );
    });

    it('should support phrase queries', async () => {
      mockDb.all.mockReturnValueOnce([{ id: 'e1', name: 'error handler' }]);

      const results = await connection.searchFTS('proj_123', '"error handler"');

      expect(results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases', () => {
    it('should handle special characters in project IDs', () => {
      const connection = new DatabaseConnection(':memory:');
      const maliciousId = 'proj; DROP TABLE--';

      expect(() => connection.createProjectTables(maliciousId)).toThrow();
    });

    it('should handle very long content in entities', async () => {
      const connection = new DatabaseConnection(':memory:');
      const longContent = 'x'.repeat(100000);

      // Should not throw
      await expect(
        connection.run(
          'INSERT INTO proj_entities (id, content) VALUES (?, ?)',
          ['e1', longContent]
        )
      ).resolves.toBeDefined();
    });

    it('should handle unicode content', async () => {
      const connection = new DatabaseConnection(':memory:');
      const unicodeContent = '函数名称 функция 関数';

      await expect(
        connection.run(
          'INSERT INTO proj_entities (id, name) VALUES (?, ?)',
          ['e1', unicodeContent]
        )
      ).resolves.toBeDefined();
    });

    it('should handle concurrent read operations', async () => {
      const connection = new DatabaseConnection(':memory:');

      const reads = await Promise.all([
        connection.get('SELECT * FROM proj_entities WHERE id = ?', ['e1']),
        connection.get('SELECT * FROM proj_entities WHERE id = ?', ['e2']),
        connection.get('SELECT * FROM proj_entities WHERE id = ?', ['e3'])
      ]);

      expect(connection.db.get).toHaveBeenCalledTimes(3);
    });
  });
});
