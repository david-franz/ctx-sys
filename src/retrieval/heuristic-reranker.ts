/**
 * F10c.3: Fast heuristic reranker that uses content signals
 * to boost relevant results without requiring an LLM.
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
 * Fast, no-model reranker that uses content signals to improve result ordering.
 * Adds < 5ms latency.
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
      let boost = 0;
      const entity = candidate.entity;

      // Exact name match boost
      if (entity.name.toLowerCase() === queryLower) {
        boost += 2.0;
      }

      // Name contains query terms
      const nameLower = entity.name.toLowerCase();
      for (const term of queryTerms) {
        if (nameLower.includes(term)) boost += 0.5;
      }

      // Summary relevance
      if (entity.summary) {
        const summaryLower = entity.summary.toLowerCase();
        const termHits = queryTerms.filter(t => summaryLower.includes(t)).length;
        if (queryTerms.length > 0) {
          boost += (termHits / queryTerms.length) * 0.3;
        }
      }

      // Penalize very short content (likely stubs)
      if (entity.content && entity.content.length < 50) {
        boost -= 0.3;
      }

      // Boost entities with more connections (higher importance)
      const connectionCount = (entity.metadata as Record<string, unknown>)?.connectionCount;
      if (typeof connectionCount === 'number' && connectionCount > 5) {
        boost += 0.2;
      }

      // F10e.7: Instruction priority boost
      if (entity.type === 'instruction') {
        const meta = entity.metadata as Record<string, unknown> | undefined;
        const priority = meta?.priority as string || 'normal';
        const priorityBoost = priority === 'high' ? 1.5 : priority === 'low' ? 0.5 : 1.0;
        boost += (priorityBoost - 1.0); // high=+0.5, normal=0, low=-0.5

        // Only count active instructions
        if (meta?.active === false) {
          boost -= 10; // Effectively hide inactive instructions
        }
      }

      return {
        entityId: entity.id,
        originalScore: candidate.score,
        rerankedScore: candidate.score + boost,
        source: candidate.source
      };
    });

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
