/**
 * Embedding provider and storage type definitions.
 */

export interface EmbeddingProvider {
  readonly name: string;
  readonly modelId: string;
  readonly dimensions: number;

  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[], options?: BatchOptions): Promise<number[][]>;
  isAvailable(): Promise<boolean>;
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
