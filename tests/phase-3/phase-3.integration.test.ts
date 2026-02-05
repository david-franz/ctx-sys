/**
 * Phase 3 Integration Tests
 *
 * IMPORTANT: These tests will FAIL until the following implementations are created:
 * - src/session/SessionManager.ts
 * - src/storage/MessageStore.ts
 * - src/summarization/ConversationSummarizer.ts
 * - src/extraction/DecisionExtractor.ts
 * - src/memory/ConversationMemoryPipeline.ts
 * - src/mcp/tools/StoreMessageTool.ts
 * - src/mcp/tools/SummarizeSessionTool.ts
 * - src/mcp/tools/GetHistoryTool.ts
 *
 * Tests for how Phase 3 features interact with each other:
 * - Message Storage + Session Management
 * - Session + Conversation Summarization
 * - Summarization + Decision Extraction
 * - Full Conversation Memory Pipeline
 *
 * @see docs/IMPLEMENTATION.md Phase 3
 */

// ============================================================================
// Source Imports (these paths don't exist yet - tests will fail until implemented)
// ============================================================================

import { SessionManager } from '../../src/conversation/session-manager';
import { MessageStore } from '../../src/conversation/message-store';
import { ConversationSummarizer } from '../../src/summarization/conversation-summarizer';
import { DecisionExtractor } from '../../src/conversation/decision-extractor';
import { ConversationMemoryPipeline } from '../../src/conversation/memory-pipeline';
import { StoreMessageTool } from '../../src/mcp/tools/store-message-tool';
import { SummarizeSessionTool } from '../../src/mcp/tools/summarize-session-tool';
import { GetHistoryTool } from '../../src/mcp/tools/get-history-tool';
import { Database } from '../../src/db/database';
import { EmbeddingProvider } from '../../src/embeddings/provider';
import { SummarizationProvider } from '../../src/summarization/provider';

// ============================================================================
// Types (imported from source when available)
// ============================================================================

import type {
  Message,
  Session,
  Decision,
  ConversationSummary
} from '../../src/types';

// ============================================================================
// Mock External Dependencies Only
// ============================================================================

// Mock the database module (external dependency)
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: jest.fn(),
      all: jest.fn().mockReturnValue([]),
      bind: jest.fn()
    }),
    exec: jest.fn(),
    transaction: jest.fn((fn: Function) => fn),
    close: jest.fn()
  }));
});

// Mock embedding provider (external AI service)
const mockEmbeddingProvider: jest.Mocked<EmbeddingProvider> = {
  embed: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  embedBatch: jest.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
  getDimensions: jest.fn().mockReturnValue(1536)
};

// Mock summarization provider (external AI service)
const mockSummarizationProvider: jest.Mocked<SummarizationProvider> = {
  summarize: jest.fn().mockResolvedValue('Generated summary of the conversation.'),
  summarizeWithStructure: jest.fn().mockResolvedValue({
    overview: 'Discussion overview',
    topics: ['topic1', 'topic2'],
    decisions: ['decision1'],
    codeReferences: [],
    keyPoints: ['key point 1']
  })
};

describe('Phase 3 Integration', () => {
  // Real instances of our classes
  let database: Database;
  let sessionManager: SessionManager;
  let messageStore: MessageStore;
  let summarizer: ConversationSummarizer;
  let decisionExtractor: DecisionExtractor;
  let memoryPipeline: ConversationMemoryPipeline;

  const projectId = 'proj_test_123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create real instances with mocked external dependencies
    database = new Database(':memory:');
    sessionManager = new SessionManager(database, projectId);
    messageStore = new MessageStore(database, projectId, mockEmbeddingProvider);
    summarizer = new ConversationSummarizer(mockSummarizationProvider);
    decisionExtractor = new DecisionExtractor();
    memoryPipeline = new ConversationMemoryPipeline(
      sessionManager,
      messageStore,
      summarizer,
      decisionExtractor,
      mockEmbeddingProvider
    );
  });

  afterEach(() => {
    database.close();
  });

  // ============================================================================
  // Message Storage + Session Management Integration
  // ============================================================================

  describe('Message Storage + Session Management', () => {
    it('should create message and update session message count', async () => {
      // Create a session
      const session = await sessionManager.createSession();

      // Store a message
      const message = await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Help with authentication'
      });

      // Verify session message count updated
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession.messageCount).toBe(1);
      expect(message.sessionId).toBe(session.id);
    });

    it('should create session when storing first message if none exists', async () => {
      // Store message without explicit session
      const message = await messageStore.storeMessage({
        role: 'user',
        content: 'First message'
      });

      // Should have created a session automatically
      expect(message.sessionId).toBeDefined();
      const session = await sessionManager.getSession(message.sessionId);
      expect(session).toBeDefined();
      expect(session.status).toBe('active');
    });

    it('should retrieve messages for session in chronological order', async () => {
      const session = await sessionManager.createSession();

      // Store multiple messages
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'First question'
      });
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'First answer'
      });
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Second question'
      });

      // Retrieve and verify order
      const messages = await messageStore.getMessages(session.id);
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('First question');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });

    it('should delete messages when session is deleted', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Message to delete'
      });

      // Delete session (should cascade to messages)
      await sessionManager.deleteSession(session.id);

      // Verify messages are gone
      const messages = await messageStore.getMessages(session.id);
      expect(messages).toHaveLength(0);
    });

    it('should update session timestamp when message added', async () => {
      const session = await sessionManager.createSession();
      const originalUpdatedAt = session.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'New message'
      });

      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  // ============================================================================
  // Session + Conversation Summarization Integration
  // ============================================================================

  describe('Session + Conversation Summarization', () => {
    it('should summarize session and update status', async () => {
      const session = await sessionManager.createSession();

      // Add some messages
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Help with authentication implementation'
      });
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'I recommend using JWT tokens for authentication.'
      });

      // Get messages and summarize
      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);

      // Update session with summary
      await sessionManager.updateSession(session.id, {
        status: 'summarized',
        summary: summary.overview
      });

      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession.status).toBe('summarized');
      expect(updatedSession.summary).toBeDefined();
      expect(mockSummarizationProvider.summarizeWithStructure).toHaveBeenCalled();
    });

    it('should create entity for summarized session', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Database design question'
      });

      // Summarize and create entity
      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);

      const entity = await sessionManager.createSessionEntity(session.id, summary);

      expect(entity.type).toBe('session');
      expect(entity.qualifiedName).toContain(session.id);
    });

    it('should generate embedding for summarized session', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Question about API design'
      });

      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);

      // Generate embedding for the summary
      await memoryPipeline.indexSessionSummary(session.id, summary);

      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith(
        expect.stringContaining(summary.overview)
      );
    });

    it('should archive session before summarization', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Some conversation'
      });

      // Archive first
      await sessionManager.archiveSession(session.id);
      let updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession.status).toBe('archived');

      // Then summarize
      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);
      await sessionManager.updateSession(session.id, {
        status: 'summarized',
        summary: summary.overview
      });

      updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession.status).toBe('summarized');
    });

    it('should handle empty session summarization', async () => {
      const session = await sessionManager.createSession();

      // No messages added
      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);

      expect(summary.overview).toBeDefined();
      expect(summary.topics).toEqual([]);
      expect(summary.decisions).toEqual([]);
    });
  });

  // ============================================================================
  // Summarization + Decision Extraction Integration
  // ============================================================================

  describe('Summarization + Decision Extraction', () => {
    it('should extract decisions during summarization', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'What database should we use?'
      });
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'Based on your requirements, I recommend PostgreSQL for its ACID compliance.'
      });
      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: 'We decided to use PostgreSQL for the production database.'
      });

      const messages = await messageStore.getMessages(session.id);
      const decisions = await decisionExtractor.extractDecisions(messages);

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].description).toContain('PostgreSQL');
    });

    it('should include decisions in summary metadata', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: "Let's use TypeScript for the project"
      });

      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);

      // Summary should contain decisions array
      expect(summary.decisions).toBeDefined();
      expect(Array.isArray(summary.decisions)).toBe(true);
    });

    it('should store decisions as separate entities', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: "We'll implement caching using Redis"
      });

      const messages = await messageStore.getMessages(session.id);
      const decisions = await decisionExtractor.extractDecisions(messages);

      // Store each decision as an entity
      for (const decision of decisions) {
        const entity = await decisionExtractor.createDecisionEntity(decision);
        expect(entity.type).toBe('decision');
        expect(entity.content).toContain(decision.description);
      }
    });

    it('should link decisions to session summary', async () => {
      const session = await sessionManager.createSession();

      await messageStore.storeMessage({
        sessionId: session.id,
        role: 'user',
        content: "We agreed to use microservices architecture"
      });

      const messages = await messageStore.getMessages(session.id);
      const summary = await summarizer.summarize(messages);
      const decisions = await decisionExtractor.extractDecisions(messages);

      // Create relationships between session entity and decision entities
      const sessionEntity = await sessionManager.createSessionEntity(session.id, summary);

      for (const decision of decisions) {
        const decisionEntity = await decisionExtractor.createDecisionEntity(decision);
        await memoryPipeline.linkDecisionToSession(sessionEntity.id, decisionEntity.id);
      }

      // Verify relationships exist
      const linkedDecisions = await memoryPipeline.getSessionDecisions(session.id);
      expect(linkedDecisions.length).toBe(decisions.length);
    });
  });

  // ============================================================================
  // Full Conversation Memory Pipeline Integration
  // ============================================================================

  describe('Full Conversation Memory Pipeline', () => {
    it('should handle complete conversation flow', async () => {
      // 1. Start new session
      const session = await memoryPipeline.startSession();
      expect(session.status).toBe('active');

      // 2. Store messages through pipeline
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Help me implement authentication'
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'I recommend using JWT tokens. Here is an example...'
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: "We'll use JWT for authentication going forward."
      });

      // 3. Verify embeddings were generated
      expect(mockEmbeddingProvider.embed).toHaveBeenCalledTimes(3);

      // 4. Finalize session (archive + summarize + extract decisions)
      const result = await memoryPipeline.finalizeSession(session.id);

      expect(result.session.status).toBe('summarized');
      expect(result.summary).toBeDefined();
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(result.sessionEntity).toBeDefined();
    });

    it('should search across conversation history', async () => {
      // Create multiple sessions with messages
      const session1 = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session1.id,
        role: 'user',
        content: 'JWT authentication implementation'
      });
      await memoryPipeline.finalizeSession(session1.id);

      const session2 = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session2.id,
        role: 'user',
        content: 'OAuth authentication setup'
      });
      await memoryPipeline.finalizeSession(session2.id);

      // Search for authentication-related content
      const searchResults = await memoryPipeline.searchHistory('authentication');

      expect(searchResults.messages.length).toBeGreaterThan(0);
      expect(searchResults.sessions.length).toBeGreaterThan(0);
    });

    it('should retrieve related decisions for query', async () => {
      const session = await memoryPipeline.startSession();

      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: "We decided to use PostgreSQL for the database"
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: "We'll implement caching with Redis"
      });

      await memoryPipeline.finalizeSession(session.id);

      // Search for database-related decisions
      const decisions = await memoryPipeline.searchDecisions('database');

      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions[0].description).toContain('PostgreSQL');
    });

    it('should handle session cleanup with retention policy', async () => {
      // Create old sessions
      const oldSession = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: oldSession.id,
        role: 'user',
        content: 'Old conversation'
      });
      await memoryPipeline.finalizeSession(oldSession.id);

      // Run cleanup with retention policy (30 days)
      const retentionDays = 30;
      const deletedCount = await memoryPipeline.cleanupOldSessions(retentionDays);

      // Verify cleanup was attempted
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // MCP Tools Integration
  // ============================================================================

  describe('MCP Tools Integration', () => {
    let storeMessageTool: StoreMessageTool;
    let summarizeSessionTool: SummarizeSessionTool;
    let getHistoryTool: GetHistoryTool;

    beforeEach(() => {
      storeMessageTool = new StoreMessageTool(memoryPipeline);
      summarizeSessionTool = new SummarizeSessionTool(memoryPipeline);
      getHistoryTool = new GetHistoryTool(memoryPipeline);
    });

    it('should handle store_message tool flow', async () => {
      const result = await storeMessageTool.execute({
        content: 'Help with authentication',
        role: 'user'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith('Help with authentication');
    });

    it('should handle store_message with explicit session', async () => {
      const session = await memoryPipeline.startSession();

      const result = await storeMessageTool.execute({
        content: 'Follow-up question',
        role: 'user',
        session: session.id
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(session.id);
    });

    it('should handle summarize_session tool flow', async () => {
      const session = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Question about databases'
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'Here is information about databases...'
      });

      const result = await summarizeSessionTool.execute({
        session: session.id
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.decisions).toBeDefined();
      expect(mockSummarizationProvider.summarizeWithStructure).toHaveBeenCalled();
    });

    it('should handle get_history tool with filters', async () => {
      const session = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'User question 1'
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'Assistant answer 1'
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'User question 2'
      });

      const result = await getHistoryTool.execute({
        session: session.id,
        limit: 10,
        role: 'user'
      });

      expect(result.success).toBe(true);
      expect(result.messages.length).toBe(2);
      expect(result.messages.every((m: Message) => m.role === 'user')).toBe(true);
    });

    it('should handle get_history tool with pagination', async () => {
      const session = await memoryPipeline.startSession();

      // Add many messages
      for (let i = 0; i < 25; i++) {
        await memoryPipeline.addMessage({
          sessionId: session.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`
        });
      }

      const firstPage = await getHistoryTool.execute({
        session: session.id,
        limit: 10,
        offset: 0
      });

      const secondPage = await getHistoryTool.execute({
        session: session.id,
        limit: 10,
        offset: 10
      });

      expect(firstPage.messages.length).toBe(10);
      expect(secondPage.messages.length).toBe(10);
      expect(firstPage.messages[0].content).not.toBe(secondPage.messages[0].content);
    });
  });

  // ============================================================================
  // Error Recovery and Edge Cases
  // ============================================================================

  describe('Error Recovery', () => {
    it('should handle summarization failure gracefully', async () => {
      mockSummarizationProvider.summarizeWithStructure.mockRejectedValueOnce(
        new Error('Provider unavailable')
      );

      const session = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Test message'
      });

      // Should archive session even if summarization fails
      const result = await memoryPipeline.finalizeSession(session.id);

      expect(result.session.status).toBe('archived');
      expect(result.summary).toBeNull();
      expect(result.error).toContain('summarization failed');
    });

    it('should handle embedding generation failure', async () => {
      mockEmbeddingProvider.embed.mockRejectedValueOnce(
        new Error('Embedding service down')
      );

      const session = await memoryPipeline.startSession();

      // Message should still be stored even if embedding fails
      const result = await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Message without embedding'
      });

      expect(result.message).toBeDefined();
      expect(result.embeddingGenerated).toBe(false);
    });

    it('should handle database errors during message insertion', async () => {
      // Simulate database error
      const dbError = new Error('SQLITE_BUSY: database is locked');
      jest.spyOn(messageStore, 'storeMessage').mockRejectedValueOnce(dbError);

      const session = await memoryPipeline.startSession();

      await expect(
        memoryPipeline.addMessage({
          sessionId: session.id,
          role: 'user',
          content: 'Test message'
        })
      ).rejects.toThrow('SQLITE_BUSY');
    });

    it('should handle concurrent message additions', async () => {
      const session = await memoryPipeline.startSession();

      // Add 10 messages concurrently
      const promises = Array(10).fill(null).map((_, i) =>
        memoryPipeline.addMessage({
          sessionId: session.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Concurrent message ${i}`
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.message).toBeDefined();
      });

      // Verify all messages were stored
      const messages = await messageStore.getMessages(session.id);
      expect(messages).toHaveLength(10);
    });

    it('should maintain message count consistency after errors', async () => {
      const session = await memoryPipeline.startSession();

      // Add some messages successfully
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'user',
        content: 'Message 1'
      });
      await memoryPipeline.addMessage({
        sessionId: session.id,
        role: 'assistant',
        content: 'Message 2'
      });

      // Simulate a failure on the third message
      jest.spyOn(messageStore, 'storeMessage').mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      try {
        await memoryPipeline.addMessage({
          sessionId: session.id,
          role: 'user',
          content: 'Message 3'
        });
      } catch {
        // Expected to fail
      }

      // Verify message count is still correct
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession.messageCount).toBe(2);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should batch message insertions efficiently', async () => {
      const session = await memoryPipeline.startSession();
      const messages = Array(50).fill(null).map((_, i) => ({
        sessionId: session.id,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Batch message ${i}`
      }));

      const startTime = Date.now();
      await memoryPipeline.addMessagesBatch(messages);
      const elapsed = Date.now() - startTime;

      // Should complete in reasonable time (adjust threshold as needed)
      expect(elapsed).toBeLessThan(5000);

      const storedMessages = await messageStore.getMessages(session.id);
      expect(storedMessages).toHaveLength(50);
    });

    it('should use indexed queries for message retrieval', async () => {
      const session = await memoryPipeline.startSession();

      // Add messages
      for (let i = 0; i < 20; i++) {
        await memoryPipeline.addMessage({
          sessionId: session.id,
          role: 'user',
          content: `Message ${i}`
        });
      }

      const startTime = Date.now();
      const messages = await messageStore.getMessages(session.id);
      const elapsed = Date.now() - startTime;

      // Indexed query should be fast
      expect(elapsed).toBeLessThan(100);
      expect(messages).toHaveLength(20);
    });

    it('should limit transcript size for summarization', async () => {
      const session = await memoryPipeline.startSession();

      // Add many long messages
      for (let i = 0; i < 100; i++) {
        await memoryPipeline.addMessage({
          sessionId: session.id,
          role: 'user',
          content: 'A'.repeat(500) // Long content
        });
      }

      // Summarizer should truncate to max length
      const messages = await messageStore.getMessages(session.id);
      const transcript = summarizer.buildTranscript(messages);

      expect(transcript.length).toBeLessThanOrEqual(summarizer.maxTranscriptLength);
    });

    it('should paginate message history efficiently', async () => {
      const session = await memoryPipeline.startSession();

      // Add many messages
      for (let i = 0; i < 200; i++) {
        await memoryPipeline.addMessage({
          sessionId: session.id,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`
        });
      }

      // Paginated retrieval
      const page1 = await messageStore.getMessages(session.id, { limit: 50, offset: 0 });
      const page2 = await messageStore.getMessages(session.id, { limit: 50, offset: 50 });
      const page3 = await messageStore.getMessages(session.id, { limit: 50, offset: 100 });

      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(50);
      expect(page3).toHaveLength(50);

      // Verify pages don't overlap
      const page1Ids = new Set(page1.map((m: Message) => m.id));
      const page2Ids = new Set(page2.map((m: Message) => m.id));
      expect([...page1Ids].filter(id => page2Ids.has(id))).toHaveLength(0);
    });
  });

  // ============================================================================
  // Multi-Session Tests
  // ============================================================================

  describe('Multi-Session', () => {
    it('should isolate messages between sessions', async () => {
      const session1 = await memoryPipeline.startSession();
      const session2 = await memoryPipeline.startSession();

      await memoryPipeline.addMessage({
        sessionId: session1.id,
        role: 'user',
        content: 'Session 1 message'
      });
      await memoryPipeline.addMessage({
        sessionId: session2.id,
        role: 'user',
        content: 'Session 2 message'
      });

      const session1Messages = await messageStore.getMessages(session1.id);
      const session2Messages = await messageStore.getMessages(session2.id);

      expect(session1Messages).toHaveLength(1);
      expect(session2Messages).toHaveLength(1);
      expect(session1Messages[0].content).toBe('Session 1 message');
      expect(session2Messages[0].content).toBe('Session 2 message');
    });

    it('should track multiple active sessions', async () => {
      const sessions = await Promise.all([
        memoryPipeline.startSession(),
        memoryPipeline.startSession(),
        memoryPipeline.startSession()
      ]);

      const activeSessions = await sessionManager.getActiveSessions();

      expect(activeSessions.length).toBeGreaterThanOrEqual(3);
      sessions.forEach(session => {
        expect(activeSessions.find(s => s.id === session.id)).toBeDefined();
      });
    });

    it('should search across all sessions', async () => {
      const session1 = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session1.id,
        role: 'user',
        content: 'JWT authentication'
      });
      await memoryPipeline.finalizeSession(session1.id);

      const session2 = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session2.id,
        role: 'user',
        content: 'OAuth authentication'
      });
      await memoryPipeline.finalizeSession(session2.id);

      const results = await memoryPipeline.searchHistory('authentication');

      expect(results.messages.length).toBe(2);
      const sessionIds = results.messages.map((m: Message) => m.sessionId);
      expect(sessionIds).toContain(session1.id);
      expect(sessionIds).toContain(session2.id);
    });

    it('should get most recent session automatically', async () => {
      await memoryPipeline.startSession();
      await new Promise(resolve => setTimeout(resolve, 10));
      const latestSession = await memoryPipeline.startSession();

      const currentSession = await sessionManager.getCurrentSession();

      expect(currentSession.id).toBe(latestSession.id);
    });

    it('should archive inactive sessions', async () => {
      const session1 = await memoryPipeline.startSession();
      await memoryPipeline.addMessage({
        sessionId: session1.id,
        role: 'user',
        content: 'Old session'
      });

      // Simulate session becoming inactive
      await sessionManager.archiveSession(session1.id);

      // Start new session
      const session2 = await memoryPipeline.startSession();

      const activeSessions = await sessionManager.getActiveSessions();
      const activeIds = activeSessions.map(s => s.id);

      expect(activeIds).not.toContain(session1.id);
      expect(activeIds).toContain(session2.id);
    });
  });
});
