/**
 * Embedding provider and storage type definitions.
 */

export interface EmbedOptions {
  /** Whether this text is a search query (vs a document to be indexed) */
  isQuery?: boolean;
}

export interface ModelIdentifier {
  name: string;
  provider: string;
  version?: string;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly modelId: string;
  readonly dimensions: number;
  readonly maxChars?: number;

  embed(text: string, options?: EmbedOptions): Promise<number[]>;
  embedBatch(texts: string[], options?: BatchOptions & EmbedOptions): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
  getModelIdentifier(): ModelIdentifier;
}

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
}

export interface StoredEmbedding {
  id: string;
  entityId: string;
  modelId: string;
  embedding: number[];
  createdAt: Date;
}

export interface SimilarityResult {
  entityId: string;
  score: number;
  distance: number;
}

export interface EmbeddingRow {
  id: string;
  entity_id: string;
  model_id: string;
  embedding: string;
  created_at: string;
}

export interface ProviderConfig {
  provider: 'ollama' | 'openai';
  model: string;
  baseUrl?: string;
  apiKey?: string;
}
