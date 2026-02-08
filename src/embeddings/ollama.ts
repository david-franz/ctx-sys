import { EmbeddingProvider, BatchOptions, EmbedOptions, ModelIdentifier } from './types';

interface OllamaConfig {
  baseUrl: string;
  model: string;
}

/**
 * Normalize base URL: replace localhost with 127.0.0.1 to avoid
 * IPv6 resolution issues on macOS where Ollama only listens on IPv4.
 */
function normalizeBaseUrl(url: string): string {
  return url.replace('://localhost', '://127.0.0.1');
}

/**
 * Max context lengths (in tokens) for known embedding models.
 * nomic-embed-text has n_ctx_train=2048. ~4 chars per token is a safe estimate.
 */
const MODEL_MAX_CHARS: Record<string, number> = {
  'nomic-embed-text': 4000,
  'mxbai-embed-large': 2000,
  'all-minilm': 1000,
  'bge-base': 2000,
  'bge-large': 2000
};

const DEFAULT_MAX_CHARS = 4000;

const MODEL_DIMENSIONS: Record<string, number> = {
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
  'bge-base': 768,
  'bge-large': 1024
};

/**
 * Model-specific prompt prefixes for query vs document embedding.
 * Some models (e.g., nomic-embed-text) produce better results with task-specific prefixes.
 */
const MODEL_PREFIXES: Record<string, { query: string; document: string }> = {
  'nomic-embed-text': {
    query: 'search_query: ',
    document: 'search_document: '
  },
  'mxbai-embed-large': {
    query: 'Represent this sentence for searching relevant passages: ',
    document: ''
  }
};

/**
 * Embedding provider using Ollama's local API.
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  readonly modelId: string;
  readonly dimensions: number;

  constructor(private config: OllamaConfig) {
    this.config.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.modelId = `ollama:${config.model}`;
    this.dimensions = MODEL_DIMENSIONS[config.model] || 768;
  }

  /**
   * Apply model-specific prefix to text based on whether it's a query or document.
   */
  private applyPrefix(text: string, isQuery: boolean): string {
    const prefixes = MODEL_PREFIXES[this.config.model];
    if (!prefixes) return text;
    const prefix = isQuery ? prefixes.query : prefixes.document;
    return prefix + text;
  }

  async embed(text: string, options?: EmbedOptions): Promise<number[]> {
    const maxChars = MODEL_MAX_CHARS[this.config.model] || DEFAULT_MAX_CHARS;
    const prefixed = this.applyPrefix(text, options?.isQuery ?? false);
    const truncated = prefixed.length > maxChars ? prefixed.slice(0, maxChars) : prefixed;

    const response = await fetch(`${this.config.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        input: truncated
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama embedding failed (${response.status}): ${body || response.statusText}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    if (!data.embeddings || !data.embeddings[0]) {
      throw new Error(`Ollama returned empty embedding for model ${this.config.model}`);
    }
    return data.embeddings[0];
  }

  async embedBatch(texts: string[], options?: BatchOptions & EmbedOptions): Promise<number[][]> {
    const batchSize = options?.batchSize || 10;
    const results: number[][] = [];
    let completed = 0;
    const maxChars = MODEL_MAX_CHARS[this.config.model] || DEFAULT_MAX_CHARS;
    const isQuery = options?.isQuery ?? false;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));

      // Apply model-specific prefixes and truncate
      const truncatedBatch = batch.map(t => {
        const prefixed = this.applyPrefix(t, isQuery);
        return prefixed.length > maxChars ? prefixed.slice(0, maxChars) : prefixed;
      });

      const response = await fetch(`${this.config.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          input: truncatedBatch
        })
      });

      if (!response.ok) {
        // If batch fails, fall back to individual embedding
        for (const text of batch) {
          try {
            const embedding = await this.embed(text);
            results.push(embedding);
          } catch {
            // Use zero vector for failed embeddings
            results.push(new Array(this.dimensions).fill(0));
          }
          completed++;
          options?.onProgress?.(completed, texts.length);
        }
        continue;
      }

      const data = await response.json() as { embeddings: number[][] };
      results.push(...data.embeddings);
      completed += batch.length;
      options?.onProgress?.(completed, texts.length);
    }

    return results;
  }

  getModelIdentifier(): ModelIdentifier {
    return {
      name: this.config.model,
      provider: 'ollama',
    };
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
