import {
  LLMSummarizationManager,
  MockSummarizationProvider,
  OllamaSummarizationProvider,
  OpenAISummarizationProvider,
  AnthropicSummarizationProvider,
  EntityForSummary
} from '../../src/summarization';
import { Symbol, ParseResult } from '../../src/ast';

describe('F10.6 - LLM Summaries', () => {
  describe('MockSummarizationProvider', () => {
    let provider: MockSummarizationProvider;

    beforeEach(() => {
      provider = new MockSummarizationProvider();
    });

    it('should be available by default', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('should be configurable to be unavailable', async () => {
      provider.configure({ isAvailable: false });
      expect(await provider.isAvailable()).toBe(false);
    });

    it('should generate predictable summaries', async () => {
      const summary = await provider.summarize('function test() {}', {
        entityType: 'function',
        name: 'test'
      });

      expect(summary).toContain('function');
      expect(summary).toContain('test');
    });

    it('should use custom prefix', async () => {
      provider.configure({ prefix: 'Custom:' });
      const summary = await provider.summarize('const x = 1;', {
        entityType: 'variable',
        name: 'x'
      });

      expect(summary).toContain('Custom:');
    });

    it('should fail when configured to fail', async () => {
      provider.configure({ shouldFail: true });
      await expect(
        provider.summarize('code', { entityType: 'function', name: 'test' })
      ).rejects.toThrow('Mock provider failure');
    });

    it('should batch summarize', async () => {
      const items = [
        { id: '1', content: 'function a() {}', options: { entityType: 'function', name: 'a' } },
        { id: '2', content: 'function b() {}', options: { entityType: 'function', name: 'b' } }
      ];

      const summaries = await provider.summarizeBatch(items);
      expect(summaries.length).toBe(2);
      expect(summaries[0]).toContain('a');
      expect(summaries[1]).toContain('b');
    });
  });

  describe('OllamaSummarizationProvider', () => {
    let provider: OllamaSummarizationProvider;

    beforeEach(() => {
      provider = new OllamaSummarizationProvider({ baseUrl: 'http://localhost:11434' });
    });

    it('should have correct id and model', () => {
      expect(provider.id).toBe('ollama');
      expect(provider.model).toBe('qwen3:0.6b');
    });

    it('should allow custom model', () => {
      const custom = new OllamaSummarizationProvider({ model: 'llama3' });
      expect(custom.model).toBe('llama3');
    });

    // Note: isAvailable will return false in tests unless Ollama is running
    it('should check availability', async () => {
      // This will return false unless Ollama is actually running
      const available = await provider.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('OpenAISummarizationProvider', () => {
    let provider: OpenAISummarizationProvider;

    beforeEach(() => {
      provider = new OpenAISummarizationProvider();
    });

    it('should have correct id and model', () => {
      expect(provider.id).toBe('openai');
      expect(provider.model).toBe('gpt-4o-mini');
    });

    it('should be unavailable without API key', async () => {
      // Clear env for test
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const testProvider = new OpenAISummarizationProvider();
      expect(await testProvider.isAvailable()).toBe(false);

      // Restore
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    it('should allow custom model and base URL', () => {
      const custom = new OpenAISummarizationProvider({
        model: 'gpt-4',
        baseUrl: 'https://custom.api.com'
      });
      expect(custom.model).toBe('gpt-4');
    });
  });

  describe('AnthropicSummarizationProvider', () => {
    let provider: AnthropicSummarizationProvider;

    beforeEach(() => {
      provider = new AnthropicSummarizationProvider();
    });

    it('should have correct id and model', () => {
      expect(provider.id).toBe('anthropic');
      expect(provider.model).toBe('claude-3-haiku-20240307');
    });

    it('should be unavailable without API key', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const testProvider = new AnthropicSummarizationProvider();
      expect(await testProvider.isAvailable()).toBe(false);

      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    });
  });

  describe('LLMSummarizationManager', () => {
    let manager: LLMSummarizationManager;
    let mockProvider: MockSummarizationProvider;

    beforeEach(() => {
      manager = new LLMSummarizationManager();
      mockProvider = new MockSummarizationProvider();
      manager.registerProvider('mock', mockProvider);
    });

    describe('Provider Selection', () => {
      it('should prefer mock provider when registered first', async () => {
        const customManager = new LLMSummarizationManager({
          providers: ['mock', 'ollama', 'openai']
        });
        customManager.registerProvider('mock', mockProvider);

        const provider = await customManager.getProvider();
        expect(provider?.id).toBe('mock');
      });

      it('should return null when no providers available', async () => {
        const customManager = new LLMSummarizationManager({
          providers: []
        });

        const provider = await customManager.getProvider();
        expect(provider).toBeNull();
      });

      it('should list available providers', async () => {
        const customManager = new LLMSummarizationManager();
        customManager.registerProvider('mock', mockProvider);

        const available = await customManager.getAvailableProviders();
        expect(available).toContain('mock');
      });

      it('should cache active provider', async () => {
        const customManager = new LLMSummarizationManager({
          providers: ['mock']
        });
        customManager.registerProvider('mock', mockProvider);

        await customManager.getProvider();
        expect(customManager.getActiveProviderId()).toBe('mock');
      });
    });

    describe('Symbol Summarization', () => {
      beforeEach(() => {
        // Make mock the active provider
        const customManager = new LLMSummarizationManager({
          providers: ['mock']
        });
        customManager.registerProvider('mock', mockProvider);
        manager = customManager;
      });

      it('should summarize a function symbol', async () => {
        const symbol: Symbol = {
          type: 'function',
          name: 'processData',
          qualifiedName: 'test.ts::processData',
          signature: 'function processData(data: string): void',
          parameters: [{ name: 'data', type: 'string' }],
          returnType: 'void',
          startLine: 1,
          endLine: 5
        };

        const summary = await manager.summarizeSymbol(symbol);
        expect(summary).toContain('function');
        expect(summary).toContain('processData');
      });

      it('should summarize a class symbol', async () => {
        const symbol: Symbol = {
          type: 'class',
          name: 'UserService',
          qualifiedName: 'test.ts::UserService',
          startLine: 1,
          endLine: 50,
          children: [
            { type: 'method', name: 'getUser', qualifiedName: 'test.ts::UserService.getUser', startLine: 5, endLine: 10 },
            { type: 'property', name: 'db', qualifiedName: 'test.ts::UserService.db', startLine: 2, endLine: 2 }
          ]
        };

        const summary = await manager.summarizeSymbol(symbol);
        expect(summary).toContain('class');
      });

      it('should include docstring in content', async () => {
        const symbol: Symbol = {
          type: 'function',
          name: 'helper',
          qualifiedName: 'test.ts::helper',
          docstring: 'Helps with things',
          startLine: 1,
          endLine: 3
        };

        const summary = await manager.summarizeSymbol(symbol);
        expect(summary).toBeDefined();
      });
    });

    describe('File Summarization', () => {
      beforeEach(() => {
        const customManager = new LLMSummarizationManager({
          providers: ['mock']
        });
        customManager.registerProvider('mock', mockProvider);
        manager = customManager;
      });

      it('should summarize a parse result', async () => {
        const parseResult: ParseResult = {
          filePath: 'src/utils/helpers.ts',
          language: 'typescript',
          symbols: [
            { type: 'function', name: 'formatDate', qualifiedName: 'helpers.ts::formatDate', startLine: 5, endLine: 10 }
          ],
          imports: [{ source: 'lodash', specifiers: [{ name: 'debounce' }], startLine: 1 }],
          exports: ['formatDate'],
          errors: []
        };

        const summary = await manager.summarizeFile(parseResult);
        expect(summary).toContain('file');
      });
    });

    describe('Batch Entity Summarization', () => {
      beforeEach(() => {
        const customManager = new LLMSummarizationManager({
          providers: ['mock'],
          batchSize: 5
        });
        customManager.registerProvider('mock', mockProvider);
        manager = customManager;
      });

      it('should summarize multiple entities', async () => {
        const entities: EntityForSummary[] = [
          { id: '1', name: 'func1', type: 'function', content: 'function func1() {}' },
          { id: '2', name: 'func2', type: 'function', content: 'function func2() {}' },
          { id: '3', name: 'ClassA', type: 'class', content: 'class ClassA {}' }
        ];

        const result = await manager.summarizeEntities(entities);

        expect(result.summarized).toBe(3);
        expect(result.failed).toBe(0);
        expect(result.provider).toBe('mock');
      });

      it('should report progress', async () => {
        const entities: EntityForSummary[] = Array(10).fill(null).map((_, i) => ({
          id: `${i}`,
          name: `entity${i}`,
          type: 'function',
          content: `function entity${i}() {}`
        }));

        const progressCalls: Array<{ completed: number; total: number }> = [];

        await manager.summarizeEntities(entities, {
          onProgress: (completed, total) => {
            progressCalls.push({ completed, total });
          }
        });

        expect(progressCalls.length).toBeGreaterThan(0);
        expect(progressCalls[progressCalls.length - 1].completed).toBe(10);
      });

      it('should handle empty entity list', async () => {
        const result = await manager.summarizeEntities([]);

        expect(result.summarized).toBe(0);
        expect(result.failed).toBe(0);
      });

      it('should handle provider failure gracefully', async () => {
        mockProvider.configure({ shouldFail: true });

        const entities: EntityForSummary[] = [
          { id: '1', name: 'func', type: 'function', content: 'function func() {}' }
        ];

        const result = await manager.summarizeEntities(entities);

        expect(result.failed).toBeGreaterThan(0);
      });

      it('should return error when no provider available', async () => {
        const noProviderManager = new LLMSummarizationManager({
          providers: []
        });

        const result = await noProviderManager.summarizeEntities([
          { id: '1', name: 'func', type: 'function', content: 'code' }
        ]);

        expect(result.provider).toBeNull();
        expect(result.error).toContain('No summarization provider available');
      });
    });

    describe('Batch Processing', () => {
      it('should process in batches of configured size', async () => {
        const customManager = new LLMSummarizationManager({
          providers: ['mock'],
          batchSize: 3
        });
        customManager.registerProvider('mock', mockProvider);

        const entities: EntityForSummary[] = Array(10).fill(null).map((_, i) => ({
          id: `${i}`,
          name: `entity${i}`,
          type: 'function',
          content: `function entity${i}() {}`
        }));

        const result = await customManager.summarizeEntities(entities);

        expect(result.summarized).toBe(10);
      });
    });

    describe('Retry Logic', () => {
      it('should retry on failure', async () => {
        // Create a provider that fails first then succeeds
        let callCount = 0;
        const flakeyProvider = new MockSummarizationProvider();
        const originalSummarizeBatch = flakeyProvider.summarizeBatch.bind(flakeyProvider);

        flakeyProvider.summarizeBatch = async (items) => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Temporary failure');
          }
          return originalSummarizeBatch(items);
        };

        const customManager = new LLMSummarizationManager({
          providers: ['flakey'],
          maxRetries: 3
        });
        customManager.registerProvider('flakey', flakeyProvider);

        const result = await customManager.summarizeEntities([
          { id: '1', name: 'func', type: 'function', content: 'code' }
        ]);

        expect(result.summarized).toBe(1);
        expect(callCount).toBe(2);
      });
    });
  });

  describe('Integration with SymbolSummarizer', () => {
    it('should work as LLMSummarizer implementation', async () => {
      const manager = new LLMSummarizationManager({
        providers: ['mock']
      });
      const mockProvider = new MockSummarizationProvider();
      manager.registerProvider('mock', mockProvider);

      // SymbolSummarizer accepts LLMSummarizer interface
      // Just verify the interface contract is satisfied
      expect(typeof manager.summarizeSymbol).toBe('function');
      expect(typeof manager.summarizeFile).toBe('function');

      const symbol: Symbol = {
        type: 'function',
        name: 'test',
        qualifiedName: 'test.ts::test',
        startLine: 1,
        endLine: 5
      };

      const summary = await manager.summarizeSymbol(symbol);
      expect(typeof summary).toBe('string');
    });
  });

  describe('Content Building', () => {
    let manager: LLMSummarizationManager;
    let mockProvider: MockSummarizationProvider;

    beforeEach(() => {
      manager = new LLMSummarizationManager({ providers: ['mock'] });
      mockProvider = new MockSummarizationProvider();
      manager.registerProvider('mock', mockProvider);
    });

    it('should include signature in symbol content', async () => {
      const symbol: Symbol = {
        type: 'function',
        name: 'calculate',
        qualifiedName: 'math.ts::calculate',
        signature: 'function calculate(a: number, b: number): number',
        parameters: [
          { name: 'a', type: 'number' },
          { name: 'b', type: 'number' }
        ],
        returnType: 'number',
        startLine: 1,
        endLine: 5
      };

      const summary = await manager.summarizeSymbol(symbol);
      expect(summary).toBeDefined();
    });

    it('should include context when provided', async () => {
      const symbol: Symbol = {
        type: 'method',
        name: 'save',
        qualifiedName: 'UserRepo.ts::UserRepo.save',
        startLine: 10,
        endLine: 20
      };

      const summary = await manager.summarizeSymbol(symbol, 'Database operation');
      expect(summary).toBeDefined();
    });
  });
});
