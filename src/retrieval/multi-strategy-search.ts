/**
 * Multi-Strategy Search combining vector, graph, and FTS strategies.
 * Uses Reciprocal Rank Fusion (RRF) to combine results.
 */

import { Entity, EntityStore, EntityType } from '../entities';
import { EmbeddingManager } from '../embeddings';
import { GraphTraversal } from '../graph';
import { QueryParser, ParsedQuery, EntityMention } from './query-parser';
import { SearchResult, SearchStrategy, SearchConfig } from './types';
import { Reranker } from './heuristic-reranker';

/**
 * Raw search result before fusion.
 */
interface RawResult {
  entityId: string;
  score: number;
  source: SearchStrategy;
}

/**
 * Strategy weights for RRF fusion.
 */
export interface StrategyWeights {
  keyword?: number;
  semantic?: number;
  graph?: number;
  structural?: number;
}

/**
 * Options for multi-strategy search.
 */
export interface MultiSearchOptions {
  /** Search strategies to use */
  strategies?: SearchStrategy[];
  /** Maximum results to return */
  limit?: number;
  /** Entity types to filter */
  entityTypes?: EntityType[];
  /** Custom weights for each strategy */
  weights?: StrategyWeights;
  /** Minimum score threshold */
  minScore?: number;
  /** Graph traversal depth */
  graphDepth?: number;
}

/**
 * Default search options.
 */
const DEFAULT_OPTIONS: Required<MultiSearchOptions> = {
  strategies: ['keyword', 'semantic'],
  limit: 10,
  entityTypes: [],
  weights: {
    keyword: 0.6,
    semantic: 1.0,
    graph: 0.8
  },
  minScore: 0.0,
  graphDepth: 2
};

/**
 * Combines multiple search strategies for comprehensive retrieval.
 */
export class MultiStrategySearch {
  private queryParser: QueryParser;

  constructor(
    private entityStore: EntityStore,
    private embeddingManager: EmbeddingManager,
    private graphTraversal?: GraphTraversal,
    queryParser?: QueryParser,
    private reranker?: Reranker
  ) {
    this.queryParser = queryParser ?? new QueryParser();
  }

  /**
   * Search using multiple strategies and fuse results.
   */
  async search(query: string, options?: MultiSearchOptions): Promise<SearchResult[]> {
    // Merge options with defaults, filtering out undefined values
    const opts: Required<MultiSearchOptions> = {
      strategies: options?.strategies ?? DEFAULT_OPTIONS.strategies,
      limit: options?.limit ?? DEFAULT_OPTIONS.limit,
      entityTypes: options?.entityTypes ?? DEFAULT_OPTIONS.entityTypes,
      weights: options?.weights ?? DEFAULT_OPTIONS.weights,
      minScore: options?.minScore ?? DEFAULT_OPTIONS.minScore,
      graphDepth: options?.graphDepth ?? DEFAULT_OPTIONS.graphDepth
    };
    const parsed = this.queryParser.parse(query);

    // F10c.5: Auto-tune strategy weights based on query characteristics
    opts.weights = this.adaptWeights(parsed, opts.weights);

    // F10c.5: Auto-enable graph when entities are mentioned
    const strategies = this.selectStrategies(parsed, opts.strategies);

    const rawResults: RawResult[] = [];

    // Execute enabled strategies in parallel
    const searchPromises: Promise<RawResult[]>[] = [];

    if (strategies.includes('keyword')) {
      searchPromises.push(this.keywordSearch(parsed, opts));
    }

    if (strategies.includes('semantic')) {
      searchPromises.push(this.semanticSearch(parsed, opts));
    }

    if (strategies.includes('graph') && this.graphTraversal) {
      searchPromises.push(this.graphSearch(parsed, opts));
    }

    // Use allSettled so individual strategy failures don't prevent
    // other strategies from returning results
    const settled = await Promise.allSettled(searchPromises);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        rawResults.push(...result.value);
      } else {
        console.error(`Search strategy failed: ${result.reason}`);
      }
    }

    // Fuse results using RRF
    const fused = this.reciprocalRankFusion(rawResults, opts.weights);

    // Deduplicate
    const deduplicated = this.deduplicate(fused);

    // Filter by minimum score
    const filtered = opts.minScore > 0
      ? deduplicated.filter(r => r.score >= opts.minScore)
      : deduplicated;

    // Limit results
    const limited = filtered.slice(0, opts.limit);

    // Hydrate with full entities
    const hydrated = await this.hydrateResults(limited);

    // Rerank if available
    if (this.reranker && hydrated.length > 1) {
      const reranked = await this.reranker.rerank(query, hydrated);
      return reranked.map(r => {
        const original = hydrated.find(h => h.entity.id === r.entityId)!;
        return { ...original, score: r.rerankedScore };
      }).filter(Boolean);
    }

    return hydrated;
  }

  /**
   * Keyword/FTS search.
   */
  private async keywordSearch(
    parsed: ParsedQuery,
    options: Required<MultiSearchOptions>
  ): Promise<RawResult[]> {
    const results: RawResult[] = [];

    // Search with keywords or fall back to raw query
    const searchQuery = parsed.keywords.length > 0
      ? parsed.keywords.join(' ')
      : parsed.normalizedQuery;

    if (searchQuery) {
      const ftsResults = await this.entityStore.search(searchQuery, {
        type: options.entityTypes.length === 1 ? options.entityTypes[0] : undefined,
        limit: options.limit * 2
      });

      // FTS doesn't give scores, use rank-based scoring
      for (let i = 0; i < ftsResults.length; i++) {
        results.push({
          entityId: ftsResults[i].id,
          score: 1 / (i + 1),
          source: 'keyword'
        });
      }
    }

    // Search for exact entity mentions
    for (const mention of parsed.entityMentions) {
      const exactMatches = await this.entityStore.search(mention.text, {
        limit: 5
      });

      for (const match of exactMatches) {
        // Boost exact matches
        results.push({
          entityId: match.id,
          score: 1.5,
          source: 'keyword'
        });
      }
    }

    // F10c.7: Search with expanded/synonym terms at lower weight
    if (parsed.expandedTerms.length > 0) {
      const expandedQuery = parsed.expandedTerms.join(' ');
      const expandedResults = await this.entityStore.search(expandedQuery, {
        limit: Math.floor(options.limit / 2)
      });
      for (let i = 0; i < expandedResults.length; i++) {
        results.push({
          entityId: expandedResults[i].id,
          score: 0.5 / (i + 1),
          source: 'keyword'
        });
      }
    }

    return results;
  }

  /**
   * Semantic/vector search.
   */
  private async semanticSearch(
    parsed: ParsedQuery,
    options: Required<MultiSearchOptions>
  ): Promise<RawResult[]> {
    try {
    const results: RawResult[] = [];

    // Search with normalized query
    const mainResults = await this.embeddingManager.findSimilar(
      parsed.normalizedQuery,
      {
        limit: options.limit * 2,
        entityTypes: options.entityTypes.length > 0
          ? options.entityTypes.map(t => t as string)
          : undefined
      }
    );

    for (const match of mainResults) {
      results.push({
        entityId: match.entityId,
        score: match.score,
        source: 'semantic'
      });
    }

    // Also search with expanded terms if available
    if (parsed.expandedTerms.length > 0) {
      const expandedQuery = [...parsed.keywords, ...parsed.expandedTerms].join(' ');
      const expandedResults = await this.embeddingManager.findSimilar(
        expandedQuery,
        {
          limit: Math.floor(options.limit / 2),
          entityTypes: options.entityTypes.length > 0
            ? options.entityTypes.map(t => t as string)
            : undefined
        }
      );

      for (const match of expandedResults) {
        // Slightly lower weight for expanded results
        results.push({
          entityId: match.entityId,
          score: match.score * 0.8,
          source: 'semantic'
        });
      }
    }

    return results;
    } catch (err) {
      console.error(`Semantic search failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * Graph-based search starting from entity mentions.
   */
  private async graphSearch(
    parsed: ParsedQuery,
    options: Required<MultiSearchOptions>
  ): Promise<RawResult[]> {
    if (!this.graphTraversal) return [];

    try {
    const results: RawResult[] = [];

    // Start from mentioned entities
    for (const mention of parsed.entityMentions) {
      const entity = await this.resolveEntityMention(mention);
      if (!entity) continue;

      // Get neighborhood
      const neighborhood = await this.graphTraversal.getNeighborhood(entity.id, {
        maxDepth: options.graphDepth,
        direction: 'both'
      });

      // Score entities by relationship weight and proximity
      const entityDistances = new Map<string, number>();

      for (const rel of neighborhood.relationships) {
        const targetId = rel.source === entity.id ? rel.target : rel.source;
        const currentDist = entityDistances.get(targetId) ?? Infinity;
        // Lower distance is better, use weight as inverse distance indicator
        const newDist = 1 / (rel.weight || 0.5);
        if (newDist < currentDist) {
          entityDistances.set(targetId, newDist);
        }
      }

      // Convert to results
      for (const [targetId, distance] of entityDistances) {
        if (targetId === entity.id) continue;

        results.push({
          entityId: targetId,
          score: 1 / (distance + 1),
          source: 'graph'
        });
      }
    }

    return results;
    } catch (err) {
      console.error(`Graph search failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * Reciprocal Rank Fusion combining results from multiple strategies.
   *
   * RRF score = Σ (weight / (k + rank))
   * where k is typically 60 and rank starts at 1.
   */
  private reciprocalRankFusion(
    results: RawResult[],
    weights?: StrategyWeights
  ): RawResult[] {
    const k = 60; // Standard RRF constant
    const defaultWeights: Record<SearchStrategy, number> = {
      keyword: 0.6,
      semantic: 1.0,
      graph: 0.8,
      structural: 0.7,
      hybrid: 1.0
    };
    const w: Record<SearchStrategy, number> = { ...defaultWeights, ...weights as Record<SearchStrategy, number> };

    // Group by source
    const bySource = new Map<SearchStrategy, RawResult[]>();
    for (const r of results) {
      const list = bySource.get(r.source) ?? [];
      list.push(r);
      bySource.set(r.source, list);
    }

    // Sort each source by score (descending)
    for (const sourceResults of bySource.values()) {
      sourceResults.sort((a, b) => b.score - a.score);
    }

    // Calculate RRF scores
    const fusedScores = new Map<string, { score: number; source: SearchStrategy }>();

    for (const [source, sourceResults] of bySource) {
      const weight = w[source] ?? 1.0;

      for (let rank = 0; rank < sourceResults.length; rank++) {
        const result = sourceResults[rank];
        const rrfScore = weight / (k + rank + 1);

        const existing = fusedScores.get(result.entityId);
        if (existing) {
          fusedScores.set(result.entityId, {
            score: existing.score + rrfScore,
            source: existing.source // Keep the first source
          });
        } else {
          fusedScores.set(result.entityId, {
            score: rrfScore,
            source
          });
        }
      }
    }

    // Convert to array and sort by fused score
    const fused: RawResult[] = [];
    for (const [entityId, data] of fusedScores) {
      fused.push({
        entityId,
        score: data.score,
        source: data.source
      });
    }

    fused.sort((a, b) => b.score - a.score);
    return fused;
  }

  /**
   * Deduplicate results keeping highest score.
   */
  private deduplicate(results: RawResult[]): RawResult[] {
    const seen = new Map<string, RawResult>();

    for (const result of results) {
      const existing = seen.get(result.entityId);
      if (!existing || result.score > existing.score) {
        seen.set(result.entityId, result);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Hydrate raw results with full entity data.
   */
  private async hydrateResults(results: RawResult[]): Promise<SearchResult[]> {
    const hydrated: SearchResult[] = [];

    for (const result of results) {
      const entity = await this.entityStore.get(result.entityId);
      if (entity) {
        hydrated.push({
          entity,
          score: result.score,
          source: result.source
        });
      }
    }

    return hydrated;
  }

  /**
   * Resolve an entity mention to an actual entity.
   */
  private async resolveEntityMention(mention: EntityMention): Promise<Entity | null> {
    // Try exact name match first
    const byName = await this.entityStore.getByName(
      mention.text,
      mention.type !== 'unknown' && mention.type !== 'code'
        ? mention.type as EntityType
        : undefined
    );
    if (byName) return byName;

    // Try qualified name
    const byQualified = await this.entityStore.getByQualifiedName(mention.text);
    if (byQualified) return byQualified;

    // Fall back to search
    const searchResults = await this.entityStore.search(mention.text, { limit: 1 });
    return searchResults[0] ?? null;
  }

  /**
   * F10c.5: Adapt strategy weights based on query characteristics.
   */
  private adaptWeights(parsed: ParsedQuery, baseWeights: StrategyWeights): StrategyWeights {
    const weights = { ...baseWeights };

    // Entity mention detected → boost keyword and graph
    if (parsed.entityMentions.length > 0) {
      weights.keyword = (weights.keyword || 0.6) * 1.5;
      weights.graph = (weights.graph || 0.8) * 1.3;
    }

    // Short query (1-2 words) with entity mention → likely a name lookup
    if (parsed.keywords.length <= 2 && parsed.entityMentions.length > 0) {
      weights.keyword = (weights.keyword || 0.6) * 2.0;
      weights.semantic = (weights.semantic || 1.0) * 0.5;
    }

    // Question format → boost semantic
    if (/^(how|what|why|where|when|which)/i.test(parsed.normalizedQuery)) {
      weights.semantic = (weights.semantic || 1.0) * 1.5;
      weights.keyword = (weights.keyword || 0.6) * 0.7;
    }

    // File path pattern → pure keyword
    if (/\.(ts|js|py|go|rs|java)$/.test(parsed.normalizedQuery)) {
      weights.keyword = 3.0;
      weights.semantic = 0.2;
    }

    return weights;
  }

  /**
   * F10c.5: Auto-select strategies based on query characteristics.
   */
  private selectStrategies(
    parsed: ParsedQuery,
    requestedStrategies: SearchStrategy[]
  ): SearchStrategy[] {
    const strategies = [...requestedStrategies];

    // Auto-enable graph when entities are mentioned and graph is available
    if (
      parsed.entityMentions.length > 0 &&
      this.graphTraversal &&
      !strategies.includes('graph')
    ) {
      strategies.push('graph');
    }

    return strategies;
  }

  /**
   * Search with a single strategy (for testing or specific use cases).
   */
  async searchWithStrategy(
    query: string,
    strategy: SearchStrategy,
    options?: Omit<MultiSearchOptions, 'strategies'>
  ): Promise<SearchResult[]> {
    return this.search(query, { ...options, strategies: [strategy] });
  }

  /**
   * Get the query parser for external use.
   */
  getQueryParser(): QueryParser {
    return this.queryParser;
  }
}
