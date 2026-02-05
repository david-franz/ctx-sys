/**
 * EmbeddingProviderFactory - Factory for creating embedding providers
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.4-embedding-pipeline.test.ts for expected behavior.
 */

import { EmbeddingProvider, OllamaEmbeddingProvider, OpenAIEmbeddingProvider } from './provider';
import { EmbeddingConfig } from './types';

export class EmbeddingProviderFactory {
  static create(config: EmbeddingConfig): EmbeddingProvider {
    throw new Error('Not implemented');
  }

  static async createWithFallback(
    primaryConfig: EmbeddingConfig,
    fallbackConfig: EmbeddingConfig
  ): Promise<EmbeddingProvider> {
    throw new Error('Not implemented');
  }
}
