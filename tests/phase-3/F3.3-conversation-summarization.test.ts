/**
 * F3.3 Conversation Summarization Tests
 *
 * NOTE: These tests will fail until the following implementations are created:
 * - src/conversation/summarizer.ts (ConversationSummarizer class)
 * - src/summarization/provider.ts (SummarizationProvider interface/class)
 * - src/database/connection.ts (DatabaseConnection class)
 * - src/embedding/provider.ts (EmbeddingProvider interface/class)
 * - src/entities/factory.ts (EntityFactory class)
 *
 * Tests for conversation summarization:
 * - ConversationSummarizer operations
 * - Transcript building
 * - Summary generation and parsing
 * - Entity creation for summaries
 * - Embedding generation for searchability
 *
 * @see docs/phase-3/F3.3-conversation-summarization.md
 */

// Import actual implementations (will fail until created)
import { ConversationSummarizer } from '../../src/conversation/summarizer';
import { SummarizationProvider } from '../../src/summarization/provider';
import { DatabaseConnection } from '../../src/db/connection';
import { EmbeddingProvider } from '../../src/embeddings/provider';
import { EntityFactory } from '../../src/entities/factory';
import type { Message, Session, ConversationSummary } from '../../src/types';

// Mock the dependencies
jest.mock('../../src/db/connection');
jest.mock('../../src/summarization/provider');
jest.mock('../../src/embedding/provider');
jest.mock('../../src/entities/factory');

// ============================================================================
// Mock Setup
// ============================================================================

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedSummarizationProvider = SummarizationProvider as jest.MockedClass<typeof SummarizationProvider>;
const MockedEmbeddingProvider = EmbeddingProvider as jest.MockedClass<typeof EmbeddingProvider>;
const MockedEntityFactory = EntityFactory as jest.MockedClass<typeof EntityFactory>;

// Helper to generate unique IDs
function generateId(): string {
  return `id_${Math.random().toString(36).substring(2, 11)}`;
}

// Mock Message Factory
function createMockMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: generateId(),
    sessionId: 'session_default',
    role: 'user',
    content: 'Default message content',
    createdAt: new Date(),
    ...overrides
  };
}

// Mock Session Factory
function createMockSessionData(overrides: Partial<Session> = {}): Session {
  const now = new Date();
  return {
    id: generateId(),
    name: undefined,
    status: 'active',
    summary: undefined,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('F3.3 Conversation Summarization', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockSummarizationProvider: jest.Mocked<SummarizationProvider>;
  let mockEmbeddingProvider: jest.Mocked<EmbeddingProvider>;
  let mockEntityFactory: jest.Mocked<EntityFactory>;
  let summarizer: ConversationSummarizer;

  beforeEach(() => {
    // Create mock instances
    mockDb = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockSummarizationProvider = new MockedSummarizationProvider() as jest.Mocked<SummarizationProvider>;
    mockEmbeddingProvider = new MockedEmbeddingProvider() as jest.Mocked<EmbeddingProvider>;
    mockEntityFactory = new MockedEntityFactory() as jest.Mocked<EntityFactory>;

    // Setup default mock implementations
    mockDb.get = jest.fn();
    mockDb.run = jest.fn();
    mockDb.all = jest.fn();

    mockSummarizationProvider.summarize = jest.fn().mockResolvedValue(
      `OVERVIEW: Test summary overview.

TOPICS:
- topic1
- topic2

DECISIONS:
- decision1

CODE_REFERENCES:
- src/test.ts

KEY_POINTS:
- key point 1`
    );
    mockSummarizationProvider.isAvailable = jest.fn().mockResolvedValue(true);

    mockEmbeddingProvider.embed = jest.fn().mockResolvedValue(new Array(768).fill(0.1));

    mockEntityFactory.create = jest.fn().mockReturnValue({
      id: generateId(),
      type: 'session',
      name: 'Test Session',
      qualifiedName: 'session::test',
      content: 'Test content',
      summary: 'Test summary'
    });

    // Create the summarizer with injected mocked dependencies
    summarizer = new ConversationSummarizer({
      database: mockDb,
      summarizationProvider: mockSummarizationProvider,
      embeddingProvider: mockEmbeddingProvider,
      entityFactory: mockEntityFactory
    });

    jest.clearAllMocks();
  });

  // ============================================================================
  // ConversationSummary Interface Tests
  // ============================================================================

  describe('ConversationSummary Interface', () => {
    it('should have all required fields', () => {
      const summary: ConversationSummary = {
        overview: 'Discussion about authentication implementation',
        topics: ['authentication', 'JWT', 'session management'],
        decisions: ['Use JWT for stateless auth', 'Store refresh tokens in DB'],
        codeReferences: ['src/auth/service.ts', 'src/auth/jwt.ts'],
        keyPoints: ['Security is priority', 'Need to handle token expiration']
      };

      expect(summary).toHaveProperty('overview');
      expect(summary).toHaveProperty('topics');
      expect(summary).toHaveProperty('decisions');
      expect(summary).toHaveProperty('codeReferences');
      expect(summary).toHaveProperty('keyPoints');
    });

    it('should support empty arrays', () => {
      const summary: ConversationSummary = {
        overview: 'Brief conversation',
        topics: [],
        decisions: [],
        codeReferences: [],
        keyPoints: []
      };

      expect(summary.topics).toHaveLength(0);
      expect(summary.decisions).toHaveLength(0);
    });
  });

  // ============================================================================
  // Transcript Building Tests
  // ============================================================================

  describe('Transcript Building', () => {
    it('should build transcript from messages', () => {
      const messages: Message[] = [
        createMockMessage({ role: 'user', content: 'How do I implement auth?' }),
        createMockMessage({ role: 'assistant', content: 'You can use JWT tokens.' }),
        createMockMessage({ role: 'user', content: 'Show me an example.' }),
        createMockMessage({ role: 'assistant', content: 'Here is the code...' })
      ];

      const transcript = summarizer.buildTranscript(messages);

      expect(transcript).toContain('[USER]: How do I implement auth?');
      expect(transcript).toContain('[ASSISTANT]: You can use JWT tokens.');
    });

    it('should preserve message order', () => {
      const messages: Message[] = [
        createMockMessage({ role: 'user', content: 'First' }),
        createMockMessage({ role: 'assistant', content: 'Second' }),
        createMockMessage({ role: 'user', content: 'Third' })
      ];

      const transcript = summarizer.buildTranscript(messages);

      const firstIndex = transcript.indexOf('First');
      const secondIndex = transcript.indexOf('Second');
      const thirdIndex = transcript.indexOf('Third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    it('should handle system messages', () => {
      const messages: Message[] = [
        createMockMessage({ role: 'system', content: 'You are a helpful assistant.' }),
        createMockMessage({ role: 'user', content: 'Hello' })
      ];

      const transcript = summarizer.buildTranscript(messages);

      expect(transcript).toContain('[SYSTEM]:');
    });

    it('should handle empty message list', () => {
      const messages: Message[] = [];

      const transcript = summarizer.buildTranscript(messages);

      expect(transcript).toBe('');
    });
  });

  // ============================================================================
  // Summary Prompt Building Tests
  // ============================================================================

  describe('Summary Prompt Building', () => {
    it('should build structured prompt', () => {
      const transcript = '[USER]: Help with auth\n\n[ASSISTANT]: Use JWT.';

      const prompt = summarizer.buildPrompt(transcript);

      expect(prompt).toContain('CONVERSATION:');
      expect(prompt).toContain('OVERVIEW:');
      expect(prompt).toContain('TOPICS:');
      expect(prompt).toContain('DECISIONS:');
      expect(prompt).toContain('CODE_REFERENCES:');
      expect(prompt).toContain('KEY_POINTS:');
    });

    it('should truncate very long transcripts', () => {
      const longTranscript = 'x'.repeat(10000);

      const prompt = summarizer.buildPrompt(longTranscript);

      // Prompt should contain truncated transcript (max 8000 chars)
      expect(prompt.length).toBeLessThan(longTranscript.length + 1000);
    });
  });

  // ============================================================================
  // Response Parsing Tests
  // ============================================================================

  describe('Response Parsing', () => {
    it('should parse structured response correctly', () => {
      const response = `OVERVIEW: This conversation discussed implementing JWT authentication for the API.

TOPICS:
- JWT tokens
- authentication flow
- token refresh

DECISIONS:
- Use RS256 algorithm for signing
- Store refresh tokens in database

CODE_REFERENCES:
- src/auth/jwt.ts
- src/middleware/auth.ts

KEY_POINTS:
- Security is important
- Handle token expiration gracefully`;

      const summary = summarizer.parseResponse(response);

      expect(summary.overview).toContain('JWT authentication');
      expect(summary.topics).toHaveLength(3);
      expect(summary.topics).toContain('JWT tokens');
      expect(summary.decisions).toHaveLength(2);
      expect(summary.codeReferences).toContain('src/auth/jwt.ts');
      expect(summary.keyPoints).toHaveLength(2);
    });

    it('should handle missing sections', () => {
      const response = `OVERVIEW: Brief chat about coding.

TOPICS:
- coding

DECISIONS:

CODE_REFERENCES:

KEY_POINTS:
- Keep it simple`;

      const summary = summarizer.parseResponse(response);

      expect(summary.overview).toContain('Brief chat');
      expect(summary.topics).toHaveLength(1);
      expect(summary.decisions).toHaveLength(0);
      expect(summary.codeReferences).toHaveLength(0);
      expect(summary.keyPoints).toHaveLength(1);
    });

    it('should handle malformed response', () => {
      const response = `This is just some text without proper formatting.
It mentions authentication but isn't structured.`;

      const summary = summarizer.parseResponse(response);

      // Should still extract what it can or return empty
      expect(summary).toHaveProperty('overview');
      expect(summary).toHaveProperty('topics');
    });

    it('should handle multi-line overview', () => {
      const response = `OVERVIEW: This was a detailed conversation about authentication.
The user wanted to implement secure login functionality.

TOPICS:
- authentication`;

      const summary = summarizer.parseResponse(response);

      expect(summary.overview).toContain('detailed conversation');
      expect(summary.overview).toContain('secure login');
    });
  });

  // ============================================================================
  // ConversationSummarizer Tests
  // ============================================================================

  describe('ConversationSummarizer', () => {
    const projectId = 'proj_123';

    describe('summarizeSession()', () => {
      it('should summarize session with messages', async () => {
        const sessionId = 'session_1';

        // Mock session exists
        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Auth Discussion',
          status: 'active'
        });

        // Mock messages
        const messages: Message[] = [
          createMockMessage({ sessionId, role: 'user', content: 'Help with auth' }),
          createMockMessage({ sessionId, role: 'assistant', content: 'Use JWT' })
        ];

        mockDb.all.mockResolvedValueOnce(messages);

        await summarizer.summarizeSession(sessionId, projectId);

        expect(mockSummarizationProvider.summarize).toHaveBeenCalled();
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("status = 'summarized'"),
          expect.any(Array)
        );
      });

      it('should return empty summary for session with no messages', async () => {
        const sessionId = 'session_empty';

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Empty Session',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce([]);

        const result = await summarizer.summarizeSession(sessionId, projectId);

        expect(result.overview).toContain('Empty session');
        expect(result.topics).toHaveLength(0);
      });

      it('should throw error for non-existent session', async () => {
        mockDb.get.mockResolvedValueOnce(undefined);

        await expect(summarizer.summarizeSession('non_existent', projectId))
          .rejects.toThrow('Session not found');
      });

      it('should update session status to summarized', async () => {
        const sessionId = 'session_1';

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Test Session',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce([
          createMockMessage({ sessionId, role: 'user', content: 'Test message' })
        ]);

        await summarizer.summarizeSession(sessionId, projectId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("status = 'summarized'"),
          expect.any(Array)
        );
      });
    });

    describe('Entity Creation', () => {
      it('should create entity for session summary', async () => {
        const sessionId = 'session_1';
        const summary: ConversationSummary = {
          overview: 'Auth discussion summary',
          topics: ['JWT', 'authentication'],
          decisions: ['Use JWT'],
          codeReferences: ['src/auth.ts'],
          keyPoints: ['Security first']
        };

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Auth Discussion',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce([
          createMockMessage({ sessionId, role: 'user', content: 'Help with auth' })
        ]);

        mockSummarizationProvider.summarize.mockResolvedValueOnce(
          `OVERVIEW: ${summary.overview}

TOPICS:
- JWT
- authentication

DECISIONS:
- Use JWT

CODE_REFERENCES:
- src/auth.ts

KEY_POINTS:
- Security first`
        );

        await summarizer.summarizeSession(sessionId, projectId);

        expect(mockEntityFactory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'session',
            qualifiedName: expect.stringContaining('session::')
          })
        );
      });

      it('should include message count in metadata', async () => {
        const sessionId = 'session_1';
        const messages = Array(25).fill(null).map((_, i) =>
          createMockMessage({ sessionId, content: `Message ${i}` })
        );

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Test Session',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce(messages);

        await summarizer.summarizeSession(sessionId, projectId);

        expect(mockEntityFactory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              messageCount: 25
            })
          })
        );
      });

      it('should include date range in metadata', async () => {
        const sessionId = 'session_1';
        const messages: Message[] = [
          createMockMessage({ sessionId, createdAt: new Date('2024-01-01') }),
          createMockMessage({ sessionId, createdAt: new Date('2024-01-15') })
        ];

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Test Session',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce(messages);

        await summarizer.summarizeSession(sessionId, projectId);

        expect(mockEntityFactory.create).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              startDate: expect.stringContaining('2024-01-01'),
              endDate: expect.stringContaining('2024-01-15')
            })
          })
        );
      });
    });

    describe('Embedding Generation', () => {
      it('should generate embedding for summary', async () => {
        const sessionId = 'session_1';

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Auth Discussion',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce([
          createMockMessage({ sessionId, role: 'user', content: 'Help with auth' })
        ]);

        await summarizer.summarizeSession(sessionId, projectId);

        expect(mockEmbeddingProvider.embed).toHaveBeenCalled();
        const embedCall = mockEmbeddingProvider.embed.mock.calls[0][0];
        expect(typeof embedCall).toBe('string');
      });

      it('should combine overview, topics, and decisions for embedding', async () => {
        const sessionId = 'session_1';

        mockDb.get.mockResolvedValueOnce({
          id: sessionId,
          name: 'Cache Discussion',
          status: 'active'
        });

        mockDb.all.mockResolvedValueOnce([
          createMockMessage({ sessionId, content: 'Help with caching' })
        ]);

        mockSummarizationProvider.summarize.mockResolvedValueOnce(
          `OVERVIEW: Discussion about caching

TOPICS:
- Redis
- performance

DECISIONS:
- Use Redis cluster

CODE_REFERENCES:

KEY_POINTS:`
        );

        await summarizer.summarizeSession(sessionId, projectId);

        const embedCall = mockEmbeddingProvider.embed.mock.calls[0][0];
        expect(embedCall).toContain('Discussion about caching');
        expect(embedCall).toContain('Redis');
        expect(embedCall).toContain('performance');
        expect(embedCall).toContain('Use Redis cluster');
      });
    });
  });

  // ============================================================================
  // MCP Tool Handler Tests
  // ============================================================================

  describe('summarize_session MCP Tool', () => {
    it('should have correct tool definition', () => {
      const toolDef = summarizer.getToolDefinition();

      expect(toolDef.name).toBe('summarize_session');
      expect(toolDef.description).toContain('Summarize');
      expect(toolDef.inputSchema.required).toContain('session');
    });

    it('should handle tool invocation', async () => {
      const sessionId = 'session_1';
      const projectId = 'proj_123';

      mockDb.get.mockResolvedValueOnce({
        id: sessionId,
        name: 'Test Session',
        status: 'active'
      });

      mockDb.all.mockResolvedValueOnce([
        createMockMessage({ sessionId, content: 'Test' })
      ]);

      const result = await summarizer.handleToolCall({
        session: sessionId,
        project: projectId
      });

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('topics');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    const projectId = 'proj_123';

    it('should handle very long conversation', async () => {
      const sessionId = 'session_long';

      mockDb.get.mockResolvedValueOnce({
        id: sessionId,
        name: 'Long Session',
        status: 'active'
      });

      const longMessages: Message[] = Array(100).fill(null).map((_, i) =>
        createMockMessage({
          sessionId,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'x'.repeat(500)}`
        })
      );

      mockDb.all.mockResolvedValueOnce(longMessages);

      await summarizer.summarizeSession(sessionId, projectId);

      // Should have called summarize with truncated content
      const summarizeCall = mockSummarizationProvider.summarize.mock.calls[0][0];
      expect(summarizeCall.length).toBeLessThanOrEqual(10000);
    });

    it('should handle conversation with only system messages', async () => {
      const sessionId = 'session_system';

      mockDb.get.mockResolvedValueOnce({
        id: sessionId,
        name: 'System Session',
        status: 'active'
      });

      const messages: Message[] = [
        createMockMessage({ sessionId, role: 'system', content: 'System init' }),
        createMockMessage({ sessionId, role: 'system', content: 'System config' })
      ];

      mockDb.all.mockResolvedValueOnce(messages);

      const result = await summarizer.summarizeSession(sessionId, projectId);

      expect(result).toBeDefined();
    });

    it('should handle special characters in messages', async () => {
      const sessionId = 'session_special';

      mockDb.get.mockResolvedValueOnce({
        id: sessionId,
        name: 'Special Session',
        status: 'active'
      });

      const messages: Message[] = [
        createMockMessage({ sessionId, content: 'Code: `const x = "test"`' }),
        createMockMessage({ sessionId, content: 'Emoji: ' })
      ];

      mockDb.all.mockResolvedValueOnce(messages);

      // Should not throw
      await expect(summarizer.summarizeSession(sessionId, projectId)).resolves.toBeDefined();
    });

    it('should handle summarization provider failure', async () => {
      const sessionId = 'session_fail';

      mockDb.get.mockResolvedValueOnce({
        id: sessionId,
        name: 'Fail Session',
        status: 'active'
      });

      mockDb.all.mockResolvedValueOnce([
        createMockMessage({ sessionId, content: 'Test' })
      ]);

      mockSummarizationProvider.isAvailable.mockResolvedValueOnce(false);
      mockSummarizationProvider.summarize.mockRejectedValueOnce(
        new Error('Provider unavailable')
      );

      await expect(summarizer.summarizeSession(sessionId, projectId))
        .rejects.toThrow('Provider unavailable');
    });
  });

  // ============================================================================
  // Summary Quality Tests
  // ============================================================================

  describe('Summary Quality', () => {
    it('should extract meaningful topics', () => {
      const response = `OVERVIEW: Test

TOPICS:
- authentication
- JWT tokens
- session management

DECISIONS:

CODE_REFERENCES:

KEY_POINTS:`;

      const summary = summarizer.parseResponse(response);

      expect(summary.topics.every((t: string) => t.length > 0)).toBe(true);
      expect(summary.topics.every((t: string) => !t.startsWith('-'))).toBe(true);
    });

    it('should extract actionable decisions', () => {
      const response = `OVERVIEW: Test

TOPICS:

DECISIONS:
- Use JWT for authentication
- Store refresh tokens in database
- Implement token rotation

CODE_REFERENCES:

KEY_POINTS:`;

      const summary = summarizer.parseResponse(response);

      expect(summary.decisions.every((d: string) => d.length > 10)).toBe(true);
    });

    it('should extract valid code references', () => {
      const response = `OVERVIEW: Test

TOPICS:

DECISIONS:

CODE_REFERENCES:
- src/auth/service.ts
- src/auth/jwt.ts
- AuthService.login()

KEY_POINTS:`;

      const summary = summarizer.parseResponse(response);

      expect(summary.codeReferences.every((ref: string) =>
        ref.includes('.ts') || ref.includes('.js') || ref.includes('()')
      )).toBe(true);
    });
  });
});
