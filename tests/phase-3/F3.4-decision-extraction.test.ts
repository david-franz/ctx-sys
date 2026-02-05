/**
 * F3.4 Decision Extraction Tests
 *
 * WARNING: These tests will fail until the following implementations are created:
 * - src/conversation/decisions.ts (DecisionExtractor class)
 * - src/conversation/types.ts (Decision, DecisionType, Message interfaces)
 * - src/database/connection.ts (DatabaseConnection class)
 * - src/llm/summarization.ts (SummarizationProvider interface)
 *
 * Tests for decision extraction from conversations:
 * - DecisionExtractor operations
 * - Decision detection patterns
 * - Decision parsing and storage
 * - Entity linking for decisions
 *
 * @see docs/phase-3/F3.4-decision-extraction.md
 */

import { DecisionExtractor } from '../../src/conversation/decisions';
import { Decision, DecisionType, Message } from '../../src/conversation/types';
import { DatabaseConnection } from '../../src/db/connection';
import { SummarizationProvider } from '../../src/summarization/llm-summarization';

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('../../src/db/connection');
jest.mock('../../src/llm/summarization');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;

// ============================================================================
// Test Helpers
// ============================================================================

let idCounter = 0;
function generateId(): string {
  return `test_id_${++idCounter}`;
}

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

function createMockDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: generateId(),
    sessionId: 'session_default',
    messageId: 'message_default',
    type: DecisionType.TECHNICAL,
    description: 'We decided to use PostgreSQL for the database',
    context: 'Need ACID compliance and complex queries',
    alternatives: ['MongoDB', 'MySQL'],
    relatedEntities: [],
    createdAt: new Date(),
    ...overrides
  };
}

describe('F3.4 Decision Extraction', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let mockSummarizationProvider: jest.Mocked<SummarizationProvider>;
  let decisionExtractor: DecisionExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    idCounter = 0;

    // Create mocked database instance
    mockDb = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockDb.run = jest.fn().mockResolvedValue({ changes: 1 });
    mockDb.get = jest.fn().mockResolvedValue(null);
    mockDb.all = jest.fn().mockResolvedValue([]);
    mockDb.exec = jest.fn().mockResolvedValue(undefined);

    // Create mocked summarization provider
    mockSummarizationProvider = {
      summarize: jest.fn().mockResolvedValue('Summary text'),
      extractDecisions: jest.fn().mockResolvedValue([])
    } as jest.Mocked<SummarizationProvider>;

    // Create real instance with mocked dependencies
    decisionExtractor = new DecisionExtractor(mockDb, mockSummarizationProvider);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Decision Interface Tests
  // ============================================================================

  describe('Decision Interface', () => {
    it('should have all required fields', () => {
      const decision = createMockDecision();

      expect(decision).toHaveProperty('id');
      expect(decision).toHaveProperty('sessionId');
      expect(decision).toHaveProperty('messageId');
      expect(decision).toHaveProperty('type');
      expect(decision).toHaveProperty('description');
      expect(decision).toHaveProperty('createdAt');
    });

    it('should have optional context', () => {
      const withContext = createMockDecision({ context: 'Performance requirements' });
      const withoutContext = createMockDecision({ context: undefined });

      expect(withContext.context).toBe('Performance requirements');
      expect(withoutContext.context).toBeUndefined();
    });

    it('should have optional alternatives', () => {
      const withAlternatives = createMockDecision({ alternatives: ['Option A', 'Option B'] });
      const withoutAlternatives = createMockDecision({ alternatives: undefined });

      expect(withAlternatives.alternatives).toHaveLength(2);
      expect(withoutAlternatives.alternatives).toBeUndefined();
    });

    it('should track related entities', () => {
      const decision = createMockDecision({
        relatedEntities: ['entity_db_config', 'entity_db_service']
      });

      expect(decision.relatedEntities).toHaveLength(2);
    });

    it('should support different decision types', () => {
      const technicalDecision = createMockDecision({ type: DecisionType.TECHNICAL });
      const architecturalDecision = createMockDecision({ type: DecisionType.ARCHITECTURAL });
      const processDecision = createMockDecision({ type: DecisionType.PROCESS });

      expect(technicalDecision.type).toBe(DecisionType.TECHNICAL);
      expect(architecturalDecision.type).toBe(DecisionType.ARCHITECTURAL);
      expect(processDecision.type).toBe(DecisionType.PROCESS);
    });
  });

  // ============================================================================
  // Decision Detection Pattern Tests
  // ============================================================================

  describe('Decision Detection Patterns', () => {
    it('should detect "we will" pattern', async () => {
      const message = createMockMessage({
        content: "We will use PostgreSQL for the database."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "we decided" pattern', async () => {
      const message = createMockMessage({
        content: "We decided to implement caching with Redis."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "we should" pattern', async () => {
      const message = createMockMessage({
        content: "We should use TypeScript for better type safety."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "we agreed" pattern', async () => {
      const message = createMockMessage({
        content: "We agreed on using JWT for authentication."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "let\'s use" pattern', async () => {
      const message = createMockMessage({
        content: "Let's use React for the frontend."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "let\'s go with" pattern', async () => {
      const message = createMockMessage({
        content: "Let's go with the microservices approach."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "the decision is" pattern', async () => {
      const message = createMockMessage({
        content: "The decision is to use Docker for deployment."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "the plan is" pattern', async () => {
      const message = createMockMessage({
        content: "The plan is to migrate to Kubernetes."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should detect "I will use" pattern', async () => {
      const message = createMockMessage({
        content: "I'll use Jest for testing."
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(true);
    });

    it('should not detect non-decision messages', async () => {
      const message = createMockMessage({
        content: "Can you help me understand authentication?"
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(false);
    });

    it('should not detect questions about decisions', async () => {
      const message = createMockMessage({
        content: "What should we use for the database?"
      });

      const containsDecision = await decisionExtractor.mightContainDecision(message.content);
      expect(containsDecision).toBe(false);
    });
  });

  // ============================================================================
  // Extraction Prompt Tests
  // ============================================================================

  describe('Extraction Prompt', () => {
    it('should build extraction prompt correctly', () => {
      const content = "We decided to use JWT for authentication because it's stateless.";

      const prompt = decisionExtractor.buildExtractionPrompt(content);

      expect(prompt).toContain('DECISION:');
      expect(prompt).toContain('CONTEXT:');
      expect(prompt).toContain('ALTERNATIVES:');
      expect(prompt).toContain('NO_DECISIONS');
      expect(prompt).toContain(content);
    });
  });

  // ============================================================================
  // Response Parsing Tests
  // ============================================================================

  describe('Response Parsing', () => {
    it('should parse single decision', () => {
      const response = `DECISION: Use JWT for authentication
CONTEXT: Stateless and scalable for microservices
ALTERNATIVES: Session cookies, OAuth tokens`;

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(decisions).toHaveLength(1);
      expect(decisions[0].description).toBe('Use JWT for authentication');
      expect(decisions[0].context).toBe('Stateless and scalable for microservices');
      expect(decisions[0].alternatives).toEqual(['Session cookies', 'OAuth tokens']);
    });

    it('should parse multiple decisions', () => {
      const response = `DECISION: Use PostgreSQL for database
CONTEXT: Need ACID compliance

DECISION: Use Redis for caching
CONTEXT: High performance requirements`;

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(decisions).toHaveLength(2);
      expect(decisions[0].description).toBe('Use PostgreSQL for database');
      expect(decisions[1].description).toBe('Use Redis for caching');
    });

    it('should handle NO_DECISIONS response', () => {
      const response = 'NO_DECISIONS';

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(decisions).toHaveLength(0);
    });

    it('should handle decision without context', () => {
      const response = `DECISION: Use TypeScript
ALTERNATIVES: JavaScript, Flow`;

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(decisions).toHaveLength(1);
      expect(decisions[0].context).toBeUndefined();
      expect(decisions[0].alternatives).toBeDefined();
    });

    it('should handle decision without alternatives', () => {
      const response = `DECISION: Use Docker for containerization
CONTEXT: Standard industry practice`;

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(decisions).toHaveLength(1);
      expect(decisions[0].alternatives).toBeUndefined();
    });
  });

  // ============================================================================
  // DecisionExtractor Tests
  // ============================================================================

  describe('DecisionExtractor', () => {
    describe('extractFromMessage()', () => {
      it('should extract decisions from message with decision patterns', async () => {
        const message = createMockMessage({
          content: "We decided to use PostgreSQL for the database because we need ACID compliance."
        });

        const mockDecision = createMockDecision({
          sessionId: message.sessionId,
          messageId: message.id,
          description: 'Use PostgreSQL for the database',
          context: 'Need ACID compliance'
        });

        mockSummarizationProvider.extractDecisions.mockResolvedValue([mockDecision]);

        const decisions = await decisionExtractor.extractFromMessage(message);

        expect(mockSummarizationProvider.extractDecisions).toHaveBeenCalledWith(
          expect.stringContaining(message.content)
        );
        expect(decisions).toHaveLength(1);
        expect(decisions[0].description).toBe('Use PostgreSQL for the database');
      });

      it('should skip messages without decision patterns', async () => {
        const message = createMockMessage({
          content: "Can you explain how authentication works?"
        });

        const decisions = await decisionExtractor.extractFromMessage(message);

        expect(mockSummarizationProvider.extractDecisions).not.toHaveBeenCalled();
        expect(decisions).toHaveLength(0);
      });

      it('should return empty array for no decisions', async () => {
        const message = createMockMessage({
          content: "We will need to discuss this further."
        });

        mockSummarizationProvider.extractDecisions.mockResolvedValue([]);

        const decisions = await decisionExtractor.extractFromMessage(message);

        expect(decisions).toHaveLength(0);
      });
    });

    describe('extractFromSession()', () => {
      it('should extract decisions from all session messages', async () => {
        const sessionId = 'session_1';

        const messages: Message[] = [
          createMockMessage({ sessionId, content: 'How should we handle auth?' }),
          createMockMessage({ sessionId, content: "We decided to use JWT." }),
          createMockMessage({ sessionId, content: 'What about the database?' }),
          createMockMessage({ sessionId, content: "Let's go with PostgreSQL." })
        ];

        mockDb.all.mockResolvedValue(messages);

        const jwtDecision = createMockDecision({
          sessionId,
          description: 'Use JWT for authentication'
        });

        const pgDecision = createMockDecision({
          sessionId,
          description: 'Use PostgreSQL for database'
        });

        mockSummarizationProvider.extractDecisions
          .mockResolvedValueOnce([jwtDecision])
          .mockResolvedValueOnce([pgDecision]);

        const decisions = await decisionExtractor.extractFromSession(sessionId);

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.arrayContaining([sessionId])
        );
        expect(decisions).toHaveLength(2);
      });

      it('should handle empty session', async () => {
        mockDb.all.mockResolvedValue([]);

        const decisions = await decisionExtractor.extractFromSession('empty_session');

        expect(decisions).toHaveLength(0);
      });
    });
  });

  // ============================================================================
  // Decision Storage Tests
  // ============================================================================

  describe('Decision Storage', () => {
    const projectId = 'proj_123';

    it('should store decision in database', async () => {
      const decision = createMockDecision({
        description: 'Use JWT for authentication'
      });

      await decisionExtractor.storeDecision(projectId, decision);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([
          decision.id,
          decision.sessionId,
          decision.messageId,
          decision.type,
          decision.description
        ])
      );
    });

    it('should store decision as entity', async () => {
      const decision = createMockDecision({
        description: 'Use JWT for authentication'
      });

      await decisionExtractor.storeAsEntity(projectId, decision);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([
          expect.any(String), // entity id
          'decision',
          expect.stringMatching(/^Use JWT/), // truncated name
          `decision::${decision.id}`, // qualified name
          decision.description
        ])
      );
    });

    it('should truncate long descriptions for entity name', async () => {
      const longDescription = 'x'.repeat(100);
      const decision = createMockDecision({ description: longDescription });

      await decisionExtractor.storeAsEntity(projectId, decision);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringMatching(/^x{50}$/) // should be truncated to 50 chars
        ])
      );
    });

    it('should use qualified name format', async () => {
      const decision = createMockDecision();

      await decisionExtractor.storeAsEntity(projectId, decision);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          `decision::${decision.id}`
        ])
      );
    });
  });

  // ============================================================================
  // Entity Linking Tests
  // ============================================================================

  describe('Entity Linking', () => {
    it('should link decision to mentioned entities', async () => {
      const decision = createMockDecision({
        description: 'Use AuthService for handling login'
      });

      mockDb.all.mockResolvedValue([
        { id: 'entity_auth_service', name: 'AuthService' }
      ]);

      const linkedDecision = await decisionExtractor.linkRelatedEntities(decision);

      expect(linkedDecision.relatedEntities).toContain('entity_auth_service');
    });

    it('should detect code mentions in decision', async () => {
      const decision = createMockDecision({
        description: 'We will implement the login in AuthService.login()'
      });

      const mentions = await decisionExtractor.detectCodeMentions(decision.description);

      expect(mentions).toContain('AuthService');
      expect(mentions).toContain('login');
    });

    it('should link multiple entities', async () => {
      const decision = createMockDecision({
        description: 'Use AuthService and UserRepository together'
      });

      mockDb.all.mockResolvedValue([
        { id: 'entity_auth_service', name: 'AuthService' },
        { id: 'entity_user_repo', name: 'UserRepository' }
      ]);

      const linkedDecision = await decisionExtractor.linkRelatedEntities(decision);

      expect(linkedDecision.relatedEntities).toHaveLength(2);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle very long decision descriptions', async () => {
      const longDescription = 'We decided to ' + 'implement '.repeat(100);
      const message = createMockMessage({ content: longDescription });

      mockSummarizationProvider.extractDecisions.mockResolvedValue([
        createMockDecision({ description: longDescription })
      ]);

      const decisions = await decisionExtractor.extractFromMessage(message);

      expect(decisions[0].description.length).toBeGreaterThan(500);
    });

    it('should handle special characters in decision', async () => {
      const content = 'We decided to use `const` instead of `let` for constants';
      const message = createMockMessage({ content });

      mockSummarizationProvider.extractDecisions.mockResolvedValue([
        createMockDecision({ description: content })
      ]);

      const decisions = await decisionExtractor.extractFromMessage(message);

      expect(decisions[0].description).toContain('`const`');
    });

    it('should handle unicode in decision', async () => {
      const content = 'We decided to implement internationalization (i18n) support';
      const message = createMockMessage({ content });

      mockSummarizationProvider.extractDecisions.mockResolvedValue([
        createMockDecision({ description: content })
      ]);

      const decisions = await decisionExtractor.extractFromMessage(message);

      expect(decisions[0].description).toContain('internationalization');
    });

    it('should handle decision without alternatives mentioned', () => {
      const response = `DECISION: Use TypeScript for the project
CONTEXT: Team preference and better tooling`;

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(decisions[0].alternatives).toBeUndefined();
    });

    it('should handle malformed LLM response', () => {
      const response = 'This is not in the expected format at all.';

      const decisions = decisionExtractor.parseResponse(response, 'session_1', 'msg_1');

      expect(Array.isArray(decisions)).toBe(true);
    });

    it('should handle concurrent decision extraction', async () => {
      const messages = Array(5).fill(null).map((_, i) =>
        createMockMessage({
          id: `msg_${i}`,
          content: `We decided option ${i}`
        })
      );

      messages.forEach((_, i) => {
        mockSummarizationProvider.extractDecisions.mockResolvedValueOnce([
          createMockDecision({ description: `Option ${i}` })
        ]);
      });

      const operations = messages.map(msg => decisionExtractor.extractFromMessage(msg));

      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
      results.forEach((r: Decision[]) => expect(r).toHaveLength(1));
    });

    it('should handle database errors gracefully', async () => {
      const decision = createMockDecision();

      mockDb.run.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        decisionExtractor.storeDecision('proj_1', decision)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle LLM provider errors gracefully', async () => {
      const message = createMockMessage({
        content: "We decided to use PostgreSQL."
      });

      mockSummarizationProvider.extractDecisions.mockRejectedValue(
        new Error('LLM service unavailable')
      );

      await expect(
        decisionExtractor.extractFromMessage(message)
      ).rejects.toThrow('LLM service unavailable');
    });
  });

  // ============================================================================
  // Decision Quality Tests
  // ============================================================================

  describe('Decision Quality', () => {
    it('should extract actionable decisions', async () => {
      const messages = [
        createMockMessage({ content: 'We decided to use PostgreSQL for the database' }),
        createMockMessage({ content: 'We will implement JWT-based authentication' }),
        createMockMessage({ content: "Let's deploy using Docker containers" })
      ];

      const mockDecisions = messages.map((m) =>
        createMockDecision({ description: m.content })
      );

      messages.forEach((_, i) => {
        mockSummarizationProvider.extractDecisions.mockResolvedValueOnce([mockDecisions[i]]);
      });

      const allDecisions = await Promise.all(
        messages.map(m => decisionExtractor.extractFromMessage(m))
      );

      allDecisions.flat().forEach((d: Decision) => {
        expect(d.description.length).toBeGreaterThan(10);
      });
    });

    it('should distinguish decisions from questions', async () => {
      const questions = [
        createMockMessage({ content: 'Should we use PostgreSQL?' }),
        createMockMessage({ content: 'What database should we use?' }),
        createMockMessage({ content: 'Is JWT a good choice?' })
      ];

      const results = await Promise.all(
        questions.map(q => decisionExtractor.extractFromMessage(q))
      );

      results.forEach((r: Decision[]) => expect(r).toHaveLength(0));
      expect(mockSummarizationProvider.extractDecisions).not.toHaveBeenCalled();
    });

    it('should capture decision context when available', async () => {
      const message = createMockMessage({
        content: 'We decided to use PostgreSQL because we need ACID compliance and complex queries'
      });

      mockSummarizationProvider.extractDecisions.mockResolvedValue([
        createMockDecision({
          description: 'Use PostgreSQL',
          context: 'Need ACID compliance and complex queries'
        })
      ]);

      const decisions = await decisionExtractor.extractFromMessage(message);

      expect(decisions[0].context).toContain('ACID');
      expect(decisions[0].context?.length).toBeGreaterThan(10);
    });
  });

  // ============================================================================
  // Integration with Session Summarization
  // ============================================================================

  describe('Integration with Session Summarization', () => {
    it('should extract decisions during summarization', async () => {
      const sessionId = 'session_1';
      const sessionMessages: Message[] = [
        createMockMessage({ sessionId, content: 'What database should we use?' }),
        createMockMessage({ sessionId, content: "We decided to use PostgreSQL for ACID compliance." }),
        createMockMessage({ sessionId, content: 'What about caching?' }),
        createMockMessage({ sessionId, content: "Let's go with Redis for high performance." })
      ];

      mockDb.all.mockResolvedValue(sessionMessages);

      mockSummarizationProvider.extractDecisions
        .mockResolvedValueOnce([createMockDecision({ description: 'Use PostgreSQL' })])
        .mockResolvedValueOnce([createMockDecision({ description: 'Use Redis' })]);

      const decisions = await decisionExtractor.extractFromSession(sessionId);

      expect(decisions).toHaveLength(2);
    });

    it('should include decisions in summary metadata', async () => {
      const sessionId = 'session_1';

      mockDb.all.mockResolvedValue([
        createMockMessage({ sessionId, content: "We decided to use PostgreSQL." }),
        createMockMessage({ sessionId, content: "Let's go with Redis." })
      ]);

      mockSummarizationProvider.extractDecisions
        .mockResolvedValueOnce([createMockDecision({ description: 'Use PostgreSQL' })])
        .mockResolvedValueOnce([createMockDecision({ description: 'Use Redis' })]);

      const summaryMetadata = await decisionExtractor.getSessionDecisionSummary(sessionId);

      expect(summaryMetadata.decisions).toHaveLength(2);
      expect(summaryMetadata.decisionCount).toBe(2);
    });
  });

  // ============================================================================
  // Batch Operations Tests
  // ============================================================================

  describe('Batch Operations', () => {
    it('should extract decisions from multiple messages in batch', async () => {
      const messages = Array(10).fill(null).map((_, i) =>
        createMockMessage({
          id: `msg_${i}`,
          content: `We decided to implement feature ${i}`
        })
      );

      messages.forEach((_, i) => {
        mockSummarizationProvider.extractDecisions.mockResolvedValueOnce([
          createMockDecision({ description: `Implement feature ${i}` })
        ]);
      });

      const decisions = await decisionExtractor.extractFromMessages(messages);

      expect(decisions).toHaveLength(10);
    });

    it('should store multiple decisions in batch', async () => {
      const decisions = Array(5).fill(null).map((_, i) =>
        createMockDecision({ description: `Decision ${i}` })
      );

      await decisionExtractor.storeDecisions('proj_1', decisions);

      expect(mockDb.run).toHaveBeenCalledTimes(5);
    });
  });
});
