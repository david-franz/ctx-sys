import { EmbeddingProvider, BatchOptions } from './types';

interface OllamaConfig {
  baseUrl: string;
  model: string;
}

const MODEL_DIMENSIONS: Record<string, number> = {
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
  'bge-base': 768,
  'bge-large': 1024
};

/**
 * Embedding provider using Ollama's local API.
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  readonly modelId: string;
  readonly dimensions: number;

  constructor(private config: OllamaConfig) {
    this.modelId = `ollama:${config.model}`;
    this.dimensions = MODEL_DIMENSIONS[config.model] || 768;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  }

  async embedBatch(texts: string[], options?: BatchOptions): Promise<number[][]> {
    const batchSize = options?.batchSize || 10;
    const concurrency = options?.concurrency || 3;
    const results: number[][] = [];
    let completed = 0;

    // Process in batches with concurrency limit
    for (let i = 0; i < texts.length; i += batchSize * concurrency) {
      const batchPromises: Promise<number[][]>[] = [];

      for (let j = 0; j < concurrency && i + j * batchSize < texts.length; j++) {
        const start = i + j * batchSize;
        const end = Math.min(start + batchSize, texts.length);
        const batch = texts.slice(start, end);

        batchPromises.push(
          Promise.all(batch.map(text => this.embed(text)))
        );
      }

      const batchResults = await Promise.all(batchPromises);
      for (const batch of batchResults) {
        results.push(...batch);
        completed += batch.length;
        options?.onProgress?.(completed, texts.length);
      }
    }

    return results;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = await response.json() as { models?: Array<{ name: string }> };
      return data.models?.some(m => m.name.startsWith(this.config.model)) ?? false;
    } catch {
      return false;
    }
  }
}
