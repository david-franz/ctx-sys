import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  MessageStore,
  SessionManager,
  ConversationSummarizer,
  MockSummaryProvider,
  SummaryProvider
} from '../../src';

describe('F3.3 - Conversation Summarization', () => {
  let db: DatabaseConnection;
  let messageStore: MessageStore;
  let sessionManager: SessionManager;
  let summarizer: ConversationSummarizer;
  let mockProvider: MockSummaryProvider;
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
    mockProvider = new MockSummaryProvider();
    summarizer = new ConversationSummarizer(mockProvider, messageStore, sessionManager);

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

  describe('ConversationSummarizer', () => {
    describe('summarizeSession', () => {
      it('should summarize a session with messages', async () => {
        messageStore.create({ sessionId, role: 'user', content: 'How do I implement auth?' });
        messageStore.create({ sessionId, role: 'assistant', content: 'You can use JWT tokens.' });

        const summary = await summarizer.summarizeSession(sessionId);

        expect(summary.overview).toBeDefined();
        expect(summary.topics).toBeInstanceOf(Array);
        expect(summary.decisions).toBeInstanceOf(Array);
        expect(summary.codeReferences).toBeInstanceOf(Array);
        expect(summary.keyPoints).toBeInstanceOf(Array);
      });

      it('should update session status to summarized', async () => {
        messageStore.create({ sessionId, role: 'user', content: 'Test message' });

        await summarizer.summarizeSession(sessionId);

        const session = sessionManager.get(sessionId);
        expect(session?.status).toBe('summarized');
        expect(session?.summary).toBeDefined();
      });

      it('should handle empty session', async () => {
        const summary = await summarizer.summarizeSession(sessionId);

        expect(summary.overview).toBe('Empty session with no messages.');
        expect(summary.topics).toEqual([]);
        expect(summary.decisions).toEqual([]);
      });

      it('should throw for non-existent session', async () => {
        await expect(summarizer.summarizeSession('non-existent'))
          .rejects.toThrow('Session not found');
      });
    });

    describe('previewSummary', () => {
      it('should generate summary without updating session', async () => {
        messageStore.create({ sessionId, role: 'user', content: 'Test message' });

        const summary = await summarizer.previewSummary(sessionId);

        // Summary should be generated
        expect(summary.overview).toBeDefined();

        // But session should still be active
        const session = sessionManager.get(sessionId);
        expect(session?.status).toBe('active');
      });
    });

    describe('summarizeMessages', () => {
      it('should summarize a list of messages directly', async () => {
        const messages = [
          messageStore.create({ sessionId, role: 'user', content: 'Question about TypeScript' }),
          messageStore.create({ sessionId, role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' })
        ];

        const summary = await summarizer.summarizeMessages(messages);

        expect(summary.overview).toBeDefined();
      });

      it('should return empty summary for empty messages', async () => {
        const summary = await summarizer.summarizeMessages([]);

        expect(summary.overview).toBe('Empty session with no messages.');
      });
    });

    describe('response parsing', () => {
      it('should parse structured response correctly', async () => {
        // Create a custom provider with specific response
        const customProvider: SummaryProvider = {
          async summarize(): Promise<string> {
            return `OVERVIEW: This conversation covered authentication implementation.

TOPICS:
- JWT authentication
- User login flow

DECISIONS:
- Use bcrypt for password hashing
- Implement refresh tokens

CODE_REFERENCES:
- auth.service.ts
- login.controller.ts

KEY_POINTS:
- Security is important
- Follow best practices`;
          }
        };

        const customSummarizer = new ConversationSummarizer(customProvider, messageStore, sessionManager);
        messageStore.create({ sessionId, role: 'user', content: 'Test' });

        const summary = await customSummarizer.previewSummary(sessionId);

        expect(summary.overview).toContain('authentication');
        expect(summary.topics).toContain('JWT authentication');
        expect(summary.topics).toContain('User login flow');
        expect(summary.decisions).toContain('Use bcrypt for password hashing');
        expect(summary.codeReferences).toContain('auth.service.ts');
        expect(summary.keyPoints).toContain('Security is important');
      });

      it('should handle "none" values in sections', async () => {
        const customProvider: SummaryProvider = {
          async summarize(): Promise<string> {
            return `OVERVIEW: A simple greeting conversation.

TOPICS:
- greetings

DECISIONS:
- none

CODE_REFERENCES:
- none

KEY_POINTS:
- none`;
          }
        };

        const customSummarizer = new ConversationSummarizer(customProvider, messageStore, sessionManager);
        messageStore.create({ sessionId, role: 'user', content: 'Hello' });

        const summary = await customSummarizer.previewSummary(sessionId);

        expect(summary.topics).toEqual(['greetings']);
        expect(summary.decisions).toEqual([]);
        expect(summary.codeReferences).toEqual([]);
        expect(summary.keyPoints).toEqual([]);
      });

      it('should handle multi-line overview', async () => {
        const customProvider: SummaryProvider = {
          async summarize(): Promise<string> {
            return `OVERVIEW: This is a long overview that
spans multiple lines to test
the parsing logic.

TOPICS:
- topic`;
          }
        };

        const customSummarizer = new ConversationSummarizer(customProvider, messageStore, sessionManager);
        messageStore.create({ sessionId, role: 'user', content: 'Test' });

        const summary = await customSummarizer.previewSummary(sessionId);

        expect(summary.overview).toContain('long overview');
        expect(summary.overview).toContain('spans multiple lines');
      });
    });

    describe('transcript building', () => {
      it('should build transcript from messages', async () => {
        // Use a provider that echoes back part of the input for testing
        const echoProvider: SummaryProvider = {
          async summarize(prompt: string): Promise<string> {
            // Check the prompt contains proper transcript
            expect(prompt).toContain('[USER]: First message');
            expect(prompt).toContain('[ASSISTANT]: First response');
            expect(prompt).toContain('[USER]: Second message');

            return `OVERVIEW: Test

TOPICS:
- test`;
          }
        };

        const echoSummarizer = new ConversationSummarizer(echoProvider, messageStore, sessionManager);

        messageStore.create({ sessionId, role: 'user', content: 'First message' });
        messageStore.create({ sessionId, role: 'assistant', content: 'First response' });
        messageStore.create({ sessionId, role: 'user', content: 'Second message' });

        await echoSummarizer.previewSummary(sessionId);
      });

      it('should truncate very long transcripts', async () => {
        // Create summarizer with small max transcript length
        const shortSummarizer = new ConversationSummarizer(
          mockProvider,
          messageStore,
          sessionManager,
          { maxTranscriptLength: 100 }
        );

        // Add a long message
        messageStore.create({ sessionId, role: 'user', content: 'A'.repeat(200) });

        // This should not throw - transcript gets truncated
        const summary = await shortSummarizer.previewSummary(sessionId);
        expect(summary).toBeDefined();
      });
    });
  });

  describe('MockSummaryProvider', () => {
    it('should return structured mock response', async () => {
      const response = await mockProvider.summarize('test prompt');

      expect(response).toContain('OVERVIEW:');
      expect(response).toContain('TOPICS:');
      expect(response).toContain('DECISIONS:');
      expect(response).toContain('CODE_REFERENCES:');
      expect(response).toContain('KEY_POINTS:');
    });
  });
});
