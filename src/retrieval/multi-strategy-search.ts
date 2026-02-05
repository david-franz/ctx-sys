/**
 * Multi-Strategy Search combining vector, graph, and FTS strategies.
 * Uses Reciprocal Rank Fusion (RRF) to combine results.
 */

import { Entity, EntityStore, EntityType } from '../entities';
import { EmbeddingManager } from '../embeddings';
import { GraphTraversal } from '../graph';
import { QueryParser, ParsedQuery, EntityMention } from './query-parser';
import { SearchResult, SearchStrategy, SearchConfig } from './types';

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
    queryParser?: QueryParser
  ) {
    this.queryParser = queryParser ?? new QueryParser();
  }

  /**
   * Search using multiple strategies and fuse results.
   */
  async search(query: string, options?: MultiSearchOptions): Promise<SearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const parsed = this.queryParser.parse(query);
    const rawResults: RawResult[] = [];

    // Execute enabled strategies in parallel
    const searchPromises: Promise<RawResult[]>[] = [];

    if (opts.strategies.includes('keyword')) {
      searchPromises.push(this.keywordSearch(parsed, opts));
    }

    if (opts.strategies.includes('semantic')) {
      searchPromises.push(this.semanticSearch(parsed, opts));
    }

    if (opts.strategies.includes('graph') && this.graphTraversal) {
      searchPromises.push(this.graphSearch(parsed, opts));
    }

    const allResults = await Promise.all(searchPromises);
    for (const results of allResults) {
      rawResults.push(...results);
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
    return this.hydrateResults(limited);
  }

  /**
   * Keyword/FTS search.
   */
  private async keywordSearch(
    parsed: ParsedQuery,
    options: Required<MultiSearchOptions>
  ): Promise<RawResult[]> {
    const results: RawResult[] = [];

    // Search with all keywords joined
    if (parsed.keywords.length > 0) {
      const searchQuery = parsed.keywords.join(' ');
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

    return results;
  }

  /**
   * Semantic/vector search.
   */
  private async semanticSearch(
    parsed: ParsedQuery,
    options: Required<MultiSearchOptions>
  ): Promise<RawResult[]> {
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
  }

  /**
   * Graph-based search starting from entity mentions.
   */
  private async graphSearch(
    parsed: ParsedQuery,
    options: Required<MultiSearchOptions>
  ): Promise<RawResult[]> {
    if (!this.graphTraversal) return [];

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
