/**
 * Embedding providers
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.4-embedding-pipeline.test.ts for expected behavior.
 */

export interface IEmbeddingProvider {
  name: string;
  modelId: string;
  dimensions: number;
  embed(text: string): Promise<number[] | Float32Array>;
  embedBatch(
    texts: string[],
    options?: { onProgress?: (current: number, total: number) => void }
  ): Promise<Array<number[] | Float32Array>>;
  isAvailable(): Promise<boolean>;
  getModelInfo?(): Promise<{ name: string; dimensions: number }>;
  findSimilar?(embedding: number[] | Float32Array, options?: { limit?: number; threshold?: number }): Promise<Array<{ entityId: string; score: number }>>;
  generateEmbedding?(text: string): Promise<number[] | Float32Array>;
}

export class EmbeddingProvider implements IEmbeddingProvider {
  public name: string = 'base';
  public modelId: string = 'base';
  public dimensions: number = 768;

  constructor(config?: { model?: string; baseUrl?: string }) {
    // Base implementation
  }

  async embed(text: string): Promise<number[] | Float32Array> {
    throw new Error('Not implemented');
  }

  async embedBatch(
    texts: string[],
    options?: { onProgress?: (current: number, total: number) => void }
  ): Promise<Array<number[] | Float32Array>> {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async getModelInfo(): Promise<{ name: string; dimensions: number }> {
    return { name: this.name, dimensions: this.dimensions };
  }

  async findSimilar(embedding: number[] | Float32Array, options?: { limit?: number; threshold?: number }): Promise<Array<{ entityId: string; score: number }>> {
    throw new Error('Not implemented');
  }

  async generateEmbedding(text: string): Promise<number[] | Float32Array> {
    return this.embed(text);
  }
}

export class OllamaEmbeddingProvider extends EmbeddingProvider {
  public name: string = 'ollama';
  public modelId: string;
  public dimensions: number = 768;

  constructor(config: { model: string; baseUrl?: string }) {
    throw new Error('Not implemented');
  }

  async embed(text: string): Promise<number[] | Float32Array> {
    throw new Error('Not implemented');
  }

  async embedBatch(
    texts: string[],
    options?: { onProgress?: (current: number, total: number) => void }
  ): Promise<Array<number[] | Float32Array>> {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }
}

export class OpenAIEmbeddingProvider extends EmbeddingProvider {
  public name: string = 'openai';
  public modelId: string;
  public dimensions: number = 1536;

  constructor(config: { model: string; apiKey: string }) {
    throw new Error('Not implemented');
  }

  async embed(text: string): Promise<number[] | Float32Array> {
    throw new Error('Not implemented');
  }

  async embedBatch(
    texts: string[],
    options?: { onProgress?: (current: number, total: number) => void }
  ): Promise<Array<number[] | Float32Array>> {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }
}
