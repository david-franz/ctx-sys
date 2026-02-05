/**
 * Phase 7: Provider Factory
 * Creates and caches provider instances
 */

import { ProviderConfig } from './types';
import { EmbeddingProvider } from './embedding-provider';
import { SummarizationProvider } from './summarization-provider';

export class ProviderFactory {
  constructor() {
    throw new Error('Not implemented');
  }

  async getEmbeddingProvider(config: ProviderConfig): Promise<EmbeddingProvider> {
    throw new Error('Not implemented');
  }

  async getSummarizationProvider(config: ProviderConfig): Promise<SummarizationProvider> {
    throw new Error('Not implemented');
  }

  clearCache(): void {
    throw new Error('Not implemented');
  }
}
