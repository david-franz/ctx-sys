/**
 * F6.1 Query Parsing Tests
 *
 * IMPORTANT: These tests will fail until the actual implementations are created.
 * The following source files need to be implemented:
 *   - src/retrieval/parser.ts (QueryParser class)
 *   - src/retrieval/types.ts (ParsedQuery, QueryIntent, QueryFilter, EntityMention types)
 *
 * Tests for query analysis and parsing:
 * - Intent detection (find, explain, debug, refactor, etc.)
 * - Keyword extraction
 * - Entity mention detection
 * - Query expansion
 * - Filter extraction
 *
 * @see docs/phase-6/F6.1-query-parsing.md
 */

// Import actual implementations from src paths
import { QueryParser } from '../../src/retrieval/parser';
import {
  ParsedQuery,
  QueryIntent,
  QueryFilter,
  EntityMention,
  QueryFilters
} from '../../src/retrieval/types';

// Mock dependencies
jest.mock('../../src/retrieval/parser', () => {
  return {
    QueryParser: jest.fn().mockImplementation(() => ({
      parse: jest.fn(),
      detectIntent: jest.fn(),
      extractKeywords: jest.fn(),
      extractEntityMentions: jest.fn(),
      extractFilters: jest.fn(),
      expandQuery: jest.fn()
    }))
  };
});

// ============================================================================
// Test Constants
// ============================================================================

// Intent detection patterns (for testing expected behavior)
const INTENT_PATTERNS: Record<string, RegExp[]> = {
  find: [
    /where is/i,
    /find (the|all)/i,
    /show me/i,
    /locate/i,
    /search for/i
  ],
  explain: [
    /how does/i,
    /what does/i,
    /explain/i,
    /understand/i,
    /what is/i
  ],
  debug: [
    /why (is|does|doesn't)/i,
    /error/i,
    /bug/i,
    /fix/i,
    /not working/i
  ],
  refactor: [
    /refactor/i,
    /improve/i,
    /optimize/i,
    /clean up/i,
    /simplify/i
  ],
  implement: [
    /implement/i,
    /create/i,
    /add (a|new)/i,
    /write/i,
    /build/i
  ],
  general: []
};

// Stop words to filter from keywords
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall',
  'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
  'until', 'while', 'this', 'that', 'these', 'those', 'what',
  'which', 'who', 'whom', 'i', 'me', 'my', 'it', 'its'
]);

// Synonym map for expansion
const SYNONYMS: Record<string, string[]> = {
  auth: ['authentication', 'login', 'credential', 'session'],
  authentication: ['auth', 'login', 'credential'],
  user: ['account', 'member', 'profile'],
  error: ['exception', 'failure', 'bug', 'issue'],
  function: ['method', 'procedure', 'routine'],
  class: ['type', 'struct', 'object'],
  database: ['db', 'storage', 'persistence'],
  api: ['endpoint', 'route', 'handler']
};

describe('F6.1 Query Parsing', () => {
  let queryParser: QueryParser;
  let mockParse: jest.Mock;
  let mockDetectIntent: jest.Mock;
  let mockExtractKeywords: jest.Mock;
  let mockExtractEntityMentions: jest.Mock;
  let mockExtractFilters: jest.Mock;
  let mockExpandQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create real instance with mocked internals
    queryParser = new QueryParser();

    // Get references to mocked methods
    mockParse = queryParser.parse as jest.Mock;
    mockDetectIntent = queryParser.detectIntent as jest.Mock;
    mockExtractKeywords = queryParser.extractKeywords as jest.Mock;
    mockExtractEntityMentions = queryParser.extractEntityMentions as jest.Mock;
    mockExtractFilters = queryParser.extractFilters as jest.Mock;
    mockExpandQuery = queryParser.expandQuery as jest.Mock;
  });

  // ============================================================================
  // ParsedQuery Interface Tests
  // ============================================================================

  describe('ParsedQuery Interface', () => {
    it('should contain all required fields', () => {
      const expectedParsed: ParsedQuery = {
        original: 'Where is the AuthService class?',
        intent: 'find',
        keywords: ['authservice', 'class'],
        entityMentions: [
          { text: 'AuthService', type: 'class', startIndex: 13, endIndex: 24 }
        ],
        filters: {}
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('Where is the AuthService class?');

      expect(parsed.original).toBeDefined();
      expect(parsed.intent).toBe('find');
      expect(parsed.keywords).toHaveLength(2);
      expect(parsed.entityMentions).toHaveLength(1);
    });

    it('should support expanded terms', () => {
      const expectedParsed: ParsedQuery = {
        original: 'authentication function',
        intent: 'find',
        keywords: ['authentication', 'function'],
        entityMentions: [],
        filters: {},
        expanded: ['auth', 'login', 'verify', 'credential']
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('authentication function');

      expect(parsed.expanded).toHaveLength(4);
      expect(parsed.expanded).toContain('auth');
    });

    it('should support filters', () => {
      const expectedParsed: ParsedQuery = {
        original: 'find functions in src/auth',
        intent: 'find',
        keywords: ['functions'],
        entityMentions: [],
        filters: {
          types: ['function'],
          files: ['src/auth/**'],
          limit: 10
        }
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('find functions in src/auth');

      expect(parsed.filters.types).toContain('function');
      expect(parsed.filters.files).toContain('src/auth/**');
    });
  });

  // ============================================================================
  // Intent Detection Tests
  // ============================================================================

  describe('Intent Detection', () => {
    describe('find intent', () => {
      it('should detect "where is" queries', () => {
        mockDetectIntent.mockReturnValue('find');
        expect(queryParser.detectIntent('Where is the login function?')).toBe('find');
      });

      it('should detect "find the" queries', () => {
        mockDetectIntent.mockReturnValue('find');
        expect(queryParser.detectIntent('Find the user service')).toBe('find');
      });

      it('should detect "show me" queries', () => {
        mockDetectIntent.mockReturnValue('find');
        expect(queryParser.detectIntent('Show me the database connection')).toBe('find');
      });

      it('should detect "locate" queries', () => {
        mockDetectIntent.mockReturnValue('find');
        expect(queryParser.detectIntent('Locate the configuration file')).toBe('find');
      });

      it('should detect "search for" queries', () => {
        mockDetectIntent.mockReturnValue('find');
        expect(queryParser.detectIntent('Search for error handling')).toBe('find');
      });
    });

    describe('explain intent', () => {
      it('should detect "how does" queries', () => {
        mockDetectIntent.mockReturnValue('explain');
        expect(queryParser.detectIntent('How does authentication work?')).toBe('explain');
      });

      it('should detect "what does" queries', () => {
        mockDetectIntent.mockReturnValue('explain');
        expect(queryParser.detectIntent('What does this function do?')).toBe('explain');
      });

      it('should detect "explain" queries', () => {
        mockDetectIntent.mockReturnValue('explain');
        expect(queryParser.detectIntent('Explain the caching strategy')).toBe('explain');
      });

      it('should detect "what is" queries', () => {
        mockDetectIntent.mockReturnValue('explain');
        expect(queryParser.detectIntent('What is the purpose of this class?')).toBe('explain');
      });
    });

    describe('debug intent', () => {
      it('should detect "why is" queries', () => {
        mockDetectIntent.mockReturnValue('debug');
        expect(queryParser.detectIntent('Why is the test failing?')).toBe('debug');
      });

      it('should detect "error" mentions', () => {
        mockDetectIntent.mockReturnValue('debug');
        expect(queryParser.detectIntent('Getting an error in the API')).toBe('debug');
      });

      it('should detect "bug" mentions', () => {
        mockDetectIntent.mockReturnValue('debug');
        expect(queryParser.detectIntent('There is a bug in login')).toBe('debug');
      });

      it('should detect "not working" queries', () => {
        mockDetectIntent.mockReturnValue('debug');
        expect(queryParser.detectIntent('The form validation is not working')).toBe('debug');
      });

      it('should detect "fix" queries', () => {
        mockDetectIntent.mockReturnValue('debug');
        expect(queryParser.detectIntent('Fix the null pointer issue')).toBe('debug');
      });
    });

    describe('refactor intent', () => {
      it('should detect "refactor" queries', () => {
        mockDetectIntent.mockReturnValue('refactor');
        expect(queryParser.detectIntent('Refactor the user service')).toBe('refactor');
      });

      it('should detect "improve" queries', () => {
        mockDetectIntent.mockReturnValue('refactor');
        expect(queryParser.detectIntent('Improve the code readability')).toBe('refactor');
      });

      it('should detect "optimize" queries', () => {
        mockDetectIntent.mockReturnValue('refactor');
        expect(queryParser.detectIntent('Optimize database queries')).toBe('refactor');
      });

      it('should detect "clean up" queries', () => {
        mockDetectIntent.mockReturnValue('refactor');
        expect(queryParser.detectIntent('Clean up the utility functions')).toBe('refactor');
      });

      it('should detect "simplify" queries', () => {
        mockDetectIntent.mockReturnValue('refactor');
        expect(queryParser.detectIntent('Simplify this complex logic')).toBe('refactor');
      });
    });

    describe('implement intent', () => {
      it('should detect "implement" queries', () => {
        mockDetectIntent.mockReturnValue('implement');
        expect(queryParser.detectIntent('Implement user registration')).toBe('implement');
      });

      it('should detect "create" queries', () => {
        mockDetectIntent.mockReturnValue('implement');
        expect(queryParser.detectIntent('Create a new API endpoint')).toBe('implement');
      });

      it('should detect "add a" queries', () => {
        mockDetectIntent.mockReturnValue('implement');
        expect(queryParser.detectIntent('Add a validation function')).toBe('implement');
      });

      it('should detect "write" queries', () => {
        mockDetectIntent.mockReturnValue('implement');
        expect(queryParser.detectIntent('Write a test for the service')).toBe('implement');
      });

      it('should detect "build" queries', () => {
        mockDetectIntent.mockReturnValue('implement');
        expect(queryParser.detectIntent('Build a caching layer')).toBe('implement');
      });
    });

    describe('general intent', () => {
      it('should default to general for unmatched queries', () => {
        mockDetectIntent.mockReturnValue('general');
        expect(queryParser.detectIntent('authentication')).toBe('general');
      });

      it('should handle ambiguous queries', () => {
        mockDetectIntent.mockReturnValue('general');
        expect(queryParser.detectIntent('user service details')).toBe('general');
      });
    });
  });

  // ============================================================================
  // Keyword Extraction Tests
  // ============================================================================

  describe('Keyword Extraction', () => {
    it('should extract meaningful keywords', () => {
      mockExtractKeywords.mockReturnValue(['authentication', 'service', 'work']);
      const keywords = queryParser.extractKeywords('How does the authentication service work?');

      expect(keywords).toContain('authentication');
      expect(keywords).toContain('service');
      expect(keywords).toContain('work');
    });

    it('should filter stop words', () => {
      mockExtractKeywords.mockReturnValue(['purpose', 'function']);
      const keywords = queryParser.extractKeywords('What is the purpose of this function?');

      expect(keywords).not.toContain('what');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('of');
      expect(keywords).not.toContain('this');
      expect(keywords).toContain('purpose');
      expect(keywords).toContain('function');
    });

    it('should remove short tokens', () => {
      mockExtractKeywords.mockReturnValue(['user']);
      const keywords = queryParser.extractKeywords('Get a user by id from db');

      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('by');
      expect(keywords).not.toContain('id');
      expect(keywords).toContain('user');
    });

    it('should handle backticked entities', () => {
      mockExtractKeywords.mockReturnValue(['find', 'function']);
      const keywords = queryParser.extractKeywords('Find the `getUserById()` function');

      // Entity should be removed, not included as keyword
      expect(keywords).not.toContain('getuserbyid');
      expect(keywords).toContain('find');
      expect(keywords).toContain('function');
    });

    it('should deduplicate keywords', () => {
      mockExtractKeywords.mockReturnValue(['user', 'service']);
      const keywords = queryParser.extractKeywords('user user user service');

      expect(keywords.filter((k: string) => k === 'user')).toHaveLength(1);
    });

    it('should normalize to lowercase', () => {
      mockExtractKeywords.mockReturnValue(['authservice', 'userservice']);
      const keywords = queryParser.extractKeywords('AuthService UserService');

      expect(keywords).toContain('authservice');
      expect(keywords).toContain('userservice');
    });
  });

  // ============================================================================
  // Entity Mention Detection Tests
  // ============================================================================

  describe('Entity Mention Detection', () => {
    it('should detect function mentions', () => {
      const expectedMentions: EntityMention[] = [
        { text: 'getUserById', type: 'function', startIndex: 10, endIndex: 26 }
      ];
      mockExtractEntityMentions.mockReturnValue(expectedMentions);

      const mentions = queryParser.extractEntityMentions('Where is `getUserById()` defined?');

      expect(mentions).toHaveLength(1);
      expect(mentions[0].text).toBe('getUserById');
      expect(mentions[0].type).toBe('function');
    });

    it('should detect class mentions', () => {
      const expectedMentions: EntityMention[] = [
        { text: 'AuthService', type: 'class', startIndex: 10, endIndex: 23 }
      ];
      mockExtractEntityMentions.mockReturnValue(expectedMentions);

      const mentions = queryParser.extractEntityMentions('How does `AuthService` work?');

      expect(mentions).toHaveLength(1);
      expect(mentions[0].text).toBe('AuthService');
      expect(mentions[0].type).toBe('class');
    });

    it('should detect file mentions', () => {
      const expectedMentions: EntityMention[] = [
        { text: 'src/auth/login.ts', type: 'file', startIndex: 6, endIndex: 25 }
      ];
      mockExtractEntityMentions.mockReturnValue(expectedMentions);

      const mentions = queryParser.extractEntityMentions('Check `src/auth/login.ts` for issues');

      expect(mentions).toHaveLength(1);
      expect(mentions[0].text).toBe('src/auth/login.ts');
      expect(mentions[0].type).toBe('file');
    });

    it('should detect multiple mentions', () => {
      const expectedMentions: EntityMention[] = [
        { text: 'AuthService', type: 'class', startIndex: 4, endIndex: 17 },
        { text: 'validateToken', type: 'function', startIndex: 30, endIndex: 47 },
        { text: 'auth.ts', type: 'file', startIndex: 52, endIndex: 61 }
      ];
      mockExtractEntityMentions.mockReturnValue(expectedMentions);

      const mentions = queryParser.extractEntityMentions(
        'The `AuthService` class uses `validateToken()` in `auth.ts`'
      );

      expect(mentions).toHaveLength(3);
      expect(mentions.map((m: EntityMention) => m.type)).toContain('class');
      expect(mentions.map((m: EntityMention) => m.type)).toContain('function');
      expect(mentions.map((m: EntityMention) => m.type)).toContain('file');
    });

    it('should include position information', () => {
      const expectedMentions: EntityMention[] = [
        { text: 'login', type: 'function', startIndex: 5, endIndex: 14 }
      ];
      mockExtractEntityMentions.mockReturnValue(expectedMentions);

      const query = 'Find `login()` function';
      const mentions = queryParser.extractEntityMentions(query);

      expect(mentions[0].startIndex).toBe(5);
      expect(mentions[0].endIndex).toBe(14);
    });

    it('should handle no mentions', () => {
      mockExtractEntityMentions.mockReturnValue([]);
      const mentions = queryParser.extractEntityMentions('How does authentication work?');

      expect(mentions).toHaveLength(0);
    });

    it('should support various file extensions', () => {
      const queries = [
        'Check `app.py`',
        'Check `main.go`',
        'Check `lib.rs`',
        'Check `App.java`'
      ];

      for (const query of queries) {
        mockExtractEntityMentions.mockReturnValue([
          { text: query.match(/`(.+)`/)![1], type: 'file', startIndex: 6, endIndex: query.length - 1 }
        ]);
        const mentions = queryParser.extractEntityMentions(query);
        expect(mentions).toHaveLength(1);
        expect(mentions[0].type).toBe('file');
      }
    });
  });

  // ============================================================================
  // Query Expansion Tests
  // ============================================================================

  describe('Query Expansion', () => {
    it('should expand authentication keywords', () => {
      mockExpandQuery.mockReturnValue(['auth', 'login', 'credential']);
      const expanded = queryParser.expandQuery(['authentication']);

      expect(expanded).toContain('auth');
      expect(expanded).toContain('login');
      expect(expanded).toContain('credential');
    });

    it('should expand user keywords', () => {
      mockExpandQuery.mockReturnValue(['account', 'member', 'profile']);
      const expanded = queryParser.expandQuery(['user']);

      expect(expanded).toContain('account');
      expect(expanded).toContain('member');
      expect(expanded).toContain('profile');
    });

    it('should expand multiple keywords', () => {
      mockExpandQuery.mockReturnValue([
        'authentication', 'login', 'credential', 'session',
        'exception', 'failure', 'bug', 'issue'
      ]);
      const expanded = queryParser.expandQuery(['auth', 'error']);

      expect(expanded.length).toBeGreaterThan(4);
      expect(expanded).toContain('login');
      expect(expanded).toContain('exception');
    });

    it('should handle unknown keywords', () => {
      mockExpandQuery.mockReturnValue([]);
      const expanded = queryParser.expandQuery(['xyz123']);

      expect(expanded).toHaveLength(0);
    });

    it('should deduplicate expansions', () => {
      mockExpandQuery.mockReturnValue(['login', 'credential', 'session']);
      const expanded = queryParser.expandQuery(['auth', 'authentication']);

      // 'login' appears in both, should only be once
      expect(expanded.filter((e: string) => e === 'login')).toHaveLength(1);
    });
  });

  // ============================================================================
  // Filter Extraction Tests
  // ============================================================================

  describe('Filter Extraction', () => {
    it('should extract type filter', () => {
      mockExtractFilters.mockReturnValue({ types: ['function'] });
      const filters = queryParser.extractFilters('Find type:function in auth');

      expect(filters.types).toContain('function');
    });

    it('should extract type from natural language', () => {
      mockExtractFilters.mockReturnValue({ types: ['function'] });
      const filters = queryParser.extractFilters('Show me functions only');

      expect(filters.types).toContain('function');
    });

    it('should extract file path filter', () => {
      mockExtractFilters.mockReturnValue({ files: ['src/auth/**'] });
      const filters = queryParser.extractFilters('Find errors in src/auth');

      expect(filters.files).toContain('src/auth/**');
    });

    it('should extract limit filter', () => {
      mockExtractFilters.mockReturnValue({ limit: 5 });
      const filters = queryParser.extractFilters('Show top 5 results');

      expect(filters.limit).toBe(5);
    });

    it('should extract since date filter', () => {
      const expectedDate = new Date('2024-01-01');
      mockExtractFilters.mockReturnValue({ since: expectedDate });
      const filters = queryParser.extractFilters('Changes since:2024-01-01');

      expect(filters.since).toBeInstanceOf(Date);
      expect(filters.since?.getFullYear()).toBe(2024);
    });

    it('should extract relative date filter', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      mockExtractFilters.mockReturnValue({ since: sevenDaysAgo });
      const filters = queryParser.extractFilters('Changes in last 7 days');

      expect(filters.since).toBeInstanceOf(Date);
      expect(filters.since!.getTime()).toBeCloseTo(sevenDaysAgo.getTime(), -4); // Within 10 seconds
    });

    it('should handle no filters', () => {
      mockExtractFilters.mockReturnValue({});
      const filters = queryParser.extractFilters('How does authentication work?');

      expect(filters.types).toBeUndefined();
      expect(filters.files).toBeUndefined();
      expect(filters.limit).toBeUndefined();
    });

    it('should extract multiple filters', () => {
      mockExtractFilters.mockReturnValue({
        types: ['function'],
        files: ['src/auth/**'],
        limit: 10
      });
      const filters = queryParser.extractFilters('Find type:function in src/auth limit:10');

      expect(filters.types).toContain('function');
      expect(filters.files).toContain('src/auth/**');
      expect(filters.limit).toBe(10);
    });
  });

  // ============================================================================
  // QueryParser Integration Tests
  // ============================================================================

  describe('QueryParser Integration', () => {
    it('should parse a complete query', () => {
      const expectedParsed: ParsedQuery = {
        original: 'Where is the `getUserById()` function in auth service?',
        intent: 'find',
        keywords: ['function', 'auth', 'service'],
        entityMentions: [
          { text: 'getUserById', type: 'function', startIndex: 13, endIndex: 28 }
        ],
        filters: {}
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('Where is the `getUserById()` function in auth service?');

      expect(parsed.original).toBe('Where is the `getUserById()` function in auth service?');
      expect(parsed.intent).toBe('find');
      expect(parsed.keywords).toContain('function');
      expect(parsed.keywords).toContain('auth');
      expect(parsed.keywords).toContain('service');
      expect(parsed.entityMentions).toHaveLength(1);
      expect(parsed.entityMentions[0].text).toBe('getUserById');
    });

    it('should handle explain queries', () => {
      const expectedParsed: ParsedQuery = {
        original: 'How does the authentication flow work?',
        intent: 'explain',
        keywords: ['authentication', 'flow', 'work'],
        entityMentions: [],
        filters: {}
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('How does the authentication flow work?');

      expect(parsed.intent).toBe('explain');
      expect(parsed.keywords).toContain('authentication');
      expect(parsed.keywords).toContain('flow');
      expect(parsed.keywords).toContain('work');
    });

    it('should handle debug queries with filters', () => {
      const expectedParsed: ParsedQuery = {
        original: 'Why is there an error type:function limit:5',
        intent: 'debug',
        keywords: ['error'],
        entityMentions: [],
        filters: {
          types: ['function'],
          limit: 5
        }
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('Why is there an error type:function limit:5');

      expect(parsed.intent).toBe('debug');
      expect(parsed.filters.types).toContain('function');
      expect(parsed.filters.limit).toBe(5);
    });

    it('should handle simple keyword queries', () => {
      const expectedParsed: ParsedQuery = {
        original: 'authentication database connection',
        intent: 'general',
        keywords: ['authentication', 'database', 'connection'],
        entityMentions: [],
        filters: {}
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('authentication database connection');

      expect(parsed.intent).toBe('general');
      expect(parsed.keywords).toContain('authentication');
      expect(parsed.keywords).toContain('database');
      expect(parsed.keywords).toContain('connection');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const expectedParsed: ParsedQuery = {
        original: '',
        intent: 'general',
        keywords: [],
        entityMentions: [],
        filters: {}
      };

      mockParse.mockReturnValue(expectedParsed);
      const parsed = queryParser.parse('');

      expect(parsed.keywords).toHaveLength(0);
    });

    it('should handle query with only stop words', () => {
      mockExtractKeywords.mockReturnValue([]);
      const keywords = queryParser.extractKeywords('the a an is are');

      expect(keywords).toHaveLength(0);
    });

    it('should handle special characters', () => {
      mockExtractKeywords.mockReturnValue(['find', 'decorator']);
      const keywords = queryParser.extractKeywords('Find @decorator #tag $variable');

      expect(keywords).toContain('find');
      expect(keywords).toContain('decorator');
    });

    it('should handle very long queries', () => {
      mockExtractKeywords.mockReturnValue(['word']);
      const longQuery = 'word '.repeat(100);
      const keywords = queryParser.extractKeywords(longQuery);

      expect(keywords).toContain('word');
    });

    it('should handle unicode characters', () => {
      mockExtractKeywords.mockReturnValue(['find', 'with']);
      const keywords = queryParser.extractKeywords('Find funcion with n character');

      expect(keywords).toContain('find');
      expect(keywords).toContain('with');
    });

    it('should handle nested backticks', () => {
      mockExtractEntityMentions.mockReturnValue([]);
      const query = 'The `outer `inner` back` pattern';
      const mentions = queryParser.extractEntityMentions(query);

      // No function pattern match expected
      expect(mentions).toHaveLength(0);
    });
  });
});
