/**
 * SummarizationProviderFactory - Factory for creating summarization providers
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-2/F2.2-symbol-summarization.test.ts for expected behavior.
 */

import {
  SummarizationProvider,
  OllamaSummarizationProvider,
  OpenAISummarizationProvider,
} from './provider';

export interface SummarizationProviderConfig {
  provider: 'ollama' | 'openai';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, any>;
}

export class SummarizationProviderFactory {
  static create(config: SummarizationProviderConfig): SummarizationProvider {
    throw new Error('Not implemented');
  }

  static async createWithFallback(
    primaryConfig: SummarizationProviderConfig,
    fallbackConfig: SummarizationProviderConfig
  ): Promise<SummarizationProvider> {
    throw new Error('Not implemented');
  }
}
