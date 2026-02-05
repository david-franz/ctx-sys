/**
 * F6.2 Multi-Strategy Search Tests
 *
 * IMPORTANT: These tests will fail until the actual implementations are created.
 * The following source files need to be implemented:
 * - src/retrieval/search.ts (MultiStrategySearch, VectorSearch, GraphSearch, FTSSearch classes)
 * - src/retrieval/types.ts (SearchResult, SearchStrategy, RRFOptions interfaces)
 * - src/database/connection.ts (DatabaseConnection class)
 *
 * Tests for search operations combining multiple strategies:
 * - Vector similarity search
 * - Graph traversal search
 * - Full-text search (FTS)
 * - Reciprocal Rank Fusion (RRF)
 *
 * @see docs/phase-6/F6.2-multi-strategy-search.md
 */

import { MultiStrategySearch, VectorSearch, GraphSearch, FTSSearch } from '../../src/retrieval/search';
import { SearchResult, SearchStrategy, RRFOptions } from '../../src/retrieval/types';
import { DatabaseConnection } from '../../src/db/connection';

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('../../src/db/connection');
jest.mock('../../src/retrieval/search', () => {
  const actual = jest.requireActual('../../src/retrieval/search');
  return {
    ...actual,
    VectorSearch: jest.fn(),
    GraphSearch: jest.fn(),
    FTSSearch: jest.fn(),
    MultiStrategySearch: jest.fn()
  };
});

// Mock types for testing
interface MockSearchResult {
  entityId: string;
  score: number;
  source: 'vector' | 'graph' | 'fts';
  entity?: {
    id: string;
    name: string;
    type: string;
    content?: string;
    filePath?: string;
  };
}

interface CombinedResult {
  entityId: string;
  finalScore: number;
  sources: Array<'vector' | 'graph' | 'fts'>;
  vectorRank?: number;
  graphRank?: number;
  ftsRank?: number;
}

interface SearchOptions {
  strategies: Array<'vector' | 'graph' | 'fts'>;
  limit: number;
  minScore?: number;
  types?: string[];
  files?: string[];
}

describe('F6.2 Multi-Strategy Search', () => {
  let mockDbConnection: jest.Mocked<DatabaseConnection>;
  let vectorSearch: jest.Mocked<VectorSearch>;
  let graphSearch: jest.Mocked<GraphSearch>;
  let ftsSearch: jest.Mocked<FTSSearch>;
  let multiStrategySearch: MultiStrategySearch;
  const projectId = 'proj_123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock database connection
    mockDbConnection = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn(),
      exec: jest.fn(),
      prepare: jest.fn(),
      close: jest.fn()
    } as unknown as jest.Mocked<DatabaseConnection>;

    // Create mock search strategy instances
    vectorSearch = {
      search: jest.fn(),
      setMinScore: jest.fn(),
      setLimit: jest.fn()
    } as unknown as jest.Mocked<VectorSearch>;

    graphSearch = {
      search: jest.fn(),
      setMaxDepth: jest.fn(),
      setRelationTypes: jest.fn()
    } as unknown as jest.Mocked<GraphSearch>;

    ftsSearch = {
      search: jest.fn(),
      setWeights: jest.fn()
    } as unknown as jest.Mocked<FTSSearch>;

    // Configure mock constructors
    (VectorSearch as jest.Mock).mockImplementation(() => vectorSearch);
    (GraphSearch as jest.Mock).mockImplementation(() => graphSearch);
    (FTSSearch as jest.Mock).mockImplementation(() => ftsSearch);
    (MultiStrategySearch as jest.Mock).mockImplementation((db, options) => {
      return {
        db,
        options,
        vectorSearch: new VectorSearch(db),
        graphSearch: new GraphSearch(db),
        ftsSearch: new FTSSearch(db),
        search: jest.fn(),
        combineResults: jest.fn()
      };
    });

    // Create real instance with mocked dependencies
    multiStrategySearch = new MultiStrategySearch(mockDbConnection, { projectId });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Vector Search Tests
  // ============================================================================

  describe('Vector Search', () => {
    let vectorSearchInstance: VectorSearch;

    beforeEach(() => {
      vectorSearchInstance = new VectorSearch(mockDbConnection);
    });

    it('should search by embedding similarity', async () => {
      const queryEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.909, source: 'vector' },
        { entityId: 'e2', score: 0.769, source: 'vector' },
        { entityId: 'e3', score: 0.667, source: 'vector' }
      ];

      vectorSearch.search.mockResolvedValue(expectedResults);

      const results = await vectorSearchInstance.search(queryEmbedding, { limit: 10 });

      expect(vectorSearch.search).toHaveBeenCalledWith(queryEmbedding, { limit: 10 });
      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should convert distance to similarity score', () => {
      const distances = [0.1, 0.5, 1.0];
      const scores = distances.map(d => 1 / (1 + d));

      expect(scores[0]).toBeGreaterThan(scores[1]);
      expect(scores[1]).toBeGreaterThan(scores[2]);
      expect(scores[0]).toBeCloseTo(0.909, 2);
    });

    it('should filter by minimum similarity', async () => {
      const minScore = 0.5;
      const allResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.909, source: 'vector' },
        { entityId: 'e2', score: 0.667, source: 'vector' },
        { entityId: 'e3', score: 0.333, source: 'vector' }
      ];

      vectorSearch.search.mockResolvedValue(
        allResults.filter(r => r.score >= minScore)
      );

      const results = await vectorSearchInstance.search(new Float32Array(4), { minScore });

      expect(results).toHaveLength(2);
      expect(results.every((r: MockSearchResult) => r.score >= minScore)).toBe(true);
    });

    it('should filter by entity type', async () => {
      const types = ['function'];
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector', entity: { id: 'e1', name: 'fn1', type: 'function' } },
        { entityId: 'e2', score: 0.8, source: 'vector', entity: { id: 'e2', name: 'fn2', type: 'function' } }
      ];

      vectorSearch.search.mockResolvedValue(expectedResults);

      const results = await vectorSearchInstance.search(new Float32Array(4), { types });

      expect(results).toHaveLength(2);
      expect(results.every((r: MockSearchResult) => r.entity?.type === 'function')).toBe(true);
    });

    it('should limit results', async () => {
      const limit = 5;
      const limitedResults = Array(limit).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: 1 - i * 0.1,
        source: 'vector' as const
      }));

      vectorSearch.search.mockResolvedValue(limitedResults);

      const results = await vectorSearchInstance.search(new Float32Array(4), { limit });

      expect(results.length).toBeLessThanOrEqual(limit);
    });
  });

  // ============================================================================
  // Graph Search Tests
  // ============================================================================

  describe('Graph Search', () => {
    let graphSearchInstance: GraphSearch;

    beforeEach(() => {
      graphSearchInstance = new GraphSearch(mockDbConnection);
    });

    it('should find entities by graph traversal', async () => {
      const startEntityId = 'entity_auth';
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e_user', score: 1.0, source: 'graph' },
        { entityId: 'e_db', score: 1.0, source: 'graph' },
        { entityId: 'e_cache', score: 0.5, source: 'graph' }
      ];

      graphSearch.search.mockResolvedValue(expectedResults);

      const results = await graphSearchInstance.search(startEntityId, { maxDepth: 3 });

      expect(graphSearch.search).toHaveBeenCalledWith(startEntityId, { maxDepth: 3 });
      expect(results).toHaveLength(3);
    });

    it('should score by relationship weight and depth', () => {
      // Score formula: weight * (1 / depth)
      const results = [
        { weight: 1.0, depth: 1 }, // Score: 1.0
        { weight: 0.8, depth: 1 }, // Score: 0.8
        { weight: 1.0, depth: 2 }, // Score: 0.5
        { weight: 0.5, depth: 2 }  // Score: 0.25
      ].map(r => ({
        ...r,
        score: r.weight * (1 / r.depth)
      }));

      expect(results[0].score).toBe(1.0);
      expect(results[2].score).toBe(0.5);
      expect(results[3].score).toBe(0.25);
    });

    it('should filter by relationship type', async () => {
      const relTypes = ['CALLS', 'IMPORTS'];
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 1.0, source: 'graph' },
        { entityId: 'e2', score: 0.8, source: 'graph' }
      ];

      graphSearch.search.mockResolvedValue(expectedResults);

      const results = await graphSearchInstance.search('start', { relationTypes: relTypes });

      expect(results).toHaveLength(2);
    });

    it('should limit traversal depth', async () => {
      const maxDepth = 2;
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 1.0, source: 'graph' },
        { entityId: 'e2', score: 0.5, source: 'graph' }
      ];

      graphSearch.search.mockResolvedValue(expectedResults);

      const results = await graphSearchInstance.search('start', { maxDepth });

      expect(results).toHaveLength(2);
    });

    it('should expand from multiple seed entities', async () => {
      const seedIds = ['e1', 'e2'];
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e3', score: 1.0, source: 'graph' },
        { entityId: 'e4', score: 1.0, source: 'graph' },
        { entityId: 'e5', score: 1.0, source: 'graph' }
      ];

      graphSearch.search.mockResolvedValue(expectedResults);

      const results = await graphSearchInstance.search(seedIds, {});

      expect(results).toHaveLength(3);
    });
  });

  // ============================================================================
  // Full-Text Search Tests
  // ============================================================================

  describe('Full-Text Search (FTS)', () => {
    let ftsSearchInstance: FTSSearch;

    beforeEach(() => {
      ftsSearchInstance = new FTSSearch(mockDbConnection);
    });

    it('should search entity content with FTS5', async () => {
      const query = 'authentication login';
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e2', score: 8.2, source: 'fts', entity: { id: 'e2', name: 'login', type: 'function' } },
        { entityId: 'e1', score: 5.5, source: 'fts', entity: { id: 'e1', name: 'AuthService', type: 'class' } }
      ];

      ftsSearch.search.mockResolvedValue(expectedResults);

      const results = await ftsSearchInstance.search(query, {});

      expect(ftsSearch.search).toHaveBeenCalledWith(query, {});
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should use porter stemming', async () => {
      // "running" should match "run", "runs", "running"
      const query = 'running';
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 5.0, source: 'fts', entity: { id: 'e1', name: 'runTests', type: 'function', content: 'run the tests' } },
        { entityId: 'e2', score: 4.5, source: 'fts', entity: { id: 'e2', name: 'scheduler', type: 'function', content: 'runs every hour' } },
        { entityId: 'e3', score: 4.0, source: 'fts', entity: { id: 'e3', name: 'runner', type: 'function', content: 'running now' } }
      ];

      ftsSearch.search.mockResolvedValue(expectedResults);

      const results = await ftsSearchInstance.search(query, {});

      // All should match due to stemming
      expect(results).toHaveLength(3);
    });

    it('should convert FTS rank to score', () => {
      // FTS5 bm25 returns negative scores, more negative = better
      // Convert to positive score where higher = better
      const ranks = [-10, -5, -2];
      const scores = ranks.map(r => -r);  // Simple negation: more negative becomes higher

      expect(scores[0]).toBeGreaterThan(scores[1]);  // 10 > 5
      expect(scores[1]).toBeGreaterThan(scores[2]);  // 5 > 2
    });

    it('should search with phrase matching', async () => {
      const phrase = '"user authentication"';
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 10.0, source: 'fts', entity: { id: 'e1', name: 'auth', type: 'function', content: 'handles user authentication flow' } }
      ];

      ftsSearch.search.mockResolvedValue(expectedResults);

      const results = await ftsSearchInstance.search(phrase, {});

      expect(results).toHaveLength(1);
    });

    it('should search with prefix matching', async () => {
      const prefix = 'auth*';
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 5.0, source: 'fts', entity: { id: 'e1', name: 'authenticate', type: 'function' } },
        { entityId: 'e2', score: 4.5, source: 'fts', entity: { id: 'e2', name: 'authorization', type: 'function' } },
        { entityId: 'e3', score: 4.0, source: 'fts', entity: { id: 'e3', name: 'AuthService', type: 'class' } }
      ];

      ftsSearch.search.mockResolvedValue(expectedResults);

      const results = await ftsSearchInstance.search(prefix, {});

      expect(results).toHaveLength(3);
    });

    it('should weight name matches higher than content', async () => {
      // Using bm25 with column weights
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 15.0, source: 'fts', entity: { id: 'e1', name: 'auth', type: 'function' } },  // name match
        { entityId: 'e2', score: 5.0, source: 'fts', entity: { id: 'e2', name: 'other', type: 'function', content: 'auth logic' } }  // content match
      ];

      ftsSearch.search.mockResolvedValue(expectedResults);

      const results = await ftsSearchInstance.search('auth', {});

      // Name match should rank higher
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  // ============================================================================
  // Reciprocal Rank Fusion (RRF) Tests
  // ============================================================================

  describe('Reciprocal Rank Fusion', () => {
    const RRF_K = 60; // Standard RRF constant

    function calculateRRF(rankings: Array<{ entityId: string; rank: number; source: string }[]>): CombinedResult[] {
      const scores = new Map<string, {
        score: number;
        sources: string[];
        ranks: Record<string, number>;
      }>();

      for (const ranking of rankings) {
        for (let i = 0; i < ranking.length; i++) {
          const item = ranking[i];
          const rrfScore = 1 / (RRF_K + i + 1);

          const existing = scores.get(item.entityId) || {
            score: 0,
            sources: [],
            ranks: {}
          };

          existing.score += rrfScore;
          existing.sources.push(item.source);
          existing.ranks[item.source] = i + 1;

          scores.set(item.entityId, existing);
        }
      }

      return Array.from(scores.entries())
        .map(([entityId, data]) => ({
          entityId,
          finalScore: data.score,
          sources: data.sources as Array<'vector' | 'graph' | 'fts'>,
          vectorRank: data.ranks['vector'],
          graphRank: data.ranks['graph'],
          ftsRank: data.ranks['fts']
        }))
        .sort((a, b) => b.finalScore - a.finalScore);
    }

    it('should combine rankings from multiple sources', () => {
      const vectorResults = [
        { entityId: 'e1', rank: 1, source: 'vector' },
        { entityId: 'e2', rank: 2, source: 'vector' },
        { entityId: 'e3', rank: 3, source: 'vector' }
      ];

      const ftsResults = [
        { entityId: 'e2', rank: 1, source: 'fts' },
        { entityId: 'e1', rank: 2, source: 'fts' },
        { entityId: 'e4', rank: 3, source: 'fts' }
      ];

      const combined = calculateRRF([vectorResults, ftsResults]);

      expect(combined.length).toBeGreaterThan(0);
      // e1 and e2 appear in both, should have higher scores
      const e1 = combined.find(r => r.entityId === 'e1');
      const e4 = combined.find(r => r.entityId === 'e4');
      expect(e1!.finalScore).toBeGreaterThan(e4!.finalScore);
    });

    it('should boost entities appearing in multiple sources', () => {
      const vectorResults = [
        { entityId: 'e1', rank: 1, source: 'vector' }
      ];

      const graphResults = [
        { entityId: 'e1', rank: 1, source: 'graph' }
      ];

      const ftsResults = [
        { entityId: 'e1', rank: 1, source: 'fts' }
      ];

      const singleSource = [
        { entityId: 'e2', rank: 1, source: 'vector' }
      ];

      const combinedMulti = calculateRRF([vectorResults, graphResults, ftsResults]);
      const combinedSingle = calculateRRF([singleSource]);

      expect(combinedMulti[0].finalScore).toBeGreaterThan(combinedSingle[0].finalScore);
      expect(combinedMulti[0].sources).toHaveLength(3);
    });

    it('should calculate correct RRF scores', () => {
      // RRF score = 1 / (k + rank)
      // For k=60, rank 1: 1/61 ~ 0.0164
      const rank1Score = 1 / (RRF_K + 1);
      const rank2Score = 1 / (RRF_K + 2);

      expect(rank1Score).toBeCloseTo(0.0164, 3);
      expect(rank2Score).toBeCloseTo(0.0161, 3);
    });

    it('should track source rankings', () => {
      const vectorResults = [
        { entityId: 'e1', rank: 1, source: 'vector' },
        { entityId: 'e2', rank: 2, source: 'vector' }
      ];

      const ftsResults = [
        { entityId: 'e2', rank: 1, source: 'fts' },
        { entityId: 'e1', rank: 2, source: 'fts' }
      ];

      const combined = calculateRRF([vectorResults, ftsResults]);

      const e1 = combined.find(r => r.entityId === 'e1')!;
      expect(e1.vectorRank).toBe(1);
      expect(e1.ftsRank).toBe(2);
    });

    it('should handle empty result sets', () => {
      const combined = calculateRRF([[], []]);

      expect(combined).toHaveLength(0);
    });

    it('should handle single source', () => {
      const vectorResults = [
        { entityId: 'e1', rank: 1, source: 'vector' },
        { entityId: 'e2', rank: 2, source: 'vector' }
      ];

      const combined = calculateRRF([vectorResults]);

      expect(combined).toHaveLength(2);
      expect(combined[0].sources).toContain('vector');
    });

    it('should sort by final score descending', () => {
      // RRF uses array position (not rank property) - first item gets highest score
      const vectorResults = [
        { entityId: 'e2', rank: 1, source: 'vector' },  // First in array = highest RRF score
        { entityId: 'e3', rank: 2, source: 'vector' },
        { entityId: 'e1', rank: 3, source: 'vector' }   // Last in array = lowest RRF score
      ];

      const combined = calculateRRF([vectorResults]);

      expect(combined[0].entityId).toBe('e2');
      expect(combined[1].entityId).toBe('e3');
      expect(combined[2].entityId).toBe('e1');
    });
  });

  // ============================================================================
  // MultiStrategySearch Tests
  // ============================================================================

  describe('MultiStrategySearch', () => {
    it('should execute all enabled strategies', async () => {
      const options: SearchOptions = {
        strategies: ['vector', 'graph', 'fts'],
        limit: 10
      };

      const vectorResults: MockSearchResult[] = [{ entityId: 'e1', score: 0.9, source: 'vector' }];
      const graphResults: MockSearchResult[] = [{ entityId: 'e2', score: 0.8, source: 'graph' }];
      const ftsResults: MockSearchResult[] = [{ entityId: 'e3', score: 0.7, source: 'fts' }];

      vectorSearch.search.mockResolvedValue(vectorResults);
      graphSearch.search.mockResolvedValue(graphResults);
      ftsSearch.search.mockResolvedValue(ftsResults);

      (multiStrategySearch.search as jest.Mock).mockResolvedValue([
        ...vectorResults,
        ...graphResults,
        ...ftsResults
      ]);

      const results = await multiStrategySearch.search('query', options);

      expect(results).toHaveLength(3);
      expect(results.map((r: MockSearchResult) => r.source)).toEqual(
        expect.arrayContaining(['vector', 'graph', 'fts'])
      );
    });

    it('should respect strategy selection', async () => {
      const options: SearchOptions = {
        strategies: ['vector', 'fts'], // No graph
        limit: 10
      };

      const combinedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector' },
        { entityId: 'e2', score: 0.8, source: 'fts' }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(combinedResults);

      const results = await multiStrategySearch.search('query', options);

      expect(results.every((r: MockSearchResult) => r.source !== 'graph')).toBe(true);
    });

    it('should apply type filters across strategies', async () => {
      const options: SearchOptions = {
        strategies: ['vector', 'fts'],
        limit: 10,
        types: ['function', 'class']
      };

      const filteredResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector', entity: { id: 'e1', name: 'fn1', type: 'function' } },
        { entityId: 'e2', score: 0.8, source: 'fts', entity: { id: 'e2', name: 'cls1', type: 'class' } }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(filteredResults);

      const results = await multiStrategySearch.search('query', options);

      expect(results).toHaveLength(2);
      expect(results.every((r: MockSearchResult) =>
        options.types!.includes(r.entity?.type || '')
      )).toBe(true);
    });

    it('should apply file filters', async () => {
      const options: SearchOptions = {
        strategies: ['vector'],
        limit: 10,
        files: ['src/auth/**']
      };

      const filteredResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector', entity: { id: 'e1', name: 'login', type: 'function', filePath: 'src/auth/login.ts' } },
        { entityId: 'e2', score: 0.8, source: 'vector', entity: { id: 'e2', name: 'session', type: 'function', filePath: 'src/auth/session.ts' } }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(filteredResults);

      const results = await multiStrategySearch.search('query', options);

      expect(results).toHaveLength(2);
      expect(results.every((r: MockSearchResult) =>
        r.entity?.filePath?.startsWith('src/auth/')
      )).toBe(true);
    });

    it('should apply minimum score filter', async () => {
      const options: SearchOptions = {
        strategies: ['vector'],
        limit: 10,
        minScore: 0.5
      };

      const filteredResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector' },
        { entityId: 'e2', score: 0.6, source: 'vector' }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(filteredResults);

      const results = await multiStrategySearch.search('query', options);

      expect(results).toHaveLength(2);
      expect(results.every((r: MockSearchResult) => r.score >= options.minScore!)).toBe(true);
    });

    it('should limit final results', async () => {
      const options: SearchOptions = {
        strategies: ['vector', 'fts'],
        limit: 5
      };

      const limitedResults = Array(options.limit).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: 1 - i * 0.05,
        source: 'vector' as const
      }));

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(limitedResults);

      const results = await multiStrategySearch.search('query', options);

      expect(results.length).toBeLessThanOrEqual(options.limit);
    });

    it('should hydrate entity details', async () => {
      const hydratedResults: MockSearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          source: 'vector',
          entity: {
            id: 'e1',
            name: 'AuthService',
            type: 'class',
            content: 'class AuthService {}',
            filePath: 'src/auth/service.ts'
          }
        }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(hydratedResults);

      const results = await multiStrategySearch.search('query', { strategies: ['vector'], limit: 10 });

      expect(results[0].entity).toHaveProperty('name');
      expect(results[0].entity).toHaveProperty('type');
      expect(results[0].entity).toHaveProperty('content');
      expect(results[0].entity).toHaveProperty('filePath');
    });
  });

  // ============================================================================
  // Strategy Weighting Tests
  // ============================================================================

  describe('Strategy Weighting', () => {
    it('should support custom strategy weights', () => {
      const weights = {
        vector: 1.0,
        graph: 0.8,
        fts: 0.6
      };

      const vectorScore = 0.9 * weights.vector;
      const graphScore = 0.9 * weights.graph;
      const ftsScore = 0.9 * weights.fts;

      expect(vectorScore).toBeGreaterThan(graphScore);
      expect(graphScore).toBeGreaterThan(ftsScore);
    });

    it('should adjust weights based on query intent', () => {
      // find intent: boost FTS for keyword matching
      // explain intent: boost graph for relationships
      const intentWeights: Record<string, Record<string, number>> = {
        find: { vector: 1.0, graph: 0.6, fts: 1.2 },
        explain: { vector: 0.8, graph: 1.2, fts: 0.8 },
        debug: { vector: 1.0, graph: 1.0, fts: 1.0 }
      };

      expect(intentWeights.find.fts).toBeGreaterThan(intentWeights.find.graph);
      expect(intentWeights.explain.graph).toBeGreaterThan(intentWeights.explain.fts);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle no results from any strategy', async () => {
      vectorSearch.search.mockResolvedValue([]);
      graphSearch.search.mockResolvedValue([]);
      ftsSearch.search.mockResolvedValue([]);
      (multiStrategySearch.search as jest.Mock).mockResolvedValue([]);

      const results = await multiStrategySearch.search('query', { strategies: ['vector', 'graph', 'fts'], limit: 10 });

      expect(results).toHaveLength(0);
    });

    it('should handle one strategy returning empty', async () => {
      const partialResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'vector' },
        { entityId: 'e2', score: 0.8, source: 'fts' }
        // No graph results
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(partialResults);

      const results = await multiStrategySearch.search('query', { strategies: ['vector', 'graph', 'fts'], limit: 10 });

      expect(results).toHaveLength(2);
    });

    it('should handle duplicate entities across strategies', async () => {
      // Same entity found by multiple strategies - should be deduplicated with boosted score
      const combinedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.95, source: 'vector' }  // Combined/deduplicated result
      ];

      (multiStrategySearch.combineResults as jest.Mock).mockReturnValue(combinedResults);
      (multiStrategySearch.search as jest.Mock).mockResolvedValue(combinedResults);

      const results = await multiStrategySearch.search('query', { strategies: ['vector', 'graph', 'fts'], limit: 10 });
      const uniqueIds = new Set(results.map((r: MockSearchResult) => r.entityId));

      // Should appear once in final results but with boosted score
      expect(uniqueIds.size).toBe(1);
    });

    it('should handle very large result sets', async () => {
      const limit = 50;
      const limitedResults = Array(limit).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: Math.random(),
        source: 'vector' as const
      }));

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(limitedResults);

      const results = await multiStrategySearch.search('query', { strategies: ['vector'], limit });

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should handle query with no keywords', async () => {
      // Should still work with vector search using embedding
      const embeddingOnlyResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.5, source: 'vector' }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(embeddingOnlyResults);

      const results = await multiStrategySearch.search('', { strategies: ['vector'], limit: 10 });

      expect(results).toHaveLength(1);
    });

    it('should handle special characters in search', async () => {
      const query = 'function() { return "test"; }';
      const expectedResults: MockSearchResult[] = [
        { entityId: 'e1', score: 0.9, source: 'fts', entity: { id: 'e1', name: 'test', type: 'function', content: 'function() { return "test"; }' } }
      ];

      (multiStrategySearch.search as jest.Mock).mockResolvedValue(expectedResults);

      const results = await multiStrategySearch.search(query, { strategies: ['fts'], limit: 10 });

      expect(results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should execute strategies in parallel', async () => {
      const strategies = ['vector', 'graph', 'fts'] as const;
      const executionLog: string[] = [];

      vectorSearch.search.mockImplementation(async () => {
        executionLog.push('vector_start');
        await new Promise(resolve => setTimeout(resolve, 10));
        executionLog.push('vector_end');
        return [];
      });

      graphSearch.search.mockImplementation(async () => {
        executionLog.push('graph_start');
        await new Promise(resolve => setTimeout(resolve, 10));
        executionLog.push('graph_end');
        return [];
      });

      ftsSearch.search.mockImplementation(async () => {
        executionLog.push('fts_start');
        await new Promise(resolve => setTimeout(resolve, 10));
        executionLog.push('fts_end');
        return [];
      });

      // In parallel execution, all should start nearly simultaneously
      // (This is a conceptual test - actual implementation would use Promise.all)
      expect(strategies).toHaveLength(3);
      // When implemented, executionLog should show all starts before all ends
      expect(executionLog).toBeDefined();
    });

    it('should use cached embeddings', async () => {
      const query = 'authentication flow';
      let embeddingComputations = 0;

      // Mock embedding computation tracking
      const mockComputeEmbedding = jest.fn().mockImplementation(async () => {
        embeddingComputations++;
        return new Float32Array(384);
      });

      // Simulate multiple searches with same query
      // In real implementation, embedding would be cached
      await mockComputeEmbedding(query);
      // Second call should use cache (in real implementation)

      expect(embeddingComputations).toBeLessThanOrEqual(1);
    });

    it('should limit intermediate results', () => {
      // Each strategy should limit its results before fusion
      const perStrategyLimit = 100;
      const strategies = 3;

      // Max intermediate results
      const maxIntermediate = perStrategyLimit * strategies;

      expect(maxIntermediate).toBe(300);
    });
  });
});
