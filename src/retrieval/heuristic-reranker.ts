/**
 * F10c.3 / F10g.2: Fast heuristic reranker with multiplicative scoring.
 * Uses content signals to improve result ordering without requiring an LLM.
 * Scores are normalized to [0, 1] after reranking.
 */

import { SearchResult, SearchStrategy } from './types';

export interface RerankerResult {
  entityId: string;
  originalScore: number;
  rerankedScore: number;
  source: SearchStrategy;
}

export interface Reranker {
  rerank(
    query: string,
    candidates: SearchResult[],
    options?: { limit?: number }
  ): Promise<RerankerResult[]>;
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
  'in', 'with', 'to', 'for', 'of', 'not', 'no', 'can', 'had', 'has',
  'have', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'shall', 'this', 'that', 'these', 'those', 'how',
  'what', 'why', 'where', 'when', 'who', 'from', 'into', 'about'
]);

/**
 * Fast, no-model reranker using multiplicative scoring.
 * All scores are normalized to [0, 1] after reranking.
 */
export class HeuristicReranker implements Reranker {
  async rerank(
    query: string,
    candidates: SearchResult[],
    options?: { limit?: number }
  ): Promise<RerankerResult[]> {
    const queryTerms = this.extractTerms(query);
    const queryLower = query.toLowerCase();

    const results = candidates.map(candidate => {
      let multiplier = 1.0;
      const entity = candidate.entity;

      // Exact name match — strong signal
      if (entity.name.toLowerCase() === queryLower) {
        multiplier *= 3.0;
      }

      // Name contains query terms
      const nameLower = entity.name.toLowerCase();
      const nameHits = queryTerms.filter(t => nameLower.includes(t)).length;
      if (queryTerms.length > 0 && nameHits > 0) {
        multiplier *= 1.0 + (nameHits / queryTerms.length) * 1.5;
      }

      // Summary relevance
      if (entity.summary) {
        const summaryLower = entity.summary.toLowerCase();
        const termHits = queryTerms.filter(t => summaryLower.includes(t)).length;
        if (queryTerms.length > 0 && termHits > 0) {
          multiplier *= 1.0 + (termHits / queryTerms.length) * 0.5;
        }
      }

      // Penalize very short content (likely stubs)
      if (entity.content && entity.content.length < 50) {
        multiplier *= 0.5;
      }

      // Boost entities with more connections (higher importance)
      const connectionCount = (entity.metadata as Record<string, unknown>)?.connectionCount;
      if (typeof connectionCount === 'number' && connectionCount > 5) {
        multiplier *= 1.15;
      }

      // Entity type weight
      const typeMultipliers: Record<string, number> = {
        'class': 1.3,
        'function': 1.2,
        'method': 1.2,
        'interface': 1.1,
        'type': 1.1,
        'document': 1.2,
        'section': 1.1,
        'file': 0.7,
        'module': 0.8,
      };
      multiplier *= typeMultipliers[entity.type] || 1.0;

      // F10e.7: Instruction priority boost
      if (entity.type === 'instruction') {
        const meta = entity.metadata as Record<string, unknown> | undefined;
        const priority = meta?.priority as string || 'normal';
        const priorityMultiplier = priority === 'high' ? 2.0 : priority === 'low' ? 0.5 : 1.0;
        multiplier *= priorityMultiplier;

        // Only count active instructions
        if (meta?.active === false) {
          multiplier *= 0.001; // Effectively hide inactive instructions
        }
      }

      return {
        entityId: entity.id,
        originalScore: candidate.score,
        rerankedScore: candidate.score * multiplier,
        source: candidate.source
      };
    });

    // Normalize scores to [0, 1] using max score
    const maxScore = Math.max(...results.map(r => r.rerankedScore), 0.001);
    for (const r of results) {
      r.rerankedScore = r.rerankedScore / maxScore;
    }

    results.sort((a, b) => b.rerankedScore - a.rerankedScore);

    if (options?.limit) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  private extractTerms(query: string): string[] {
    return query.toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2)
      .filter(t => !STOP_WORDS.has(t));
  }
}
