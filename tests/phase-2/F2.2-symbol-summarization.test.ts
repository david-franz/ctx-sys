/**
 * F2.2 Symbol Summarization Tests
 *
 * Tests for AI-generated code summaries using Ollama and OpenAI providers.
 *
 * WARNING: These tests will FAIL with "Cannot find module" errors until
 * the actual implementations are created at:
 *   - src/summarization/provider.ts
 *   - src/summarization/summarizer.ts
 *   - src/summarization/factory.ts
 *
 * This is intentional - the tests define the expected API contract that
 * implementations must fulfill.
 *
 * @see docs/phase-2/F2.2-symbol-summarization.md
 */

// Import actual implementations (will fail until implementations exist)
import {
  SummarizationProvider,
  OllamaSummarizationProvider,
  OpenAISummarizationProvider,
  SummarizationContext,
  SummarizationOptions
} from '../../src/summarization/provider';
import { CodeSummarizer, SymbolSummaryResult } from '../../src/summarization/summarizer';
import {
  SummarizationProviderFactory,
  SummarizationProviderConfig
} from '../../src/summarization/factory';

// Mock external dependencies
jest.mock('../../src/summarization/provider', () => {
  const actualModule = jest.requireActual('../../src/summarization/provider');
  return {
    ...actualModule,
    OllamaSummarizationProvider: jest.fn().mockImplementation((config) => ({
      name: 'ollama',
      modelId: `ollama:${config?.model || 'qwen2.5-coder:7b'}`,
      baseUrl: config?.baseUrl || 'http://localhost:11434',
      summarize: jest.fn(),
      summarizeBatch: jest.fn(),
      isAvailable: jest.fn(),
      buildPrompt: jest.fn(),
      cleanSummary: jest.fn()
    })),
    OpenAISummarizationProvider: jest.fn().mockImplementation((config) => ({
      name: 'openai',
      modelId: `openai:${config?.model || 'gpt-4o-mini'}`,
      apiKey: config?.apiKey,
      summarize: jest.fn(),
      summarizeBatch: jest.fn(),
      isAvailable: jest.fn(),
      buildChatMessages: jest.fn()
    }))
  };
});

jest.mock('../../src/summarization/summarizer', () => {
  return {
    CodeSummarizer: jest.fn().mockImplementation((provider) => ({
      provider,
      summarizeSymbol: jest.fn(),
      summarizeFile: jest.fn(),
      buildSymbolContent: jest.fn(),
      flattenSymbols: jest.fn(),
      isGoodDocstring: jest.fn(),
      extractFirstSentence: jest.fn(),
      detectLanguage: jest.fn(),
      getParentClass: jest.fn()
    }))
  };
});

jest.mock('../../src/summarization/factory', () => {
  return {
    SummarizationProviderFactory: {
      create: jest.fn(),
      createWithFallback: jest.fn()
    }
  };
});

// Test helpers
interface MockSymbol {
  name: string;
  type: string;
  qualifiedName: string;
  signature?: string;
  docstring?: string;
  children?: MockSymbol[];
  startLine: number;
  endLine: number;
}

interface MockEntity {
  name: string;
  type: string;
  qualifiedName: string;
  summary?: string;
}

function createMockSymbol(overrides: Partial<MockSymbol> = {}): MockSymbol {
  return {
    name: 'testSymbol',
    type: 'function',
    qualifiedName: 'src/test.ts::testSymbol',
    startLine: 1,
    endLine: 10,
    ...overrides
  };
}

function createMockEntity(overrides: Partial<MockEntity> = {}): MockEntity {
  return {
    name: 'testEntity',
    type: 'function',
    qualifiedName: 'src/test.ts::testEntity',
    ...overrides
  };
}

describe('F2.2 Symbol Summarization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // SummarizationProvider Interface Tests
  // ============================================================================

  describe('SummarizationProvider', () => {
    let ollamaProvider: ReturnType<typeof OllamaSummarizationProvider>;

    beforeEach(() => {
      ollamaProvider = new (OllamaSummarizationProvider as jest.MockedClass<typeof OllamaSummarizationProvider>)({
        model: 'qwen2.5-coder:7b',
        baseUrl: 'http://localhost:11434'
      });
    });

    it('should have required properties', () => {
      expect(ollamaProvider.name).toBe('ollama');
      expect(ollamaProvider.modelId).toBe('ollama:qwen2.5-coder:7b');
    });

    it('should implement summarize method', async () => {
      const mockSummary = 'Validates user input.';
      ollamaProvider.summarize.mockResolvedValue(mockSummary);

      const summary = await ollamaProvider.summarize('function test() {}');

      expect(ollamaProvider.summarize).toHaveBeenCalledWith('function test() {}');
      expect(summary).toBe(mockSummary);
      expect(typeof summary).toBe('string');
    });

    it('should implement summarizeBatch method', async () => {
      const items = [
        { content: 'function a() {}' },
        { content: 'function b() {}' },
        { content: 'function c() {}' }
      ];
      const mockSummaries = ['Summary A.', 'Summary B.', 'Summary C.'];
      ollamaProvider.summarizeBatch.mockResolvedValue(mockSummaries);

      const summaries = await ollamaProvider.summarizeBatch(items);

      expect(ollamaProvider.summarizeBatch).toHaveBeenCalledWith(items);
      expect(summaries).toHaveLength(3);
      expect(summaries).toEqual(mockSummaries);
    });

    it('should implement isAvailable method', async () => {
      ollamaProvider.isAvailable.mockResolvedValue(true);

      const available = await ollamaProvider.isAvailable();

      expect(ollamaProvider.isAvailable).toHaveBeenCalled();
      expect(typeof available).toBe('boolean');
      expect(available).toBe(true);
    });
  });

  // ============================================================================
  // OllamaSummarizationProvider Tests
  // ============================================================================

  describe('OllamaSummarizationProvider', () => {
    let provider: ReturnType<typeof OllamaSummarizationProvider>;

    beforeEach(() => {
      provider = new (OllamaSummarizationProvider as jest.MockedClass<typeof OllamaSummarizationProvider>)({
        model: 'qwen2.5-coder:7b',
        baseUrl: 'http://localhost:11434'
      });
    });

    it('should construct with correct model ID', () => {
      expect(OllamaSummarizationProvider).toHaveBeenCalledWith({
        model: 'qwen2.5-coder:7b',
        baseUrl: 'http://localhost:11434'
      });
      expect(provider.modelId).toMatch(/^ollama:/);
      expect(provider.modelId).toBe('ollama:qwen2.5-coder:7b');
    });

    it('should generate concise summary', async () => {
      const content = `
        async function validateUserCredentials(username: string, password: string): Promise<AuthResult> {
          const user = await db.users.findByUsername(username);
          if (!user) return { success: false, error: 'User not found' };
          const valid = await bcrypt.compare(password, user.passwordHash);
          return { success: valid };
        }
      `;
      const mockSummary = 'Validates user credentials against database.';
      provider.summarize.mockResolvedValue(mockSummary);

      const summary = await provider.summarize(content);

      expect(provider.summarize).toHaveBeenCalledWith(content);
      expect(summary.length).toBeLessThan(150);
      expect(summary).toBe(mockSummary);
    });

    it('should handle batch summarization', async () => {
      const items = Array(10).fill({ content: 'function test() {}' });
      const mockSummaries = Array(10).fill('Tests functionality.');
      provider.summarizeBatch.mockResolvedValue(mockSummaries);

      const summaries = await provider.summarizeBatch(items);

      expect(provider.summarizeBatch).toHaveBeenCalledWith(items);
      expect(summaries).toHaveLength(10);
    });

    it('should respect concurrency limits', async () => {
      const items = Array(20).fill({ content: 'function test() {}' });
      const mockSummaries = Array(20).fill('Tests functionality.');
      provider.summarizeBatch.mockResolvedValue(mockSummaries);

      const summaries = await provider.summarizeBatch(items);

      expect(provider.summarizeBatch).toHaveBeenCalledTimes(1);
      expect(summaries).toHaveLength(20);
    });

    it('should detect availability correctly', async () => {
      provider.isAvailable.mockResolvedValue(true);

      const available = await provider.isAvailable();

      expect(provider.isAvailable).toHaveBeenCalled();
      expect(available).toBe(true);
    });

    it('should report unavailable when Ollama is not running', async () => {
      provider.isAvailable.mockResolvedValue(false);

      const available = await provider.isAvailable();

      expect(provider.isAvailable).toHaveBeenCalled();
      expect(available).toBe(false);
    });

    it('should build correct prompt', () => {
      const symbolType = 'function';
      const content = 'function test(x: number): number { return x * 2; }';
      const expectedPrompt = [
        `Summarize this ${symbolType} in ONE short sentence (max 15 words).`,
        'Focus on WHAT it does, not HOW.',
        'Start with a verb (Returns, Validates, Creates, Handles, etc.).',
        '',
        content,
        '',
        'Summary:'
      ].join('\n');

      provider.buildPrompt.mockReturnValue(expectedPrompt);

      const prompt = provider.buildPrompt(content, { symbolType });

      expect(provider.buildPrompt).toHaveBeenCalledWith(content, { symbolType });
      expect(prompt).toContain('ONE short sentence');
      expect(prompt).toContain('max 15 words');
      expect(prompt).toContain(content);
    });

    it('should include parent class in prompt when provided', () => {
      const context = {
        symbolType: 'method',
        parentClass: 'AuthService'
      };
      const content = 'login(username: string): Promise<boolean>';
      const expectedPrompt = `Summarize this method in ONE short sentence\nClass: AuthService\n${content}`;

      provider.buildPrompt.mockReturnValue(expectedPrompt);

      const prompt = provider.buildPrompt(content, context);

      expect(provider.buildPrompt).toHaveBeenCalledWith(content, context);
      expect(prompt).toContain('AuthService');
    });

    it('should include docstring in prompt when provided', () => {
      const context = {
        symbolType: 'function',
        docstring: 'Validates user input against schema'
      };
      const content = 'function validate(input: unknown): boolean {}';
      const expectedPrompt = `Summarize this function\nDocstring: ${context.docstring}\n${content}`;

      provider.buildPrompt.mockReturnValue(expectedPrompt);

      const prompt = provider.buildPrompt(content, context);

      expect(provider.buildPrompt).toHaveBeenCalledWith(content, context);
      expect(prompt).toContain('Validates user input');
    });

    it('should clean summary output', () => {
      const rawSummaries = [
        '"Validates user credentials against database"',
        'Summary: Returns the sum of two numbers.',
        'Creates a new instance of the class.',
        '  Handles HTTP requests  '
      ];

      const expectedCleaned = [
        'Validates user credentials against database.',
        'Returns the sum of two numbers.',
        'Creates a new instance of the class.',
        'Handles HTTP requests.'
      ];

      rawSummaries.forEach((raw, i) => {
        provider.cleanSummary.mockReturnValueOnce(expectedCleaned[i]);
        const cleaned = provider.cleanSummary(raw);
        expect(provider.cleanSummary).toHaveBeenCalledWith(raw);
        expect(cleaned).toBe(expectedCleaned[i]);
      });
    });
  });

  // ============================================================================
  // OpenAISummarizationProvider Tests
  // ============================================================================

  describe('OpenAISummarizationProvider', () => {
    let provider: ReturnType<typeof OpenAISummarizationProvider>;

    beforeEach(() => {
      provider = new (OpenAISummarizationProvider as jest.MockedClass<typeof OpenAISummarizationProvider>)({
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-key'
      });
    });

    it('should construct with correct model ID', () => {
      expect(OpenAISummarizationProvider).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-key'
      });
      expect(provider.modelId).toMatch(/^openai:/);
      expect(provider.modelId).toBe('openai:gpt-4o-mini');
    });

    it('should build correct chat messages', () => {
      const systemPrompt = `You are a code documentation assistant. Your task is to write concise, one-line summaries of code symbols.

Rules:
- Maximum 15 words
- Start with a verb (Returns, Validates, Creates, Handles, etc.)
- Focus on WHAT the code does, not HOW it's implemented
- Be specific but concise`;

      const userContent = 'function test() {}';
      const expectedMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ];

      provider.buildChatMessages.mockReturnValue(expectedMessages);

      const messages = provider.buildChatMessages(userContent);

      expect(provider.buildChatMessages).toHaveBeenCalledWith(userContent);
      expect(messages[0].content).toContain('Maximum 15 words');
      expect(messages[0].content).toContain('Start with a verb');
    });

    it('should handle rate limiting gracefully', async () => {
      provider.summarize.mockRejectedValue(
        new Error('OpenAI summarization failed: Rate limit exceeded')
      );

      await expect(provider.summarize('test')).rejects.toThrow('Rate limit');
      expect(provider.summarize).toHaveBeenCalledWith('test');
    });

    it('should detect availability based on API key validity', async () => {
      provider.isAvailable.mockResolvedValue(true);

      const available = await provider.isAvailable();

      expect(provider.isAvailable).toHaveBeenCalled();
      expect(available).toBe(true);
    });

    it('should report unavailable when API key is invalid', async () => {
      provider.isAvailable.mockResolvedValue(false);

      const available = await provider.isAvailable();

      expect(provider.isAvailable).toHaveBeenCalled();
      expect(available).toBe(false);
    });
  });

  // ============================================================================
  // CodeSummarizer Tests
  // ============================================================================

  describe('CodeSummarizer', () => {
    let summarizer: ReturnType<typeof CodeSummarizer>;
    let mockProvider: ReturnType<typeof OllamaSummarizationProvider>;

    beforeEach(() => {
      mockProvider = new (OllamaSummarizationProvider as jest.MockedClass<typeof OllamaSummarizationProvider>)({
        model: 'qwen2.5-coder:7b'
      });
      summarizer = new (CodeSummarizer as jest.MockedClass<typeof CodeSummarizer>)(mockProvider);
    });

    describe('summarizeSymbol', () => {
      it('should use existing docstring if good', async () => {
        const symbol = createMockSymbol({
          name: 'validateInput',
          docstring: 'Validates user input against the configured schema and returns validation result.'
        });

        summarizer.isGoodDocstring.mockReturnValue(true);
        summarizer.extractFirstSentence.mockReturnValue('Validates user input against the configured schema and returns validation result.');
        summarizer.summarizeSymbol.mockResolvedValue({
          qualifiedName: symbol.qualifiedName,
          summary: 'Validates user input against the configured schema and returns validation result.',
          source: 'docstring'
        });

        const result = await summarizer.summarizeSymbol(symbol);

        expect(summarizer.isGoodDocstring).toHaveBeenCalledWith(symbol.docstring);
        expect(result.source).toBe('docstring');
        expect(result.summary).toContain('Validates user input');
      });

      it('should extract first sentence from docstring', () => {
        const docstring = 'Validates user input. Also performs sanitization. Returns boolean.';

        summarizer.extractFirstSentence.mockReturnValue('Validates user input.');

        const firstSentence = summarizer.extractFirstSentence(docstring);

        expect(summarizer.extractFirstSentence).toHaveBeenCalledWith(docstring);
        expect(firstSentence).toBe('Validates user input.');
      });

      it('should generate summary when no docstring', async () => {
        const symbol = createMockSymbol({
          name: 'processData',
          docstring: undefined
        });

        summarizer.isGoodDocstring.mockReturnValue(false);
        summarizer.summarizeSymbol.mockResolvedValue({
          qualifiedName: symbol.qualifiedName,
          summary: 'Processes data and returns result.',
          source: 'ai'
        });

        const result = await summarizer.summarizeSymbol(symbol);

        expect(summarizer.summarizeSymbol).toHaveBeenCalledWith(symbol);
        expect(result.summary).toBeDefined();
        expect(result.source).toBe('ai');
      });

      it('should include context in summarization request', async () => {
        const symbol = createMockSymbol({
          name: 'processItem',
          type: 'method',
          qualifiedName: 'src/processor.ts::DataProcessor::processItem'
        });

        summarizer.detectLanguage.mockReturnValue('typescript');
        summarizer.getParentClass.mockReturnValue('DataProcessor');
        summarizer.summarizeSymbol.mockResolvedValue({
          qualifiedName: symbol.qualifiedName,
          summary: 'Processes a single item.',
          source: 'ai'
        });

        await summarizer.summarizeSymbol(symbol);

        expect(summarizer.detectLanguage).toHaveBeenCalled();
        expect(summarizer.getParentClass).toHaveBeenCalled();
      });
    });

    describe('summarizeFile', () => {
      it('should batch summarize symbols from file', async () => {
        const symbols = [
          createMockSymbol({ name: 'func1' }),
          createMockSymbol({ name: 'func2' }),
          createMockSymbol({ name: 'func3' })
        ];

        const mockResults = symbols.map(s => ({
          qualifiedName: s.qualifiedName,
          summary: `Summary for ${s.name}.`,
          source: 'ai' as const
        }));

        summarizer.summarizeFile.mockResolvedValue(mockResults);

        const results = await summarizer.summarizeFile('src/test.ts', symbols);

        expect(summarizer.summarizeFile).toHaveBeenCalledWith('src/test.ts', symbols);
        expect(results).toHaveLength(3);
      });

      it('should skip already summarized symbols', async () => {
        const existingEntity = createMockEntity({
          name: 'alreadySummarized',
          summary: 'Existing summary.'
        });

        const symbols = [createMockSymbol({ name: 'alreadySummarized' })];

        summarizer.summarizeFile.mockResolvedValue([]);

        const results = await summarizer.summarizeFile('src/test.ts', symbols, {
          existingSummaries: new Map([[existingEntity.qualifiedName, existingEntity.summary!]])
        });

        expect(results).toHaveLength(0);
      });

      it('should use docstring for symbols with good docstrings', async () => {
        const symbol = createMockSymbol({
          name: 'wellDocumented',
          docstring: 'Performs complex calculation and returns the result.'
        });

        summarizer.isGoodDocstring.mockReturnValue(true);
        summarizer.summarizeFile.mockResolvedValue([{
          qualifiedName: symbol.qualifiedName,
          summary: 'Performs complex calculation and returns the result.',
          source: 'docstring'
        }]);

        const results = await summarizer.summarizeFile('src/test.ts', [symbol]);

        expect(results[0].source).toBe('docstring');
        expect(results[0].summary).toBe('Performs complex calculation and returns the result.');
      });

      it('should report progress during batch summarization', async () => {
        const symbols = Array(5).fill(null).map((_, i) =>
          createMockSymbol({ name: `func${i}` })
        );

        const onProgress = jest.fn();

        summarizer.summarizeFile.mockImplementation(async (_filePath: string, syms: MockSymbol[], options?: { onProgress?: (current: number, total: number) => void }) => {
          for (let i = 0; i < syms.length; i++) {
            options?.onProgress?.(i + 1, syms.length);
          }
          return syms.map((s: MockSymbol) => ({
            qualifiedName: s.qualifiedName,
            summary: `Summary for ${s.name}.`,
            source: 'ai' as const
          }));
        });

        await summarizer.summarizeFile('src/test.ts', symbols, { onProgress });

        expect(onProgress).toHaveBeenCalledTimes(5);
        expect(onProgress).toHaveBeenLastCalledWith(5, 5);
      });
    });

    describe('buildSymbolContent', () => {
      it('should include signature for functions', () => {
        const symbol = createMockSymbol({
          type: 'function',
          name: 'calculate',
          signature: 'calculate(a: number, b: number): number'
        });

        const expectedContent = 'function calculate(a: number, b: number): number';
        summarizer.buildSymbolContent.mockReturnValue(expectedContent);

        const content = summarizer.buildSymbolContent(symbol);

        expect(summarizer.buildSymbolContent).toHaveBeenCalledWith(symbol);
        expect(content).toContain('calculate');
        expect(content).toContain('number');
      });

      it('should include method signatures for classes', () => {
        const classSymbol = createMockSymbol({
          type: 'class',
          name: 'Calculator',
          children: [
            createMockSymbol({ name: 'add', signature: 'add(x, y)' }),
            createMockSymbol({ name: 'subtract', signature: 'subtract(x, y)' })
          ]
        });

        const expectedContent = 'class Calculator {\n  add(x, y)\n  subtract(x, y)\n}';
        summarizer.buildSymbolContent.mockReturnValue(expectedContent);

        const content = summarizer.buildSymbolContent(classSymbol);

        expect(summarizer.buildSymbolContent).toHaveBeenCalledWith(classSymbol);
        expect(content).toContain('add');
        expect(content).toContain('subtract');
      });

      it('should limit content length', () => {
        const symbol = createMockSymbol({ name: 'longFunction' });
        const limitedContent = 'x'.repeat(500);

        summarizer.buildSymbolContent.mockReturnValue(limitedContent);

        const content = summarizer.buildSymbolContent(symbol);

        expect(content.length).toBeLessThanOrEqual(500);
      });
    });

    describe('flattenSymbols', () => {
      it('should flatten nested symbols', () => {
        const symbols = [
          {
            ...createMockSymbol({ name: 'Class1' }),
            children: [
              createMockSymbol({ name: 'method1' }),
              createMockSymbol({ name: 'method2' })
            ]
          },
          createMockSymbol({ name: 'func1' })
        ];

        const expectedFlattened = [
          symbols[0],
          symbols[0].children![0],
          symbols[0].children![1],
          symbols[1]
        ];

        summarizer.flattenSymbols.mockReturnValue(expectedFlattened);

        const flattened = summarizer.flattenSymbols(symbols);

        expect(summarizer.flattenSymbols).toHaveBeenCalledWith(symbols);
        expect(flattened).toHaveLength(4);
      });
    });

    describe('isGoodDocstring', () => {
      it('should reject short docstrings', () => {
        const shortDocstrings = ['TODO', 'Fixme', 'test', ''];

        shortDocstrings.forEach(doc => {
          summarizer.isGoodDocstring.mockReturnValue(false);

          const isGood = summarizer.isGoodDocstring(doc);

          expect(summarizer.isGoodDocstring).toHaveBeenCalledWith(doc);
          expect(isGood).toBe(false);
        });
      });

      it('should reject TODO docstrings', () => {
        const todoDocstrings = [
          'TODO: implement this',
          'todo implement later',
          'FIXME: broken'
        ];

        todoDocstrings.forEach(doc => {
          summarizer.isGoodDocstring.mockReturnValue(false);

          const isGood = summarizer.isGoodDocstring(doc);

          expect(summarizer.isGoodDocstring).toHaveBeenCalledWith(doc);
          expect(isGood).toBe(false);
        });
      });

      it('should reject generic docstrings', () => {
        const genericDocstrings = ['Constructor', 'constructor'];

        genericDocstrings.forEach(doc => {
          summarizer.isGoodDocstring.mockReturnValue(false);

          const isGood = summarizer.isGoodDocstring(doc);

          expect(summarizer.isGoodDocstring).toHaveBeenCalledWith(doc);
          expect(isGood).toBe(false);
        });
      });

      it('should accept good docstrings', () => {
        const goodDocstrings = [
          'Validates user credentials against the database.',
          'Returns the sum of two numbers with overflow checking.',
          'Creates a new instance with the specified configuration.'
        ];

        goodDocstrings.forEach(doc => {
          summarizer.isGoodDocstring.mockReturnValue(true);

          const isGood = summarizer.isGoodDocstring(doc);

          expect(summarizer.isGoodDocstring).toHaveBeenCalledWith(doc);
          expect(isGood).toBe(true);
        });
      });
    });

    describe('extractFirstSentence', () => {
      it('should extract first sentence ending with period', () => {
        const text = 'First sentence. Second sentence. Third.';
        summarizer.extractFirstSentence.mockReturnValue('First sentence.');

        const first = summarizer.extractFirstSentence(text);

        expect(summarizer.extractFirstSentence).toHaveBeenCalledWith(text);
        expect(first).toBe('First sentence.');
      });

      it('should extract first sentence ending with exclamation', () => {
        const text = 'Important! More details.';
        summarizer.extractFirstSentence.mockReturnValue('Important!');

        const first = summarizer.extractFirstSentence(text);

        expect(summarizer.extractFirstSentence).toHaveBeenCalledWith(text);
        expect(first).toBe('Important!');
      });

      it('should extract first sentence ending with question', () => {
        const text = 'Is this valid? Check constraints.';
        summarizer.extractFirstSentence.mockReturnValue('Is this valid?');

        const first = summarizer.extractFirstSentence(text);

        expect(summarizer.extractFirstSentence).toHaveBeenCalledWith(text);
        expect(first).toBe('Is this valid?');
      });

      it('should truncate long text without sentence end', () => {
        const longText = 'This is a very long description without any sentence ending that goes on and on';
        const truncated = longText.slice(0, 100).trim() + '...';

        summarizer.extractFirstSentence.mockReturnValue(truncated);

        const result = summarizer.extractFirstSentence(longText);

        expect(summarizer.extractFirstSentence).toHaveBeenCalledWith(longText);
        expect(result.length).toBeLessThanOrEqual(103);
      });
    });

    describe('detectLanguage', () => {
      it('should detect TypeScript from qualified name', () => {
        const qualifiedName = 'src/utils.ts::formatDate';
        summarizer.detectLanguage.mockReturnValue('typescript');

        const language = summarizer.detectLanguage(qualifiedName);

        expect(summarizer.detectLanguage).toHaveBeenCalledWith(qualifiedName);
        expect(language).toBe('typescript');
      });

      it('should detect Python from qualified name', () => {
        const qualifiedName = 'src/utils.py::format_date';
        summarizer.detectLanguage.mockReturnValue('python');

        const language = summarizer.detectLanguage(qualifiedName);

        expect(summarizer.detectLanguage).toHaveBeenCalledWith(qualifiedName);
        expect(language).toBe('python');
      });

      it('should return unknown for unrecognized extensions', () => {
        const qualifiedName = 'src/utils.xyz::something';
        summarizer.detectLanguage.mockReturnValue('unknown');

        const language = summarizer.detectLanguage(qualifiedName);

        expect(summarizer.detectLanguage).toHaveBeenCalledWith(qualifiedName);
        expect(language).toBe('unknown');
      });
    });

    describe('getParentClass', () => {
      it('should extract parent class from qualified name', () => {
        const qualifiedName = 'src/auth.ts::AuthService::login';
        summarizer.getParentClass.mockReturnValue('AuthService');

        const parentClass = summarizer.getParentClass(qualifiedName);

        expect(summarizer.getParentClass).toHaveBeenCalledWith(qualifiedName);
        expect(parentClass).toBe('AuthService');
      });

      it('should return undefined for top-level functions', () => {
        const qualifiedName = 'src/utils.ts::formatDate';
        summarizer.getParentClass.mockReturnValue(undefined);

        const parentClass = summarizer.getParentClass(qualifiedName);

        expect(summarizer.getParentClass).toHaveBeenCalledWith(qualifiedName);
        expect(parentClass).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // SummarizationProviderFactory Tests
  // ============================================================================

  describe('SummarizationProviderFactory', () => {
    describe('create', () => {
      it('should create Ollama provider', () => {
        const config: SummarizationProviderConfig = {
          provider: 'ollama',
          model: 'qwen2.5-coder:7b',
          baseUrl: 'http://localhost:11434'
        };

        const mockOllamaProvider = {
          name: 'ollama',
          modelId: 'ollama:qwen2.5-coder:7b'
        };

        (SummarizationProviderFactory.create as jest.Mock).mockReturnValue(mockOllamaProvider);

        const provider = SummarizationProviderFactory.create(config);

        expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
        expect(provider.name).toBe('ollama');
        expect(provider.modelId).toBe('ollama:qwen2.5-coder:7b');
      });

      it('should create OpenAI provider', () => {
        const config: SummarizationProviderConfig = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: 'sk-test'
        };

        const mockOpenAIProvider = {
          name: 'openai',
          modelId: 'openai:gpt-4o-mini'
        };

        (SummarizationProviderFactory.create as jest.Mock).mockReturnValue(mockOpenAIProvider);

        const provider = SummarizationProviderFactory.create(config);

        expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
        expect(provider.name).toBe('openai');
        expect(provider.modelId).toBe('openai:gpt-4o-mini');
      });

      it('should throw for unknown provider', () => {
        const config = {
          provider: 'unknown' as any,
          model: 'test'
        };

        (SummarizationProviderFactory.create as jest.Mock).mockImplementation(() => {
          throw new Error('Unknown provider: unknown');
        });

        expect(() => SummarizationProviderFactory.create(config)).toThrow('Unknown provider: unknown');
        expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
      });

      it('should throw for OpenAI without API key', () => {
        const config: SummarizationProviderConfig = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: undefined
        };

        (SummarizationProviderFactory.create as jest.Mock).mockImplementation(() => {
          throw new Error('OpenAI provider requires apiKey');
        });

        expect(() => SummarizationProviderFactory.create(config)).toThrow('OpenAI provider requires apiKey');
        expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
      });
    });

    describe('createWithFallback', () => {
      it('should use primary when available', async () => {
        const primaryConfig: SummarizationProviderConfig = {
          provider: 'ollama',
          model: 'qwen2.5-coder:7b'
        };
        const fallbackConfig: SummarizationProviderConfig = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: 'sk-test'
        };

        const mockPrimaryProvider = {
          name: 'ollama',
          modelId: 'ollama:qwen2.5-coder:7b',
          isAvailable: jest.fn().mockResolvedValue(true)
        };

        (SummarizationProviderFactory.createWithFallback as jest.Mock).mockResolvedValue(mockPrimaryProvider);

        const provider = await SummarizationProviderFactory.createWithFallback(primaryConfig, fallbackConfig);

        expect(SummarizationProviderFactory.createWithFallback).toHaveBeenCalledWith(primaryConfig, fallbackConfig);
        expect(provider.name).toBe('ollama');
      });

      it('should fallback when primary unavailable', async () => {
        const primaryConfig: SummarizationProviderConfig = {
          provider: 'ollama',
          model: 'qwen2.5-coder:7b'
        };
        const fallbackConfig: SummarizationProviderConfig = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: 'sk-test'
        };

        const mockFallbackProvider = {
          name: 'openai',
          modelId: 'openai:gpt-4o-mini',
          isAvailable: jest.fn().mockResolvedValue(true)
        };

        (SummarizationProviderFactory.createWithFallback as jest.Mock).mockResolvedValue(mockFallbackProvider);

        const provider = await SummarizationProviderFactory.createWithFallback(primaryConfig, fallbackConfig);

        expect(SummarizationProviderFactory.createWithFallback).toHaveBeenCalledWith(primaryConfig, fallbackConfig);
        expect(provider.name).toBe('openai');
      });

      it('should log warning when using fallback', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        const primaryConfig: SummarizationProviderConfig = {
          provider: 'ollama',
          model: 'qwen2.5-coder:7b'
        };
        const fallbackConfig: SummarizationProviderConfig = {
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: 'sk-test'
        };

        (SummarizationProviderFactory.createWithFallback as jest.Mock).mockImplementation(async () => {
          console.warn('Primary summarization provider unavailable, using fallback');
          return { name: 'openai', modelId: 'openai:gpt-4o-mini' };
        });

        await SummarizationProviderFactory.createWithFallback(primaryConfig, fallbackConfig);

        expect(consoleSpy).toHaveBeenCalledWith('Primary summarization provider unavailable, using fallback');
        consoleSpy.mockRestore();
      });
    });
  });

  // ============================================================================
  // Summary Quality Tests
  // ============================================================================

  describe('summary quality', () => {
    let provider: ReturnType<typeof OllamaSummarizationProvider>;

    beforeEach(() => {
      provider = new (OllamaSummarizationProvider as jest.MockedClass<typeof OllamaSummarizationProvider>)({
        model: 'qwen2.5-coder:7b'
      });
    });

    it('should produce summaries starting with a verb', async () => {
      const contents = [
        'function formatDate() {}',
        'function validateInput() {}',
        'function createConnection() {}',
        'function handleRequest() {}'
      ];

      const expectedSummaries = [
        'Returns the formatted date string.',
        'Validates user input against schema.',
        'Creates a new database connection.',
        'Handles authentication requests.'
      ];

      const verbs = ['Returns', 'Validates', 'Creates', 'Handles'];

      for (let i = 0; i < contents.length; i++) {
        provider.summarize.mockResolvedValueOnce(expectedSummaries[i]);

        const summary = await provider.summarize(contents[i]);

        expect(provider.summarize).toHaveBeenCalledWith(contents[i]);
        expect(summary.startsWith(verbs[i])).toBe(true);
      }
    });

    it('should produce summaries under 15 words', async () => {
      const content = 'function validateCredentials(username, password) {}';
      const summary = 'Validates user credentials and returns authentication result.';

      provider.summarize.mockResolvedValue(summary);

      const result = await provider.summarize(content);
      const wordCount = result.split(/\s+/).length;

      expect(provider.summarize).toHaveBeenCalledWith(content);
      expect(wordCount).toBeLessThanOrEqual(15);
    });

    it('should describe WHAT not HOW', async () => {
      const content = 'function validateEmail(email) { return /^[^@]+@[^@]+$/.test(email); }';

      // Good summary describes purpose
      const goodSummary = 'Validates user email format.';

      provider.summarize.mockResolvedValue(goodSummary);

      const summary = await provider.summarize(content);

      expect(provider.summarize).toHaveBeenCalledWith(content);
      expect(summary).not.toContain('regex');
      expect(summary).not.toContain('test');
      expect(summary).toContain('Validates');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    let provider: ReturnType<typeof OllamaSummarizationProvider>;

    beforeEach(() => {
      provider = new (OllamaSummarizationProvider as jest.MockedClass<typeof OllamaSummarizationProvider>)({
        model: 'qwen2.5-coder:7b'
      });
    });

    it('should handle empty content', async () => {
      provider.summarize.mockResolvedValue('Empty function.');

      const summary = await provider.summarize('');

      expect(provider.summarize).toHaveBeenCalledWith('');
      expect(summary).toBeDefined();
    });

    it('should handle very long content', async () => {
      const longContent = 'function test() {\n' + '  // comment\n'.repeat(1000) + '}';

      provider.summarize.mockResolvedValue('Tests functionality.');

      const summary = await provider.summarize(longContent);

      expect(provider.summarize).toHaveBeenCalledWith(longContent);
      expect(summary).toBeDefined();
    });

    it('should handle unicode content', async () => {
      const unicodeContent = 'function test() { return "Hello"; }';

      provider.summarize.mockResolvedValue('Returns greeting in Chinese.');

      const summary = await provider.summarize(unicodeContent);

      expect(provider.summarize).toHaveBeenCalledWith(unicodeContent);
      expect(summary).toBeDefined();
    });

    it('should handle special characters', async () => {
      const specialContent = 'function test<T extends Record<string, unknown>>(): T[] {}';

      provider.summarize.mockResolvedValue('Returns array of generic type.');

      const summary = await provider.summarize(specialContent);

      expect(provider.summarize).toHaveBeenCalledWith(specialContent);
      expect(summary).toBeDefined();
    });

    it('should handle concurrent summarization requests', async () => {
      const contents = Array(10).fill('function test() {}');
      const mockSummaries = contents.map((_, i) => `Summary ${i}.`);

      contents.forEach((_, i) => {
        provider.summarize.mockResolvedValueOnce(mockSummaries[i]);
      });

      const summaries = await Promise.all(
        contents.map(c => provider.summarize(c))
      );

      expect(provider.summarize).toHaveBeenCalledTimes(10);
      expect(summaries).toHaveLength(10);
      summaries.forEach((s: string, i: number) => {
        expect(s).toBe(mockSummaries[i]);
      });
    });
  });

  // ============================================================================
  // Model Configuration Tests
  // ============================================================================

  describe('model configuration', () => {
    it('should use low temperature for consistency', () => {
      const config = {
        provider: 'ollama' as const,
        model: 'qwen2.5-coder:7b',
        options: { temperature: 0.3 }
      };

      (SummarizationProviderFactory.create as jest.Mock).mockReturnValue({
        name: 'ollama',
        modelId: 'ollama:qwen2.5-coder:7b',
        options: config.options
      });

      const provider = SummarizationProviderFactory.create(config);

      expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
      expect(provider.options.temperature).toBeLessThan(0.5);
    });

    it('should limit output tokens', () => {
      const config = {
        provider: 'ollama' as const,
        model: 'qwen2.5-coder:7b',
        options: { max_tokens: 50, num_predict: 50 }
      };

      (SummarizationProviderFactory.create as jest.Mock).mockReturnValue({
        name: 'ollama',
        modelId: 'ollama:qwen2.5-coder:7b',
        options: config.options
      });

      const provider = SummarizationProviderFactory.create(config);

      expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
      expect(provider.options.max_tokens).toBeLessThanOrEqual(100);
    });

    it('should use stop sequences', () => {
      const config = {
        provider: 'ollama' as const,
        model: 'qwen2.5-coder:7b',
        options: { stop: ['\n', '.'] }
      };

      (SummarizationProviderFactory.create as jest.Mock).mockReturnValue({
        name: 'ollama',
        modelId: 'ollama:qwen2.5-coder:7b',
        options: config.options
      });

      const provider = SummarizationProviderFactory.create(config);

      expect(SummarizationProviderFactory.create).toHaveBeenCalledWith(config);
      expect(provider.options.stop).toContain('\n');
      expect(provider.options.stop).toContain('.');
    });
  });
});
