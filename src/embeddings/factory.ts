import { EmbeddingProvider, ProviderConfig } from './types';
import { OllamaEmbeddingProvider } from './ollama';
import { OpenAIEmbeddingProvider } from './openai';
import { Logger, consoleLogger } from '../utils/logger';

/**
 * Factory for creating embedding providers.
 */
export class EmbeddingProviderFactory {
  /**
   * Create an embedding provider from configuration.
   */
  static async create(config: ProviderConfig): Promise<EmbeddingProvider> {
    switch (config.provider) {
      case 'ollama':
        return OllamaEmbeddingProvider.create({
          baseUrl: config.baseUrl || 'http://localhost:11434',
          model: config.model
        });

      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key required');
        }
        return new OpenAIEmbeddingProvider({
          apiKey: config.apiKey,
          model: config.model
        });

      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Create a provider with fallback if primary is unavailable.
   */
  static async createWithFallback(
    primary: ProviderConfig,
    fallback: ProviderConfig,
    logger: Logger = consoleLogger
  ): Promise<EmbeddingProvider> {
    const primaryProvider = await this.create(primary);

    if (await primaryProvider.isAvailable()) {
      return primaryProvider;
    }

    logger.warn('Primary embedding provider unavailable, using fallback');
    return await this.create(fallback);
  }
}
