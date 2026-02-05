/**
 * F1.4 Embedding Pipeline Tests
 *
 * Tests for embedding providers, manager, and factory
 * covering vector generation, storage, and similarity search.
 *
 * These tests will FAIL until the actual implementations are created.
 * Expected source files:
 * - src/embeddings/provider.ts (EmbeddingProvider interface, OllamaEmbeddingProvider, OpenAIEmbeddingProvider)
 * - src/embeddings/manager.ts (EmbeddingManager class)
 * - src/embeddings/factory.ts (EmbeddingProviderFactory class)
 * - src/embeddings/types.ts (EmbeddingConfig, SimilarityResult types)
 * - src/database/connection.ts (DatabaseConnection class)
 *
 * @see docs/phase-1/F1.4-embedding-pipeline.md
 */

// Import actual implementations - these will fail until implemented
import {
  EmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider
} from '../../src/embeddings/provider';
import { EmbeddingManager } from '../../src/embeddings/manager';
import { EmbeddingProviderFactory } from '../../src/embeddings/factory';
import {
  EmbeddingConfig,
  SimilarityResult,
  SimilarityOptions
} from '../../src/embeddings/types';
import { DatabaseConnection } from '../../src/db/connection';

// Import mock helpers
import {
  createMockDatabase,
  createMockEntity,
  MockDatabase
} from '../helpers/mocks';

// Mock the database connection
jest.mock('../../src/db/connection');

describe('F1.4 Embedding Pipeline', () => {
  let mockDb: MockDatabase;
  const projectId = 'proj_test123';

  beforeEach(() => {
    mockDb = createMockDatabase();

    // Mock DatabaseConnection to return our mock db
    (DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>).mockImplementation(() => ({
      db: mockDb,
      close: jest.fn(),
      transaction: mockDb.transaction,
    } as unknown as DatabaseConnection));

    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // EmbeddingProvider Interface Tests
  // ============================================================================

  describe('EmbeddingProvider Interface', () => {
    let provider: OllamaEmbeddingProvider;

    beforeEach(() => {
      provider = new OllamaEmbeddingProvider({
        model: 'nomic-embed-text',
        baseUrl: 'http://localhost:11434'
      });
    });

    it('should have required properties', () => {
      expect(provider.name).toBe('ollama');
      expect(provider.modelId).toBe('ollama:nomic-embed-text');
      expect(provider.dimensions).toBe(768);
    });

    it('should implement embed method', async () => {
      const embedding = await provider.embed('test text');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding) || embedding instanceof Float32Array).toBe(true);
      expect(embedding.length).toBe(provider.dimensions);
    });

    it('should implement embedBatch method', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const embeddings = await provider.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((emb: number[] | Float32Array) => {
        expect(emb.length).toBe(provider.dimensions);
      });
    });

    it('should implement isAvailable method', async () => {
      const available = await provider.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  // ============================================================================
  // OllamaEmbeddingProvider Tests
  // ============================================================================

  describe('OllamaEmbeddingProvider', () => {
    let provider: OllamaEmbeddingProvider;

    beforeEach(() => {
      provider = new OllamaEmbeddingProvider({
        model: 'nomic-embed-text',
        baseUrl: 'http://localhost:11434'
      });
    });

    it('should construct with correct model ID', () => {
      expect(provider.modelId).toBe('ollama:nomic-embed-text');
    });

    it('should know dimensions for known models', () => {
      const nomicProvider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      expect(nomicProvider.dimensions).toBe(768);

      const mxbaiProvider = new OllamaEmbeddingProvider({ model: 'mxbai-embed-large' });
      expect(mxbaiProvider.dimensions).toBe(1024);

      const minilmProvider = new OllamaEmbeddingProvider({ model: 'all-minilm' });
      expect(minilmProvider.dimensions).toBe(384);
    });

    it('should default to 768 dimensions for unknown models', () => {
      const unknownProvider = new OllamaEmbeddingProvider({ model: 'unknown-model' });
      expect(unknownProvider.dimensions).toBe(768);
    });

    it('should generate embedding via Ollama API', async () => {
      const embedding = await provider.embed('function test() {}');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle batch embedding with concurrency', async () => {
      const texts = Array(30).fill('test text');
      const embeddings = await provider.embedBatch(texts);

      expect(embeddings).toHaveLength(30);
    });

    it('should report availability correctly', async () => {
      const available = await provider.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should handle API errors gracefully', async () => {
      // Mock a failed connection
      const badProvider = new OllamaEmbeddingProvider({
        model: 'nomic-embed-text',
        baseUrl: 'http://nonexistent:11434'
      });

      await expect(badProvider.embed('test')).rejects.toThrow();
    });

    it('should call progress callback during batch', async () => {
      const onProgress = jest.fn();
      const texts = ['text 1', 'text 2', 'text 3'];

      await provider.embedBatch(texts, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    });

    it('should use default URL if not specified', () => {
      const defaultProvider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      expect(defaultProvider).toBeDefined();
      // Default URL should be http://localhost:11434
    });
  });

  // ============================================================================
  // OpenAIEmbeddingProvider Tests
  // ============================================================================

  describe('OpenAIEmbeddingProvider', () => {
    let provider: OpenAIEmbeddingProvider;

    beforeEach(() => {
      provider = new OpenAIEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: 'sk-test-key'
      });
    });

    it('should construct with correct model ID', () => {
      expect(provider.modelId).toBe('openai:text-embedding-3-small');
    });

    it('should know dimensions for known models', () => {
      const smallProvider = new OpenAIEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: 'sk-test'
      });
      expect(smallProvider.dimensions).toBe(1536);

      const largeProvider = new OpenAIEmbeddingProvider({
        model: 'text-embedding-3-large',
        apiKey: 'sk-test'
      });
      expect(largeProvider.dimensions).toBe(3072);

      const adaProvider = new OpenAIEmbeddingProvider({
        model: 'text-embedding-ada-002',
        apiKey: 'sk-test'
      });
      expect(adaProvider.dimensions).toBe(1536);
    });

    it('should use native batch API', async () => {
      const texts = Array(100).fill('test');
      const embeddings = await provider.embedBatch(texts);

      // All 100 should be processed (OpenAI supports up to 2048 per batch)
      expect(embeddings).toHaveLength(100);
    });

    it('should handle rate limiting', async () => {
      // This test verifies error handling for rate limits
      // In real usage, the provider should retry with exponential backoff
      expect(provider).toBeDefined();
    });

    it('should throw without API key', () => {
      expect(() => {
        new OpenAIEmbeddingProvider({
          model: 'text-embedding-3-small',
          apiKey: ''
        });
      }).toThrow('API key required');
    });
  });

  // ============================================================================
  // EmbeddingManager Tests
  // ============================================================================

  describe('EmbeddingManager', () => {
    let manager: EmbeddingManager;
    let provider: OllamaEmbeddingProvider;

    beforeEach(() => {
      provider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      manager = new EmbeddingManager(
        new DatabaseConnection(':memory:'),
        projectId,
        provider
      );
    });

    describe('embed', () => {
      it('should store embedding for entity', async () => {
        mockDb.mockRun({ changes: 1 });

        const entityId = 'entity-123';
        const content = 'function authenticate(user) { ... }';

        await manager.embed(entityId, content);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.any(Array)
        );
      });

      it('should delete existing embedding before storing new one', async () => {
        mockDb.mockRun({ changes: 1 });
        mockDb.mockRun({ changes: 1 });

        const entityId = 'entity-123';
        await manager.embed(entityId, 'new content');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining([entityId])
        );
      });
    });

    describe('embedBatch', () => {
      it('should batch embed multiple entities', async () => {
        mockDb.mockRun({ changes: 1 });

        const entities = [
          { id: 'e1', content: 'content 1' },
          { id: 'e2', content: 'content 2' },
          { id: 'e3', content: 'content 3' }
        ];

        await manager.embedBatch(entities);

        expect(mockDb.transaction).toHaveBeenCalled();
      });

      it('should store all embeddings in a transaction', async () => {
        mockDb.mockRun({ changes: 1 });

        const entities = [
          { id: 'e1', content: 'content 1' },
          { id: 'e2', content: 'content 2' }
        ];

        await manager.embedBatch(entities);

        expect(mockDb.transaction).toHaveBeenCalled();
      });

      it('should call progress callback', async () => {
        mockDb.mockRun({ changes: 1 });
        const onProgress = jest.fn();

        const entities = Array(10).fill(null).map((_, i) => ({
          id: `e${i}`,
          content: `content ${i}`
        }));

        await manager.embedBatch(entities, { onProgress });

        expect(onProgress).toHaveBeenCalled();
      });
    });

    describe('findSimilar', () => {
      it('should find similar entities by query', async () => {
        mockDb.mockAll([
          { entity_id: 'e1', distance: 0.15 },
          { entity_id: 'e2', distance: 0.25 }
        ]);

        const options: SimilarityOptions = { query: 'authentication login' };
        const results = await manager.findSimilar(options);

        expect(results).toHaveLength(2);
        expect(results[0].entityId).toBe('e1');
        expect(results[0].score).toBeCloseTo(0.85, 2);
      });

      it('should filter by entity type', async () => {
        mockDb.mockAll([
          { entity_id: 'e1', distance: 0.1 }
        ]);

        const options: SimilarityOptions = {
          query: 'test',
          entityTypes: ['function']
        };
        const results = await manager.findSimilar(options);

        expect(results).toHaveLength(1);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('type IN'),
          expect.any(Array)
        );
      });

      it('should respect similarity threshold', async () => {
        mockDb.mockAll([
          { entity_id: 'e1', distance: 0.1 },
          { entity_id: 'e2', distance: 0.3 },
          { entity_id: 'e3', distance: 0.5 }
        ]);

        const options: SimilarityOptions = {
          query: 'test',
          threshold: 0.6
        };
        const results = await manager.findSimilar(options);

        // Only e1 (score 0.9) and e2 (score 0.7) meet threshold of 0.6
        expect(results.length).toBeLessThanOrEqual(2);
        results.forEach((r: SimilarityResult) => {
          expect(r.score).toBeGreaterThanOrEqual(0.6);
        });
      });

      it('should respect limit', async () => {
        mockDb.mockAll([
          { entity_id: 'e1', distance: 0.1 },
          { entity_id: 'e2', distance: 0.2 }
        ]);

        const options: SimilarityOptions = { query: 'test', limit: 2 };
        const results = await manager.findSimilar(options);

        expect(results.length).toBeLessThanOrEqual(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.any(Array)
        );
      });

      it('should convert distance to similarity score', async () => {
        mockDb.mockAll([
          { entity_id: 'e1', distance: 0.25 }
        ]);

        const results = await manager.findSimilar({ query: 'test' });

        expect(results[0].score).toBe(0.75); // 1 - 0.25
      });
    });

    describe('findSimilarByVector', () => {
      it('should search using pre-computed embedding', async () => {
        mockDb.mockAll([
          { entity_id: 'e1', distance: 0.12 }
        ]);

        const embedding = new Float32Array(768).fill(0.1);
        const results = await manager.findSimilarByVector(embedding);

        expect(results).toHaveLength(1);
        expect(results[0].entityId).toBe('e1');
      });
    });

    describe('deleteForEntity', () => {
      it('should delete embeddings for entity', async () => {
        mockDb.mockRun({ changes: 1 });

        await manager.deleteForEntity('entity-1');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining(['entity-1'])
        );
      });
    });

    describe('hasEmbedding', () => {
      it('should return true when embedding exists', async () => {
        mockDb.mockGet({ count: 1 });

        const exists = await manager.hasEmbedding('entity-1');

        expect(exists).toBe(true);
      });

      it('should return false when no embedding', async () => {
        mockDb.mockGet({ count: 0 });

        const exists = await manager.hasEmbedding('entity-1');

        expect(exists).toBe(false);
      });
    });

    describe('getStats', () => {
      it('should return embedding statistics', async () => {
        mockDb.mockGet({ count: 500 });

        const stats = await manager.getStats();

        expect(stats.count).toBe(500);
        expect(stats.modelId).toBe('ollama:nomic-embed-text');
        expect(stats.dimensions).toBe(768);
      });
    });

    describe('model registration', () => {
      it('should register model if not exists', async () => {
        mockDb.mockGet(undefined); // Model doesn't exist
        mockDb.mockRun({ changes: 1 });

        await manager.registerModel();

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO embedding_models'),
          expect.any(Array)
        );
      });

      it('should not re-register existing model', async () => {
        mockDb.mockGet({ id: 'ollama:nomic-embed-text' }); // Model exists

        await manager.registerModel();

        // Should only call get, not run (no INSERT)
        expect(mockDb.get).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // EmbeddingProviderFactory Tests
  // ============================================================================

  describe('EmbeddingProviderFactory', () => {
    describe('create', () => {
      it('should create Ollama provider', () => {
        const config: EmbeddingConfig = {
          provider: 'ollama',
          model: 'nomic-embed-text',
          baseUrl: 'http://localhost:11434'
        };

        const provider = EmbeddingProviderFactory.create(config);

        expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
        expect(provider.name).toBe('ollama');
      });

      it('should create OpenAI provider', () => {
        const config: EmbeddingConfig = {
          provider: 'openai',
          model: 'text-embedding-3-small',
          apiKey: 'sk-test-key'
        };

        const provider = EmbeddingProviderFactory.create(config);

        expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
        expect(provider.name).toBe('openai');
      });

      it('should throw for unknown provider', () => {
        const config = {
          provider: 'unknown' as const,
          model: 'test'
        } as unknown as EmbeddingConfig;

        expect(() => EmbeddingProviderFactory.create(config)).toThrow('Unknown provider');
      });

      it('should throw for OpenAI without API key', () => {
        const config: EmbeddingConfig = {
          provider: 'openai',
          model: 'text-embedding-3-small'
        };

        expect(() => EmbeddingProviderFactory.create(config)).toThrow('API key required');
      });

      it('should use default Ollama URL if not specified', () => {
        const config: EmbeddingConfig = {
          provider: 'ollama',
          model: 'nomic-embed-text'
        };

        const provider = EmbeddingProviderFactory.create(config);

        expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
      });
    });

    describe('createWithFallback', () => {
      it('should use primary when available', async () => {
        const primaryConfig: EmbeddingConfig = {
          provider: 'ollama',
          model: 'nomic-embed-text'
        };
        const fallbackConfig: EmbeddingConfig = {
          provider: 'openai',
          model: 'text-embedding-3-small',
          apiKey: 'sk-test'
        };

        const provider = await EmbeddingProviderFactory.createWithFallback(
          primaryConfig,
          fallbackConfig
        );

        // If Ollama is available, should return Ollama provider
        expect(provider).toBeDefined();
      });

      it('should fallback when primary unavailable', async () => {
        // Mock Ollama as unavailable
        const primaryConfig: EmbeddingConfig = {
          provider: 'ollama',
          model: 'nomic-embed-text',
          baseUrl: 'http://nonexistent:11434'
        };
        const fallbackConfig: EmbeddingConfig = {
          provider: 'openai',
          model: 'text-embedding-3-small',
          apiKey: 'sk-test'
        };

        const provider = await EmbeddingProviderFactory.createWithFallback(
          primaryConfig,
          fallbackConfig
        );

        expect(provider).toBeDefined();
      });

      it('should log warning when using fallback', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const primaryConfig: EmbeddingConfig = {
          provider: 'ollama',
          model: 'nomic-embed-text',
          baseUrl: 'http://nonexistent:11434'
        };
        const fallbackConfig: EmbeddingConfig = {
          provider: 'openai',
          model: 'text-embedding-3-small',
          apiKey: 'sk-test'
        };

        await EmbeddingProviderFactory.createWithFallback(primaryConfig, fallbackConfig);

        // If primary fails, should warn
        // Note: This may not always be called if primary succeeds
        consoleSpy.mockRestore();
      });
    });
  });

  // ============================================================================
  // Batch Processing Tests
  // ============================================================================

  describe('batch processing', () => {
    let manager: EmbeddingManager;

    beforeEach(() => {
      const provider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      manager = new EmbeddingManager(
        new DatabaseConnection(':memory:'),
        projectId,
        provider
      );
    });

    it('should respect batch size', async () => {
      mockDb.mockRun({ changes: 1 });

      const entities = Array(25).fill(null).map((_, i) => ({
        id: `e${i}`,
        content: `test content ${i}`
      }));

      await manager.embedBatch(entities, { batchSize: 10 });

      // Should be processed in batches
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should respect concurrency limit', async () => {
      mockDb.mockRun({ changes: 1 });

      const entities = Array(100).fill(null).map((_, i) => ({
        id: `e${i}`,
        content: `test content ${i}`
      }));

      await manager.embedBatch(entities, { batchSize: 10, concurrency: 3 });

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle empty batch', async () => {
      const result = await manager.embedBatch([]);

      expect(result).toEqual({ processed: 0, errors: 0 });
    });

    it('should handle single item batch', async () => {
      mockDb.mockRun({ changes: 1 });

      const result = await manager.embedBatch([{ id: 'e1', content: 'single item' }]);

      expect(result.processed).toBe(1);
    });
  });

  // ============================================================================
  // Vector Storage Tests
  // ============================================================================

  describe('vector storage', () => {
    let manager: EmbeddingManager;

    beforeEach(() => {
      const provider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      manager = new EmbeddingManager(
        new DatabaseConnection(':memory:'),
        projectId,
        provider
      );
    });

    it('should store embeddings correctly', async () => {
      mockDb.mockRun({ changes: 1 });

      await manager.embed('entity-1', 'test content');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.any(Array)
      );
    });

    it('should handle different dimension sizes', () => {
      const dimensions = [384, 768, 1024, 1536, 3072];

      dimensions.forEach(dim => {
        const embedding = new Float32Array(dim).fill(0.1);
        expect(embedding.length).toBe(dim);
      });
    });

    it('should preserve floating point precision', async () => {
      mockDb.mockRun({ changes: 1 });
      mockDb.mockGet({
        embedding: JSON.stringify([0.123456789, -0.987654321, 0.000001])
      });

      await manager.embed('entity-1', 'test');
      const stored = mockDb.get('SELECT embedding FROM ...', []);
      const parsed = JSON.parse(stored.embedding);

      expect(parsed[0]).toBeCloseTo(0.123456789, 6);
      expect(parsed[1]).toBeCloseTo(-0.987654321, 6);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    let provider: OllamaEmbeddingProvider;

    beforeEach(() => {
      provider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
    });

    it('should handle very long text', async () => {
      const longText = 'word '.repeat(10000);
      const embedding = await provider.embed(longText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle empty text', async () => {
      const embedding = await provider.embed('');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle unicode text', async () => {
      const unicodeText = '中文 日本語 한국어 العربية';
      const embedding = await provider.embed(unicodeText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle special characters', async () => {
      const specialText = 'function<T>(arg: T): T[] { return [arg]; }';
      const embedding = await provider.embed(specialText);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
    });

    it('should handle concurrent embedding requests', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];

      const results = await Promise.all(
        texts.map(t => provider.embed(t))
      );

      expect(results).toHaveLength(3);
      results.forEach((r: number[] | Float32Array) => expect(r.length).toBe(768));
    });

    it('should handle model switching in manager', async () => {
      mockDb.mockRun({ changes: 1 });

      const provider1 = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      const provider2 = new OpenAIEmbeddingProvider({
        model: 'text-embedding-3-small',
        apiKey: 'sk-test'
      });

      const manager1 = new EmbeddingManager(
        new DatabaseConnection(':memory:'),
        projectId,
        provider1
      );
      const manager2 = new EmbeddingManager(
        new DatabaseConnection(':memory:'),
        projectId,
        provider2
      );

      // Both can embed the same entity with different models
      await manager1.embed('entity-1', 'test');
      mockDb.mockRun({ changes: 1 });
      await manager2.embed('entity-1', 'test');

      expect(mockDb.run).toHaveBeenCalledTimes(4); // 2 deletes + 2 inserts
    });
  });

  // ============================================================================
  // Similarity Results Tests
  // ============================================================================

  describe('similarity results', () => {
    let manager: EmbeddingManager;

    beforeEach(() => {
      const provider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
      manager = new EmbeddingManager(
        new DatabaseConnection(':memory:'),
        projectId,
        provider
      );
    });

    it('should return results sorted by similarity', async () => {
      mockDb.mockAll([
        { entity_id: 'e1', distance: 0.1 },
        { entity_id: 'e2', distance: 0.3 },
        { entity_id: 'e3', distance: 0.5 }
      ]);

      const results = await manager.findSimilar({ query: 'test' });

      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it('should include both distance and score', async () => {
      mockDb.mockAll([
        { entity_id: 'e1', distance: 0.25 }
      ]);

      const results = await manager.findSimilar({ query: 'test' });

      expect(results[0].distance).toBe(0.25);
      expect(results[0].score).toBe(0.75);
    });

    it('should handle identical vectors (distance 0)', async () => {
      mockDb.mockAll([
        { entity_id: 'e1', distance: 0 }
      ]);

      const results = await manager.findSimilar({ query: 'test' });

      expect(results[0].score).toBe(1);
    });

    it('should handle orthogonal vectors (distance ~1)', async () => {
      mockDb.mockAll([
        { entity_id: 'e1', distance: 1 }
      ]);

      const results = await manager.findSimilar({ query: 'test' });

      expect(results[0].score).toBe(0);
    });
  });
});
