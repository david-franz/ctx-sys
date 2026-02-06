import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore, Entity } from '../../src/entities';
import { EmbeddingManager, MockEmbeddingProvider, hashEntityContent, buildEmbeddingContent } from '../../src/embeddings';

describe('F10.2 - Incremental Embedding', () => {
  let tempDir: string;
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let embeddingManager: EmbeddingManager;
  let mockProvider: MockEmbeddingProvider;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-2-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject('test-project');
    entityStore = new EntityStore(db, 'test-project');
    mockProvider = new MockEmbeddingProvider();
    embeddingManager = new EmbeddingManager(db, 'test-project', mockProvider);
  });

  afterEach(() => {
    db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  async function createEntity(name: string, content: string): Promise<Entity> {
    return entityStore.create({
      type: 'function',
      name,
      content,
      summary: `A function named ${name}`
    });
  }

  describe('Content Hashing', () => {
    it('should generate consistent hashes for same content', async () => {
      const entity = await createEntity('myFunc', 'function myFunc() { return 1; }');

      const hash1 = hashEntityContent(entity);
      const hash2 = hashEntityContent(entity);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });

    it('should generate different hashes for different content', async () => {
      const entity1 = await createEntity('func1', 'function func1() { return 1; }');
      const entity2 = await createEntity('func2', 'function func2() { return 2; }');

      const hash1 = hashEntityContent(entity1);
      const hash2 = hashEntityContent(entity2);

      expect(hash1).not.toBe(hash2);
    });

    it('should build embedding content with type, name, summary, and code', async () => {
      const entity = await createEntity('testFunc', 'function testFunc() { return 42; }');

      const content = buildEmbeddingContent(entity);

      expect(content).toContain('function: testFunc');
      expect(content).toContain('A function named testFunc');
      expect(content).toContain('return 42');
    });
  });

  describe('Incremental Embedding', () => {
    it('should embed all entities on first run', async () => {
      const entities = [
        await createEntity('func1', 'function func1() {}'),
        await createEntity('func2', 'function func2() {}'),
        await createEntity('func3', 'function func3() {}')
      ];

      const result = await embeddingManager.embedIncremental(entities);

      expect(result.embedded).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(3);
    });

    it('should skip unchanged entities on second run', async () => {
      const entities = [
        await createEntity('func1', 'function func1() {}'),
        await createEntity('func2', 'function func2() {}')
      ];

      // First run
      await embeddingManager.embedIncremental(entities);

      // Second run should skip all
      const result = await embeddingManager.embedIncremental(entities);

      expect(result.embedded).toBe(0);
      expect(result.skipped).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should re-embed changed entities', async () => {
      const entity1 = await createEntity('func1', 'function func1() { return 1; }');
      const entity2 = await createEntity('func2', 'function func2() { return 2; }');

      // First run
      await embeddingManager.embedIncremental([entity1, entity2]);

      // Modify one entity
      const updated = await entityStore.update(entity1.id, {
        content: 'function func1() { return "modified"; }'
      });

      // Second run should only embed the changed entity
      const result = await embeddingManager.embedIncremental([updated, entity2]);

      expect(result.embedded).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should embed new entities added to the list', async () => {
      const entity1 = await createEntity('func1', 'function func1() {}');

      // First run
      await embeddingManager.embedIncremental([entity1]);

      // Add a new entity
      const entity2 = await createEntity('func2', 'function func2() {}');

      // Second run should embed only the new one
      const result = await embeddingManager.embedIncremental([entity1, entity2]);

      expect(result.embedded).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should report progress during embedding', async () => {
      const entities = [
        await createEntity('func1', 'function func1() {}'),
        await createEntity('func2', 'function func2() {}'),
        await createEntity('func3', 'function func3() {}')
      ];

      const progressCalls: Array<{ completed: number; total: number; skipped: number }> = [];

      await embeddingManager.embedIncremental(entities, {
        batchSize: 1,
        onProgress: (completed, total, skipped) => {
          progressCalls.push({ completed, total, skipped });
        }
      });

      expect(progressCalls.length).toBe(3);
      expect(progressCalls[2].completed).toBe(3);
    });
  });

  describe('needsEmbedding', () => {
    it('should return true for new entities', async () => {
      const entity = await createEntity('newFunc', 'function newFunc() {}');

      expect(embeddingManager.needsEmbedding(entity)).toBe(true);
    });

    it('should return false for unchanged entities', async () => {
      const entity = await createEntity('func', 'function func() {}');
      await embeddingManager.embedWithHash(entity);

      expect(embeddingManager.needsEmbedding(entity)).toBe(false);
    });

    it('should return true for modified entities', async () => {
      const entity = await createEntity('func', 'function func() { return 1; }');
      await embeddingManager.embedWithHash(entity);

      // Modify entity
      const updated = await entityStore.update(entity.id, {
        content: 'function func() { return "changed"; }'
      });

      expect(embeddingManager.needsEmbedding(updated)).toBe(true);
    });
  });

  describe('getEntitiesNeedingEmbedding', () => {
    it('should return all entities when none are embedded', async () => {
      const entities = [
        await createEntity('func1', 'function func1() {}'),
        await createEntity('func2', 'function func2() {}')
      ];

      const needsEmbedding = embeddingManager.getEntitiesNeedingEmbedding(entities);

      expect(needsEmbedding.length).toBe(2);
    });

    it('should return only changed entities', async () => {
      const entity1 = await createEntity('func1', 'function func1() {}');
      const entity2 = await createEntity('func2', 'function func2() {}');

      // Embed both
      await embeddingManager.embedIncremental([entity1, entity2]);

      // Modify only entity1
      const updated1 = await entityStore.update(entity1.id, {
        content: 'function func1() { modified; }'
      });

      const needsEmbedding = embeddingManager.getEntitiesNeedingEmbedding([updated1, entity2]);

      expect(needsEmbedding.length).toBe(1);
      expect(needsEmbedding[0].id).toBe(entity1.id);
    });
  });

  describe('Orphan Cleanup', () => {
    it('should remove embeddings for deleted entities', async () => {
      const entity1 = await createEntity('func1', 'function func1() {}');
      const entity2 = await createEntity('func2', 'function func2() {}');

      // Embed both
      await embeddingManager.embedIncremental([entity1, entity2]);

      // Delete entity1 from store
      await entityStore.delete(entity1.id);

      // Cleanup orphans
      const validIds = new Set([entity2.id]);
      const removed = await embeddingManager.cleanupOrphaned(validIds);

      expect(removed).toBe(1);

      // Verify entity2 still has embedding
      const hasEmbedding = await embeddingManager.hasEmbedding(entity2.id);
      expect(hasEmbedding).toBe(true);
    });
  });

  describe('Detailed Stats', () => {
    it('should report stale embeddings (without hash)', async () => {
      const entity = await createEntity('func', 'function func() {}');

      // Embed using old method (no hash)
      await embeddingManager.embed(entity.id, 'function func() {}');

      const stats = await embeddingManager.getDetailedStats();

      expect(stats.count).toBe(1);
      expect(stats.staleCount).toBe(1);
    });

    it('should not count hashed embeddings as stale', async () => {
      const entity = await createEntity('func', 'function func() {}');

      // Embed with hash
      await embeddingManager.embedWithHash(entity);

      const stats = await embeddingManager.getDetailedStats();

      expect(stats.count).toBe(1);
      expect(stats.staleCount).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process entities in batches', async () => {
      const entities: Entity[] = [];
      for (let i = 0; i < 10; i++) {
        entities.push(await createEntity(`func${i}`, `function func${i}() {}`));
      }

      const result = await embeddingManager.embedIncremental(entities, {
        batchSize: 3
      });

      expect(result.embedded).toBe(10);
      expect(result.total).toBe(10);
    });
  });
});
