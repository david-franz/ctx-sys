import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  EmbeddingManager,
  MockEmbeddingProvider,
  HyDEQueryExpander,
  MockHypotheticalProvider,
  HypotheticalProvider,
  HyDEConfig,
  DEFAULT_HYDE_CONFIG,
  QueryParser,
  buildHypotheticalPrompt
} from '../../src';

describe('F6.5 - HyDE Query Expansion', () => {
  let db: DatabaseConnection;
  let embeddingManager: EmbeddingManager;
  let mockProvider: MockHypotheticalProvider;
  let expander: HyDEQueryExpander;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-hyde-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    const embeddingProvider = new MockEmbeddingProvider();
    embeddingManager = new EmbeddingManager(db, projectId, embeddingProvider);
    mockProvider = new MockHypotheticalProvider();
    expander = new HyDEQueryExpander(mockProvider, embeddingManager);
  });

  afterEach(() => {
    db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('shouldUseHyDE', () => {
    it('should use HyDE for conceptual questions', () => {
      expect(expander.shouldUseHyDE('How does authentication work in this system?')).toBe(true);
      expect(expander.shouldUseHyDE('Explain the caching mechanism')).toBe(true);
      expect(expander.shouldUseHyDE('Why was this design decision made?')).toBe(true);
    });

    it('should skip HyDE for short queries', () => {
      expect(expander.shouldUseHyDE('auth')).toBe(false);
      expect(expander.shouldUseHyDE('test')).toBe(false);
    });

    it('should skip HyDE for specific entity queries', () => {
      expect(expander.shouldUseHyDE('Find `UserService.create()`')).toBe(false);
      expect(expander.shouldUseHyDE('Show me src/auth/service.ts')).toBe(false);
    });

    it('should skip HyDE for find/list intents', () => {
      expect(expander.shouldUseHyDE('Find all authentication functions')).toBe(false);
      expect(expander.shouldUseHyDE('List all classes in the project')).toBe(false);
    });

    it('should respect enabled config', () => {
      const disabledExpander = new HyDEQueryExpander(
        mockProvider,
        embeddingManager,
        { ...DEFAULT_HYDE_CONFIG, enabled: false }
      );
      expect(disabledExpander.shouldUseHyDE('How does authentication work?')).toBe(false);
    });

    it('should accept ParsedQuery objects', () => {
      const parser = new QueryParser();
      const parsed = parser.parse('How does the database connection work?');
      expect(expander.shouldUseHyDE(parsed)).toBe(true);
    });
  });

  describe('expandQuery', () => {
    it('should generate hypothetical answer', async () => {
      const result = await expander.expandQuery({
        query: 'How does authentication work?',
        projectId
      });

      expect(result.usedHyDE).toBe(true);
      expect(result.hypotheticalAnswer).toBeTruthy();
      expect(result.hypotheticalAnswer).toContain('authentication');
    });

    it('should generate embeddings for both original and hypothetical', async () => {
      const result = await expander.expandQuery({
        query: 'Explain the caching mechanism',
        projectId
      });

      expect(result.directEmbedding).toBeDefined();
      expect(result.directEmbedding.length).toBeGreaterThan(0);
      expect(result.hypotheticalEmbedding).toBeDefined();
      expect(result.hypotheticalEmbedding.length).toBeGreaterThan(0);
    });

    it('should track generation time', async () => {
      const result = await expander.expandQuery({
        query: 'How does error handling work?',
        projectId
      });

      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should cache results when enabled', async () => {
      const query = 'How does caching work?';

      const result1 = await expander.expandQuery({ query, projectId });
      const result2 = await expander.expandQuery({ query, projectId });

      // Same result from cache
      expect(result2.hypotheticalAnswer).toBe(result1.hypotheticalAnswer);

      // Cache should have one entry
      const stats = expander.getCacheStats();
      expect(stats.size).toBe(1);
    });

    it('should not cache when disabled', async () => {
      const noCacheExpander = new HyDEQueryExpander(
        mockProvider,
        embeddingManager,
        { ...DEFAULT_HYDE_CONFIG, cacheHypothetical: false }
      );

      await noCacheExpander.expandQuery({
        query: 'How does auth work?',
        projectId
      });

      const stats = noCacheExpander.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should fallback to direct embedding on error', async () => {
      const failingProvider: HypotheticalProvider = {
        generate: async () => { throw new Error('Model unavailable'); }
      };

      const failingExpander = new HyDEQueryExpander(
        failingProvider,
        embeddingManager,
        { ...DEFAULT_HYDE_CONFIG, fallbackToDirectEmbed: true }
      );

      const result = await failingExpander.expandQuery({
        query: 'How does auth work?',
        projectId
      });

      expect(result.usedHyDE).toBe(false);
      expect(result.hypotheticalAnswer).toBe('');
      // Hypothetical embedding equals direct embedding when fallback
      expect(result.hypotheticalEmbedding).toEqual(result.directEmbedding);
    });

    it('should throw when fallback is disabled', async () => {
      const failingProvider: HypotheticalProvider = {
        generate: async () => { throw new Error('Model unavailable'); }
      };

      const failingExpander = new HyDEQueryExpander(
        failingProvider,
        embeddingManager,
        { ...DEFAULT_HYDE_CONFIG, fallbackToDirectEmbed: false }
      );

      await expect(failingExpander.expandQuery({
        query: 'How does auth work?',
        projectId
      })).rejects.toThrow('Model unavailable');
    });
  });

  describe('getSearchEmbedding', () => {
    it('should use HyDE embedding for conceptual queries', async () => {
      const result = await expander.getSearchEmbedding(
        'How does authentication work in the system?',
        projectId
      );

      expect(result.usedHyDE).toBe(true);
      expect(result.hypothetical).toBeTruthy();
      expect(result.embedding.length).toBeGreaterThan(0);
    });

    it('should use direct embedding for specific queries', async () => {
      const result = await expander.getSearchEmbedding(
        'Find `UserService`',
        projectId
      );

      expect(result.usedHyDE).toBe(false);
      expect(result.hypothetical).toBeUndefined();
      expect(result.embedding.length).toBeGreaterThan(0);
    });

    it('should pass through entity types and context', async () => {
      const result = await expander.getSearchEmbedding(
        'How does caching work?',
        projectId,
        {
          entityTypes: ['function', 'class'],
          recentContext: 'Working on performance optimization'
        }
      );

      expect(result.usedHyDE).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await expander.expandQuery({ query: 'Query 1', projectId });
      await expander.expandQuery({ query: 'Query 2', projectId });

      let stats = expander.getCacheStats();
      expect(stats.size).toBe(2);

      expander.clearCache();

      stats = expander.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should provide cache entries list', async () => {
      await expander.expandQuery({
        query: 'How does auth work?',
        projectId
      });

      const stats = expander.getCacheStats();
      expect(stats.entries.length).toBe(1);
      expect(stats.entries[0]).toContain(projectId);
    });
  });

  describe('Configuration', () => {
    it('should return current config', () => {
      const config = expander.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.minQueryLength).toBe(10);
    });

    it('should update config', () => {
      expander.updateConfig({ minQueryLength: 20 });
      const config = expander.getConfig();
      expect(config.minQueryLength).toBe(20);
    });

    it('should respect custom hydeIntents', () => {
      const customExpander = new HyDEQueryExpander(
        mockProvider,
        embeddingManager,
        { ...DEFAULT_HYDE_CONFIG, hydeIntents: ['debug'] }
      );

      // Debug intent should trigger HyDE
      expect(customExpander.shouldUseHyDE('Debug the authentication error')).toBe(true);
      // Explain intent should not trigger HyDE
      expect(customExpander.shouldUseHyDE('Explain how auth works')).toBe(false);
    });
  });

  describe('MockHypotheticalProvider', () => {
    it('should generate auth-related hypothetical', async () => {
      const result = await mockProvider.generate('How does authentication work?');
      expect(result).toContain('authentication');
    });

    it('should generate cache-related hypothetical', async () => {
      const result = await mockProvider.generate('Explain the caching system');
      expect(result).toContain('cache');
    });

    it('should generate database-related hypothetical', async () => {
      const result = await mockProvider.generate('How is data stored in the database?');
      expect(result).toContain('database');
    });

    it('should generate default hypothetical for unknown topics', async () => {
      const result = await mockProvider.generate('How does the widget system work?');
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('buildHypotheticalPrompt', () => {
    it('should build basic prompt', () => {
      const prompt = buildHypotheticalPrompt('How does auth work?');
      expect(prompt).toContain('How does auth work?');
      expect(prompt).toContain('documentation expert');
    });

    it('should include entity type hint', () => {
      const prompt = buildHypotheticalPrompt('How does auth work?', {
        entityTypes: ['function', 'class']
      });
      expect(prompt).toContain('function');
      expect(prompt).toContain('class');
    });

    it('should include recent context', () => {
      const prompt = buildHypotheticalPrompt('How does auth work?', {
        recentContext: 'Working on login flow'
      });
      expect(prompt).toContain('Working on login flow');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query gracefully', async () => {
      // Empty query is too short, should not use HyDE
      expect(expander.shouldUseHyDE('')).toBe(false);
    });

    it('should handle queries at minimum length', () => {
      // Exactly at minimum (10 chars)
      expect(expander.shouldUseHyDE('How auth?')).toBe(false); // 9 chars, too short
      // 10+ chars with 'how' intent should use HyDE
      expect(expander.shouldUseHyDE('How can I authenticate users?')).toBe(true);
    });

    it('should cache by project ID', async () => {
      await expander.expandQuery({
        query: 'How does auth work?',
        projectId: 'project-1'
      });

      await expander.expandQuery({
        query: 'How does auth work?',
        projectId: 'project-2'
      });

      const stats = expander.getCacheStats();
      expect(stats.size).toBe(2); // Different cache entries for different projects
    });
  });
});
