/**
 * Phase 3: Embedding Provider (capital E path)
 * Provider for generating embeddings
 */

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(config?: any) {
    throw new Error('Not implemented');
  }

  async embed(text: string): Promise<number[]> {
    throw new Error('Not implemented');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    throw new Error('Not implemented');
  }

  getDimensions(): number {
    return 768;
  }
}
