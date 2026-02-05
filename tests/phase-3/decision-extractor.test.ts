import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  MessageStore,
  SessionManager,
  DecisionExtractor,
  MockDecisionProvider,
  Message
} from '../../src';

describe('F3.4 - Decision Extraction', () => {
  let db: DatabaseConnection;
  let messageStore: MessageStore;
  let sessionManager: SessionManager;
  let extractor: DecisionExtractor;
  let mockProvider: MockDecisionProvider;
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
    mockProvider = new MockDecisionProvider();
    extractor = new DecisionExtractor(mockProvider, messageStore);

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

  describe('DecisionExtractor', () => {
    describe('mightContainDecision', () => {
      it('should detect "we decided" pattern', () => {
        expect(extractor.mightContainDecision("We decided to use PostgreSQL")).toBe(true);
      });

      it('should detect "let\'s go with" pattern', () => {
        expect(extractor.mightContainDecision("Let's go with React for the frontend")).toBe(true);
      });

      it('should detect "agreed on" pattern', () => {
        expect(extractor.mightContainDecision("We agreed on using TypeScript")).toBe(true);
      });

      it('should detect "I will use" pattern', () => {
        expect(extractor.mightContainDecision("I'll use JWT for authentication")).toBe(true);
      });

      it('should detect "the decision is" pattern', () => {
        expect(extractor.mightContainDecision("The decision is to implement caching")).toBe(true);
      });

      it('should return false for messages without decisions', () => {
        expect(extractor.mightContainDecision("How does authentication work?")).toBe(false);
        expect(extractor.mightContainDecision("The weather is nice today")).toBe(false);
        expect(extractor.mightContainDecision("What is TypeScript?")).toBe(false);
      });

      it('should be case insensitive', () => {
        expect(extractor.mightContainDecision("WE DECIDED to use MongoDB")).toBe(true);
        expect(extractor.mightContainDecision("let's GO WITH Redis")).toBe(true);
      });
    });

    describe('extractFromMessage', () => {
      it('should extract decision from message', async () => {
        mockProvider.setResponse(
          'use PostgreSQL',
          `DECISION: Use PostgreSQL as the database
CONTEXT: Better for relational data
ALTERNATIVES: MongoDB, MySQL`
        );

        const message = messageStore.create({
          sessionId,
          role: 'assistant',
          content: "We decided to use PostgreSQL for the database"
        });

        const decisions = await extractor.extractFromMessage(message);

        expect(decisions.length).toBe(1);
        expect(decisions[0].description).toContain('PostgreSQL');
        expect(decisions[0].context).toContain('relational');
        expect(decisions[0].alternatives).toContain('MongoDB');
        expect(decisions[0].sessionId).toBe(sessionId);
        expect(decisions[0].messageId).toBe(message.id);
      });

      it('should return empty array for non-decision messages', async () => {
        const message = messageStore.create({
          sessionId,
          role: 'user',
          content: "What is the best database to use?"
        });

        const decisions = await extractor.extractFromMessage(message);
        expect(decisions).toEqual([]);
      });

      it('should extract multiple decisions from one message', async () => {
        mockProvider.setResponse(
          'implement features',
          `DECISION: Use React for frontend
CONTEXT: Team familiarity

DECISION: Use Node.js for backend
CONTEXT: JavaScript full stack`
        );

        const message = messageStore.create({
          sessionId,
          role: 'assistant',
          content: "Let's implement features: we'll use React for frontend and Node.js for backend"
        });

        const decisions = await extractor.extractFromMessage(message);

        expect(decisions.length).toBe(2);
        expect(decisions[0].description).toContain('React');
        expect(decisions[1].description).toContain('Node.js');
      });

      it('should handle decisions without alternatives', async () => {
        mockProvider.setResponse(
          'TypeScript',
          `DECISION: Use TypeScript for type safety
CONTEXT: Reduces bugs in production`
        );

        const message = messageStore.create({
          sessionId,
          role: 'assistant',
          content: "We should use TypeScript for this project"
        });

        const decisions = await extractor.extractFromMessage(message);

        expect(decisions.length).toBe(1);
        expect(decisions[0].alternatives).toBeUndefined();
      });

      it('should handle decisions without context', async () => {
        mockProvider.setResponse(
          'implement caching',
          `DECISION: Implement caching with Redis`
        );

        const message = messageStore.create({
          sessionId,
          role: 'assistant',
          content: "Let's implement caching with Redis"
        });

        const decisions = await extractor.extractFromMessage(message);

        expect(decisions.length).toBe(1);
        expect(decisions[0].context).toBeUndefined();
      });
    });

    describe('extractFromSession', () => {
      it('should extract decisions from all messages in a session', async () => {
        mockProvider.setResponse(
          'PostgreSQL',
          `DECISION: Use PostgreSQL
CONTEXT: Good for relational data`
        );
        mockProvider.setResponse(
          'JWT',
          `DECISION: Use JWT for auth
CONTEXT: Stateless authentication`
        );

        messageStore.create({
          sessionId,
          role: 'user',
          content: "What database should we use?"
        });
        messageStore.create({
          sessionId,
          role: 'assistant',
          content: "We decided to use PostgreSQL for this project"
        });
        messageStore.create({
          sessionId,
          role: 'user',
          content: "What about authentication?"
        });
        messageStore.create({
          sessionId,
          role: 'assistant',
          content: "Let's go with JWT for authentication"
        });

        const decisions = await extractor.extractFromSession(sessionId);

        expect(decisions.length).toBe(2);
      });

      it('should return empty array for session without decisions', async () => {
        messageStore.create({
          sessionId,
          role: 'user',
          content: "Hello"
        });
        messageStore.create({
          sessionId,
          role: 'assistant',
          content: "Hi! How can I help?"
        });

        const decisions = await extractor.extractFromSession(sessionId);
        expect(decisions).toEqual([]);
      });
    });

    describe('extractFromMessages', () => {
      it('should extract decisions from a list of messages', async () => {
        mockProvider.setResponse(
          'Redis',
          `DECISION: Use Redis for caching
CONTEXT: Fast in-memory storage`
        );

        const messages: Message[] = [
          messageStore.create({ sessionId, role: 'user', content: 'What about caching?' }),
          messageStore.create({ sessionId, role: 'assistant', content: "Let's use Redis for caching" })
        ];

        const decisions = await extractor.extractFromMessages(messages);

        expect(decisions.length).toBe(1);
        expect(decisions[0].description).toContain('Redis');
      });
    });

    describe('createDecision', () => {
      it('should create a decision object', () => {
        const message = messageStore.create({
          sessionId,
          role: 'assistant',
          content: 'Test'
        });

        const decision = extractor.createDecision({
          sessionId,
          messageId: message.id,
          description: 'Use PostgreSQL for the database',
          context: 'Best for relational data',
          alternatives: ['MongoDB', 'MySQL'],
          relatedEntities: ['database-service']
        });

        expect(decision.id).toBeDefined();
        expect(decision.sessionId).toBe(sessionId);
        expect(decision.messageId).toBe(message.id);
        expect(decision.description).toBe('Use PostgreSQL for the database');
        expect(decision.context).toBe('Best for relational data');
        expect(decision.alternatives).toEqual(['MongoDB', 'MySQL']);
        expect(decision.relatedEntities).toEqual(['database-service']);
        expect(decision.createdAt).toBeInstanceOf(Date);
      });

      it('should create decision with minimal input', () => {
        const message = messageStore.create({ sessionId, role: 'assistant', content: 'Test' });

        const decision = extractor.createDecision({
          sessionId,
          messageId: message.id,
          description: 'Simple decision'
        });

        expect(decision.description).toBe('Simple decision');
        expect(decision.context).toBeUndefined();
        expect(decision.alternatives).toBeUndefined();
        expect(decision.relatedEntities).toEqual([]);
      });
    });

    describe('getPatterns', () => {
      it('should return decision patterns', () => {
        const patterns = extractor.getPatterns();

        expect(patterns).toBeInstanceOf(Array);
        expect(patterns.length).toBeGreaterThan(0);
        expect(patterns[0]).toBeInstanceOf(RegExp);
      });
    });
  });

  describe('MockDecisionProvider', () => {
    it('should return default NO_DECISIONS response', async () => {
      const response = await mockProvider.summarize('random prompt');
      expect(response).toBe('NO_DECISIONS');
    });

    it('should return custom response for matching content', async () => {
      mockProvider.setResponse('keyword', 'Custom response');

      const response = await mockProvider.summarize('prompt with keyword');
      expect(response).toBe('Custom response');
    });

    it('should allow changing default response', async () => {
      mockProvider.setDefaultResponse('New default');

      const response = await mockProvider.summarize('random');
      expect(response).toBe('New default');
    });
  });
});
