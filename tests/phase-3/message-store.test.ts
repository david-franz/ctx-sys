import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { MessageStore, SessionManager } from '../../src';

describe('F3.1 - Message Storage', () => {
  let db: DatabaseConnection;
  let messageStore: MessageStore;
  let sessionManager: SessionManager;
  let testDbPath: string;
  const projectId = 'test-project';
  let sessionId: string;

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    messageStore = new MessageStore(db, projectId);
    sessionManager = new SessionManager(db, projectId);

    // Create a session for testing
    const session = sessionManager.create('Test Session');
    sessionId = session.id;
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

  describe('MessageStore', () => {
    describe('create', () => {
      it('should create a message', () => {
        const message = messageStore.create({
          sessionId,
          role: 'user',
          content: 'Hello, world!'
        });

        expect(message.id).toBeDefined();
        expect(message.sessionId).toBe(sessionId);
        expect(message.role).toBe('user');
        expect(message.content).toBe('Hello, world!');
        expect(message.createdAt).toBeInstanceOf(Date);
      });

      it('should create a message with metadata', () => {
        const message = messageStore.create({
          sessionId,
          role: 'assistant',
          content: 'I can help you with that.',
          metadata: {
            model: 'gpt-4',
            tokens: { input: 10, output: 20 },
            latency: 500
          }
        });

        expect(message.metadata?.model).toBe('gpt-4');
        expect(message.metadata?.tokens?.input).toBe(10);
        expect(message.metadata?.tokens?.output).toBe(20);
        expect(message.metadata?.latency).toBe(500);
      });

      it('should update session message count', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Message 1' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Response 1' });

        const session = sessionManager.get(sessionId);
        expect(session?.messageCount).toBe(2);
      });

      it('should create messages with different roles', () => {
        const userMsg = messageStore.create({ sessionId, role: 'user', content: 'User message' });
        const assistantMsg = messageStore.create({ sessionId, role: 'assistant', content: 'Assistant response' });
        const systemMsg = messageStore.create({ sessionId, role: 'system', content: 'System prompt' });

        expect(userMsg.role).toBe('user');
        expect(assistantMsg.role).toBe('assistant');
        expect(systemMsg.role).toBe('system');
      });
    });

    describe('get', () => {
      it('should get a message by ID', () => {
        const created = messageStore.create({
          sessionId,
          role: 'user',
          content: 'Test content'
        });

        const retrieved = messageStore.get(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.content).toBe('Test content');
      });

      it('should return null for non-existent message', () => {
        const result = messageStore.get('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('getBySession', () => {
      it('should get all messages for a session', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Message 1' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Response 1' });
        messageStore.create({ sessionId, role: 'user', content: 'Message 2' });

        const messages = messageStore.getBySession(sessionId);
        expect(messages.length).toBe(3);
        expect(messages[0].content).toBe('Message 1');
        expect(messages[1].content).toBe('Response 1');
        expect(messages[2].content).toBe('Message 2');
      });

      it('should return messages in chronological order', () => {
        messageStore.create({ sessionId, role: 'user', content: 'First' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Second' });
        messageStore.create({ sessionId, role: 'user', content: 'Third' });

        const messages = messageStore.getBySession(sessionId);
        expect(messages[0].content).toBe('First');
        expect(messages[1].content).toBe('Second');
        expect(messages[2].content).toBe('Third');
      });

      it('should respect limit option', () => {
        for (let i = 0; i < 10; i++) {
          messageStore.create({ sessionId, role: 'user', content: `Message ${i}` });
        }

        const messages = messageStore.getBySession(sessionId, { limit: 5 });
        expect(messages.length).toBe(5);
      });

      it('should return empty array for session with no messages', () => {
        const newSession = sessionManager.create('Empty Session');
        const messages = messageStore.getBySession(newSession.id);
        expect(messages).toEqual([]);
      });
    });

    describe('getRecent', () => {
      it('should get most recent messages', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Old message' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Older response' });
        messageStore.create({ sessionId, role: 'user', content: 'Recent message' });

        const messages = messageStore.getRecent(2);
        expect(messages.length).toBe(2);
        // Should be in chronological order (oldest first)
        expect(messages[0].content).toBe('Older response');
        expect(messages[1].content).toBe('Recent message');
      });

      it('should default to 10 messages', () => {
        for (let i = 0; i < 15; i++) {
          messageStore.create({ sessionId, role: 'user', content: `Message ${i}` });
        }

        const messages = messageStore.getRecent();
        expect(messages.length).toBe(10);
      });
    });

    describe('getRecentBySession', () => {
      it('should get recent messages for a specific session', () => {
        const session2 = sessionManager.create('Session 2');

        messageStore.create({ sessionId, role: 'user', content: 'Session 1 message' });
        messageStore.create({ sessionId: session2.id, role: 'user', content: 'Session 2 message' });

        const messages = messageStore.getRecentBySession(sessionId, 10);
        expect(messages.length).toBe(1);
        expect(messages[0].content).toBe('Session 1 message');
      });
    });

    describe('search', () => {
      it('should search messages by content', () => {
        messageStore.create({ sessionId, role: 'user', content: 'How do I implement authentication?' });
        messageStore.create({ sessionId, role: 'assistant', content: 'You can use JWT tokens for authentication.' });
        messageStore.create({ sessionId, role: 'user', content: 'What about database design?' });

        const results = messageStore.search('authentication');
        expect(results.length).toBe(2);
      });

      it('should filter search by session', () => {
        const session2 = sessionManager.create('Session 2');

        messageStore.create({ sessionId, role: 'user', content: 'Question about authentication' });
        messageStore.create({ sessionId: session2.id, role: 'user', content: 'Another question about authentication' });

        const results = messageStore.search('authentication', { sessionId });
        expect(results.length).toBe(1);
      });

      it('should respect search limit', () => {
        for (let i = 0; i < 10; i++) {
          messageStore.create({ sessionId, role: 'user', content: `Question about coding ${i}` });
        }

        const results = messageStore.search('coding', { limit: 3 });
        expect(results.length).toBe(3);
      });

      it('should return empty array when no matches', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Hello world' });

        const results = messageStore.search('nonexistent');
        expect(results).toEqual([]);
      });
    });

    describe('query', () => {
      it('should query by role', () => {
        messageStore.create({ sessionId, role: 'user', content: 'User message' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Assistant response' });
        messageStore.create({ sessionId, role: 'user', content: 'Another user message' });

        const userMessages = messageStore.query({ sessionId, role: 'user' });
        expect(userMessages.length).toBe(2);
        expect(userMessages.every(m => m.role === 'user')).toBe(true);
      });

      it('should query with pagination', () => {
        for (let i = 0; i < 10; i++) {
          messageStore.create({ sessionId, role: 'user', content: `Message ${i}` });
        }

        const page1 = messageStore.query({ sessionId, limit: 5, offset: 0 });
        const page2 = messageStore.query({ sessionId, limit: 5, offset: 5 });

        expect(page1.length).toBe(5);
        expect(page2.length).toBe(5);
        expect(page1[0].content).toBe('Message 0');
        expect(page2[0].content).toBe('Message 5');
      });
    });

    describe('count', () => {
      it('should count all messages', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Message 1' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Response 1' });

        expect(messageStore.count()).toBe(2);
      });

      it('should count messages for a specific session', () => {
        const session2 = sessionManager.create('Session 2');

        messageStore.create({ sessionId, role: 'user', content: 'Session 1' });
        messageStore.create({ sessionId, role: 'user', content: 'Session 1 again' });
        messageStore.create({ sessionId: session2.id, role: 'user', content: 'Session 2' });

        expect(messageStore.count(sessionId)).toBe(2);
        expect(messageStore.count(session2.id)).toBe(1);
      });
    });

    describe('delete', () => {
      it('should delete a message', () => {
        const message = messageStore.create({ sessionId, role: 'user', content: 'To be deleted' });

        const result = messageStore.delete(message.id);
        expect(result).toBe(true);
        expect(messageStore.get(message.id)).toBeNull();
      });

      it('should update session message count on delete', () => {
        const message = messageStore.create({ sessionId, role: 'user', content: 'Message' });
        expect(sessionManager.get(sessionId)?.messageCount).toBe(1);

        messageStore.delete(message.id);
        expect(sessionManager.get(sessionId)?.messageCount).toBe(0);
      });

      it('should return false for non-existent message', () => {
        const result = messageStore.delete('non-existent-id');
        expect(result).toBe(false);
      });
    });

    describe('deleteBySession', () => {
      it('should delete all messages for a session', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Message 1' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Response 1' });
        messageStore.create({ sessionId, role: 'user', content: 'Message 2' });

        const deleted = messageStore.deleteBySession(sessionId);
        expect(deleted).toBe(3);
        expect(messageStore.getBySession(sessionId)).toEqual([]);
      });
    });

    describe('getConversationPairs', () => {
      it('should extract user-assistant pairs', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Question 1' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Answer 1' });
        messageStore.create({ sessionId, role: 'user', content: 'Question 2' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Answer 2' });

        const pairs = messageStore.getConversationPairs(sessionId);
        expect(pairs.length).toBe(2);
        expect(pairs[0].user.content).toBe('Question 1');
        expect(pairs[0].assistant.content).toBe('Answer 1');
        expect(pairs[1].user.content).toBe('Question 2');
        expect(pairs[1].assistant.content).toBe('Answer 2');
      });

      it('should handle incomplete pairs', () => {
        messageStore.create({ sessionId, role: 'user', content: 'Question 1' });
        messageStore.create({ sessionId, role: 'assistant', content: 'Answer 1' });
        messageStore.create({ sessionId, role: 'user', content: 'Unanswered question' });

        const pairs = messageStore.getConversationPairs(sessionId);
        expect(pairs.length).toBe(1);
      });

      it('should respect limit on pairs', () => {
        for (let i = 0; i < 10; i++) {
          messageStore.create({ sessionId, role: 'user', content: `Question ${i}` });
          messageStore.create({ sessionId, role: 'assistant', content: `Answer ${i}` });
        }

        const pairs = messageStore.getConversationPairs(sessionId, 3);
        expect(pairs.length).toBe(3);
        // Should return the most recent pairs
        expect(pairs[0].user.content).toBe('Question 7');
      });
    });

    describe('buildTranscript', () => {
      it('should build a transcript from messages', () => {
        const messages = [
          messageStore.create({ sessionId, role: 'user', content: 'Hello' }),
          messageStore.create({ sessionId, role: 'assistant', content: 'Hi there!' })
        ];

        const transcript = messageStore.buildTranscript(messages);
        expect(transcript).toContain('[USER]: Hello');
        expect(transcript).toContain('[ASSISTANT]: Hi there!');
      });
    });
  });
});
