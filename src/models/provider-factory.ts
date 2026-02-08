/**
 * Provider factory for creating and managing embedding and summarization providers.
 * Supports automatic fallback when primary provider is unavailable.
 */

import {
  EmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
  MockEmbeddingProvider
} from '../embeddings';
import { LLMSummarizer } from '../summarization';
import { ConfigManager, GlobalConfig } from '../config';

/**
 * Configuration for a model provider.
 */
export interface ModelProviderConfig {
  provider: 'ollama' | 'openai' | 'anthropic' | 'mock';
  model: string;
}

/**
 * Health status of a provider.
 */
export interface ProviderHealth {
  available: boolean;
  lastChecked: Date;
  error?: string;
}

/**
 * Provider factory options.
 */
export interface ProviderFactoryOptions {
  /** ConfigManager instance (optional, will create default if not provided) */
  configManager?: ConfigManager;
  /** Health check cache TTL in milliseconds (default: 5 minutes) */
  healthCacheTTL?: number;
}

/**
 * Factory for creating embedding and summarization providers.
 */
export class ProviderFactory {
  private configManager: ConfigManager;
  private embeddingProviders: Map<string, EmbeddingProvider> = new Map();
  private summarizationProviders: Map<string, LLMSummarizer> = new Map();
  private healthCache: Map<string, ProviderHealth> = new Map();
  private healthCacheTTL: number;

  constructor(options: ProviderFactoryOptions = {}) {
    this.configManager = options.configManager ?? new ConfigManager({ inMemoryOnly: true });
    this.healthCacheTTL = options.healthCacheTTL ?? 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get an embedding provider.
   */
  async getEmbeddingProvider(config?: ModelProviderConfig): Promise<EmbeddingProvider> {
    const resolvedConfig = config ?? await this.getDefaultEmbeddingConfig();
    const key = this.getProviderKey('embedding', resolvedConfig);

    if (this.embeddingProviders.has(key)) {
      return this.embeddingProviders.get(key)!;
    }

    const provider = await this.createEmbeddingProvider(resolvedConfig);
    this.embeddingProviders.set(key, provider);
    return provider;
  }

  /**
   * Get an embedding provider with automatic fallback.
   */
  async getEmbeddingProviderWithFallback(
    primary?: ModelProviderConfig,
    fallback?: ModelProviderConfig
  ): Promise<EmbeddingProvider> {
    const primaryConfig = primary ?? await this.getDefaultEmbeddingConfig();
    const fallbackConfig = fallback ?? { provider: 'mock' as const, model: 'mock-embed' };

    try {
      const primaryProvider = await this.getEmbeddingProvider(primaryConfig);

      if (await this.checkHealth(primaryProvider)) {
        return primaryProvider;
      }

      console.warn(`Primary embedding provider ${primaryConfig.provider}:${primaryConfig.model} unavailable, using fallback`);
    } catch (error) {
      console.warn(`Failed to create primary embedding provider: ${error}`);
    }

    return this.getEmbeddingProvider(fallbackConfig);
  }

  /**
   * Get a summarization provider.
   */
  async getSummarizationProvider(config?: ModelProviderConfig): Promise<LLMSummarizer> {
    const resolvedConfig = config ?? await this.getDefaultSummarizationConfig();
    const key = this.getProviderKey('summarization', resolvedConfig);

    if (this.summarizationProviders.has(key)) {
      return this.summarizationProviders.get(key)!;
    }

    const provider = await this.createSummarizationProvider(resolvedConfig);
    this.summarizationProviders.set(key, provider);
    return provider;
  }

  /**
   * Get a summarization provider with automatic fallback.
   */
  async getSummarizationProviderWithFallback(
    primary?: ModelProviderConfig,
    fallback?: ModelProviderConfig
  ): Promise<LLMSummarizer> {
    const primaryConfig = primary ?? await this.getDefaultSummarizationConfig();
    const fallbackConfig = fallback ?? { provider: 'mock' as const, model: 'mock-summarizer' };

    try {
      const primaryProvider = await this.getSummarizationProvider(primaryConfig);

      if (await this.checkSummarizationHealth(primaryProvider)) {
        return primaryProvider;
      }

      console.warn(`Primary summarization provider ${primaryConfig.provider}:${primaryConfig.model} unavailable, using fallback`);
    } catch (error) {
      console.warn(`Failed to create primary summarization provider: ${error}`);
    }

    return this.getSummarizationProvider(fallbackConfig);
  }

  /**
   * Check if an embedding provider is healthy.
   */
  async checkHealth(provider: EmbeddingProvider): Promise<boolean> {
    const key = `${provider.name}:${provider.modelId}`;
    const cached = this.getCachedHealth(key);

    if (cached !== undefined) {
      return cached;
    }

    try {
      const available = await provider.isAvailable();
      this.setCachedHealth(key, available);
      return available;
    } catch (error) {
      this.setCachedHealth(key, false, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Check if a summarization provider is healthy.
   */
  async checkSummarizationHealth(provider: LLMSummarizer): Promise<boolean> {
    // LLMSummarizer doesn't have isAvailable, so we try a simple call
    const key = `summarizer:${(provider as any).name ?? 'unknown'}`;
    const cached = this.getCachedHealth(key);

    if (cached !== undefined) {
      return cached;
    }

    try {
      // Try to summarize a minimal symbol to test availability
      await provider.summarizeSymbol({
        name: 'test',
        type: 'function',
        qualifiedName: 'test',
        startLine: 1,
        endLine: 1
      });
      this.setCachedHealth(key, true);
      return true;
    } catch (error) {
      this.setCachedHealth(key, false, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get health status for all cached providers.
   */
  getHealthStatus(): Map<string, ProviderHealth> {
    return new Map(this.healthCache);
  }

  /**
   * Clear health cache.
   */
  clearHealthCache(): void {
    this.healthCache.clear();
  }

  /**
   * Clear all provider caches.
   */
  clearAll(): void {
    this.embeddingProviders.clear();
    this.summarizationProviders.clear();
    this.healthCache.clear();
  }

  /**
   * Create an embedding provider.
   */
  private async createEmbeddingProvider(config: ModelProviderConfig): Promise<EmbeddingProvider> {
    const globalConfig = await this.configManager.loadGlobal();

    switch (config.provider) {
      case 'ollama':
        return OllamaEmbeddingProvider.create({
          baseUrl: globalConfig.providers.ollama?.base_url ?? 'http://localhost:11434',
          model: config.model
        });

      case 'openai':
        return new OpenAIEmbeddingProvider({
          apiKey: globalConfig.providers.openai?.api_key ?? process.env.OPENAI_API_KEY ?? '',
          model: config.model
        });

      case 'mock':
        return new MockEmbeddingProvider();

      default:
        throw new Error(`Unknown embedding provider: ${config.provider}`);
    }
  }

  /**
   * Create a summarization provider.
   */
  private async createSummarizationProvider(config: ModelProviderConfig): Promise<LLMSummarizer> {
    const globalConfig = await this.configManager.loadGlobal();

    switch (config.provider) {
      case 'ollama':
        return new OllamaSummarizationProvider({
          baseUrl: globalConfig.providers.ollama?.base_url ?? 'http://localhost:11434',
          model: config.model
        });

      case 'openai':
        return new OpenAISummarizationProvider({
          apiKey: globalConfig.providers.openai?.api_key ?? process.env.OPENAI_API_KEY ?? '',
          model: config.model
        });

      case 'mock':
        return new MockSummarizationProvider();

      default:
        throw new Error(`Unknown summarization provider: ${config.provider}`);
    }
  }

  /**
   * Get default embedding config from ConfigManager.
   */
  private async getDefaultEmbeddingConfig(): Promise<ModelProviderConfig> {
    const config = await this.configManager.loadGlobal();
    return {
      provider: config.defaults.embeddings.provider as ModelProviderConfig['provider'],
      model: config.defaults.embeddings.model
    };
  }

  /**
   * Get default summarization config from ConfigManager.
   */
  private async getDefaultSummarizationConfig(): Promise<ModelProviderConfig> {
    const config = await this.configManager.loadGlobal();
    return {
      provider: config.defaults.summarization.provider as ModelProviderConfig['provider'],
      model: config.defaults.summarization.model
    };
  }

  /**
   * Generate a unique key for a provider.
   */
  private getProviderKey(type: string, config: ModelProviderConfig): string {
    return `${type}:${config.provider}:${config.model}`;
  }

  /**
   * Get cached health status.
   */
  private getCachedHealth(key: string): boolean | undefined {
    const cached = this.healthCache.get(key);
    if (!cached) return undefined;

    // Check if cache is still valid
    const age = Date.now() - cached.lastChecked.getTime();
    if (age > this.healthCacheTTL) {
      this.healthCache.delete(key);
      return undefined;
    }

    return cached.available;
  }

  /**
   * Set cached health status.
   */
  private setCachedHealth(key: string, available: boolean, error?: string): void {
    this.healthCache.set(key, {
      available,
      lastChecked: new Date(),
      error
    });
  }
}

/**
 * Ollama summarization provider.
 */
class OllamaSummarizationProvider implements LLMSummarizer {
  readonly name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(config: { baseUrl: string; model: string }) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  async summarizeSymbol(symbol: any, context?: string): Promise<string> {
    const prompt = this.buildSymbolPrompt(symbol, context);
    return this.complete(prompt);
  }

  async summarizeFile(parseResult: any): Promise<string> {
    const prompt = this.buildFilePrompt(parseResult);
    return this.complete(prompt);
  }

  private buildSymbolPrompt(symbol: any, context?: string): string {
    let prompt = `Provide a brief one-line description for this ${symbol.type}:\n\n`;
    prompt += `Name: ${symbol.name}\n`;
    if (symbol.signature) prompt += `Signature: ${symbol.signature}\n`;
    if (context) prompt += `Context: ${context}\n`;
    prompt += '\nDescription:';
    return prompt;
  }

  private buildFilePrompt(parseResult: any): string {
    let prompt = `Provide a brief description of this file:\n\n`;
    prompt += `File: ${parseResult.filePath}\n`;
    prompt += `Symbols: ${parseResult.symbols?.length ?? 0}\n`;
    prompt += '\nDescription:';
    return prompt;
  }

  private async complete(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { num_predict: 100 }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json() as { response?: string };
    return data.response?.trim() ?? '';
  }
}

/**
 * OpenAI summarization provider.
 */
class OpenAISummarizationProvider implements LLMSummarizer {
  readonly name = 'openai';
  private apiKey: string;
  private model: string;

  constructor(config: { apiKey: string; model: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model;
  }

  async summarizeSymbol(symbol: any, context?: string): Promise<string> {
    const prompt = this.buildSymbolPrompt(symbol, context);
    return this.complete(prompt);
  }

  async summarizeFile(parseResult: any): Promise<string> {
    const prompt = this.buildFilePrompt(parseResult);
    return this.complete(prompt);
  }

  private buildSymbolPrompt(symbol: any, context?: string): string {
    let prompt = `Provide a brief one-line description for this ${symbol.type}:\n\n`;
    prompt += `Name: ${symbol.name}\n`;
    if (symbol.signature) prompt += `Signature: ${symbol.signature}\n`;
    if (context) prompt += `Context: ${context}\n`;
    return prompt;
  }

  private buildFilePrompt(parseResult: any): string {
    let prompt = `Provide a brief description of this file:\n\n`;
    prompt += `File: ${parseResult.filePath}\n`;
    prompt += `Symbols: ${parseResult.symbols?.length ?? 0}\n`;
    return prompt;
  }

  private async complete(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.statusText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}

/**
 * Mock summarization provider for testing.
 */
export class MockSummarizationProvider implements LLMSummarizer {
  readonly name = 'mock';
  public failOnCall = false;

  async summarizeSymbol(symbol: any, _context?: string): Promise<string> {
    if (this.failOnCall) {
      throw new Error('Mock provider configured to fail');
    }
    return `Mock summary for ${symbol.name}`;
  }

  async summarizeFile(parseResult: any): Promise<string> {
    if (this.failOnCall) {
      throw new Error('Mock provider configured to fail');
    }
    return `Mock file summary for ${parseResult.filePath ?? 'unknown file'}`;
  }
}

/**
 * Default provider factory instance.
 */
export const defaultProviderFactory = new ProviderFactory();
