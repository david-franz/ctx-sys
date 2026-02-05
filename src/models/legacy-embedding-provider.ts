/**
 * Embedding Provider
 *
 * Interface for embedding generation providers.
 */

export interface EmbeddingProvider {
  embed(text: string): Promise<Float32Array>;

  embedBatch(texts: string[]): Promise<Float32Array[]>;

  isAvailable(): Promise<boolean>;

  getModelInfo(): { name: string; dimensions: number };
}
