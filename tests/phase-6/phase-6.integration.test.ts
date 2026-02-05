/**
 * Phase 6 Integration Tests
 *
 * IMPORTANT: This test file will fail with "Cannot find module" errors until
 * the actual implementations are created. This is intentional - the tests
 * define the expected behavior and will pass once implementations exist.
 *
 * Required source files to implement:
 * - src/retrieval/parser.ts           - QueryParser class
 * - src/retrieval/search.ts           - MultiStrategySearch class
 * - src/retrieval/assembler.ts        - ContextAssembler class
 * - src/retrieval/feedback.ts         - RelevanceFeedbackManager class
 * - src/database/connection.ts        - DatabaseConnection class
 * - src/embeddings/provider.ts        - EmbeddingProvider class
 *
 * Tests for feature interactions within Phase 6 - Smart Retrieval:
 * - Query Parsing + Multi-Strategy Search
 * - Search + Context Assembly
 * - Context Assembly + Relevance Feedback
 * - Full retrieval pipeline
 *
 * @see docs/phase-6/
 */

// Import actual implementations (these will fail until created)
import { QueryParser } from '../../src/retrieval/parser';
import { MultiStrategySearch } from '../../src/retrieval/search';
import { ContextAssembler } from '../../src/retrieval/assembler';
import { RelevanceFeedbackManager } from '../../src/retrieval/feedback';
import { DatabaseConnection } from '../../src/db/connection';
import { EmbeddingProvider } from '../../src/embeddings/provider';

// Only keep createMockDatabase for mock setup
import { createMockDatabase } from '../helpers/mocks';

// Mock the database module
jest.mock('../../src/db/connection');
jest.mock('../../src/embeddings/provider');

// ============================================================================
// Shared Interfaces
// ============================================================================

type QueryIntent = 'find' | 'explain' | 'debug' | 'refactor' | 'implement' | 'general';
type FeedbackType = 'used' | 'ignored' | 'explicit_positive' | 'explicit_negative';

interface ParsedQuery {
  original: string;
  intent: QueryIntent;
  keywords: string[];
  entityMentions: Array<{ text: string; type: string }>;
  filters: { types?: string[]; files?: string[]; limit?: number };
  expanded?: string[];
}

interface SearchResult {
  entityId: string;
  score: number;
  source: 'vector' | 'graph' | 'fts';
  entity: {
    id: string;
    name: string;
    type: string;
    content?: string;
    summary?: string;
    filePath?: string;
    startLine?: number;
  };
}

interface AssembledContext {
  context: string;
  sources: Array<{
    entityId: string;
    name: string;
    type: string;
    file?: string;
    relevance: number;
  }>;
  tokenCount: number;
  truncated: boolean;
}

interface FeedbackStats {
  entityId: string;
  totalReturns: number;
  usedCount: number;
  ignoredCount: number;
  positiveCount: number;
  negativeCount: number;
  useRate: number;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Phase 6 Integration Tests', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;
  let dbConnection: jest.Mocked<DatabaseConnection>;
  let embeddingProvider: jest.Mocked<EmbeddingProvider>;
  let queryParser: QueryParser;
  let multiStrategySearch: MultiStrategySearch;
  let contextAssembler: ContextAssembler;
  let feedbackManager: RelevanceFeedbackManager;
  const projectId = 'proj_integration';

  beforeEach(() => {
    // Create mock database for simulating query responses
    mockDb = createMockDatabase();
    jest.clearAllMocks();

    // Setup mocked DatabaseConnection
    dbConnection = new DatabaseConnection() as jest.Mocked<DatabaseConnection>;
    dbConnection.query = jest.fn();
    dbConnection.execute = jest.fn();
    dbConnection.transaction = jest.fn();

    // Setup mocked EmbeddingProvider
    embeddingProvider = new EmbeddingProvider() as jest.Mocked<EmbeddingProvider>;
    embeddingProvider.embed = jest.fn().mockResolvedValue(new Array(1536).fill(0));
    embeddingProvider.embedBatch = jest.fn().mockResolvedValue([]);

    // Create real instances with mocked dependencies
    queryParser = new QueryParser();
    multiStrategySearch = new MultiStrategySearch(dbConnection, embeddingProvider);
    contextAssembler = new ContextAssembler({ maxTokens: 4000 });
    feedbackManager = new RelevanceFeedbackManager(dbConnection);
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // Query Parsing + Multi-Strategy Search Integration
  // ============================================================================

  describe('Query Parsing + Multi-Strategy Search', () => {
    it('should select strategies based on query intent', async () => {
      const findQuery = queryParser.parse('Where is the login function?');
      const explainQuery = queryParser.parse('How does authentication work?');
      const debugQuery = queryParser.parse('Why is there an error in the API?');

      expect(findQuery.intent).toBe('find');
      expect(explainQuery.intent).toBe('explain');
      expect(debugQuery.intent).toBe('debug');

      const findStrategies = multiStrategySearch.selectStrategies(findQuery.intent);
      const explainStrategies = multiStrategySearch.selectStrategies(explainQuery.intent);
      const debugStrategies = multiStrategySearch.selectStrategies(debugQuery.intent);

      expect(findStrategies).toContain('fts');
      expect(explainStrategies).toContain('graph');
      expect(debugStrategies).toHaveLength(3);
    });

    it('should use keywords for FTS search', async () => {
      const query = queryParser.parse('Find authentication service');

      expect(query.keywords).toContain('authentication');
      expect(query.keywords).toContain('service');

      // Mock FTS search results
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', name: 'AuthService', rank: -10 },
        { entity_id: 'e2', name: 'authenticate', rank: -8 }
      ]);

      const results = await multiStrategySearch.searchFts(projectId, query.keywords);

      expect(dbConnection.query).toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });

    it('should use entity mentions for direct lookup', async () => {
      const query = queryParser.parse('Where is `getUserById()` defined?');

      expect(query.entityMentions).toHaveLength(1);
      expect(query.entityMentions[0].text).toBe('getUserById');
      expect(query.entityMentions[0].type).toBe('function');

      // Mock direct lookup results
      dbConnection.query.mockResolvedValueOnce([
        { id: 'e1', name: 'getUserById', type: 'function', file_path: 'src/user.ts' }
      ]);

      const results = await multiStrategySearch.lookupByName(
        projectId,
        query.entityMentions[0].text
      );

      expect(dbConnection.query).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should apply filters to search', async () => {
      const query = queryParser.parse('Find functions type:function limit:5');

      expect(query.filters.types).toContain('function');
      expect(query.filters.limit).toBe(5);

      // Mock filtered search results
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', type: 'function' },
        { entity_id: 'e2', type: 'function' }
      ]);

      const results = await multiStrategySearch.search(projectId, query, {
        filters: query.filters
      });

      expect(dbConnection.query).toHaveBeenCalled();
      expect(results.every((r: SearchResult) => r.entity.type === 'function')).toBe(true);
    });

    it('should combine parsing with multi-strategy execution', async () => {
      const query = queryParser.parse('How does the AuthService class work?');
      const strategies = multiStrategySearch.selectStrategies(query.intent);

      expect(strategies).toContain('graph'); // explain intent uses graph

      // Mock combined search results
      dbConnection.query
        .mockResolvedValueOnce([
          { entity_id: 'e1', distance: 0.1, source: 'vector' }
        ])
        .mockResolvedValueOnce([
          { entity_id: 'e2', depth: 1, source: 'graph' }
        ]);

      embeddingProvider.embed.mockResolvedValueOnce(new Array(1536).fill(0.1));

      const results = await multiStrategySearch.search(projectId, query);

      expect(results.length).toBeGreaterThan(0);
      expect(embeddingProvider.embed).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Multi-Strategy Search + Context Assembly Integration
  // ============================================================================

  describe('Search + Context Assembly', () => {
    it('should assemble context from search results', async () => {
      const searchResults: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.95,
          source: 'vector',
          entity: {
            id: 'e1',
            name: 'AuthService',
            type: 'class',
            summary: 'Handles user authentication',
            filePath: 'src/auth/service.ts'
          }
        },
        {
          entityId: 'e2',
          score: 0.85,
          source: 'fts',
          entity: {
            id: 'e2',
            name: 'login',
            type: 'function',
            summary: 'Performs login with credentials'
          }
        }
      ];

      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 500 });

      expect(assembled.context).toContain('AuthService');
      expect(assembled.context).toContain('login');
      expect(assembled.sources).toHaveLength(2);
      expect(assembled.sources[0].relevance).toBeGreaterThan(assembled.sources[1].relevance);
    });

    it('should respect token budget', async () => {
      const searchResults: SearchResult[] = Array(50).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: 0.9 - i * 0.01,
        source: 'vector' as const,
        entity: {
          id: `e${i}`,
          name: `Entity${i}`,
          type: 'function',
          summary: 'A function that does something important in the system'
        }
      }));

      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 200 });

      expect(assembled.tokenCount).toBeLessThanOrEqual(200);
      expect(assembled.truncated).toBe(true);
      expect(assembled.sources.length).toBeLessThan(50);
    });

    it('should prioritize high-scoring results', async () => {
      const searchResults: SearchResult[] = [
        { entityId: 'e1', score: 0.5, source: 'fts', entity: { id: 'e1', name: 'Low', type: 'function' } },
        { entityId: 'e2', score: 0.9, source: 'vector', entity: { id: 'e2', name: 'High', type: 'function' } },
        { entityId: 'e3', score: 0.7, source: 'graph', entity: { id: 'e3', name: 'Medium', type: 'function' } }
      ];

      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 100 });

      // First source should be the highest scoring
      expect(assembled.sources[0].name).toBe('High');
    });

    it('should track source attribution', async () => {
      const searchResults: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          source: 'vector',
          entity: {
            id: 'e1',
            name: 'AuthService',
            type: 'class',
            filePath: 'src/auth/service.ts',
            startLine: 10
          }
        }
      ];

      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 500 });

      expect(assembled.sources[0].entityId).toBe('e1');
      expect(assembled.sources[0].file).toBe('src/auth/service.ts');
      expect(assembled.sources[0].relevance).toBe(0.9);
    });
  });

  // ============================================================================
  // Context Assembly + Relevance Feedback Integration
  // ============================================================================

  describe('Context Assembly + Relevance Feedback', () => {
    it('should detect which context was used in response', async () => {
      const sources = [
        { entityId: 'e1', name: 'AuthService' },
        { entityId: 'e2', name: 'UserService' },
        { entityId: 'e3', name: 'DatabaseConnection' }
      ];

      const response = 'The AuthService class handles authentication. It validates user credentials and manages sessions.';

      const feedback = feedbackManager.detectUsage(sources, response);

      expect(feedback.find((f: { entityId: string; signal: string }) => f.entityId === 'e1')?.signal).toBe('used');
      expect(feedback.find((f: { entityId: string; signal: string }) => f.entityId === 'e2')?.signal).toBe('ignored');
      expect(feedback.find((f: { entityId: string; signal: string }) => f.entityId === 'e3')?.signal).toBe('ignored');
    });

    it('should record feedback for assembled context', async () => {
      const assembled: AssembledContext = {
        context: '### AuthService\n*class*\nHandles authentication',
        sources: [
          { entityId: 'e1', name: 'AuthService', type: 'class', relevance: 0.9 },
          { entityId: 'e2', name: 'login', type: 'function', relevance: 0.8 }
        ],
        tokenCount: 50,
        truncated: false
      };

      const response = 'The AuthService handles user authentication.';
      const feedback = feedbackManager.detectUsage(assembled.sources, response);

      // Mock database insert
      dbConnection.execute.mockResolvedValue({ changes: 1 });

      await feedbackManager.recordFeedback('q1', feedback);

      expect(dbConnection.execute).toHaveBeenCalled();
      expect(feedback).toHaveLength(2);
    });

    it('should adjust search scores based on feedback history', async () => {
      const searchResults: SearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector', entity: { id: 'e1', name: 'Often Ignored', type: 'function' } },
        { entityId: 'e2', score: 0.8, source: 'vector', entity: { id: 'e2', name: 'Often Used', type: 'function' } }
      ];

      // Mock feedback stats retrieval
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', total_returns: 100, used_count: 10, ignored_count: 90, positive_count: 0, negative_count: 0 },
        { entity_id: 'e2', total_returns: 100, used_count: 90, ignored_count: 10, positive_count: 0, negative_count: 0 }
      ]);

      const adjusted = await feedbackManager.adjustScores(searchResults);

      // e2 should now be first despite lower original score
      expect(adjusted[0].entityId).toBe('e2');
      expect(dbConnection.query).toHaveBeenCalled();
    });

    it('should improve retrieval quality over time', async () => {
      // Round 1: Initial retrieval
      const initialResults: SearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector', entity: { id: 'e1', name: 'Entity1', type: 'function' } },
        { entityId: 'e2', score: 0.8, source: 'vector', entity: { id: 'e2', name: 'Entity2', type: 'function' } }
      ];

      // Simulate feedback accumulation - e2 is consistently more useful
      dbConnection.execute.mockResolvedValue({ changes: 1 });

      for (let i = 0; i < 10; i++) {
        await feedbackManager.recordFeedback(`q${i}`, [
          { entityId: 'e1', signal: 'ignored' },
          { entityId: 'e2', signal: 'used' }
        ]);
      }

      // Mock accumulated stats
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', total_returns: 10, used_count: 0, ignored_count: 10, positive_count: 0, negative_count: 0 },
        { entity_id: 'e2', total_returns: 10, used_count: 10, ignored_count: 0, positive_count: 0, negative_count: 0 }
      ]);

      // Round 2: Adjusted retrieval
      const adjusted = await feedbackManager.adjustScores(initialResults);

      // e2 should now rank higher
      expect(adjusted[0].entityId).toBe('e2');
    });
  });

  // ============================================================================
  // Full Retrieval Pipeline Integration
  // ============================================================================

  describe('Full Retrieval Pipeline', () => {
    it('should process query through complete pipeline', async () => {
      // Step 1: Parse query
      const query = 'How does the authentication flow work?';
      const parsed = queryParser.parse(query);

      expect(parsed.intent).toBe('explain');

      // Step 2: Execute multi-strategy search
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', name: 'AuthService', type: 'class', score: 0.9, summary: 'Summary for AuthService' },
        { entity_id: 'e2', name: 'login', type: 'function', score: 0.85, summary: 'Summary for login' },
        { entity_id: 'e3', name: 'validateToken', type: 'function', score: 0.8, summary: 'Summary for validateToken' }
      ]);

      embeddingProvider.embed.mockResolvedValueOnce(new Array(1536).fill(0.1));

      const searchResults = await multiStrategySearch.search(projectId, parsed);

      expect(searchResults).toHaveLength(3);

      // Step 3: Assemble context
      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 1000 });

      expect(assembled.context).toContain('AuthService');
      expect(assembled.sources).toHaveLength(3);

      // Step 4: Simulate LLM response
      const llmResponse = 'The AuthService handles the authentication flow by first validating credentials through the login function.';

      // Step 5: Record feedback
      const feedback = feedbackManager.detectUsage(assembled.sources, llmResponse);

      expect(feedback.filter((f: { signal: string }) => f.signal === 'used')).toHaveLength(2); // AuthService and login
      expect(feedback.filter((f: { signal: string }) => f.signal === 'ignored')).toHaveLength(1); // validateToken

      // Verify feedback is recorded
      dbConnection.execute.mockResolvedValue({ changes: 1 });
      await feedbackManager.recordFeedback('q1', feedback);
      expect(dbConnection.execute).toHaveBeenCalled();
    });

    it('should handle empty search results gracefully', async () => {
      dbConnection.query.mockResolvedValueOnce([]);
      embeddingProvider.embed.mockResolvedValueOnce(new Array(1536).fill(0));

      const parsed = queryParser.parse('Something that does not exist');
      const searchResults = await multiStrategySearch.search(projectId, parsed);

      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 500 });

      expect(assembled.context).toBe('');
      expect(assembled.sources).toHaveLength(0);
    });

    it('should handle very restrictive token budget', async () => {
      const searchResults: SearchResult[] = Array(10).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: 0.9 - i * 0.05,
        source: 'vector' as const,
        entity: { id: `e${i}`, name: `Entity${i}`, type: 'function', summary: 'A longer description that takes more tokens' }
      }));

      // Very small token budget - should only fit a few entities
      const assembled = contextAssembler.assemble(searchResults, { maxTokens: 30 });

      expect(assembled.tokenCount).toBeLessThanOrEqual(30);
      expect(assembled.sources.length).toBeLessThan(10);
    });

    it('should apply feedback-based re-ranking', async () => {
      // Initial search results
      const results: SearchResult[] = [
        { entityId: 'e1', score: 0.95, source: 'vector', entity: { id: 'e1', name: 'OftenIgnored', type: 'function' } },
        { entityId: 'e2', score: 0.90, source: 'vector', entity: { id: 'e2', name: 'AlwaysUsed', type: 'function' } },
        { entityId: 'e3', score: 0.85, source: 'vector', entity: { id: 'e3', name: 'NewEntity', type: 'function' } }
      ];

      // Mock feedback history stats
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', total_returns: 50, used_count: 5, ignored_count: 45, positive_count: 0, negative_count: 2 },
        { entity_id: 'e2', total_returns: 50, used_count: 48, ignored_count: 2, positive_count: 3, negative_count: 0 }
        // e3 has no history
      ]);

      const adjusted = await feedbackManager.adjustScores(results);

      // e2 should now be first (high use rate)
      // e3 should be second (no adjustment, original score)
      // e1 should be last (low use rate + negative feedback)
      expect(adjusted[0].entityId).toBe('e2');
      expect(adjusted[2].entityId).toBe('e1');
    });
  });

  // ============================================================================
  // Cross-Feature Integration Tests
  // ============================================================================

  describe('Cross-Feature Integration', () => {
    it('should use parsed intent to weight search strategies', async () => {
      const queries = [
        { text: 'Where is the login function?', expectedStrategy: 'fts' },
        { text: 'How does authentication work?', expectedStrategy: 'graph' },
        { text: 'Why is there an error?', expectedStrategy: 'vector' }
      ];

      for (const { text, expectedStrategy } of queries) {
        const parsed = queryParser.parse(text);
        const weights = multiStrategySearch.getStrategyWeights(parsed.intent) as Record<string, number>;

        const topStrategy = Object.entries(weights)
          .sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];

        expect(topStrategy).toBe(expectedStrategy);
      }
    });

    it('should combine entity mentions with semantic search', async () => {
      const query = 'How does `AuthService` authenticate users?';
      const parsed = queryParser.parse(query);

      expect(parsed.entityMentions[0]?.text).toBe('AuthService');
      expect(parsed.keywords).toContain('authenticate');

      // Mock combined search results
      dbConnection.query.mockResolvedValueOnce([
        { entity_id: 'e1', name: 'AuthService', match_type: 'explicit' },
        { entity_id: 'e2', name: 'authenticate', match_type: 'semantic' },
        { entity_id: 'e3', name: 'UserValidator', match_type: 'semantic' }
      ]);

      embeddingProvider.embed.mockResolvedValueOnce(new Array(1536).fill(0.1));

      const results = await multiStrategySearch.search(projectId, parsed);

      expect(results.some((r: SearchResult) => r.entity.name === 'AuthService')).toBe(true);
      expect(embeddingProvider.embed).toHaveBeenCalled();
    });

    it('should format context based on query type', async () => {
      // Code query should prioritize code formatting
      const codeResults: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          source: 'fts',
          entity: {
            id: 'e1',
            name: 'login',
            type: 'function',
            content: 'function login(user, pass) { ... }',
            filePath: 'src/auth.ts'
          }
        }
      ];

      const codeContext = contextAssembler.assemble(codeResults, {
        maxTokens: 500,
        format: 'code'
      });

      expect(codeContext.context).toContain('```');
      expect(codeContext.context).toContain('login');

      // Doc query should prioritize prose
      const docResults: SearchResult[] = [
        {
          entityId: 'e2',
          score: 0.9,
          source: 'vector',
          entity: {
            id: 'e2',
            name: 'Authentication Requirements',
            type: 'document',
            summary: 'Users must provide valid credentials...'
          }
        }
      ];

      const docContext = contextAssembler.assemble(docResults, {
        maxTokens: 500,
        format: 'prose'
      });

      expect(docContext.context).toContain('Authentication Requirements');
      expect(docContext.context).toContain('valid credentials');
    });
  });
});
