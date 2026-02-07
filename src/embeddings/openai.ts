import { EmbeddingProvider, BatchOptions, EmbedOptions } from './types';

interface OpenAIConfig {
  apiKey: string;
  model: string;
}

const MODEL_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536
};

interface OpenAIEmbeddingResponse {
  data: Array<{ index: number; embedding: number[] }>;
  error?: { message: string };
}

/**
 * Embedding provider using OpenAI's API.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly modelId: string;
  readonly dimensions: number;

  constructor(private config: OpenAIConfig) {
    this.modelId = `openai:${config.model}`;
    this.dimensions = MODEL_DIMENSIONS[config.model] || 1536;
  }

  async embed(text: string, _options?: EmbedOptions): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.json() as OpenAIEmbeddingResponse;
      throw new Error(`OpenAI embedding failed: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json() as OpenAIEmbeddingResponse;
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[], options?: BatchOptions & EmbedOptions): Promise<number[][]> {
    // OpenAI supports batch input natively (up to 2048 items)
    const batchSize = Math.min(options?.batchSize || 100, 2048);
    const results: number[][] = [];
    let completed = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          input: batch
        })
      });

      if (!response.ok) {
        const error = await response.json() as OpenAIEmbeddingResponse;
        throw new Error(`OpenAI embedding failed: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json() as OpenAIEmbeddingResponse;
      const embeddings = data.data
        .sort((a, b) => a.index - b.index)
        .map(d => d.embedding);

      results.push(...embeddings);
      completed += embeddings.length;
      options?.onProgress?.(completed, texts.length);
    }

    return results;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
