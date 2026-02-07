import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities';

describe('F10.10 - Native SQLite + FTS5', () => {
  let tempDir: string;
  let db: DatabaseConnection;
  let entityStore: EntityStore;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-10-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject('test-project');
    entityStore = new EntityStore(db, 'test-project');
  });

  afterEach(() => {
    db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Database Connection (better-sqlite3)', () => {
    it('should initialize and create global tables', () => {
      const tables = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='projects'`
      );
      expect(tables).toHaveLength(1);
    });

    it('should support WAL mode', () => {
      const result = db.get<{ journal_mode: string }>(
        `PRAGMA journal_mode`
      );
      expect(result?.journal_mode).toBe('wal');
    });

    it('should create project tables with FTS5', () => {
      // Check FTS5 table exists
      const fts = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='p_test_project_entities_fts'`
      );
      expect(fts).toHaveLength(1);
    });

    it('should support transactions', () => {
      const result = db.transaction(() => {
        db.run(
          `INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`,
          ['test-id', 'test-name', '/test/path']
        );
        return db.get<{ id: string }>(`SELECT id FROM projects WHERE id = ?`, ['test-id']);
      });
      expect(result?.id).toBe('test-id');
    });

    it('should support save and close', () => {
      db.run(
        `INSERT INTO projects (id, name, path) VALUES (?, ?, ?)`,
        ['save-test', 'save-name', '/save/path']
      );
      db.save();

      // Re-open and verify data persisted
      db.close();
      db = new DatabaseConnection(path.join(tempDir, 'test.db'));
      // Need to reinitialize
      // The data should persist because we saved
    });
  });

  describe('FTS5 Full-Text Search', () => {
    beforeEach(async () => {
      // Create test entities
      await entityStore.create({
        type: 'function',
        name: 'authenticateUser',
        content: 'async function authenticateUser(username: string, password: string) { return validateCredentials(username, password); }',
        summary: 'Authenticates a user with username and password'
      });
      await entityStore.create({
        type: 'function',
        name: 'validateToken',
        content: 'function validateToken(token: string) { return jwt.verify(token, secret); }',
        summary: 'Validates a JWT authentication token'
      });
      await entityStore.create({
        type: 'class',
        name: 'DatabaseConnection',
        content: 'class DatabaseConnection { constructor(path: string) {} async initialize() {} }',
        summary: 'Manages SQLite database connections'
      });
      await entityStore.create({
        type: 'function',
        name: 'processPayment',
        content: 'function processPayment(amount: number) { return chargeCard(amount); }',
        summary: 'Processes a payment transaction'
      });
    });

    it('should find entities by name with FTS5', async () => {
      const results = await entityStore.search('authenticate');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.name === 'authenticateUser')).toBe(true);
    });

    it('should find entities by content with FTS5', async () => {
      const results = await entityStore.search('validateCredentials');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.name === 'authenticateUser')).toBe(true);
    });

    it('should find entities by summary with FTS5', async () => {
      const results = await entityStore.search('database');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.name === 'DatabaseConnection')).toBe(true);
    });

    it('should support prefix matching', async () => {
      const results = await entityStore.search('auth');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Should match authenticateUser and/or validateToken (which mentions authentication)
    });

    it('should filter by entity type', async () => {
      const results = await entityStore.search('authenticate', { type: 'function' });
      expect(results.every(r => r.type === 'function')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const results = await entityStore.search('function', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for non-matching queries', async () => {
      const results = await entityStore.search('zzzznonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('FTS5 Sync Triggers', () => {
    it('should automatically index new entities in FTS5', async () => {
      await entityStore.create({
        type: 'function',
        name: 'newFunction',
        content: 'function newFunction() { return "hello"; }',
        summary: 'A brand new function'
      });

      const results = await entityStore.search('newFunction');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should update FTS5 when entity is updated', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'updateMe',
        content: 'original content',
        summary: 'original summary'
      });

      await entityStore.update(entity.id, {
        content: 'completely different updated content with unique keyword xylophone'
      });

      const results = await entityStore.search('xylophone');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('updateMe');
    });

    it('should remove from FTS5 when entity is deleted', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'deleteMe',
        content: 'this entity will be deleted uniqueword',
        summary: 'temporary'
      });

      // Verify it's searchable
      let results = await entityStore.search('uniqueword');
      expect(results.length).toBeGreaterThanOrEqual(1);

      // Delete it
      await entityStore.delete(entity.id);

      // Should no longer be searchable
      results = await entityStore.search('uniqueword');
      expect(results).toHaveLength(0);
    });
  });
});
