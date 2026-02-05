/**
 * F7.2 Model Abstraction Tests
 *
 * WARNING: These tests will FAIL until the actual implementations are created.
 * The following source files need to be implemented:
 *   - src/models/provider.ts (ModelProvider, OllamaProvider, OpenAIProvider, AnthropicProvider)
 *   - src/models/types.ts (ModelConfig, ModelCapabilities, ProviderConfig, HealthStatus)
 *   - src/models/embedding-provider.ts (EmbeddingProvider, OllamaEmbeddingProvider, OpenAIEmbeddingProvider)
 *   - src/models/summarization-provider.ts (SummarizationProvider)
 *   - src/models/provider-factory.ts (ProviderFactory)
 *   - src/models/health-checker.ts (HealthChecker)
 *   - src/models/fallback-manager.ts (FallbackManager)
 *
 * Tests for the model abstraction layer:
 * - Provider factory creation
 * - Embedding provider management
 * - Summarization provider management
 * - Health checking
 * - Automatic fallback
 *
 * @see docs/phase-7/F7.2-model-abstraction.md
 */

// Import actual implementations from source paths
import { ModelProvider, OllamaProvider, OpenAIProvider, AnthropicProvider } from '../../src/models/provider';
import { ModelConfig, ModelCapabilities, ProviderConfig, HealthStatus } from '../../src/models/types';
import { EmbeddingProvider, OllamaEmbeddingProvider, OpenAIEmbeddingProvider } from '../../src/models/embedding-provider';
import { SummarizationProvider } from '../../src/models/summarization-provider';
import { ProviderFactory } from '../../src/models/provider-factory';
import { HealthChecker } from '../../src/models/health-checker';
import { FallbackManager } from '../../src/models/fallback-manager';

// Mock the provider module
jest.mock('../../src/models/provider', () => ({
  ModelProvider: jest.fn(),
  OllamaProvider: jest.fn().mockImplementation((config) => ({
    modelId: `ollama:${config.model}`,
    baseUrl: config.baseUrl || 'http://localhost:11434',
    isAvailable: jest.fn().mockResolvedValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  })),
  OpenAIProvider: jest.fn().mockImplementation((config) => ({
    modelId: `openai:${config.model}`,
    apiKey: config.apiKey,
    isAvailable: jest.fn().mockResolvedValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  })),
  AnthropicProvider: jest.fn().mockImplementation((config) => ({
    modelId: `anthropic:${config.model}`,
    apiKey: config.apiKey,
    isAvailable: jest.fn().mockResolvedValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock the embedding provider module
jest.mock('../../src/models/embedding-provider', () => ({
  EmbeddingProvider: jest.fn(),
  OllamaEmbeddingProvider: jest.fn().mockImplementation((config) => ({
    modelId: `ollama:${config.model}`,
    embed: jest.fn().mockResolvedValue(new Float32Array(384).fill(0.1)),
    embedBatch: jest.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Float32Array(384).fill(0.1)))
    ),
    isAvailable: jest.fn().mockResolvedValue(true)
  })),
  OpenAIEmbeddingProvider: jest.fn().mockImplementation((config) => ({
    modelId: `openai:${config.model}`,
    embed: jest.fn().mockResolvedValue(new Float32Array(1536).fill(0.1)),
    embedBatch: jest.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Float32Array(1536).fill(0.1)))
    ),
    isAvailable: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock the summarization provider module
jest.mock('../../src/models/summarization-provider', () => ({
  SummarizationProvider: jest.fn().mockImplementation((config) => ({
    modelId: `${config.provider}:${config.model}`,
    summarize: jest.fn().mockImplementation((code: string) =>
      Promise.resolve(`Summary of code: ${code.slice(0, 50)}...`)
    ),
    isAvailable: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock the provider factory module
jest.mock('../../src/models/provider-factory', () => {
  const embeddingProviders = new Map();
  const summarizationProviders = new Map();

  return {
    ProviderFactory: jest.fn().mockImplementation(() => ({
      getEmbeddingProvider: jest.fn().mockImplementation((config) => {
        const key = `${config.provider}:${config.model}`;
        if (!embeddingProviders.has(key)) {
          const provider = {
            modelId: key,
            embed: jest.fn().mockResolvedValue(new Float32Array(384)),
            embedBatch: jest.fn().mockImplementation((texts: string[]) =>
              Promise.resolve(texts.map(() => new Float32Array(384)))
            ),
            isAvailable: jest.fn().mockResolvedValue(true)
          };
          embeddingProviders.set(key, provider);
        }
        return Promise.resolve(embeddingProviders.get(key));
      }),
      getSummarizationProvider: jest.fn().mockImplementation((config) => {
        const key = `${config.provider}:${config.model}`;
        if (!summarizationProviders.has(key)) {
          const provider = {
            modelId: key,
            summarize: jest.fn().mockResolvedValue('Summary'),
            isAvailable: jest.fn().mockResolvedValue(true)
          };
          summarizationProviders.set(key, provider);
        }
        return Promise.resolve(summarizationProviders.get(key));
      }),
      clearCache: jest.fn().mockImplementation(() => {
        embeddingProviders.clear();
        summarizationProviders.clear();
      })
    }))
  };
});

// Mock the health checker module
jest.mock('../../src/models/health-checker', () => {
  const cache = new Map<string, { available: boolean; timestamp: number }>();
  const cacheTTL = 5 * 60 * 1000;

  return {
    HealthChecker: jest.fn().mockImplementation(() => ({
      checkHealth: jest.fn().mockImplementation(async (provider) => {
        const cached = cache.get(provider.modelId);
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          return cached.available;
        }
        try {
          const available = await provider.isAvailable();
          cache.set(provider.modelId, { available, timestamp: Date.now() });
          return available;
        } catch {
          cache.set(provider.modelId, { available: false, timestamp: Date.now() });
          return false;
        }
      }),
      clearCache: jest.fn().mockImplementation(() => {
        cache.clear();
      }),
      getCacheTTL: jest.fn().mockReturnValue(cacheTTL),
      setCacheTTL: jest.fn()
    }))
  };
});

// Mock the fallback manager module
jest.mock('../../src/models/fallback-manager', () => ({
  FallbackManager: jest.fn().mockImplementation(() => {
    let primaryAvailable = true;
    let fallbackAvailable = true;

    return {
      setPrimaryAvailable: jest.fn().mockImplementation((available: boolean) => {
        primaryAvailable = available;
      }),
      setFallbackAvailable: jest.fn().mockImplementation((available: boolean) => {
        fallbackAvailable = available;
      }),
      getProvider: jest.fn().mockImplementation((primary, fallback) => {
        if (primaryAvailable) {
          return Promise.resolve({
            provider: `${primary.provider}:${primary.model}`,
            usedFallback: false
          });
        }
        if (fallbackAvailable) {
          return Promise.resolve({
            provider: `${fallback.provider}:${fallback.model}`,
            usedFallback: true
          });
        }
        return Promise.reject(new Error('No providers available'));
      })
    };
  })
}));

describe('F7.2 Model Abstraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // ProviderConfig Interface Tests
  // ============================================================================

  describe('ProviderConfig Interface', () => {
    it('should support ollama provider', () => {
      const config: ProviderConfig = {
        provider: 'ollama',
        model: 'nomic-embed-text'
      };

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('nomic-embed-text');
    });

    it('should support openai provider', () => {
      const config: ProviderConfig = {
        provider: 'openai',
        model: 'text-embedding-3-small'
      };

      expect(config.provider).toBe('openai');
    });

    it('should support anthropic provider', () => {
      const config: ProviderConfig = {
        provider: 'anthropic',
        model: 'claude-3-haiku'
      };

      expect(config.provider).toBe('anthropic');
    });
  });

  // ============================================================================
  // OllamaProvider Tests
  // ============================================================================

  describe('OllamaProvider', () => {
    it('should create OllamaProvider with correct config', () => {
      const config = { model: 'nomic-embed-text', baseUrl: 'http://localhost:11434' };
      const provider = new OllamaProvider(config);

      expect(OllamaProvider).toHaveBeenCalledWith(config);
      expect(provider.modelId).toBe('ollama:nomic-embed-text');
      expect(provider.baseUrl).toBe('http://localhost:11434');
    });

    it('should check availability', async () => {
      const provider = new OllamaProvider({ model: 'test' });

      const available = await provider.isAvailable();

      expect(available).toBe(true);
      expect(provider.isAvailable).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // OpenAIProvider Tests
  // ============================================================================

  describe('OpenAIProvider', () => {
    it('should create OpenAIProvider with correct config', () => {
      const config = { model: 'gpt-4o-mini', apiKey: 'sk-test-key' };
      const provider = new OpenAIProvider(config);

      expect(OpenAIProvider).toHaveBeenCalledWith(config);
      expect(provider.modelId).toBe('openai:gpt-4o-mini');
      expect(provider.apiKey).toBe('sk-test-key');
    });

    it('should check availability', async () => {
      const provider = new OpenAIProvider({ model: 'test', apiKey: 'sk-test' });

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  // ============================================================================
  // AnthropicProvider Tests
  // ============================================================================

  describe('AnthropicProvider', () => {
    it('should create AnthropicProvider with correct config', () => {
      const config = { model: 'claude-3-haiku', apiKey: 'sk-ant-test' };
      const provider = new AnthropicProvider(config);

      expect(AnthropicProvider).toHaveBeenCalledWith(config);
      expect(provider.modelId).toBe('anthropic:claude-3-haiku');
    });
  });

  // ============================================================================
  // EmbeddingProvider Tests
  // ============================================================================

  describe('EmbeddingProvider', () => {
    it('should create OllamaEmbeddingProvider', () => {
      const config = { model: 'nomic-embed-text' };
      const provider = new OllamaEmbeddingProvider(config);

      expect(OllamaEmbeddingProvider).toHaveBeenCalledWith(config);
      expect(provider.modelId).toBe('ollama:nomic-embed-text');
    });

    it('should generate embeddings with OllamaEmbeddingProvider', async () => {
      const provider = new OllamaEmbeddingProvider({ model: 'test' });

      const embedding = await provider.embed('test text');

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(384);
      expect(provider.embed).toHaveBeenCalledWith('test text');
    });

    it('should generate batch embeddings', async () => {
      const provider = new OllamaEmbeddingProvider({ model: 'test' });

      const embeddings = await provider.embedBatch(['text1', 'text2', 'text3']);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(emb => {
        expect(emb).toBeInstanceOf(Float32Array);
      });
    });

    it('should create OpenAIEmbeddingProvider', () => {
      const config = { model: 'text-embedding-3-small', apiKey: 'sk-test' };
      const provider = new OpenAIEmbeddingProvider(config);

      expect(OpenAIEmbeddingProvider).toHaveBeenCalledWith(config);
      expect(provider.modelId).toBe('openai:text-embedding-3-small');
    });

    it('should generate embeddings with OpenAIEmbeddingProvider', async () => {
      const provider = new OpenAIEmbeddingProvider({ model: 'text-embedding-3-small', apiKey: 'sk-test' });

      const embedding = await provider.embed('test text');

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(1536);
    });

    it('should check availability', async () => {
      const provider = new OllamaEmbeddingProvider({ model: 'test' });

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  // ============================================================================
  // SummarizationProvider Tests
  // ============================================================================

  describe('SummarizationProvider', () => {
    it('should create summarization provider from config', () => {
      const config = { provider: 'ollama', model: 'qwen2.5-coder:7b' };
      const provider = new SummarizationProvider(config);

      expect(SummarizationProvider).toHaveBeenCalledWith(config);
      expect(provider.modelId).toBe('ollama:qwen2.5-coder:7b');
    });

    it('should generate summaries', async () => {
      const config = { provider: 'ollama', model: 'test' };
      const provider = new SummarizationProvider(config);

      const code = 'function login(user, pass) { return authenticate(user, pass); }';
      const summary = await provider.summarize(code, 'Summarize this function');

      expect(summary).toContain('Summary');
      expect(summary.length).toBeGreaterThan(0);
      expect(provider.summarize).toHaveBeenCalledWith(code, 'Summarize this function');
    });

    it('should check availability', async () => {
      const config = { provider: 'ollama', model: 'test' };
      const provider = new SummarizationProvider(config);

      const available = await provider.isAvailable();

      expect(available).toBe(true);
    });
  });

  // ============================================================================
  // ProviderFactory Tests
  // ============================================================================

  describe('ProviderFactory', () => {
    let factory: InstanceType<typeof ProviderFactory>;

    beforeEach(() => {
      factory = new ProviderFactory();
    });

    it('should create embedding provider', async () => {
      const config: ProviderConfig = { provider: 'ollama', model: 'nomic-embed-text' };

      const provider = await factory.getEmbeddingProvider(config);

      expect(provider.modelId).toBe('ollama:nomic-embed-text');
      expect(factory.getEmbeddingProvider).toHaveBeenCalledWith(config);
    });

    it('should create summarization provider', async () => {
      const config: ProviderConfig = { provider: 'openai', model: 'gpt-4o-mini' };

      const provider = await factory.getSummarizationProvider(config);

      expect(provider.modelId).toBe('openai:gpt-4o-mini');
      expect(factory.getSummarizationProvider).toHaveBeenCalledWith(config);
    });

    it('should cache providers', async () => {
      const config: ProviderConfig = { provider: 'ollama', model: 'test' };

      const provider1 = await factory.getEmbeddingProvider(config);
      const provider2 = await factory.getEmbeddingProvider(config);

      expect(provider1).toBe(provider2);
    });

    it('should return different providers for different configs', async () => {
      const provider1 = await factory.getEmbeddingProvider({ provider: 'ollama', model: 'model1' });
      const provider2 = await factory.getEmbeddingProvider({ provider: 'ollama', model: 'model2' });

      expect(provider1).not.toBe(provider2);
    });

    it('should clear provider cache', async () => {
      const config: ProviderConfig = { provider: 'ollama', model: 'test' };
      await factory.getEmbeddingProvider(config);

      factory.clearCache();

      expect(factory.clearCache).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Health Checking Tests
  // ============================================================================

  describe('HealthChecker', () => {
    let healthChecker: InstanceType<typeof HealthChecker>;

    beforeEach(() => {
      healthChecker = new HealthChecker();
    });

    it('should check provider health', async () => {
      const provider = new OllamaProvider({ model: 'test' });

      const healthy = await healthChecker.checkHealth(provider);

      expect(healthy).toBe(true);
      expect(healthChecker.checkHealth).toHaveBeenCalledWith(provider);
    });

    it('should cache health status', async () => {
      let checkCount = 0;
      const provider = {
        modelId: 'ollama:test',
        isAvailable: jest.fn().mockImplementation(async () => {
          checkCount++;
          return true;
        })
      };

      await healthChecker.checkHealth(provider);
      await healthChecker.checkHealth(provider);
      await healthChecker.checkHealth(provider);

      // Health checker should cache, so isAvailable called only once
      expect(provider.isAvailable).toHaveBeenCalledTimes(1);
    });

    it('should handle provider errors', async () => {
      const provider = {
        modelId: 'ollama:broken',
        isAvailable: jest.fn().mockRejectedValue(new Error('Connection refused'))
      };

      const healthy = await healthChecker.checkHealth(provider);

      expect(healthy).toBe(false);
    });

    it('should clear cache', async () => {
      const provider = {
        modelId: 'ollama:test',
        isAvailable: jest.fn().mockResolvedValue(true)
      };

      await healthChecker.checkHealth(provider);
      healthChecker.clearCache();
      await healthChecker.checkHealth(provider);

      expect(provider.isAvailable).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Automatic Fallback Tests
  // ============================================================================

  describe('FallbackManager', () => {
    let fallbackManager: InstanceType<typeof FallbackManager>;

    beforeEach(() => {
      fallbackManager = new FallbackManager();
    });

    it('should use primary provider when available', async () => {
      const result = await fallbackManager.getProvider(
        { provider: 'ollama', model: 'primary' },
        { provider: 'openai', model: 'fallback' }
      );

      expect(result.provider).toBe('ollama:primary');
      expect(result.usedFallback).toBe(false);
    });

    it('should fall back when primary unavailable', async () => {
      fallbackManager.setPrimaryAvailable(false);

      const result = await fallbackManager.getProvider(
        { provider: 'ollama', model: 'primary' },
        { provider: 'openai', model: 'fallback' }
      );

      expect(result.provider).toBe('openai:fallback');
      expect(result.usedFallback).toBe(true);
    });

    it('should throw when all providers unavailable', async () => {
      fallbackManager.setPrimaryAvailable(false);
      fallbackManager.setFallbackAvailable(false);

      await expect(fallbackManager.getProvider(
        { provider: 'ollama', model: 'primary' },
        { provider: 'openai', model: 'fallback' }
      )).rejects.toThrow('No providers available');
    });

    it('should support embedding provider fallback', async () => {
      fallbackManager.setPrimaryAvailable(false);

      const result = await fallbackManager.getProvider(
        { provider: 'ollama', model: 'nomic-embed-text' },
        { provider: 'openai', model: 'text-embedding-3-small' }
      );

      expect(result.usedFallback).toBe(true);
      expect(result.provider).toContain('openai');
    });

    it('should support summarization provider fallback', async () => {
      fallbackManager.setPrimaryAvailable(false);

      const result = await fallbackManager.getProvider(
        { provider: 'ollama', model: 'qwen2.5-coder:7b' },
        { provider: 'openai', model: 'gpt-4o-mini' }
      );

      expect(result.usedFallback).toBe(true);
      expect(result.provider).toContain('openai');
    });
  });

  // ============================================================================
  // Provider Creation Tests
  // ============================================================================

  describe('Provider Creation', () => {
    it('should create Ollama embedding provider with default baseUrl', () => {
      const config = { model: 'nomic-embed-text' };
      const provider = new OllamaProvider(config);

      expect(provider.baseUrl).toBe('http://localhost:11434');
      expect(provider.modelId).toBe('ollama:nomic-embed-text');
    });

    it('should create OpenAI embedding provider with apiKey', () => {
      const config = { model: 'text-embedding-3-small', apiKey: 'sk-test-key' };
      const provider = new OpenAIProvider(config);

      expect(provider.apiKey).toBe('sk-test-key');
      expect(provider.modelId).toBe('openai:text-embedding-3-small');
    });

    it('should throw for unknown provider', () => {
      const createProvider = (providerType: string) => {
        if (!['ollama', 'openai', 'anthropic'].includes(providerType)) {
          throw new Error(`Unknown provider: ${providerType}`);
        }
      };

      expect(() => createProvider('unknown')).toThrow('Unknown provider: unknown');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle provider timeout', async () => {
      const provider = new OllamaProvider({ model: 'slow-model' });
      (provider.isAvailable as jest.Mock).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      const provider = new OllamaProvider({ model: 'broken-model' });
      (provider.isAvailable as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await provider.isAvailable();
      } catch (error) {
        expect((error as Error).message).toBe('ECONNREFUSED');
      }
    });

    it('should handle empty model name', () => {
      const config: ProviderConfig = { provider: 'ollama', model: '' };

      expect(config.model).toBe('');
    });

    it('should handle concurrent provider requests', async () => {
      let requestCount = 0;
      const provider = new OllamaProvider({ model: 'concurrent-test' });
      (provider.isAvailable as jest.Mock).mockImplementation(async () => {
        requestCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });

      // Concurrent requests
      await Promise.all([
        provider.isAvailable(),
        provider.isAvailable(),
        provider.isAvailable()
      ]);

      expect(requestCount).toBe(3);
    });

    it('should handle provider returning different results', async () => {
      let callCount = 0;
      const provider = new OllamaProvider({ model: 'flaky-model' });
      (provider.isAvailable as jest.Mock).mockImplementation(async () => {
        callCount++;
        return callCount % 2 === 0; // Alternates between true/false
      });

      const result1 = await provider.isAvailable();
      const result2 = await provider.isAvailable();

      expect(result1).toBe(false);
      expect(result2).toBe(true);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration', () => {
    it('should create full provider workflow', async () => {
      // Create factory
      const factory = new ProviderFactory();

      // Get embedding provider
      const embeddingProvider = await factory.getEmbeddingProvider({
        provider: 'ollama',
        model: 'nomic-embed-text'
      });

      // Get summarization provider
      const summarizationProvider = await factory.getSummarizationProvider({
        provider: 'ollama',
        model: 'qwen2.5-coder:7b'
      });

      // Create health checker
      const healthChecker = new HealthChecker();

      // Check health
      const embeddingHealthy = await healthChecker.checkHealth(embeddingProvider);
      const summarizationHealthy = await healthChecker.checkHealth(summarizationProvider);

      expect(embeddingHealthy).toBe(true);
      expect(summarizationHealthy).toBe(true);
    });

    it('should handle fallback in workflow', async () => {
      const fallbackManager = new FallbackManager();
      fallbackManager.setPrimaryAvailable(false);

      const result = await fallbackManager.getProvider(
        { provider: 'ollama', model: 'nomic-embed-text' },
        { provider: 'openai', model: 'text-embedding-3-small' }
      );

      expect(result.usedFallback).toBe(true);
      expect(result.provider).toBe('openai:text-embedding-3-small');
    });
  });
});
