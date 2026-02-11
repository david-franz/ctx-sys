/**
 * F10.6: LLM Summarization Manager.
 * Orchestrates multiple LLM providers for intelligent code summarization.
 */

import { Symbol, ParseResult } from '../ast';
import { LLMSummarizer } from './types';
import {
  SummarizationProvider,
  SummarizeItem,
  OllamaSummarizationProvider,
  OpenAISummarizationProvider,
  AnthropicSummarizationProvider,
  OllamaOptions,
  OpenAIOptions,
  AnthropicOptions
} from './providers';
import { Logger, consoleLogger } from '../utils/logger';

/**
 * Configuration for the LLM summarization manager.
 */
export interface LLMManagerConfig {
  /** Provider preference order (custom providers can be registered) */
  providers?: string[];

  /** Ollama settings */
  ollama?: OllamaOptions;

  /** OpenAI settings */
  openai?: OpenAIOptions;

  /** Anthropic settings */
  anthropic?: AnthropicOptions;

  /** Batch size for processing */
  batchSize?: number;

  /** Max retries on failure */
  maxRetries?: number;

  /** Timeout per request in ms */
  timeout?: number;

  /** Logger instance */
  logger?: Logger;
}

/**
 * Result of summarization operation.
 */
export interface SummarizeResult {
  summarized: number;
  skipped: number;
  failed: number;
  provider: string | null;
  error?: string;
  /** Map of entity ID → generated summary text */
  summaries: Map<string, string>;
}

/**
 * Entity to summarize.
 */
export interface EntityForSummary {
  id: string;
  name: string;
  type: string;
  content: string;
  filePath?: string;
  contentHash?: string;
}

/**
 * Summarization statistics.
 */
export interface SummarizationStats {
  totalEntities: number;
  entitiesWithSummary: number;
  staleSummaries: number;
  coveragePercent: number;
}

/**
 * Manages LLM-based summarization with multiple provider support.
 */
export class LLMSummarizationManager implements LLMSummarizer {
  private providers: Map<string, SummarizationProvider> = new Map();
  private preferenceOrder: string[];
  private activeProvider: SummarizationProvider | null = null;
  private batchSize: number;
  private maxRetries: number;
  private logger: Logger;

  constructor(config: LLMManagerConfig = {}) {
    this.preferenceOrder = config.providers || ['ollama', 'openai', 'anthropic'];
    this.batchSize = config.batchSize || 20;
    this.maxRetries = config.maxRetries || 3;
    this.logger = config.logger ?? consoleLogger;

    // Initialize providers
    this.providers.set('ollama', new OllamaSummarizationProvider(config.ollama));
    this.providers.set('openai', new OpenAISummarizationProvider(config.openai));
    this.providers.set('anthropic', new AnthropicSummarizationProvider(config.anthropic));
  }

  /**
   * Get the first available provider based on preference order.
   */
  async getProvider(): Promise<SummarizationProvider | null> {
    if (this.activeProvider) return this.activeProvider;

    for (const providerId of this.preferenceOrder) {
      const provider = this.providers.get(providerId);
      if (provider && await provider.isAvailable()) {
        this.activeProvider = provider;
        return provider;
      }
    }

    return null;
  }

  /**
   * Check which providers are available.
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];

    for (const [id, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(id);
      }
    }

    return available;
  }

  /**
   * Get current active provider ID.
   */
  getActiveProviderId(): string | null {
    return this.activeProvider?.id || null;
  }

  /**
   * Register a custom provider.
   */
  registerProvider(id: string, provider: SummarizationProvider): void {
    this.providers.set(id, provider);
  }

  /**
   * Summarize a single symbol (implements LLMSummarizer interface).
   */
  async summarizeSymbol(symbol: Symbol, context?: string): Promise<string> {
    const provider = await this.getProvider();
    if (!provider) {
      throw new Error('No LLM provider available');
    }

    // Build content to summarize
    const content = this.buildSymbolContent(symbol, context);

    return provider.summarize(content, {
      entityType: symbol.type,
      name: symbol.name,
      maxTokens: 150,
      temperature: 0.3
    });
  }

  /**
   * Summarize a file (implements LLMSummarizer interface).
   */
  async summarizeFile(parseResult: ParseResult): Promise<string> {
    const provider = await this.getProvider();
    if (!provider) {
      throw new Error('No LLM provider available');
    }

    // Build file overview content
    const content = this.buildFileContent(parseResult);

    return provider.summarize(content, {
      entityType: 'file',
      name: parseResult.filePath,
      maxTokens: 200,
      temperature: 0.3
    });
  }

  /**
   * Summarize multiple entities with progress tracking.
   */
  async summarizeEntities(
    entities: EntityForSummary[],
    options?: {
      force?: boolean;
      onProgress?: (completed: number, total: number, skipped: number) => void;
    }
  ): Promise<SummarizeResult> {
    const provider = await this.getProvider();

    if (!provider) {
      return {
        summarized: 0,
        skipped: entities.length,
        failed: 0,
        provider: null,
        error: 'No summarization provider available',
        summaries: new Map()
      };
    }

    // For incremental updates, caller should filter entities needing summarization
    const toSummarize = entities;

    if (toSummarize.length === 0) {
      return {
        summarized: 0,
        skipped: 0,
        failed: 0,
        provider: provider.id,
        summaries: new Map()
      };
    }

    // Process in batches
    let summarized = 0;
    let failed = 0;
    const summaries: Map<string, string> = new Map();

    for (let i = 0; i < toSummarize.length; i += this.batchSize) {
      const batch = toSummarize.slice(i, i + this.batchSize);

      const items: SummarizeItem[] = batch.map(entity => ({
        id: entity.id,
        content: entity.content,
        options: {
          entityType: entity.type,
          name: entity.name,
          filePath: entity.filePath
        }
      }));

      try {
        const batchSummaries = await this.summarizeBatchWithRetry(provider, items);

        for (let j = 0; j < batch.length; j++) {
          const entity = batch[j];
          const summary = batchSummaries[j];

          if (summary) {
            summaries.set(entity.id, summary);
            summarized++;
          } else {
            failed++;
          }
        }
      } catch (error) {
        this.logger.error(`Batch summarization failed:`, error);
        failed += batch.length;
      }

      options?.onProgress?.(summarized, toSummarize.length, 0);
    }

    return {
      summarized,
      skipped: 0,
      failed,
      provider: provider.id,
      summaries
    };
  }

  /**
   * Summarize a batch with retry logic.
   */
  private async summarizeBatchWithRetry(
    provider: SummarizationProvider,
    items: SummarizeItem[]
  ): Promise<string[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await provider.summarizeBatch(items);
      } catch (error) {
        lastError = error as Error;
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    throw lastError;
  }

  /**
   * Build content string for symbol summarization.
   */
  private buildSymbolContent(symbol: Symbol, context?: string): string {
    const parts: string[] = [];

    // Add signature if available
    if (symbol.signature) {
      parts.push(symbol.signature);
    }

    // Add parameters info
    if (symbol.parameters && symbol.parameters.length > 0) {
      const params = symbol.parameters.map(p => {
        let param = p.name;
        if (p.type) param += `: ${p.type}`;
        if (p.isOptional) param += ' (optional)';
        return param;
      });
      parts.push(`Parameters: ${params.join(', ')}`);
    }

    // Add return type
    if (symbol.returnType) {
      parts.push(`Returns: ${symbol.returnType}`);
    }

    // Add docstring if available
    if (symbol.docstring) {
      parts.push(`Documentation: ${symbol.docstring}`);
    }

    // Add context if provided
    if (context) {
      parts.push(`Context: ${context}`);
    }

    // Add children info for classes
    if (symbol.type === 'class' && symbol.children) {
      const methods = symbol.children.filter(c => c.type === 'method');
      const props = symbol.children.filter(c => c.type === 'property');
      if (methods.length > 0) {
        parts.push(`Methods: ${methods.map(m => m.name).join(', ')}`);
      }
      if (props.length > 0) {
        parts.push(`Properties: ${props.map(p => p.name).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Build content string for file summarization.
   */
  private buildFileContent(parseResult: ParseResult): string {
    const parts: string[] = [];

    parts.push(`File: ${parseResult.filePath}`);
    parts.push(`Language: ${parseResult.language}`);

    // Add imports
    if (parseResult.imports.length > 0) {
      const deps = parseResult.imports.map(i => i.source).slice(0, 10);
      parts.push(`Dependencies: ${deps.join(', ')}`);
    }

    // Add exports
    if (parseResult.exports.length > 0) {
      parts.push(`Exports: ${parseResult.exports.slice(0, 10).join(', ')}`);
    }

    // Add symbol summary
    const symbolInfo: string[] = [];
    for (const symbol of parseResult.symbols.slice(0, 15)) {
      if (symbol.signature) {
        symbolInfo.push(symbol.signature);
      } else {
        symbolInfo.push(`${symbol.type} ${symbol.name}`);
      }
    }

    if (symbolInfo.length > 0) {
      parts.push(`Symbols:\n${symbolInfo.join('\n')}`);
    }

    return parts.join('\n');
  }
}
