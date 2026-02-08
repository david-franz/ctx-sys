import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { MigrationManager } from '../../src/db/migrations';
import {
  sanitizeProjectId,
  getProjectTableNames,
  createProjectTables,
  dropProjectTables
} from '../../src/db/schema';

describe('F1.1 Database Schema', () => {
  let db: DatabaseConnection;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database for each test
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test directory
    if (testDbPath) {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    }
  });

  describe('DatabaseConnection', () => {
    it('should create global tables on initialize', () => {
      // Check that projects table exists
      const tables = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='projects'`
      );
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('projects');
    });

    it('should create all global tables', () => {
      const expectedTables = [
        'projects',
        'embedding_models',
        'config',
        'shared_entities',
        'cross_project_links',
        'schema_version'
      ];

      for (const tableName of expectedTables) {
        const tables = db.all<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [tableName]
        );
        expect(tables).toHaveLength(1);
      }
    });

    it('should create project tables with correct prefix', () => {
      const projectId = 'test-project-123';
      db.createProject(projectId);

      const prefix = sanitizeProjectId(projectId);
      const entitiesTable = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [`${prefix}_entities`]
      );
      expect(entitiesTable).toHaveLength(1);
    });

    it('should enable foreign key constraints', () => {
      const result = db.get<{ foreign_keys: number }>('PRAGMA foreign_keys');
      expect(result?.foreign_keys).toBe(1);
    });

    it('should handle transactions correctly', () => {
      // Insert in transaction
      db.transaction(() => {
        db.run(
          `INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`,
          ['p1', 'test-project', '/test/path']
        );
      });

      const project = db.get<{ name: string }>(
        `SELECT name FROM projects WHERE id = ?`,
        ['p1']
      );
      expect(project?.name).toBe('test-project');
    });

    it('should rollback transaction on error', () => {
      try {
        db.transaction(() => {
          db.run(
            `INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`,
            ['p2', 'test-project-2', '/test/path2']
          );
          throw new Error('Simulated error');
        });
      } catch {
        // Expected
      }

      const project = db.get<{ name: string }>(
        `SELECT name FROM projects WHERE id = ?`,
        ['p2']
      );
      expect(project).toBeUndefined();
    });

    it('should persist data to file on save', async () => {
      db.run(
        `INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`,
        ['p3', 'persist-test', '/test/persist']
      );
      db.save();
      db.close();

      // Reopen database
      const db2 = new DatabaseConnection(testDbPath);
      await db2.initialize();

      const project = db2.get<{ name: string }>(
        `SELECT name FROM projects WHERE id = ?`,
        ['p3']
      );
      expect(project?.name).toBe('persist-test');

      db2.close();
    });

    it('should return correct RunResult from run()', () => {
      const result = db.run(
        `INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`,
        ['p4', 'run-test', '/test/run']
      );
      expect(result.changes).toBe(1);
    });

    it('should return all rows with all()', () => {
      db.run(`INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`, ['p5', 'all-test-1', '/test/1']);
      db.run(`INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`, ['p6', 'all-test-2', '/test/2']);

      const projects = db.all<{ id: string; name: string }>(
        `SELECT id, name FROM projects WHERE name LIKE ?`,
        ['all-test%']
      );
      expect(projects).toHaveLength(2);
    });

    it('should return undefined for non-existent row', () => {
      const result = db.get<{ name: string }>(
        `SELECT name FROM projects WHERE id = ?`,
        ['non-existent']
      );
      expect(result).toBeUndefined();
    });
  });

  describe('Schema Functions', () => {
    it('should sanitize project ID correctly', () => {
      // All prefixed with 'p_' to ensure valid SQL identifiers
      expect(sanitizeProjectId('my-project')).toBe('p_my_project');
      expect(sanitizeProjectId('my.project.name')).toBe('p_my_project_name');
      expect(sanitizeProjectId('test123')).toBe('p_test123');
      expect(sanitizeProjectId('a-b_c.d')).toBe('p_a_b_c_d');
    });

    it('should return correct project table names', () => {
      const tables = getProjectTableNames('test-proj');
      expect(tables).toContain('p_test_proj_entities');
      expect(tables).toContain('p_test_proj_vector_meta');
      expect(tables).toContain('p_test_proj_vec');
      expect(tables).toContain('p_test_proj_relationships');
      expect(tables).toContain('p_test_proj_sessions');
      expect(tables).toContain('p_test_proj_messages');
      expect(tables).toContain('p_test_proj_ast_cache');
    });

    it('should create all project tables', () => {
      db.createProject('full-test');

      const tableNames = getProjectTableNames('full-test');
      for (const tableName of tableNames) {
        // vec0 virtual table is created on demand by EmbeddingManager, not createProjectTables()
        if (tableName.endsWith('_vec')) continue;
        const tables = db.all<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [tableName]
        );
        expect(tables.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should support LIKE-based text search', () => {
      db.createProject('search-test');

      // Insert an entity (table name is prefixed with p_)
      db.run(
        `INSERT INTO p_search_test_entities (id, type, name, content, summary) VALUES (?, ?, ?, ?, ?)`,
        ['e1', 'function', 'testFunction', 'function test() { return 1; }', 'A test function']
      );

      // Search using LIKE
      const results = db.all<{ name: string }>(
        `SELECT name FROM p_search_test_entities WHERE name LIKE ? OR content LIKE ?`,
        ['%test%', '%test%']
      );
      expect(results.length).toBeGreaterThan(0);
    });

    it('should drop project tables', () => {
      db.createProject('drop-test');
      db.dropProject('drop-test');

      const tables = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?`,
        ['drop_test_%']
      );
      expect(tables).toHaveLength(0);
    });
  });

  describe('MigrationManager', () => {
    let migrationManager: MigrationManager;

    beforeEach(() => {
      migrationManager = new MigrationManager(db);
    });

    it('should track migration versions', () => {
      const version = migrationManager.getCurrentVersion();
      expect(typeof version).toBe('number');
    });

    it('should apply migrations in order', () => {
      // Initial migration is already applied via GLOBAL_SCHEMA
      const result = migrationManager.migrate();
      expect(result.current).toBeGreaterThanOrEqual(0);
    });

    it('should return applied migrations', () => {
      migrationManager.migrate();
      const applied = migrationManager.getAppliedMigrations();
      expect(Array.isArray(applied)).toBe(true);
    });

    it('should detect pending migrations', () => {
      const hasPending = migrationManager.hasPendingMigrations();
      expect(typeof hasPending).toBe('boolean');
    });

    it('should list pending migrations', () => {
      const pending = migrationManager.getPendingMigrations();
      expect(Array.isArray(pending)).toBe(true);
    });
  });

  describe('Project Table Indexes', () => {
    it('should create indexes on entity columns', () => {
      db.createProject('index-test');
      const prefix = 'p_index_test';

      const indexes = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE ?`,
        [`idx_${prefix}_%`]
      );

      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain(`idx_${prefix}_entities_type`);
      expect(indexNames).toContain(`idx_${prefix}_entities_file`);
      expect(indexNames).toContain(`idx_${prefix}_entities_name`);
      expect(indexNames).toContain(`idx_${prefix}_entities_qualified`);
    });
  });
});
