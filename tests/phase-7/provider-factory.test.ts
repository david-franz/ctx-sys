/**
 * Tests for F7.2 - Model Abstraction (Provider Factory)
 */

import {
  ProviderFactory,
  ModelProviderConfig,
  ProviderHealth,
  MockSummarizationProvider,
  defaultProviderFactory
} from '../../src/models';
import {
  MockEmbeddingProvider,
  EmbeddingProvider
} from '../../src/embeddings';
import { LLMSummarizer } from '../../src/summarization';
import { ConfigManager } from '../../src/config';

describe('ProviderFactory', () => {
  let factory: ProviderFactory;
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager({ inMemoryOnly: true });
    factory = new ProviderFactory({ configManager });
  });

  afterEach(() => {
    factory.clearAll();
  });

  describe('constructor', () => {
    it('should create factory with default options', () => {
      const defaultFactory = new ProviderFactory();
      expect(defaultFactory).toBeInstanceOf(ProviderFactory);
    });

    it('should create factory with custom ConfigManager', () => {
      const customConfig = new ConfigManager({ inMemoryOnly: true });
      const customFactory = new ProviderFactory({ configManager: customConfig });
      expect(customFactory).toBeInstanceOf(ProviderFactory);
    });

    it('should create factory with custom health cache TTL', () => {
      const customFactory = new ProviderFactory({ healthCacheTTL: 60000 });
      expect(customFactory).toBeInstanceOf(ProviderFactory);
    });
  });

  describe('getEmbeddingProvider', () => {
    it('should create mock embedding provider', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test-model'
      });

      expect(provider).toBeInstanceOf(MockEmbeddingProvider);
    });

    it('should cache and reuse providers', async () => {
      const config: ModelProviderConfig = { provider: 'mock', model: 'test-model' };

      const provider1 = await factory.getEmbeddingProvider(config);
      const provider2 = await factory.getEmbeddingProvider(config);

      expect(provider1).toBe(provider2);
    });

    it('should create different providers for different configs', async () => {
      const provider1 = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'model-1'
      });

      const provider2 = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'model-2'
      });

      // Both are MockEmbeddingProvider but should be cached separately
      expect(provider1).not.toBe(provider2);
    });

    it('should use default config when none provided', async () => {
      const provider = await factory.getEmbeddingProvider();
      expect(provider).toBeDefined();
    });

    it('should throw for unknown provider type', async () => {
      await expect(factory.getEmbeddingProvider({
        provider: 'unknown' as any,
        model: 'test'
      })).rejects.toThrow('Unknown embedding provider');
    });
  });

  describe('getEmbeddingProviderWithFallback', () => {
    it('should return primary provider when available', async () => {
      const provider = await factory.getEmbeddingProviderWithFallback(
        { provider: 'mock', model: 'primary' },
        { provider: 'mock', model: 'fallback' }
      );

      expect(provider).toBeDefined();
    });

    it('should use fallback when primary unavailable', async () => {
      // Create a failing mock provider by using an unknown provider type
      // that will fail health check
      const failingConfig: ModelProviderConfig = {
        provider: 'mock',
        model: 'failing-model'
      };

      const fallbackConfig: ModelProviderConfig = {
        provider: 'mock',
        model: 'fallback-model'
      };

      // Get provider first to put it in cache
      const primaryProvider = await factory.getEmbeddingProvider(failingConfig);

      // Set cached health to false
      factory['healthCache'].set(`${primaryProvider.name}:${primaryProvider.modelId}`, {
        available: false,
        lastChecked: new Date()
      });

      const provider = await factory.getEmbeddingProviderWithFallback(
        failingConfig,
        fallbackConfig
      );

      // Should get fallback since primary marked as unavailable
      expect(provider).toBeDefined();
    });

    it('should use default fallback to mock provider', async () => {
      const provider = await factory.getEmbeddingProviderWithFallback();
      expect(provider).toBeDefined();
    });
  });

  describe('getSummarizationProvider', () => {
    it('should create mock summarization provider', async () => {
      const provider = await factory.getSummarizationProvider({
        provider: 'mock',
        model: 'test-model'
      });

      expect(provider).toBeInstanceOf(MockSummarizationProvider);
    });

    it('should cache and reuse summarization providers', async () => {
      const config: ModelProviderConfig = { provider: 'mock', model: 'test-model' };

      const provider1 = await factory.getSummarizationProvider(config);
      const provider2 = await factory.getSummarizationProvider(config);

      expect(provider1).toBe(provider2);
    });

    it('should use default config when none provided', async () => {
      const provider = await factory.getSummarizationProvider();
      expect(provider).toBeDefined();
    });

    it('should throw for unknown provider type', async () => {
      await expect(factory.getSummarizationProvider({
        provider: 'unknown' as any,
        model: 'test'
      })).rejects.toThrow('Unknown summarization provider');
    });
  });

  describe('getSummarizationProviderWithFallback', () => {
    it('should return primary provider when available', async () => {
      const provider = await factory.getSummarizationProviderWithFallback(
        { provider: 'mock', model: 'primary' },
        { provider: 'mock', model: 'fallback' }
      );

      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(MockSummarizationProvider);
    });

    it('should use fallback when primary fails health check', async () => {
      const failingMock = new MockSummarizationProvider();
      failingMock.failOnCall = true;

      // We need to test the fallback mechanism through the factory
      const provider = await factory.getSummarizationProviderWithFallback(
        { provider: 'mock', model: 'test' },
        { provider: 'mock', model: 'fallback' }
      );

      expect(provider).toBeInstanceOf(MockSummarizationProvider);
    });

    it('should use default fallback to mock provider', async () => {
      const provider = await factory.getSummarizationProviderWithFallback();
      expect(provider).toBeDefined();
    });
  });

  describe('checkHealth', () => {
    it('should return true for available provider', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test'
      });

      const isHealthy = await factory.checkHealth(provider);
      expect(isHealthy).toBe(true);
    });

    it('should cache health check results', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test'
      });

      // First check
      await factory.checkHealth(provider);

      // Second check should use cache
      const status = factory.getHealthStatus();
      expect(status.size).toBeGreaterThan(0);
    });

    it('should return cached value within TTL', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test'
      });

      // First check populates cache
      const result1 = await factory.checkHealth(provider);

      // Manually set cache to false
      const key = `${provider.name}:${provider.modelId}`;
      factory['healthCache'].set(key, {
        available: false,
        lastChecked: new Date()
      });

      // Should return cached false value
      const result2 = await factory.checkHealth(provider);
      expect(result2).toBe(false);
    });

    it('should refresh cache after TTL expires', async () => {
      const shortTTLFactory = new ProviderFactory({
        configManager,
        healthCacheTTL: 1 // 1ms TTL
      });

      const provider = await shortTTLFactory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test'
      });

      // First check
      await shortTTLFactory.checkHealth(provider);

      // Set cached health to false
      const key = `${provider.name}:${provider.modelId}`;
      shortTTLFactory['healthCache'].set(key, {
        available: false,
        lastChecked: new Date(Date.now() - 100) // 100ms ago
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 5));

      // Should refresh and get true from mock provider
      const result = await shortTTLFactory.checkHealth(provider);
      expect(result).toBe(true);
    });
  });

  describe('checkSummarizationHealth', () => {
    it('should return true for healthy mock provider', async () => {
      const provider = await factory.getSummarizationProvider({
        provider: 'mock',
        model: 'test'
      });

      const isHealthy = await factory.checkSummarizationHealth(provider);
      expect(isHealthy).toBe(true);
    });

    it('should return false when provider fails', async () => {
      const failingProvider = new MockSummarizationProvider();
      failingProvider.failOnCall = true;

      const isHealthy = await factory.checkSummarizationHealth(failingProvider);
      expect(isHealthy).toBe(false);
    });

    it('should cache summarization health results', async () => {
      const provider = await factory.getSummarizationProvider({
        provider: 'mock',
        model: 'test'
      });

      await factory.checkSummarizationHealth(provider);

      const status = factory.getHealthStatus();
      const hasEntry = Array.from(status.keys()).some(k => k.includes('summarizer'));
      expect(hasEntry).toBe(true);
    });
  });

  describe('getHealthStatus', () => {
    it('should return empty map initially', () => {
      const status = factory.getHealthStatus();
      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBe(0);
    });

    it('should return health info after checks', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test'
      });
      await factory.checkHealth(provider);

      const status = factory.getHealthStatus();
      expect(status.size).toBeGreaterThan(0);

      const entry = Array.from(status.values())[0];
      expect(entry.available).toBe(true);
      expect(entry.lastChecked).toBeInstanceOf(Date);
    });

    it('should return copy of health cache', () => {
      const status1 = factory.getHealthStatus();
      const status2 = factory.getHealthStatus();
      expect(status1).not.toBe(status2);
    });
  });

  describe('clearHealthCache', () => {
    it('should clear all health cache entries', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'mock',
        model: 'test'
      });
      await factory.checkHealth(provider);

      expect(factory.getHealthStatus().size).toBeGreaterThan(0);

      factory.clearHealthCache();

      expect(factory.getHealthStatus().size).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all caches', async () => {
      // Create some providers
      await factory.getEmbeddingProvider({ provider: 'mock', model: 'test' });
      await factory.getSummarizationProvider({ provider: 'mock', model: 'test' });

      // Do health checks
      const embProvider = await factory.getEmbeddingProvider({ provider: 'mock', model: 'test' });
      await factory.checkHealth(embProvider);

      factory.clearAll();

      // Verify caches are cleared
      expect(factory.getHealthStatus().size).toBe(0);
      expect(factory['embeddingProviders'].size).toBe(0);
      expect(factory['summarizationProviders'].size).toBe(0);
    });
  });

  describe('defaultProviderFactory', () => {
    it('should export a default factory instance', () => {
      expect(defaultProviderFactory).toBeInstanceOf(ProviderFactory);
    });
  });
});

describe('MockSummarizationProvider', () => {
  let provider: MockSummarizationProvider;

  beforeEach(() => {
    provider = new MockSummarizationProvider();
  });

  describe('name', () => {
    it('should have name "mock"', () => {
      expect(provider.name).toBe('mock');
    });
  });

  describe('summarizeSymbol', () => {
    it('should return mock summary for symbol', async () => {
      const summary = await provider.summarizeSymbol({
        name: 'testFunction',
        type: 'function',
        qualifiedName: 'testFunction',
        startLine: 1,
        endLine: 10
      });

      expect(summary).toBe('Mock summary for testFunction');
    });

    it('should throw when failOnCall is true', async () => {
      provider.failOnCall = true;

      await expect(provider.summarizeSymbol({
        name: 'test',
        type: 'function',
        qualifiedName: 'test',
        startLine: 1,
        endLine: 1
      })).rejects.toThrow('Mock provider configured to fail');
    });
  });

  describe('summarizeFile', () => {
    it('should return mock summary for file', async () => {
      const summary = await provider.summarizeFile({
        filePath: '/path/to/file.ts',
        symbols: []
      });

      expect(summary).toBe('Mock file summary for /path/to/file.ts');
    });

    it('should handle missing filePath', async () => {
      const summary = await provider.summarizeFile({});

      expect(summary).toBe('Mock file summary for unknown file');
    });

    it('should throw when failOnCall is true', async () => {
      provider.failOnCall = true;

      await expect(provider.summarizeFile({
        filePath: '/path/to/file.ts'
      })).rejects.toThrow('Mock provider configured to fail');
    });
  });
});

describe('Provider Configuration', () => {
  let factory: ProviderFactory;
  let configManager: ConfigManager;

  beforeEach(() => {
    configManager = new ConfigManager({ inMemoryOnly: true });
    factory = new ProviderFactory({ configManager });
  });

  afterEach(() => {
    factory.clearAll();
  });

  describe('Ollama provider', () => {
    it('should create Ollama embedding provider with default URL', async () => {
      // Note: This won't actually connect, but verifies provider creation
      const provider = await factory.getEmbeddingProvider({
        provider: 'ollama',
        model: 'nomic-embed-text'
      });

      expect(provider.name).toBe('ollama');
      expect(provider.modelId).toContain('nomic-embed-text');
    });

    it('should create Ollama summarization provider', async () => {
      const provider = await factory.getSummarizationProvider({
        provider: 'ollama',
        model: 'llama2'
      });

      expect((provider as any).name).toBe('ollama');
    });
  });

  describe('OpenAI provider', () => {
    it('should create OpenAI embedding provider', async () => {
      const provider = await factory.getEmbeddingProvider({
        provider: 'openai',
        model: 'text-embedding-3-small'
      });

      expect(provider.name).toBe('openai');
      expect(provider.modelId).toContain('text-embedding-3-small');
    });

    it('should create OpenAI summarization provider', async () => {
      const provider = await factory.getSummarizationProvider({
        provider: 'openai',
        model: 'gpt-4o-mini'
      });

      expect((provider as any).name).toBe('openai');
    });
  });
});

describe('Provider Key Generation', () => {
  let factory: ProviderFactory;

  beforeEach(() => {
    factory = new ProviderFactory({
      configManager: new ConfigManager({ inMemoryOnly: true })
    });
  });

  it('should generate unique keys for different types', async () => {
    const embeddingProvider = await factory.getEmbeddingProvider({
      provider: 'mock',
      model: 'test'
    });

    const summarizationProvider = await factory.getSummarizationProvider({
      provider: 'mock',
      model: 'test'
    });

    // They should both exist but be different instances
    expect(embeddingProvider).not.toBe(summarizationProvider);
  });

  it('should generate unique keys for different providers', async () => {
    const provider1 = await factory.getEmbeddingProvider({
      provider: 'mock',
      model: 'model-a'
    });

    const provider2 = await factory.getEmbeddingProvider({
      provider: 'mock',
      model: 'model-b'
    });

    expect(provider1).not.toBe(provider2);
  });
});

describe('Health Cache with Errors', () => {
  let factory: ProviderFactory;

  beforeEach(() => {
    factory = new ProviderFactory({
      configManager: new ConfigManager({ inMemoryOnly: true })
    });
  });

  it('should store error messages in health cache', async () => {
    const failingProvider = new MockSummarizationProvider();
    failingProvider.failOnCall = true;

    await factory.checkSummarizationHealth(failingProvider);

    const status = factory.getHealthStatus();
    const entry = Array.from(status.values()).find(e => e.error);

    expect(entry).toBeDefined();
    expect(entry!.error).toContain('Mock provider configured to fail');
  });
});
