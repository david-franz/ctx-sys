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
 * Max input lengths (in characters) for known embedding models.
 * Uses ~2 chars/token for code (symbols, braces, operators tokenize short).
 * mxbai-embed-large: 512 tokens → 1024 chars
 * nomic-embed-text: 2048 tokens → 4000 chars
 */
const MODEL_MAX_CHARS: Record<string, number> = {
  'nomic-embed-text': 4000,
  'mxbai-embed-large': 1024,
  'all-minilm': 700,
  'bge-base': 1024,
  'bge-large': 1024
};

const DEFAULT_MAX_CHARS = 1024;

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
  readonly maxChars: number;

  private baseModel: string;

  constructor(private config: OllamaConfig, resolved?: { dimensions?: number; maxChars?: number }) {
    this.config.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.modelId = `ollama:${config.model}`;
    this.baseModel = config.model.split(':')[0];
    this.dimensions = resolved?.dimensions
      ?? MODEL_DIMENSIONS[this.baseModel]
      ?? 768;
    this.maxChars = resolved?.maxChars
      ?? MODEL_MAX_CHARS[this.baseModel]
      ?? DEFAULT_MAX_CHARS;
  }

  /**
   * Create an OllamaEmbeddingProvider, auto-detecting dimensions and context
   * length from the model. Probes Ollama's /api/show endpoint, falls back to
   * the hardcoded registry.
   */
  static async create(config: OllamaConfig): Promise<OllamaEmbeddingProvider> {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const baseModel = config.model.split(':')[0];

    // Fast path: known model in both registries
    if (MODEL_DIMENSIONS[baseModel] && MODEL_MAX_CHARS[baseModel]) {
      return new OllamaEmbeddingProvider(config);
    }

    // Probe model metadata from Ollama
    const detected = await OllamaEmbeddingProvider.detectModelInfo(baseUrl, config.model);
    return new OllamaEmbeddingProvider(config, detected ?? undefined);
  }

  /**
   * Detect embedding dimensions and context length from Ollama's /api/show endpoint.
   * Returns null if detection fails (caller should fall back to defaults).
   */
  static async detectModelInfo(baseUrl: string, model: string): Promise<{ dimensions?: number; maxChars?: number } | null> {
    try {
      const response = await fetch(`${baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      if (!response.ok) return null;

      const data = await response.json() as {
        model_info?: Record<string, unknown>;
      };
      if (!data.model_info) return null;

      const result: { dimensions?: number; maxChars?: number } = {};

      for (const [key, value] of Object.entries(data.model_info)) {
        if (key.endsWith('.embedding_length') && typeof value === 'number') {
          result.dimensions = value;
        }
        if (key.endsWith('.context_length') && typeof value === 'number') {
          // Convert tokens to chars: ~2 chars/token for code (conservative)
          result.maxChars = Math.floor(value * 2);
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    }
  }

  /**
   * Detect embedding dimensions only (backwards-compatible helper).
   */
  static async detectDimensions(baseUrl: string, model: string): Promise<number | null> {
    const info = await OllamaEmbeddingProvider.detectModelInfo(baseUrl, model);
    return info?.dimensions ?? null;
  }

  /**
   * Apply model-specific prefix to text based on whether it's a query or document.
   */
  private applyPrefix(text: string, isQuery: boolean): string {
    const prefixes = MODEL_PREFIXES[this.baseModel];
    if (!prefixes) return text;
    const prefix = isQuery ? prefixes.query : prefixes.document;
    return prefix + text;
  }

  async embed(text: string, options?: EmbedOptions): Promise<number[]> {
    const prefixed = this.applyPrefix(text, options?.isQuery ?? false);
    const truncated = prefixed.length > this.maxChars ? prefixed.slice(0, this.maxChars) : prefixed;

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
    const isQuery = options?.isQuery ?? false;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));

      // Apply model-specific prefixes and truncate
      const truncatedBatch = batch.map(t => {
        const prefixed = this.applyPrefix(t, isQuery);
        return prefixed.length > this.maxChars ? prefixed.slice(0, this.maxChars) : prefixed;
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
