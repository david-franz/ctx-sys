/**
 * F3.1 Message Storage Tests
 *
 * IMPORTANT: These tests will FAIL with "Cannot find module" errors until
 * the actual implementations are created at:
 * - src/conversation/messages.ts (MessageStore class)
 * - src/conversation/types.ts (Message, MessageRole, ToolCall interfaces)
 * - src/database/connection.ts (DatabaseConnection class)
 *
 * Tests for conversation message storage:
 * - MessageStore CRUD operations
 * - Message interface and data model
 * - Session-based message retrieval
 * - Message search functionality
 * - Conversation pair extraction
 *
 * @see docs/phase-3/F3.1-message-storage.md
 */

// Import actual implementations (will fail until created)
import { MessageStore } from '../../src/conversation/messages';
import { Message, MessageRole, ToolCall, MessageQuery } from '../../src/conversation/types';
import { DatabaseConnection } from '../../src/db/connection';

// Mock the database connection module
jest.mock('../../src/db/connection');

// ============================================================================
// Test Helpers
// ============================================================================

function generateId(): string {
  return `msg_${Math.random().toString(36).substring(2, 15)}`;
}

function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: generateId(),
    sessionId: 'session_default',
    role: 'user' as MessageRole,
    content: 'Hello, I need help with authentication.',
    metadata: {},
    createdAt: new Date(),
    ...overrides
  };
}

describe('F3.1 Message Storage', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let messageStore: MessageStore;
  const projectId = 'proj_123';

  beforeEach(() => {
    // Create a fresh mock instance for each test
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
      transaction: jest.fn((fn) => fn()),
    } as unknown as jest.Mocked<DatabaseConnection>;

    // Clear all mocks
    jest.clearAllMocks();

    // Create real MessageStore instance with mocked database
    messageStore = new MessageStore(mockDb, projectId);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Message Interface Tests
  // ============================================================================

  describe('Message Interface', () => {
    it('should have required fields', () => {
      const message = createTestMessage();

      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('sessionId');
      expect(message).toHaveProperty('role');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('createdAt');
    });

    it('should support all role types', () => {
      const userMessage = createTestMessage({ role: 'user' as MessageRole });
      const assistantMessage = createTestMessage({ role: 'assistant' as MessageRole });
      const systemMessage = createTestMessage({ role: 'system' as MessageRole });

      expect(userMessage.role).toBe('user');
      expect(assistantMessage.role).toBe('assistant');
      expect(systemMessage.role).toBe('system');
    });

    it('should support optional metadata', () => {
      const message = createTestMessage({
        metadata: {
          model: 'claude-3-opus',
          tokens: { input: 100, output: 500 },
          latency: 1500
        }
      });

      expect(message.metadata?.model).toBe('claude-3-opus');
      expect(message.metadata?.tokens?.input).toBe(100);
      expect(message.metadata?.tokens?.output).toBe(500);
      expect(message.metadata?.latency).toBe(1500);
    });

    it('should support tool calls in metadata', () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'read_file',
          arguments: { path: 'src/auth.ts' },
          result: { content: 'file content...' }
        },
        {
          name: 'search_code',
          arguments: { query: 'authentication' },
          result: { files: ['auth.ts', 'login.ts'] }
        }
      ];

      const message = createTestMessage({
        role: 'assistant' as MessageRole,
        metadata: { toolCalls }
      });

      expect(message.metadata?.toolCalls).toHaveLength(2);
      expect(message.metadata?.toolCalls?.[0].name).toBe('read_file');
    });
  });

  // ============================================================================
  // MessageStore CRUD Tests
  // ============================================================================

  describe('MessageStore', () => {
    describe('create()', () => {
      it('should create a message with generated ID', async () => {
        const input = {
          sessionId: 'session_1',
          role: 'user' as MessageRole,
          content: 'How do I implement caching?'
        };

        const expectedMessage = {
          id: expect.any(String),
          sessionId: input.sessionId,
          role: input.role,
          content: input.content,
          metadata: {},
          createdAt: expect.any(Date)
        };

        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        const result = await messageStore.create(input);

        // Verify return value
        expect(result).toMatchObject(expectedMessage);
        expect(result.id).toBeDefined();

        // Verify mock interaction
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining([
            expect.any(String), // id
            input.sessionId,
            input.role,
            input.content,
            expect.any(String) // metadata JSON
          ])
        );
      });

      it('should update session message count on create', async () => {
        const sessionId = 'session_1';
        const input = {
          sessionId,
          role: 'user' as MessageRole,
          content: 'test content'
        };

        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        await messageStore.create(input);

        // Verify session count update was called
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('message_count'),
          expect.arrayContaining([sessionId])
        );
      });

      it('should store metadata as JSON', async () => {
        const metadata = {
          model: 'claude-3-sonnet',
          tokens: { input: 50, output: 200 }
        };

        const input = {
          sessionId: 'session_1',
          role: 'assistant' as MessageRole,
          content: 'response',
          metadata
        };

        mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

        await messageStore.create(input);

        // Verify metadata was serialized to JSON
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([JSON.stringify(metadata)])
        );
      });
    });

    describe('get()', () => {
      it('should retrieve message by ID', async () => {
        const messageId = 'msg_123';
        const dbRow = {
          id: messageId,
          session_id: 'session_1',
          role: 'user',
          content: 'Test message',
          metadata: '{}',
          created_at: new Date().toISOString()
        };

        mockDb.get.mockReturnValue(dbRow);

        const result = await messageStore.get(messageId);

        // Verify return value
        expect(result).toBeDefined();
        expect(result?.id).toBe(messageId);
        expect(result?.sessionId).toBe('session_1');
        expect(result?.role).toBe('user');

        // Verify mock interaction
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.arrayContaining([messageId])
        );
      });

      it('should return null for non-existent message', async () => {
        mockDb.get.mockReturnValue(undefined);

        const result = await messageStore.get('non_existent');

        expect(result).toBeNull();
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.arrayContaining(['non_existent'])
        );
      });

      it('should parse metadata JSON on retrieval', async () => {
        const metadata = { model: 'claude-3', tokens: { input: 100 } };
        const dbRow = {
          id: 'msg_1',
          session_id: 'session_1',
          role: 'user',
          content: 'test',
          metadata: JSON.stringify(metadata),
          created_at: new Date().toISOString()
        };

        mockDb.get.mockReturnValue(dbRow);

        const result = await messageStore.get('msg_1');

        expect(result?.metadata?.model).toBe('claude-3');
        expect(result?.metadata?.tokens?.input).toBe(100);
      });
    });

    describe('getBySession()', () => {
      it('should retrieve all messages for a session', async () => {
        const sessionId = 'session_1';
        const dbRows = [
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'Question', metadata: '{}', created_at: '2024-01-01T00:00:00Z' },
          { id: 'msg_2', session_id: sessionId, role: 'assistant', content: 'Answer', metadata: '{}', created_at: '2024-01-01T00:01:00Z' }
        ];

        mockDb.all.mockReturnValue(dbRows);

        const messages = await messageStore.getBySession(sessionId);

        // Verify return value
        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('user');
        expect(messages[1].role).toBe('assistant');

        // Verify mock interaction
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('session_id'),
          expect.arrayContaining([sessionId])
        );
      });

      it('should support limit option', async () => {
        const sessionId = 'session_1';
        const dbRows = [
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'Q1', metadata: '{}', created_at: '2024-01-01T00:00:00Z' },
          { id: 'msg_2', session_id: sessionId, role: 'assistant', content: 'A1', metadata: '{}', created_at: '2024-01-01T00:01:00Z' }
        ];

        mockDb.all.mockReturnValue(dbRows);

        const messages = await messageStore.getBySession(sessionId, { limit: 2 });

        expect(messages.length).toBeLessThanOrEqual(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.any(Array)
        );
      });

      it('should support before/after date filters', async () => {
        const sessionId = 'session_1';
        const before = new Date('2024-01-15');
        const after = new Date('2024-01-01');

        mockDb.all.mockReturnValue([
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'test', metadata: '{}', created_at: '2024-01-10T00:00:00Z' }
        ]);

        const messages = await messageStore.getBySession(sessionId, { before, after });

        expect(messages).toHaveLength(1);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringMatching(/created_at.*<.*AND.*created_at.*>/),
          expect.any(Array)
        );
      });
    });

    describe('getRecent()', () => {
      it('should retrieve most recent messages across sessions', async () => {
        const dbRows = [
          { id: 'msg_3', session_id: 's1', role: 'user', content: 'c3', metadata: '{}', created_at: '2024-01-03T00:00:00Z' },
          { id: 'msg_2', session_id: 's2', role: 'user', content: 'c2', metadata: '{}', created_at: '2024-01-02T00:00:00Z' },
          { id: 'msg_1', session_id: 's1', role: 'user', content: 'c1', metadata: '{}', created_at: '2024-01-01T00:00:00Z' }
        ];

        mockDb.all.mockReturnValue(dbRows);

        const messages = await messageStore.getRecent(10);

        expect(messages[0].id).toBe('msg_3');
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.any(Array)
        );
      });

      it('should default to 10 messages', async () => {
        mockDb.all.mockReturnValue([]);

        await messageStore.getRecent();

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([10])
        );
      });
    });

    describe('getRecentBySession()', () => {
      it('should retrieve recent messages for specific session', async () => {
        const sessionId = 'session_1';
        const dbRows = [
          { id: 'msg_2', session_id: sessionId, role: 'assistant', content: 'a2', metadata: '{}', created_at: '2024-01-02T00:00:00Z' },
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'q1', metadata: '{}', created_at: '2024-01-01T00:00:00Z' }
        ];

        mockDb.all.mockReturnValue(dbRows);

        const messages = await messageStore.getRecentBySession(sessionId, 10);

        expect(messages).toHaveLength(2);
        expect(messages[0].sessionId).toBe(sessionId);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('session_id'),
          expect.arrayContaining([sessionId])
        );
      });
    });

    describe('search()', () => {
      it('should search messages by content', async () => {
        const query = 'authentication';
        const dbRows = [
          { id: 'msg_1', session_id: 's1', role: 'user', content: 'How do I implement authentication?', metadata: '{}', created_at: '2024-01-01T00:00:00Z' },
          { id: 'msg_2', session_id: 's1', role: 'assistant', content: 'Authentication uses JWT tokens', metadata: '{}', created_at: '2024-01-01T00:01:00Z' }
        ];

        mockDb.all.mockReturnValue(dbRows);

        const results = await messageStore.search(query);

        expect(results).toHaveLength(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('LIKE'),
          expect.arrayContaining([`%${query}%`])
        );
      });

      it('should support session-scoped search', async () => {
        const sessionId = 'session_1';
        const query = 'caching';

        mockDb.all.mockReturnValue([
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'Implement caching', metadata: '{}', created_at: '2024-01-01T00:00:00Z' }
        ]);

        const results = await messageStore.search(query, { sessionId });

        expect(results).toHaveLength(1);
        expect(results[0].sessionId).toBe(sessionId);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('session_id'),
          expect.arrayContaining([`%${query}%`, sessionId])
        );
      });

      it('should support search result limit', async () => {
        mockDb.all.mockReturnValue([
          { id: 'msg_1', session_id: 's1', role: 'user', content: 'test1', metadata: '{}', created_at: '2024-01-01T00:00:00Z' },
          { id: 'msg_2', session_id: 's1', role: 'user', content: 'test2', metadata: '{}', created_at: '2024-01-01T00:01:00Z' }
        ]);

        const results = await messageStore.search('test', { limit: 2 });

        expect(results.length).toBeLessThanOrEqual(2);
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.any(Array)
        );
      });
    });

    describe('count()', () => {
      it('should count all messages', async () => {
        mockDb.get.mockReturnValue({ count: 150 });

        const result = await messageStore.count();

        expect(result).toBe(150);
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(*)'),
          expect.any(Array)
        );
      });

      it('should count messages for specific session', async () => {
        const sessionId = 'session_1';
        mockDb.get.mockReturnValue({ count: 25 });

        const result = await messageStore.count({ sessionId });

        expect(result).toBe(25);
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('session_id'),
          expect.arrayContaining([sessionId])
        );
      });
    });

    describe('delete()', () => {
      it('should delete message by ID', async () => {
        const messageId = 'msg_to_delete';
        mockDb.get.mockReturnValue({ id: messageId, session_id: 'session_1' });
        mockDb.run.mockReturnValue({ changes: 1 });

        const result = await messageStore.delete(messageId);

        expect(result).toBe(true);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining([messageId])
        );
      });

      it('should update session message count on delete', async () => {
        const messageId = 'msg_1';
        const sessionId = 'session_1';

        mockDb.get.mockReturnValue({ id: messageId, session_id: sessionId });
        mockDb.run.mockReturnValue({ changes: 1 });

        await messageStore.delete(messageId);

        // Verify session count decrement was called
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('message_count'),
          expect.arrayContaining([sessionId])
        );
      });

      it('should return false for non-existent message', async () => {
        mockDb.get.mockReturnValue(undefined);

        const result = await messageStore.delete('non_existent');

        expect(result).toBe(false);
      });
    });

    describe('deleteBySession()', () => {
      it('should delete all messages for a session', async () => {
        const sessionId = 'session_to_clear';
        mockDb.run.mockReturnValue({ changes: 15 });

        const result = await messageStore.deleteBySession(sessionId);

        expect(result).toBe(15);
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining([sessionId])
        );
      });
    });

    describe('getConversationPairs()', () => {
      it('should extract user-assistant message pairs', async () => {
        const sessionId = 'session_1';
        const dbRows = [
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'Question 1', metadata: '{}', created_at: '2024-01-01T00:00:00Z' },
          { id: 'msg_2', session_id: sessionId, role: 'assistant', content: 'Answer 1', metadata: '{}', created_at: '2024-01-01T00:01:00Z' },
          { id: 'msg_3', session_id: sessionId, role: 'user', content: 'Question 2', metadata: '{}', created_at: '2024-01-01T00:02:00Z' },
          { id: 'msg_4', session_id: sessionId, role: 'assistant', content: 'Answer 2', metadata: '{}', created_at: '2024-01-01T00:03:00Z' }
        ];

        mockDb.all.mockReturnValue(dbRows);

        const pairs = await messageStore.getConversationPairs(sessionId);

        expect(pairs).toHaveLength(2);
        expect(pairs[0].user.content).toBe('Question 1');
        expect(pairs[0].assistant.content).toBe('Answer 1');
        expect(pairs[1].user.content).toBe('Question 2');
        expect(pairs[1].assistant.content).toBe('Answer 2');
      });

      it('should handle incomplete pairs', async () => {
        const sessionId = 'session_1';
        const dbRows = [
          { id: 'msg_1', session_id: sessionId, role: 'user', content: 'Question 1', metadata: '{}', created_at: '2024-01-01T00:00:00Z' },
          { id: 'msg_2', session_id: sessionId, role: 'assistant', content: 'Answer 1', metadata: '{}', created_at: '2024-01-01T00:01:00Z' },
          { id: 'msg_3', session_id: sessionId, role: 'user', content: 'Question 2', metadata: '{}', created_at: '2024-01-01T00:02:00Z' }
          // No assistant response yet
        ];

        mockDb.all.mockReturnValue(dbRows);

        const pairs = await messageStore.getConversationPairs(sessionId);

        expect(pairs).toHaveLength(1);
      });

      it('should support pair limit', async () => {
        const sessionId = 'session_1';
        const dbRows = Array(20).fill(null).flatMap((_, i) => [
          { id: `msg_${i * 2}`, session_id: sessionId, role: 'user', content: `Question ${i}`, metadata: '{}', created_at: `2024-01-01T00:${String(i * 2).padStart(2, '0')}:00Z` },
          { id: `msg_${i * 2 + 1}`, session_id: sessionId, role: 'assistant', content: `Answer ${i}`, metadata: '{}', created_at: `2024-01-01T00:${String(i * 2 + 1).padStart(2, '0')}:00Z` }
        ]);

        mockDb.all.mockReturnValue(dbRows);

        const pairs = await messageStore.getConversationPairs(sessionId, { limit: 3 });

        expect(pairs).toHaveLength(3);
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty content', async () => {
      const input = {
        sessionId: 'session_1',
        role: 'user' as MessageRole,
        content: ''
      };

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = await messageStore.create(input);

      expect(result.content).toBe('');
    });

    it('should handle very long content', async () => {
      const longContent = 'x'.repeat(100000);
      const input = {
        sessionId: 'session_1',
        role: 'user' as MessageRole,
        content: longContent
      };

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = await messageStore.create(input);

      expect(result.content.length).toBe(100000);
    });

    it('should handle special characters in content', async () => {
      const content = 'Code: `const x = "test";` and special chars: <>&';
      const input = {
        sessionId: 'session_1',
        role: 'user' as MessageRole,
        content
      };

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = await messageStore.create(input);

      expect(result.content).toContain('`const x');
    });

    it('should handle messages with no metadata', async () => {
      const input = {
        sessionId: 'session_1',
        role: 'user' as MessageRole,
        content: 'test'
      };

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = await messageStore.create(input);

      expect(result.metadata).toEqual({});
    });

    it('should handle concurrent message creation', async () => {
      const sessionId = 'session_1';
      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const operations = Array(10).fill(null).map((_, i) =>
        messageStore.create({
          sessionId,
          role: 'user' as MessageRole,
          content: `Message ${i}`
        })
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      expect(mockDb.run).toHaveBeenCalledTimes(20); // 10 inserts + 10 session count updates
    });

    it('should handle database errors gracefully', async () => {
      mockDb.run.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(
        messageStore.create({
          sessionId: 'session_1',
          role: 'user' as MessageRole,
          content: 'test'
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  // ============================================================================
  // Data Transformation Tests
  // ============================================================================

  describe('Data Transformation', () => {
    it('should convert row to Message object correctly', async () => {
      const row = {
        id: 'msg_123',
        session_id: 'session_1',
        role: 'user',
        content: 'Test content',
        metadata: '{"model": "claude-3"}',
        created_at: '2024-01-15T10:30:00Z'
      };

      mockDb.get.mockReturnValue(row);

      const message = await messageStore.get('msg_123');

      expect(message?.sessionId).toBe('session_1');
      expect(message?.metadata?.model).toBe('claude-3');
      expect(message?.createdAt).toBeInstanceOf(Date);
    });

    it('should handle null metadata in row', async () => {
      const row = {
        id: 'msg_1',
        session_id: 'session_1',
        role: 'user',
        content: 'test',
        metadata: null,
        created_at: '2024-01-15T10:30:00Z'
      };

      mockDb.get.mockReturnValue(row);

      const message = await messageStore.get('msg_1');

      expect(message?.metadata).toEqual({});
    });
  });

  // ============================================================================
  // MessageQuery Tests
  // ============================================================================

  describe('MessageQuery', () => {
    it('should support all query fields', async () => {
      const query: MessageQuery = {
        sessionId: 'session_1',
        role: 'user' as MessageRole,
        before: new Date('2024-01-15'),
        after: new Date('2024-01-01'),
        limit: 50,
        offset: 10
      };

      mockDb.all.mockReturnValue([]);

      await messageStore.query(query);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('session_id'),
        expect.any(Array)
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('role'),
        expect.any(Array)
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.any(Array)
      );
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('OFFSET'),
        expect.any(Array)
      );
    });

    it('should build query with multiple conditions', async () => {
      const query: MessageQuery = {
        sessionId: 'session_1',
        role: 'assistant' as MessageRole,
        limit: 20
      };

      mockDb.all.mockReturnValue([]);

      await messageStore.query(query);

      // Verify the query was built with AND conditions
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE.*AND/),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // ToolCall Interface Tests
  // ============================================================================

  describe('ToolCall Interface', () => {
    it('should represent tool call correctly', () => {
      const toolCall: ToolCall = {
        name: 'read_file',
        arguments: { path: 'src/main.ts' },
        result: { content: 'file content here' }
      };

      expect(toolCall.name).toBe('read_file');
      expect(toolCall.arguments.path).toBe('src/main.ts');
      expect(toolCall.result).toBeDefined();
    });

    it('should handle tool call without result', () => {
      const toolCall: ToolCall = {
        name: 'write_file',
        arguments: { path: 'out.txt', content: 'data' }
      };

      expect(toolCall.result).toBeUndefined();
    });

    it('should store messages with tool calls', async () => {
      const toolCalls: ToolCall[] = [
        {
          name: 'search',
          arguments: {
            query: 'authentication',
            filters: { type: 'function', language: 'typescript' },
            limit: 10
          }
        }
      ];

      const input = {
        sessionId: 'session_1',
        role: 'assistant' as MessageRole,
        content: 'Here are the search results',
        metadata: { toolCalls }
      };

      mockDb.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

      const result = await messageStore.create(input);

      expect(result.metadata?.toolCalls?.[0].name).toBe('search');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.stringContaining('toolCalls')])
      );
    });
  });
});
