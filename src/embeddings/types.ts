/**
 * Embedding types and interfaces
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.4-embedding-pipeline.test.ts for expected behavior.
 */

export interface EmbeddingConfig {
  provider: 'ollama' | 'openai';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface SimilarityResult {
  entityId: string;
  distance?: number;
  score: number;
}

export interface SimilarityOptions {
  query?: string;
  embedding?: number[] | Float32Array;
  entityTypes?: string[];
  threshold?: number;
  limit?: number;
}
