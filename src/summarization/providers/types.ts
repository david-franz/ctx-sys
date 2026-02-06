/**
 * F10.6: LLM Provider types for summarization.
 */

import { EntityType } from '../../entities';

/**
 * Options for summarization request.
 */
export interface SummarizeOptions {
  /** Type of code entity */
  entityType: string;

  /** Entity name for context */
  name: string;

  /** File path for context */
  filePath?: string;

  /** Maximum tokens for response */
  maxTokens?: number;

  /** Temperature for creativity (0-1) */
  temperature?: number;
}

/**
 * Item to summarize in a batch.
 */
export interface SummarizeItem {
  id: string;
  content: string;
  options: SummarizeOptions;
}

/**
 * Interface for LLM summarization providers.
 */
export interface SummarizationProvider {
  /** Provider identifier */
  readonly id: string;

  /** Model being used */
  readonly model: string;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;

  /** Generate summary for content */
  summarize(content: string, options: SummarizeOptions): Promise<string>;

  /** Batch summarization for efficiency */
  summarizeBatch(items: SummarizeItem[]): Promise<string[]>;
}

/**
 * Options for Ollama provider.
 */
export interface OllamaOptions {
  baseUrl?: string;
  model?: string;
  concurrency?: number;
}

/**
 * Options for OpenAI provider.
 */
export interface OpenAIOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Options for Anthropic provider.
 */
export interface AnthropicOptions {
  apiKey?: string;
  model?: string;
}
