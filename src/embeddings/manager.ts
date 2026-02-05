import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { EmbeddingProvider, SimilarityResult, EmbeddingRow } from './types';

/**
 * Manages embedding storage and similarity search for a project.
 */
export class EmbeddingManager {
  private vectorTable: string;
  private entitiesTable: string;
  private projectPrefix: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string,
    private provider: EmbeddingProvider
  ) {
    this.projectPrefix = sanitizeProjectId(projectId);
    this.vectorTable = `${this.projectPrefix}_vectors`;
    this.entitiesTable = `${this.projectPrefix}_entities`;
    this.ensureModelRegistered();
  }

  /**
   * Register the embedding model if not already registered.
   */
  private ensureModelRegistered(): void {
    const existing = this.db.get<{ id: string }>(
      `SELECT id FROM embedding_models WHERE id = ?`,
      [this.provider.modelId]
    );

    if (!existing) {
      this.db.run(
        `INSERT INTO embedding_models (id, name, provider, dimensions)
         VALUES (?, ?, ?, ?)`,
        [
          this.provider.modelId,
          this.provider.modelId,
          this.provider.name,
          this.provider.dimensions
        ]
      );
    }
  }

  /**
   * Generate and store embedding for an entity.
   */
  async embed(entityId: string, content: string): Promise<void> {
    const embedding = await this.provider.embed(content);
    this.store(entityId, embedding);
  }

  /**
   * Generate and store embeddings for multiple entities.
   */
  async embedBatch(
    entities: Array<{ id: string; content: string }>,
    options?: { onProgress?: (completed: number, total: number) => void }
  ): Promise<void> {
    const contents = entities.map(e => e.content);
    const embeddings = await this.provider.embedBatch(contents, {
      onProgress: options?.onProgress
    });

    // Store all embeddings in a transaction
    this.db.transaction(() => {
      for (let i = 0; i < entities.length; i++) {
        this.store(entities[i].id, embeddings[i]);
      }
    });
  }

  /**
   * Store an embedding for an entity.
   */
  private store(entityId: string, embedding: number[]): void {
    const id = generateId();

    // Delete existing embedding for this entity/model
    this.db.run(
      `DELETE FROM ${this.vectorTable} WHERE entity_id = ? AND model_id = ?`,
      [entityId, this.provider.modelId]
    );

    // Insert new embedding (stored as JSON)
    this.db.run(
      `INSERT INTO ${this.vectorTable} (id, entity_id, model_id, embedding)
       VALUES (?, ?, ?, ?)`,
      [id, entityId, this.provider.modelId, JSON.stringify(embedding)]
    );
  }

  /**
   * Find similar entities by query text.
   */
  async findSimilar(
    query: string,
    options?: { limit?: number; threshold?: number; entityTypes?: string[] }
  ): Promise<SimilarityResult[]> {
    const queryEmbedding = await this.provider.embed(query);
    return this.findSimilarByVector(queryEmbedding, options);
  }

  /**
   * Find similar entities by embedding vector.
   */
  findSimilarByVector(
    embedding: number[],
    options?: { limit?: number; threshold?: number; entityTypes?: string[] }
  ): SimilarityResult[] {
    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.0;

    // Get all embeddings for this model
    let sql = `
      SELECT v.entity_id, v.embedding
      FROM ${this.vectorTable} v
      WHERE v.model_id = ?
    `;
    const params: unknown[] = [this.provider.modelId];

    if (options?.entityTypes?.length) {
      const placeholders = options.entityTypes.map(() => '?').join(', ');
      sql += `
        AND v.entity_id IN (
          SELECT id FROM ${this.entitiesTable} WHERE type IN (${placeholders})
        )
      `;
      params.push(...options.entityTypes);
    }

    const rows = this.db.all<EmbeddingRow>(sql, params);

    // Calculate cosine similarity for each
    const results: SimilarityResult[] = rows.map(row => {
      const storedEmbedding = JSON.parse(row.embedding) as number[];
      const similarity = this.cosineSimilarity(embedding, storedEmbedding);
      return {
        entityId: row.entity_id,
        score: similarity,
        distance: 1 - similarity
      };
    });

    // Filter by threshold, sort by score descending, and limit
    return results
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Delete embedding for an entity.
   */
  async deleteForEntity(entityId: string): Promise<void> {
    this.db.run(
      `DELETE FROM ${this.vectorTable} WHERE entity_id = ?`,
      [entityId]
    );
  }

  /**
   * Check if an entity has an embedding.
   */
  async hasEmbedding(entityId: string): Promise<boolean> {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorTable}
       WHERE entity_id = ? AND model_id = ?`,
      [entityId, this.provider.modelId]
    );
    return (row?.count || 0) > 0;
  }

  /**
   * Get embedding statistics.
   */
  async getStats(): Promise<{ count: number; modelId: string; dimensions: number }> {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorTable} WHERE model_id = ?`,
      [this.provider.modelId]
    );
    return {
      count: row?.count || 0,
      modelId: this.provider.modelId,
      dimensions: this.provider.dimensions
    };
  }

  /**
   * Get the embedding for an entity if it exists.
   */
  async getEmbedding(entityId: string): Promise<number[] | null> {
    const row = this.db.get<EmbeddingRow>(
      `SELECT embedding FROM ${this.vectorTable}
       WHERE entity_id = ? AND model_id = ?`,
      [entityId, this.provider.modelId]
    );
    return row ? JSON.parse(row.embedding) : null;
  }
}
