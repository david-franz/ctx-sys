/**
 * Retrieval gating to decide if context retrieval is needed.
 * Saves compute and latency by skipping unnecessary searches.
 */

import { QueryParser, ParsedQuery, QueryIntent } from './query-parser';
import { SearchStrategy } from './types';

/**
 * Provider interface for model-based gating decisions.
 */
export interface GateModelProvider {
  /**
   * Generate a gating decision response.
   */
  complete(options: { prompt: string; maxTokens?: number; temperature?: number }): Promise<{ text: string }>;
}

/**
 * Decision from the retrieval gate.
 */
export interface GateDecision {
  /** Whether to perform retrieval */
  shouldRetrieve: boolean;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** Explanation for the decision */
  reason: string;
  /** Suggested search strategy if retrieving */
  suggestedStrategy?: SearchStrategy;
  /** Expected relevance of results */
  estimatedRelevance?: number;
}

/**
 * Context for making gate decisions.
 */
export interface GateContext {
  /** The query to evaluate */
  query: string;
  /** Recent conversation for context */
  conversationHistory?: string;
  /** Available entity types in the project */
  availableEntityTypes?: string[];
  /** Description of the project */
  projectDescription?: string;
}

/**
 * Configuration for the retrieval gate.
 */
export interface GateConfig {
  /** Whether gating is enabled */
  enabled: boolean;
  /** Confidence threshold - below this, retrieve anyway */
  confidenceThreshold: number;
  /** Maximum input tokens for model */
  maxInputTokens: number;
  /** Whether to cache decisions */
  cacheDecisions: boolean;
  /** Cache TTL in seconds */
  cacheTTLSeconds: number;
}

/**
 * Default gate configuration.
 */
export const DEFAULT_GATE_CONFIG: GateConfig = {
  enabled: true,
  confidenceThreshold: 0.7,
  maxInputTokens: 500,
  cacheDecisions: true,
  cacheTTLSeconds: 300 // 5 minutes
};

/**
 * Cached gate decision.
 */
interface CachedDecision {
  decision: GateDecision;
  expires: number;
}

/**
 * Mock model provider for testing.
 */
export class MockGateModelProvider implements GateModelProvider {
  async complete(options: { prompt: string }): Promise<{ text: string }> {
    // Simple pattern-based mock response
    const prompt = options.prompt.toLowerCase();

    if (prompt.includes('authentication') || prompt.includes('auth')) {
      return {
        text: JSON.stringify({
          shouldRetrieve: true,
          confidence: 0.9,
          reason: 'Query about authentication requires project context',
          suggestedStrategy: 'semantic'
        })
      };
    }

    if (prompt.includes('general') || prompt.includes('javascript') || prompt.includes('python')) {
      return {
        text: JSON.stringify({
          shouldRetrieve: false,
          confidence: 0.85,
          reason: 'General programming question, not project-specific'
        })
      };
    }

    // Default to retrieving for ambiguous queries
    return {
      text: JSON.stringify({
        shouldRetrieve: true,
        confidence: 0.6,
        reason: 'Ambiguous query, retrieving to check for relevant context',
        suggestedStrategy: 'semantic'
      })
    };
  }
}

/**
 * Retrieval gate that decides whether to perform context retrieval.
 */
export class RetrievalGate {
  private cache: Map<string, CachedDecision> = new Map();
  private queryParser: QueryParser;

  constructor(
    private modelProvider?: GateModelProvider,
    private config: GateConfig = DEFAULT_GATE_CONFIG,
    queryParser?: QueryParser
  ) {
    this.queryParser = queryParser ?? new QueryParser();
  }

  /**
   * Determine if retrieval is needed for this query.
   */
  async shouldRetrieve(context: GateContext): Promise<GateDecision> {
    // If gate is disabled, always retrieve
    if (!this.config.enabled) {
      return {
        shouldRetrieve: true,
        confidence: 1,
        reason: 'Gate disabled, defaulting to retrieve'
      };
    }

    // Check cache first
    const cached = this.getCached(context.query);
    if (cached) {
      return cached;
    }

    // Fast path: pattern-based decisions
    const fastDecision = this.fastPathDecision(context.query);
    if (fastDecision) {
      this.cacheDecision(context.query, fastDecision);
      return fastDecision;
    }

    // Slow path: model-based decision
    if (this.modelProvider) {
      const modelDecision = await this.modelBasedDecision(context);
      this.cacheDecision(context.query, modelDecision);
      return modelDecision;
    }

    // No model provider, default to retrieve
    const defaultDecision: GateDecision = {
      shouldRetrieve: true,
      confidence: 0.5,
      reason: 'No model provider, defaulting to retrieve'
    };
    this.cacheDecision(context.query, defaultDecision);
    return defaultDecision;
  }

  /**
   * Fast pattern-based decisions (no model call needed).
   */
  private fastPathDecision(query: string): GateDecision | null {
    const parsed = this.queryParser.parse(query);

    // Always retrieve for code-specific queries (backtick mentions)
    if (parsed.entityMentions.length > 0) {
      const hasSpecificEntity = parsed.entityMentions.some(
        m => m.type === 'file' || m.type === 'function' || m.type === 'class'
      );
      if (hasSpecificEntity) {
        return {
          shouldRetrieve: true,
          confidence: 0.95,
          reason: 'Query mentions specific code entities',
          suggestedStrategy: 'keyword'
        };
      }
    }

    // Always retrieve for project-specific intents
    const projectIntents: QueryIntent[] = ['find', 'list', 'debug'];
    if (projectIntents.includes(parsed.intent)) {
      return {
        shouldRetrieve: true,
        confidence: 0.9,
        reason: `Intent '${parsed.intent}' typically requires project context`,
        suggestedStrategy: parsed.intent === 'debug' ? 'graph' : 'semantic'
      };
    }

    // Never retrieve for basic/trivial queries
    if (this.isBasicQuery(query)) {
      return {
        shouldRetrieve: false,
        confidence: 0.99,
        reason: 'Basic query pattern detected'
      };
    }

    // Never retrieve for greetings
    if (this.isGreeting(query)) {
      return {
        shouldRetrieve: false,
        confidence: 0.99,
        reason: 'Greeting detected'
      };
    }

    // Never retrieve for confirmations
    if (this.isConfirmation(query)) {
      return {
        shouldRetrieve: false,
        confidence: 0.99,
        reason: 'Confirmation detected'
      };
    }

    // General programming questions often don't need project context
    if (this.isGeneralProgrammingQuestion(query)) {
      return {
        shouldRetrieve: false,
        confidence: 0.8,
        reason: 'General programming question'
      };
    }

    return null; // Need model decision
  }

  /**
   * Check if query is a basic/trivial query.
   */
  private isBasicQuery(query: string): boolean {
    const patterns = [
      /^what('s| is) \d+\s*[\+\-\*\/]\s*\d+/i, // Math
      /^(\d+\s*[\+\-\*\/]\s*)+\d+/i, // Pure math expressions
    ];

    return patterns.some(p => p.test(query));
  }

  /**
   * Check if query is a greeting.
   */
  private isGreeting(query: string): boolean {
    const patterns = [
      /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))/i,
      /^(thanks|thank\s*you|ty|thx)/i
    ];

    return patterns.some(p => p.test(query.trim()));
  }

  /**
   * Check if query is a confirmation.
   */
  private isConfirmation(query: string): boolean {
    const normalized = query.trim().toLowerCase();
    const confirmations = ['yes', 'no', 'okay', 'ok', 'sure', 'yep', 'nope', 'yeah', 'nah'];
    return confirmations.includes(normalized);
  }

  /**
   * Check if query is a general programming question.
   */
  private isGeneralProgrammingQuestion(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    // Questions about general concepts
    const generalPatterns = [
      /what('s| is) the difference between/i,
      /how (do|does) (a |the )?(variable|function|class|method|loop|array|object)/i,
      /what (is|are) (a |the )?(variable|function|class|method|loop|array|object)/i,
      /explain (the concept of|what|how)/i
    ];

    // General programming keywords without project-specific context
    const generalKeywords = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'rust', 'go',
      'variable', 'function', 'loop', 'array', 'object', 'class',
      'async', 'await', 'promise', 'callback',
      'rest api', 'http', 'json', 'xml'
    ];

    // Check if it's a "what is X" pattern without project specifics
    if (generalPatterns.some(p => p.test(query))) {
      // But still retrieve if it mentions specific project terms
      const hasProjectTerms = /our|my|this|the project|codebase/i.test(query);
      return !hasProjectTerms;
    }

    // Check for general programming keywords without "our" or "my"
    const hasGeneralKeyword = generalKeywords.some(k => lowerQuery.includes(k));
    const hasProjectReference = /our|my|this (project|codebase|system)/i.test(query);

    return hasGeneralKeyword && !hasProjectReference;
  }

  /**
   * Model-based gating decision.
   */
  private async modelBasedDecision(context: GateContext): Promise<GateDecision> {
    try {
      const prompt = this.buildGatePrompt(context);

      const response = await this.modelProvider!.complete({
        prompt,
        maxTokens: 100,
        temperature: 0.1 // Very low for consistent decisions
      });

      return this.parseGateResponse(response.text);
    } catch (error) {
      // Default to retrieving on error
      return {
        shouldRetrieve: true,
        confidence: 0.5,
        reason: `Model error, defaulting to retrieve: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Build the prompt for model-based gating.
   */
  private buildGatePrompt(context: GateContext): string {
    const projectContext = context.projectDescription
      ? `Project: ${context.projectDescription}\n`
      : '';

    const entityContext = context.availableEntityTypes?.length
      ? `Available context types: ${context.availableEntityTypes.join(', ')}\n`
      : '';

    const historyContext = context.conversationHistory
      ? `Recent conversation: ${context.conversationHistory.slice(0, this.config.maxInputTokens)}\n`
      : '';

    return `You are a retrieval gate. Decide if answering this query requires searching the codebase/documentation.

${projectContext}${entityContext}${historyContext}
Query: "${context.query}"

Respond in JSON format:
{
  "shouldRetrieve": true/false,
  "confidence": 0.0-1.0,
  "reason": "brief explanation",
  "suggestedStrategy": "keyword" | "semantic" | "graph" | null
}

Guidelines:
- shouldRetrieve=true for: code questions, project-specific info, debugging, finding files
- shouldRetrieve=false for: general knowledge, math, greetings, opinions, common programming concepts
- High confidence (>0.9) when clearly one or the other
- Lower confidence when ambiguous

JSON response:`;
  }

  /**
   * Parse the model response into a gate decision.
   */
  private parseGateResponse(response: string): GateDecision {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        shouldRetrieve: Boolean(parsed.shouldRetrieve),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
        reason: String(parsed.reason || 'Model decision'),
        suggestedStrategy: this.validateStrategy(parsed.suggestedStrategy)
      };
    } catch {
      // Default to retrieving on parse failure
      return {
        shouldRetrieve: true,
        confidence: 0.5,
        reason: 'Failed to parse gate response, defaulting to retrieve'
      };
    }
  }

  /**
   * Validate and normalize suggested strategy.
   */
  private validateStrategy(strategy: unknown): SearchStrategy | undefined {
    const validStrategies: SearchStrategy[] = ['keyword', 'semantic', 'graph', 'structural', 'hybrid'];
    if (typeof strategy === 'string' && validStrategies.includes(strategy as SearchStrategy)) {
      return strategy as SearchStrategy;
    }
    return undefined;
  }

  /**
   * Get cached decision.
   */
  private getCached(query: string): GateDecision | null {
    if (!this.config.cacheDecisions) return null;

    const cached = this.cache.get(query);
    if (cached && cached.expires > Date.now()) {
      return cached.decision;
    }

    this.cache.delete(query);
    return null;
  }

  /**
   * Cache a decision.
   */
  private cacheDecision(query: string, decision: GateDecision): void {
    if (!this.config.cacheDecisions) return;

    this.cache.set(query, {
      decision,
      expires: Date.now() + (this.config.cacheTTLSeconds * 1000)
    });
  }

  /**
   * Clear the decision cache.
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
   * Get current configuration.
   */
  getConfig(): GateConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<GateConfig>): void {
    Object.assign(this.config, updates);
  }
}
