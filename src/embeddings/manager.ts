import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { EmbeddingProvider, SimilarityResult, EmbeddingRow } from './types';
import { Entity } from '../entities';
import { hashEntityContent, buildEmbeddingContent, hashContent } from './content-hasher';

/**
 * Result of incremental embedding operation.
 */
export interface IncrementalEmbedResult {
  embedded: number;
  skipped: number;
  errors?: number;
  total: number;
}

/**
 * Embedding statistics with hash and model mismatch information.
 */
export interface EmbeddingStats {
  count: number;
  modelId: string;
  dimensions: number;
  staleCount?: number;
  modelMismatchCount?: number;
  byModel?: Array<{ modelId: string; count: number }>;
}

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

    // Store embeddings (no transaction - we batch externally and auto-save handles persistence)
    for (let i = 0; i < entities.length; i++) {
      this.store(entities[i].id, embeddings[i]);
    }
  }

  /**
   * Store an embedding for an entity.
   */
  private store(entityId: string, embedding: number[], contentHash?: string): void {
    const id = generateId();

    // Delete existing embedding for this entity/model
    this.db.run(
      `DELETE FROM ${this.vectorTable} WHERE entity_id = ? AND model_id = ?`,
      [entityId, this.provider.modelId]
    );

    // Insert new embedding with optional content hash (stored as JSON)
    this.db.run(
      `INSERT INTO ${this.vectorTable} (id, entity_id, model_id, embedding, content_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [id, entityId, this.provider.modelId, JSON.stringify(embedding), contentHash || null]
    );
  }

  /**
   * Generate embedding for text without storing it.
   * Useful for query embeddings and HyDE.
   */
  async embedText(text: string, options?: { isQuery?: boolean }): Promise<number[]> {
    return this.provider.embed(text, { isQuery: options?.isQuery ?? true });
  }

  /**
   * Find similar entities by query text.
   * Uses query-specific embedding prefix for models that support it.
   */
  async findSimilar(
    query: string,
    options?: { limit?: number; threshold?: number; entityTypes?: string[] }
  ): Promise<SimilarityResult[]> {
    const queryEmbedding = await this.provider.embed(query, { isQuery: true });
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

  // ===== F10.2: Incremental Embedding Methods =====

  /**
   * Check if an entity needs re-embedding based on content hash.
   */
  needsEmbedding(entity: Entity): boolean {
    const currentHash = hashEntityContent(entity);

    const existing = this.db.get<{ content_hash: string | null }>(
      `SELECT content_hash FROM ${this.vectorTable}
       WHERE entity_id = ? AND model_id = ?`,
      [entity.id, this.provider.modelId]
    );

    // No existing embedding
    if (!existing) return true;

    // Hash mismatch (content changed) or no hash stored
    if (!existing.content_hash || existing.content_hash !== currentHash) return true;

    return false;
  }

  /**
   * Get all entities that need embedding (new or changed).
   */
  getEntitiesNeedingEmbedding(entities: Entity[]): Entity[] {
    // Get all existing hashes in one query for efficiency
    const existingHashes = new Map<string, string | null>();
    const rows = this.db.all<{ entity_id: string; content_hash: string | null }>(
      `SELECT entity_id, content_hash FROM ${this.vectorTable}
       WHERE model_id = ?`,
      [this.provider.modelId]
    );

    for (const row of rows) {
      existingHashes.set(row.entity_id, row.content_hash);
    }

    // Check each entity
    const result: Entity[] = [];
    for (const entity of entities) {
      const currentHash = hashEntityContent(entity);
      const existingHash = existingHashes.get(entity.id);

      // Need embedding if: no existing hash, or hash mismatch
      if (existingHash === undefined || existingHash !== currentHash) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Generate and store embeddings only for changed entities.
   * F10.2: Dramatically reduces indexing time and API costs.
   */
  async embedIncremental(
    entities: Entity[],
    options?: {
      batchSize?: number;
      onProgress?: (completed: number, total: number, skipped: number) => void;
    }
  ): Promise<IncrementalEmbedResult> {
    // Determine which entities need embedding
    const needsEmbedding = this.getEntitiesNeedingEmbedding(entities);
    const skipped = entities.length - needsEmbedding.length;

    if (needsEmbedding.length === 0) {
      return {
        embedded: 0,
        skipped,
        total: entities.length
      };
    }

    // Batch embed only changed entities
    const batchSize = options?.batchSize || 50;
    let embedded = 0;
    let errors = 0;

    for (let i = 0; i < needsEmbedding.length; i += batchSize) {
      const batch = needsEmbedding.slice(i, i + batchSize);

      const contents = batch.map(e => ({
        id: e.id,
        content: buildEmbeddingContent(e),
        hash: hashEntityContent(e)
      }));

      try {
        const embeddings = await this.provider.embedBatch(
          contents.map(c => c.content)
        );

        // Store with hashes
        for (let j = 0; j < batch.length; j++) {
          this.store(batch[j].id, embeddings[j], contents[j].hash);
        }
        embedded += batch.length;
      } catch {
        // Batch failed (e.g. connection dropped) — skip and continue
        errors += batch.length;
      }

      // Periodic save so progress survives crashes
      if ((i + batchSize) % (batchSize * 10) === 0) {
        this.db.save();
      }

      options?.onProgress?.(i + batch.length, needsEmbedding.length, skipped);
    }

    // Final save
    this.db.save();

    return {
      embedded,
      skipped,
      errors,
      total: entities.length
    };
  }

  /**
   * Embed a single entity with content hash tracking.
   */
  async embedWithHash(entity: Entity): Promise<void> {
    const content = buildEmbeddingContent(entity);
    const hash = hashEntityContent(entity);
    const embedding = await this.provider.embed(content);
    this.store(entity.id, embedding, hash);
  }

  /**
   * Remove embeddings for deleted entities.
   */
  async cleanupOrphaned(validEntityIds: Set<string>): Promise<number> {
    const allEmbeddings = this.db.all<{ entity_id: string }>(
      `SELECT entity_id FROM ${this.vectorTable} WHERE model_id = ?`,
      [this.provider.modelId]
    );

    let removed = 0;
    for (const row of allEmbeddings) {
      if (!validEntityIds.has(row.entity_id)) {
        this.db.run(
          `DELETE FROM ${this.vectorTable} WHERE entity_id = ? AND model_id = ?`,
          [row.entity_id, this.provider.modelId]
        );
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get detailed embedding statistics including stale count and model mismatch info.
   */
  async getDetailedStats(): Promise<EmbeddingStats> {
    const total = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorTable} WHERE model_id = ?`,
      [this.provider.modelId]
    );

    const stale = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorTable}
       WHERE model_id = ? AND content_hash IS NULL`,
      [this.provider.modelId]
    );

    // Count vectors from other models (model mismatch)
    const mismatch = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );

    // Per-model breakdown
    const byModel = this.db.all<{ model_id: string; count: number }>(
      `SELECT model_id, COUNT(*) as count FROM ${this.vectorTable} GROUP BY model_id ORDER BY count DESC`
    );

    return {
      count: total?.count || 0,
      modelId: this.provider.modelId,
      dimensions: this.provider.dimensions,
      staleCount: stale?.count || 0,
      modelMismatchCount: mismatch?.count || 0,
      byModel: byModel.map(r => ({ modelId: r.model_id, count: r.count }))
    };
  }

  /**
   * Get count of vectors generated by a different model than the current one.
   */
  getModelMismatchCount(): number {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );
    return row?.count || 0;
  }

  /**
   * Get entities that have vectors from a different model (need model upgrade).
   * Returns entity IDs whose vectors were generated by a model different from the current one.
   */
  getModelMismatchEntityIds(): string[] {
    const rows = this.db.all<{ entity_id: string }>(
      `SELECT DISTINCT entity_id FROM ${this.vectorTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );
    return rows.map(r => r.entity_id);
  }

  /**
   * Delete vectors from models other than the current one.
   * Used after re-embedding with a new model to clean up old vectors.
   */
  cleanupOldModelVectors(): number {
    const result = this.db.run(
      `DELETE FROM ${this.vectorTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );
    return result.changes;
  }
}
