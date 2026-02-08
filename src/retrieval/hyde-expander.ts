/**
 * HyDE (Hypothetical Document Embeddings) Query Expander.
 * Generates hypothetical answers to improve retrieval recall.
 */

import { EmbeddingManager } from '../embeddings';
import { QueryParser, ParsedQuery, QueryIntent } from './query-parser';

/**
 * Provider interface for generating hypothetical documents.
 */
export interface HypotheticalProvider {
  /**
   * Generate a hypothetical answer for a query.
   */
  generate(query: string, options?: HypotheticalOptions): Promise<string>;
}

/**
 * Options for hypothetical generation.
 */
export interface HypotheticalOptions {
  /** Entity types to focus on */
  entityTypes?: string[];
  /** Recent conversation context */
  recentContext?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
}

/**
 * Configuration for HyDE.
 */
export interface HyDEConfig {
  /** Whether HyDE is enabled */
  enabled: boolean;
  /** Minimum query length to trigger HyDE */
  minQueryLength: number;
  /** Maximum tokens for hypothetical answer */
  maxHypotheticalTokens: number;
  /** Whether to fall back to direct embedding on error */
  fallbackToDirectEmbed: boolean;
  /** Whether to cache hypothetical results */
  cacheHypothetical: boolean;
  /** Intents that should trigger HyDE */
  hydeIntents: QueryIntent[];
}

/**
 * Result of HyDE query expansion.
 */
export interface HyDEResult {
  /** Original query text */
  originalQuery: string;
  /** Generated hypothetical answer */
  hypotheticalAnswer: string;
  /** Embedding of the hypothetical answer */
  hypotheticalEmbedding: number[];
  /** Direct embedding of the original query */
  directEmbedding: number[];
  /** Whether HyDE was used */
  usedHyDE: boolean;
  /** Time taken for generation in ms */
  generationTimeMs: number;
}

/**
 * Context for query expansion.
 */
export interface HyDEQueryContext {
  /** The query to expand */
  query: string;
  /** Project ID for scoping */
  projectId: string;
  /** Entity types to focus on */
  entityTypes?: string[];
  /** Recent context for grounding */
  recentContext?: string;
}

/**
 * Default HyDE configuration.
 */
export const DEFAULT_HYDE_CONFIG: HyDEConfig = {
  enabled: true,
  minQueryLength: 10,
  maxHypotheticalTokens: 150,
  fallbackToDirectEmbed: true,
  cacheHypothetical: true,
  hydeIntents: ['explain', 'how', 'why', 'general']
};

/**
 * Mock hypothetical provider for testing.
 */
export class MockHypotheticalProvider implements HypotheticalProvider {
  async generate(query: string, options?: HypotheticalOptions): Promise<string> {
    // Generate a template-based hypothetical
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('authentication') || lowerQuery.includes('auth')) {
      return 'The authentication system validates user credentials through a multi-step process. It checks the username and password against the database, generates a JWT token on success, and manages session state through secure cookies.';
    }

    if (lowerQuery.includes('caching') || lowerQuery.includes('cache')) {
      return 'The caching system uses a multi-layer approach with in-memory LRU cache for frequently accessed data. Cache invalidation is handled through event-based updates when entities change.';
    }

    if (lowerQuery.includes('database') || lowerQuery.includes('db')) {
      return 'The database layer uses SQLite for persistent storage with connection pooling. Queries are executed through prepared statements to prevent SQL injection.';
    }

    if (lowerQuery.includes('error') || lowerQuery.includes('exception')) {
      return 'Error handling is implemented through try-catch blocks with custom error types. Errors are logged with context and stack traces for debugging.';
    }

    // Default hypothetical
    return `This functionality is implemented through a combination of modules that work together to handle ${query.split(' ').slice(0, 3).join(' ')}. The main components include data processing, validation, and storage layers.`;
  }
}

/**
 * Ollama-backed hypothetical provider using a local LLM.
 */
export class OllamaHypotheticalProvider implements HypotheticalProvider {
  private baseUrl: string;
  private model: string;

  constructor(options?: { baseUrl?: string; model?: string }) {
    this.baseUrl = options?.baseUrl || 'http://localhost:11434';
    this.model = options?.model || 'gemma3:4b';
  }

  async generate(query: string, options?: HypotheticalOptions): Promise<string> {
    const prompt = buildHypotheticalPrompt(query, options);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `/no_think\n${prompt}`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: options?.maxTokens ?? 150
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json() as { response: string };
    // Strip <think> blocks from Qwen3
    let cleaned = data.response.replace(/<think>[\s\S]*?<\/think>/g, '');
    cleaned = cleaned.replace(/^<think>[\s\S]*$/, '');
    return cleaned.trim();
  }
}

/**
 * Expands queries using Hypothetical Document Embeddings (HyDE).
 */
export class HyDEQueryExpander {
  private cache: Map<string, HyDEResult> = new Map();
  private queryParser: QueryParser;

  constructor(
    private hypotheticalProvider: HypotheticalProvider,
    private embeddingManager: EmbeddingManager,
    private config: HyDEConfig = DEFAULT_HYDE_CONFIG,
    queryParser?: QueryParser
  ) {
    this.queryParser = queryParser ?? new QueryParser();
  }

  /**
   * Determine if HyDE should be used for this query.
   */
  shouldUseHyDE(query: string | ParsedQuery): boolean {
    if (!this.config.enabled) return false;

    const parsed = typeof query === 'string'
      ? this.queryParser.parse(query)
      : query;

    // Skip for very short queries
    if (parsed.original.length < this.config.minQueryLength) {
      return false;
    }

    // Skip for very specific queries (backtick mentions with high confidence)
    if (parsed.entityMentions.length > 0) {
      const hasSpecificMention = parsed.entityMentions.some(
        m => m.type === 'file' || m.type === 'function' || m.type === 'class'
      );
      if (hasSpecificMention) {
        return false;
      }
    }

    // Use HyDE for conceptual/explanatory intents
    return this.config.hydeIntents.includes(parsed.intent);
  }

  /**
   * Expand a query using HyDE.
   */
  async expandQuery(context: HyDEQueryContext): Promise<HyDEResult> {
    const cacheKey = `${context.projectId}:${context.query}`;

    // Check cache
    if (this.config.cacheHypothetical && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const startTime = Date.now();

    // Always compute direct embedding as fallback
    const directEmbedding = await this.embeddingManager.embedText(context.query);

    try {
      // Generate hypothetical answer
      const hypotheticalAnswer = await this.hypotheticalProvider.generate(
        context.query,
        {
          entityTypes: context.entityTypes,
          recentContext: context.recentContext,
          maxTokens: this.config.maxHypotheticalTokens
        }
      );

      // Embed the hypothetical
      const hypotheticalEmbedding = await this.embeddingManager.embedText(
        hypotheticalAnswer
      );

      const result: HyDEResult = {
        originalQuery: context.query,
        hypotheticalAnswer,
        hypotheticalEmbedding,
        directEmbedding,
        usedHyDE: true,
        generationTimeMs: Date.now() - startTime
      };

      if (this.config.cacheHypothetical) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      // Fallback to direct embedding
      if (this.config.fallbackToDirectEmbed) {
        return {
          originalQuery: context.query,
          hypotheticalAnswer: '',
          hypotheticalEmbedding: directEmbedding,
          directEmbedding,
          usedHyDE: false,
          generationTimeMs: Date.now() - startTime
        };
      }
      throw error;
    }
  }

  /**
   * Get the embedding to use for search.
   * Returns hypothetical embedding if HyDE was used, otherwise direct.
   */
  async getSearchEmbedding(
    query: string,
    projectId: string,
    options?: { entityTypes?: string[]; recentContext?: string }
  ): Promise<{ embedding: number[]; usedHyDE: boolean; hypothetical?: string }> {
    const parsed = this.queryParser.parse(query);

    if (this.shouldUseHyDE(parsed)) {
      const result = await this.expandQuery({
        query,
        projectId,
        entityTypes: options?.entityTypes,
        recentContext: options?.recentContext
      });

      return {
        embedding: result.hypotheticalEmbedding,
        usedHyDE: result.usedHyDE,
        hypothetical: result.hypotheticalAnswer
      };
    }

    // Direct embedding
    const embedding = await this.embeddingManager.embedText(query);
    return {
      embedding,
      usedHyDE: false
    };
  }

  /**
   * Clear the hypothetical cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): HyDEConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<HyDEConfig>): void {
    Object.assign(this.config, updates);
  }
}

/**
 * Build a prompt for generating hypothetical documents.
 * Useful for real LLM providers.
 */
export function buildHypotheticalPrompt(
  query: string,
  options?: HypotheticalOptions
): string {
  const typeHint = options?.entityTypes?.length
    ? `Focus on ${options.entityTypes.join(', ')} entities.`
    : '';

  const contextHint = options?.recentContext
    ? `Recent context: ${options.recentContext}\n`
    : '';

  return `You are a code documentation expert. Write a brief technical description (2-3 sentences) answering this question about a codebase. Include specific class names, function names, parameter types, and implementation patterns.

${contextHint}Question: ${query}

${typeHint}

Write as if you know the codebase. Use concrete technical terms, not generic descriptions. Mention specific types, modules, and patterns.

Answer:`;
}
