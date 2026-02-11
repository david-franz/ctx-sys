import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities';
import { nullLogger } from '../../src/utils/logger';

describe('EntityStore.listPaginated', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let testDbPath: string;
  const projectId = 'test-pagination';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-pagination-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath, { logger: nullLogger });
    await db.initialize();
    db.createProject(projectId);
    entityStore = new EntityStore(db, projectId);
  });

  afterEach(() => {
    if (db) db.close();
    if (testDbPath) {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    }
  });

  it('should yield empty when no entities exist', () => {
    const pages = [...entityStore.listPaginated({ pageSize: 10 })];
    expect(pages).toHaveLength(0);
  });

  it('should yield a single page when count < pageSize', () => {
    for (let i = 0; i < 3; i++) {
      entityStore.create({ name: `entity-${i}`, type: 'function', filePath: 'f.ts', startLine: i, endLine: i + 1 });
    }

    const pages = [...entityStore.listPaginated({ pageSize: 10 })];
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(3);
  });

  it('should yield multiple pages for large datasets', () => {
    for (let i = 0; i < 25; i++) {
      entityStore.create({ name: `entity-${i}`, type: 'class', filePath: 'f.ts', startLine: i, endLine: i + 1 });
    }

    const pages = [...entityStore.listPaginated({ pageSize: 10 })];
    expect(pages).toHaveLength(3);
    expect(pages[0]).toHaveLength(10);
    expect(pages[1]).toHaveLength(10);
    expect(pages[2]).toHaveLength(5);
  });

  it('should handle exactly one page (count === pageSize)', () => {
    for (let i = 0; i < 10; i++) {
      entityStore.create({ name: `entity-${i}`, type: 'class', filePath: 'f.ts', startLine: i, endLine: i + 1 });
    }

    const pages = [...entityStore.listPaginated({ pageSize: 10 })];
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(10);
  });

  it('should filter by entity type', () => {
    entityStore.create({ name: 'cls', type: 'class', filePath: 'f.ts', startLine: 1, endLine: 2 });
    entityStore.create({ name: 'fn', type: 'function', filePath: 'f.ts', startLine: 3, endLine: 4 });
    entityStore.create({ name: 'ifc', type: 'interface', filePath: 'f.ts', startLine: 5, endLine: 6 });

    const pages = [...entityStore.listPaginated({ type: 'function', pageSize: 10 })];
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(1);
    expect(pages[0][0].type).toBe('function');
  });

  it('should default to pageSize 500', () => {
    // Just verify it doesn't throw with no pageSize specified
    for (let i = 0; i < 5; i++) {
      entityStore.create({ name: `entity-${i}`, type: 'class', filePath: 'f.ts', startLine: i, endLine: i + 1 });
    }

    const pages = [...entityStore.listPaginated()];
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(5);
  });

  it('should return all entities across all pages', () => {
    const count = 23;
    for (let i = 0; i < count; i++) {
      entityStore.create({ name: `entity-${i}`, type: 'class', filePath: 'f.ts', startLine: i, endLine: i + 1 });
    }

    const pages = [...entityStore.listPaginated({ pageSize: 7 })];
    const allEntities = pages.flat();
    expect(allEntities).toHaveLength(count);

    // Verify all unique IDs
    const ids = new Set(allEntities.map(e => e.id));
    expect(ids.size).toBe(count);
  });
});
