/**
 * F10.12: LLM-based Re-ranking.
 * Uses a local LLM to score relevance of search results against a query.
 */

import { SearchResult } from './types';

export interface RerankerConfig {
  baseUrl?: string;
  model?: string;
  topK?: number;
  timeout?: number;
}

const DEFAULT_CONFIG: Required<RerankerConfig> = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen3:0.6b',
  topK: 20,
  timeout: 10000,
};

export interface RerankResult {
  results: SearchResult[];
  reranked: boolean;
}

export class LLMReranker {
  private config: Required<RerankerConfig>;

  constructor(config?: RerankerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Re-rank search results using LLM relevance scoring.
   * Only re-ranks the top-K candidates for performance.
   */
  async rerank(query: string, results: SearchResult[]): Promise<RerankResult> {
    if (results.length === 0) {
      return { results: [], reranked: false };
    }

    // Only re-rank top-K
    const toRerank = results.slice(0, this.config.topK);
    const rest = results.slice(this.config.topK);

    try {
      const scored = await this.scoreResults(query, toRerank);
      // Merge with non-reranked results (keep original order for rest)
      const combined = [...scored, ...rest];
      return { results: combined, reranked: true };
    } catch {
      // LLM unavailable — return original order
      return { results, reranked: false };
    }
  }

  private async scoreResults(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    const scoredResults: Array<{ result: SearchResult; llmScore: number }> = [];

    // Score each result individually for reliability
    for (const result of results) {
      const snippet = this.buildSnippet(result);
      const score = await this.scoreSingle(query, snippet);
      scoredResults.push({ result, llmScore: score });
    }

    // Sort by LLM score descending
    scoredResults.sort((a, b) => b.llmScore - a.llmScore);

    // Normalize scores to 0-1 range and blend with original score
    const maxScore = Math.max(...scoredResults.map(r => r.llmScore), 1);
    return scoredResults.map(({ result, llmScore }) => ({
      ...result,
      score: (llmScore / maxScore) * 0.7 + result.score * 0.3,
    }));
  }

  private async scoreSingle(query: string, snippet: string): Promise<number> {
    const prompt = `Rate the relevance of this code snippet to the query on a scale of 0-10.

Query: ${query}

Snippet:
${snippet}

Reply with ONLY a number 0-10.`;

    const response = await this.callLLM(prompt);
    return this.parseScore(response);
  }

  private buildSnippet(result: SearchResult): string {
    const entity = result.entity;
    const parts: string[] = [];
    if (entity.type) parts.push(`[${entity.type}] ${entity.name}`);
    if (entity.summary) parts.push(entity.summary);
    if (entity.content) {
      // Truncate content to avoid token limits
      const truncated = entity.content.length > 500
        ? entity.content.slice(0, 500) + '...'
        : entity.content;
      parts.push(truncated);
    }
    return parts.join('\n');
  }

  private parseScore(response: string): number {
    // Strip <think> tags if present
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const match = cleaned.match(/(\d+)/);
    if (match) {
      const score = parseInt(match[1], 10);
      return Math.min(10, Math.max(0, score));
    }
    return 5; // Default middle score on parse failure
  }

  private async callLLM(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: { temperature: 0.0, num_predict: 10 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      return data.response || '';
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Check if the LLM is available for re-ranking.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
