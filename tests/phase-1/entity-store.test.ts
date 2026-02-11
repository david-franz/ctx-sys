import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities/store';
import { EntityType } from '../../src/entities/types';
import { hashContent } from '../../src/utils/hash';

describe('F1.3 Entity Storage', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);
    entityStore = new EntityStore(db, projectId);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (testDbPath) {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    }
  });

  describe('create', () => {
    it('should create an entity with auto-generated ID', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunction'
      });

      expect(entity.id).toBeDefined();
      expect(entity.type).toBe('function');
      expect(entity.name).toBe('testFunction');
      expect(entity.createdAt).toBeInstanceOf(Date);
    });

    it('should compute content hash', async () => {
      const content = 'function test() { return 1; }';
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunction',
        content
      });

      expect(entity.hash).toBe(hashContent(content));
    });

    it('should generate qualified name if not provided', async () => {
      const entity1 = await entityStore.create({
        type: 'function',
        name: 'myFunc',
        filePath: 'src/utils.ts'
      });
      expect(entity1.qualifiedName).toBe('src/utils.ts::myFunc');

      const entity2 = await entityStore.create({
        type: 'concept',
        name: 'rate-limiting'
      });
      expect(entity2.qualifiedName).toBe('concept::rate-limiting');
    });

    it('should use provided qualified name', async () => {
      const entity = await entityStore.create({
        type: 'method',
        name: 'login',
        qualifiedName: 'src/auth.ts::AuthService::login'
      });
      expect(entity.qualifiedName).toBe('src/auth.ts::AuthService::login');
    });

    it('should store metadata as JSON', async () => {
      const metadata = { visibility: 'public', async: true };
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunction',
        metadata
      });

      expect(entity.metadata).toEqual(metadata);
    });

    it('should store file location info', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunction',
        filePath: 'src/index.ts',
        startLine: 10,
        endLine: 25
      });

      expect(entity.filePath).toBe('src/index.ts');
      expect(entity.startLine).toBe(10);
      expect(entity.endLine).toBe(25);
    });
  });

  describe('createMany', () => {
    it('should create multiple entities in transaction', async () => {
      const inputs = [
        { type: 'function' as EntityType, name: 'func1' },
        { type: 'function' as EntityType, name: 'func2' },
        { type: 'function' as EntityType, name: 'func3' }
      ];

      const entities = await entityStore.createMany(inputs);

      expect(entities).toHaveLength(3);
      expect(entities.map(e => e.name)).toEqual(['func1', 'func2', 'func3']);
    });
  });

  describe('get', () => {
    it('should retrieve entity by ID', async () => {
      const created = await entityStore.create({
        type: 'class',
        name: 'TestClass'
      });

      const retrieved = await entityStore.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('TestClass');
    });

    it('should return null for non-existent entity', async () => {
      const result = await entityStore.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getByName', () => {
    it('should retrieve entity by name', async () => {
      await entityStore.create({ type: 'function', name: 'uniqueFunc' });

      const entity = await entityStore.getByName('uniqueFunc');

      expect(entity).not.toBeNull();
      expect(entity!.name).toBe('uniqueFunc');
    });

    it('should filter by type when specified', async () => {
      await entityStore.create({ type: 'function', name: 'duplicate' });
      await entityStore.create({ type: 'class', name: 'duplicate' });

      const funcEntity = await entityStore.getByName('duplicate', 'function');
      const classEntity = await entityStore.getByName('duplicate', 'class');

      expect(funcEntity!.type).toBe('function');
      expect(classEntity!.type).toBe('class');
    });
  });

  describe('getByQualifiedName', () => {
    it('should retrieve entity by qualified name', async () => {
      await entityStore.create({
        type: 'method',
        name: 'login',
        qualifiedName: 'src/auth.ts::AuthService::login'
      });

      const entity = await entityStore.getByQualifiedName('src/auth.ts::AuthService::login');

      expect(entity).not.toBeNull();
      expect(entity!.name).toBe('login');
    });
  });

  describe('getByFile', () => {
    it('should return all entities for a file', async () => {
      await entityStore.create({ type: 'function', name: 'func1', filePath: 'src/file.ts', startLine: 1 });
      await entityStore.create({ type: 'function', name: 'func2', filePath: 'src/file.ts', startLine: 10 });
      await entityStore.create({ type: 'function', name: 'other', filePath: 'src/other.ts', startLine: 1 });

      const entities = await entityStore.getByFile('src/file.ts');

      expect(entities).toHaveLength(2);
      expect(entities.map(e => e.name)).toEqual(['func1', 'func2']);
    });

    it('should order by start line', async () => {
      await entityStore.create({ type: 'function', name: 'second', filePath: 'src/file.ts', startLine: 20 });
      await entityStore.create({ type: 'function', name: 'first', filePath: 'src/file.ts', startLine: 5 });
      await entityStore.create({ type: 'function', name: 'third', filePath: 'src/file.ts', startLine: 30 });

      const entities = await entityStore.getByFile('src/file.ts');

      expect(entities.map(e => e.name)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('getByType', () => {
    it('should return entities of single type', async () => {
      await entityStore.create({ type: 'function', name: 'func1' });
      await entityStore.create({ type: 'class', name: 'class1' });
      await entityStore.create({ type: 'function', name: 'func2' });

      const functions = await entityStore.getByType('function');

      expect(functions).toHaveLength(2);
      expect(functions.every(e => e.type === 'function')).toBe(true);
    });

    it('should return entities of multiple types', async () => {
      await entityStore.create({ type: 'function', name: 'func1' });
      await entityStore.create({ type: 'class', name: 'class1' });
      await entityStore.create({ type: 'interface', name: 'iface1' });

      const entities = await entityStore.getByType(['function', 'class']);

      expect(entities).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update specified fields', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'oldName',
        content: 'old content'
      });

      const updated = await entityStore.update(entity.id, {
        name: 'newName',
        content: 'new content'
      });

      expect(updated.name).toBe('newName');
      expect(updated.content).toBe('new content');
    });

    it('should recompute hash when content changes', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'func',
        content: 'original'
      });
      const originalHash = entity.hash;

      const updated = await entityStore.update(entity.id, {
        content: 'modified'
      });

      expect(updated.hash).not.toBe(originalHash);
      expect(updated.hash).toBe(hashContent('modified'));
    });

    it('should merge metadata', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'func',
        metadata: { a: 1, b: 2 }
      });

      const updated = await entityStore.update(entity.id, {
        metadata: { b: 3, c: 4 }
      });

      expect(updated.metadata).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should update timestamp', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'func'
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await entityStore.update(entity.id, { name: 'newName' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(entity.updatedAt.getTime());
    });

    it('should throw for non-existent entity', () => {
      expect(() =>
        entityStore.update('non-existent', { name: 'new' })
      ).toThrow('not found');
    });
  });

  describe('delete', () => {
    it('should delete entity by ID', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'toDelete'
      });

      await entityStore.delete(entity.id);

      const result = await entityStore.get(entity.id);
      expect(result).toBeNull();
    });

    it('should delete all entities for a file', async () => {
      await entityStore.create({ type: 'function', name: 'func1', filePath: 'src/delete.ts' });
      await entityStore.create({ type: 'function', name: 'func2', filePath: 'src/delete.ts' });
      await entityStore.create({ type: 'function', name: 'keep', filePath: 'src/keep.ts' });

      const deleted = await entityStore.deleteByFile('src/delete.ts');

      expect(deleted).toBe(2);
      expect(await entityStore.count()).toBe(1);
    });

    it('should delete all entities of a type', async () => {
      await entityStore.create({ type: 'function', name: 'func1' });
      await entityStore.create({ type: 'function', name: 'func2' });
      await entityStore.create({ type: 'class', name: 'class1' });

      const deleted = await entityStore.deleteByType('function');

      expect(deleted).toBe(2);
      expect(await entityStore.count()).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await entityStore.create({ type: 'function', name: 'calculateTotal', content: 'function calculateTotal(items) { return sum; }' });
      await entityStore.create({ type: 'function', name: 'validateInput', content: 'function validateInput(data) { return true; }' });
      await entityStore.create({ type: 'class', name: 'Calculator', summary: 'A calculator class for math operations' });
    });

    it('should find entities matching query in name', async () => {
      const results = await entityStore.search('calculate');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(e => e.name === 'calculateTotal')).toBe(true);
    });

    it('should find entities matching query in content', async () => {
      const results = await entityStore.search('items');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should find entities matching query in summary', async () => {
      const results = await entityStore.search('math operations');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(e => e.name === 'Calculator')).toBe(true);
    });

    it('should filter by type', async () => {
      const results = await entityStore.search('calcul', { type: 'function' });

      expect(results.every(e => e.type === 'function')).toBe(true);
    });

    it('should respect limit and offset', async () => {
      const page1 = await entityStore.search('', { limit: 2 });
      const page2 = await entityStore.search('', { limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
    });
  });

  describe('hash operations', () => {
    it('should detect existing content by hash', async () => {
      const content = 'unique content';
      await entityStore.create({
        type: 'function',
        name: 'func',
        content
      });

      const hash = hashContent(content);
      const exists = await entityStore.existsByHash(hash);

      expect(exists).toBe(true);
    });

    it('should find entity by hash', async () => {
      const content = 'findable content';
      await entityStore.create({
        type: 'function',
        name: 'findMe',
        content
      });

      const hash = hashContent(content);
      const entity = await entityStore.findByHash(hash);

      expect(entity).not.toBeNull();
      expect(entity!.name).toBe('findMe');
    });

    it('should return false for non-existent hash', async () => {
      const exists = await entityStore.existsByHash('nonexistenthash');
      expect(exists).toBe(false);
    });
  });

  describe('count and list', () => {
    it('should count all entities', async () => {
      await entityStore.create({ type: 'function', name: 'func1' });
      await entityStore.create({ type: 'function', name: 'func2' });
      await entityStore.create({ type: 'class', name: 'class1' });

      const count = await entityStore.count();
      expect(count).toBe(3);
    });

    it('should count entities by type', async () => {
      await entityStore.create({ type: 'function', name: 'func1' });
      await entityStore.create({ type: 'function', name: 'func2' });
      await entityStore.create({ type: 'class', name: 'class1' });

      const count = await entityStore.count('function');
      expect(count).toBe(2);
    });

    it('should list entities with pagination', async () => {
      await entityStore.create({ type: 'function', name: 'a' });
      await entityStore.create({ type: 'function', name: 'b' });
      await entityStore.create({ type: 'function', name: 'c' });

      const all = await entityStore.list();
      const limited = await entityStore.list({ limit: 2 });
      const offset = await entityStore.list({ limit: 2, offset: 1 });

      expect(all).toHaveLength(3);
      expect(limited).toHaveLength(2);
      expect(offset).toHaveLength(2);
      expect(offset[0].name).toBe('b');
    });
  });
});
