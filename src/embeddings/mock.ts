import { EmbeddingProvider, BatchOptions, EmbedOptions } from './types';

/**
 * Mock embedding provider for testing.
 * Generates deterministic embeddings based on text hash.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly modelId = 'mock:test-model';
  readonly dimensions: number;

  private available: boolean = true;

  constructor(dimensions: number = 128) {
    this.dimensions = dimensions;
  }

  /**
   * Generate a deterministic embedding from text.
   * Uses a simple hash-based approach for reproducibility.
   */
  async embed(text: string, _options?: EmbedOptions): Promise<number[]> {
    if (!this.available) {
      throw new Error('Mock provider unavailable');
    }

    const embedding: number[] = [];
    let hash = 0;

    // Simple string hash
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Generate embedding values from hash
    for (let i = 0; i < this.dimensions; i++) {
      // Use sine function for smooth distribution
      const value = Math.sin(hash * (i + 1) * 0.0001);
      embedding.push(value);
    }

    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / norm);
  }

  async embedBatch(texts: string[], options?: BatchOptions & EmbedOptions): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      results.push(await this.embed(texts[i]));
      options?.onProgress?.(i + 1, texts.length);
    }

    return results;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  /**
   * Set availability state for testing.
   */
  setAvailable(available: boolean): void {
    this.available = available;
  }
}
