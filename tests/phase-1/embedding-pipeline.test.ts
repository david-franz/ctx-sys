import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities/store';
import { EmbeddingManager } from '../../src/embeddings/manager';
import { MockEmbeddingProvider } from '../../src/embeddings/mock';
import { EmbeddingProviderFactory } from '../../src/embeddings/factory';

describe('F1.4 Embedding Pipeline', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let embeddingManager: EmbeddingManager;
  let mockProvider: MockEmbeddingProvider;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    mockProvider = new MockEmbeddingProvider(128);
    embeddingManager = new EmbeddingManager(db, projectId, mockProvider);
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

  describe('MockEmbeddingProvider', () => {
    it('should generate embedding for text', async () => {
      const embedding = await mockProvider.embed('test text');

      expect(embedding).toHaveLength(128);
      expect(embedding.every(v => typeof v === 'number')).toBe(true);
    });

    it('should generate deterministic embeddings', async () => {
      const embedding1 = await mockProvider.embed('same text');
      const embedding2 = await mockProvider.embed('same text');

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await mockProvider.embed('text one');
      const embedding2 = await mockProvider.embed('text two');

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should generate normalized embeddings', async () => {
      const embedding = await mockProvider.embed('test');

      // Calculate magnitude
      const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));

      // Should be approximately 1 (unit vector)
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should batch embed multiple texts', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const embeddings = await mockProvider.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      expect(embeddings.every(e => e.length === 128)).toBe(true);
    });

    it('should call progress callback during batch', async () => {
      const texts = ['a', 'b', 'c', 'd', 'e'];
      const progressCalls: number[] = [];

      await mockProvider.embedBatch(texts, {
        onProgress: (completed) => progressCalls.push(completed)
      });

      expect(progressCalls).toEqual([1, 2, 3, 4, 5]);
    });

    it('should report availability correctly', async () => {
      expect(await mockProvider.isAvailable()).toBe(true);

      mockProvider.setAvailable(false);
      expect(await mockProvider.isAvailable()).toBe(false);
    });
  });

  describe('EmbeddingManager', () => {
    it('should store embedding for entity', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'function test() {}'
      });

      await embeddingManager.embed(entity.id, entity.content!);

      const hasEmbedding = await embeddingManager.hasEmbedding(entity.id);
      expect(hasEmbedding).toBe(true);
    });

    it('should retrieve stored embedding', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'function test() {}'
      });

      await embeddingManager.embed(entity.id, entity.content!);

      const embedding = await embeddingManager.getEmbedding(entity.id);
      expect(embedding).not.toBeNull();
      expect(embedding).toHaveLength(128);
    });

    it('should find similar entities by query', async () => {
      // Create entities with content
      const entity1 = await entityStore.create({
        type: 'function',
        name: 'calculateSum',
        content: 'function calculateSum(numbers) { return numbers.reduce((a, b) => a + b, 0); }'
      });
      const entity2 = await entityStore.create({
        type: 'function',
        name: 'calculateProduct',
        content: 'function calculateProduct(numbers) { return numbers.reduce((a, b) => a * b, 1); }'
      });

      // Generate embeddings
      await embeddingManager.embed(entity1.id, entity1.content!);
      await embeddingManager.embed(entity2.id, entity2.content!);

      // Search for similar - use the exact content to ensure a match
      const results = await embeddingManager.findSimilar(entity1.content!);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
      // The first result should be entity1 since we searched with its exact content
      expect(results[0].entityId).toBe(entity1.id);
    });

    it('should filter by entity type', async () => {
      const func = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'function test() {}'
      });
      const cls = await entityStore.create({
        type: 'class',
        name: 'TestClass',
        content: 'class Test {}'
      });

      await embeddingManager.embed(func.id, func.content!);
      await embeddingManager.embed(cls.id, cls.content!);

      const results = await embeddingManager.findSimilar('test', {
        entityTypes: ['function']
      });

      expect(results.every(r => r.entityId !== cls.id || false)).toBe(true);
    });

    it('should respect similarity threshold', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'unique content here'
      });

      await embeddingManager.embed(entity.id, entity.content!);

      const highThreshold = await embeddingManager.findSimilar('completely different', {
        threshold: 0.99
      });

      const lowThreshold = await embeddingManager.findSimilar('completely different', {
        threshold: 0.0
      });

      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length);
    });

    it('should respect limit', async () => {
      // Create multiple entities
      for (let i = 0; i < 10; i++) {
        const entity = await entityStore.create({
          type: 'function',
          name: `func${i}`,
          content: `function func${i}() {}`
        });
        await embeddingManager.embed(entity.id, entity.content!);
      }

      const results = await embeddingManager.findSimilar('function', { limit: 5 });

      expect(results).toHaveLength(5);
    });

    it('should delete embeddings for entity', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'test content'
      });

      await embeddingManager.embed(entity.id, entity.content!);
      expect(await embeddingManager.hasEmbedding(entity.id)).toBe(true);

      await embeddingManager.deleteForEntity(entity.id);
      expect(await embeddingManager.hasEmbedding(entity.id)).toBe(false);
    });

    it('should batch embed entities', async () => {
      const entities = await entityStore.createMany([
        { type: 'function', name: 'func1', content: 'content 1' },
        { type: 'function', name: 'func2', content: 'content 2' },
        { type: 'function', name: 'func3', content: 'content 3' }
      ]);

      await embeddingManager.embedBatch(
        entities.map(e => ({ id: e.id, content: e.content! }))
      );

      for (const entity of entities) {
        expect(await embeddingManager.hasEmbedding(entity.id)).toBe(true);
      }
    });

    it('should track progress during batch embed', async () => {
      const entities = await entityStore.createMany([
        { type: 'function', name: 'func1', content: 'content 1' },
        { type: 'function', name: 'func2', content: 'content 2' },
        { type: 'function', name: 'func3', content: 'content 3' }
      ]);

      const progressCalls: Array<{ completed: number; total: number }> = [];

      await embeddingManager.embedBatch(
        entities.map(e => ({ id: e.id, content: e.content! })),
        {
          onProgress: (completed, total) => progressCalls.push({ completed, total })
        }
      );

      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('should get embedding statistics', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'test content'
      });
      await embeddingManager.embed(entity.id, entity.content!);

      const stats = await embeddingManager.getStats();

      expect(stats.count).toBe(1);
      expect(stats.modelId).toBe('mock:test-model');
      expect(stats.dimensions).toBe(128);
    });

    it('should replace existing embedding on re-embed', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'original content'
      });

      await embeddingManager.embed(entity.id, 'original content');
      const originalEmbedding = await embeddingManager.getEmbedding(entity.id);

      await embeddingManager.embed(entity.id, 'new content');
      const newEmbedding = await embeddingManager.getEmbedding(entity.id);

      expect(newEmbedding).not.toEqual(originalEmbedding);

      // Should still only have one embedding
      const stats = await embeddingManager.getStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('EmbeddingProviderFactory', () => {
    it('should create Ollama provider', () => {
      const provider = EmbeddingProviderFactory.create({
        provider: 'ollama',
        model: 'nomic-embed-text'
      });

      expect(provider.name).toBe('ollama');
      expect(provider.modelId).toBe('ollama:nomic-embed-text');
    });

    it('should create OpenAI provider', () => {
      const provider = EmbeddingProviderFactory.create({
        provider: 'openai',
        model: 'text-embedding-3-small',
        apiKey: 'test-key'
      });

      expect(provider.name).toBe('openai');
      expect(provider.modelId).toBe('openai:text-embedding-3-small');
    });

    it('should throw for OpenAI without API key', () => {
      expect(() => {
        EmbeddingProviderFactory.create({
          provider: 'openai',
          model: 'text-embedding-3-small'
        });
      }).toThrow('API key required');
    });

    it('should throw for unknown provider', () => {
      expect(() => {
        EmbeddingProviderFactory.create({
          provider: 'unknown' as any,
          model: 'model'
        });
      }).toThrow('Unknown provider');
    });
  });

  describe('Cosine Similarity', () => {
    it('should return 1 for identical embeddings', async () => {
      const entity = await entityStore.create({
        type: 'function',
        name: 'testFunc',
        content: 'exact match content'
      });

      await embeddingManager.embed(entity.id, entity.content!);

      const results = await embeddingManager.findSimilar('exact match content');

      // The exact same text should have very high similarity
      expect(results[0].score).toBeGreaterThan(0.99);
    });

    it('should return scores between 0 and 1', async () => {
      const entities = await entityStore.createMany([
        { type: 'function', name: 'func1', content: 'apples and oranges' },
        { type: 'function', name: 'func2', content: 'cats and dogs' },
        { type: 'function', name: 'func3', content: 'numbers and math' }
      ]);

      for (const entity of entities) {
        await embeddingManager.embed(entity.id, entity.content!);
      }

      const results = await embeddingManager.findSimilar('random query text');

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });
  });
});
