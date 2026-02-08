import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId, createVecTable } from '../db/schema';
import { EmbeddingProvider, SimilarityResult } from './types';
import { Entity } from '../entities';
import { hashEntityContent, buildEmbeddingContent } from './content-hasher';

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
 * F10h.2: Uses sqlite-vec vec0 virtual tables for native vector search.
 */
export class EmbeddingManager {
  private vectorMetaTable: string;
  private vecTable: string;
  private entitiesTable: string;
  private projectPrefix: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string,
    private provider: EmbeddingProvider
  ) {
    this.projectPrefix = sanitizeProjectId(projectId);
    this.vectorMetaTable = `${this.projectPrefix}_vector_meta`;
    this.vecTable = `${this.projectPrefix}_vec`;
    this.entitiesTable = `${this.projectPrefix}_entities`;
    this.ensureModelRegistered();
    this.ensureVecTables();
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
   * Ensure vec0 tables exist.
   */
  private ensureVecTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.vectorMetaTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        content_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entity_id) REFERENCES ${this.entitiesTable}(id) ON DELETE CASCADE,
        UNIQUE(entity_id, model_id)
      );
      CREATE INDEX IF NOT EXISTS idx_${this.projectPrefix}_vector_meta_entity ON ${this.vectorMetaTable}(entity_id);
      CREATE INDEX IF NOT EXISTS idx_${this.projectPrefix}_vector_meta_model ON ${this.vectorMetaTable}(model_id);
    `);

    this.db.exec(createVecTable(this.projectId, this.provider.dimensions));
  }

  /**
   * Convert a number[] embedding to Buffer for sqlite-vec.
   */
  private vectorToBuffer(embedding: number[]): Buffer {
    return Buffer.from(new Float32Array(embedding).buffer);
  }

  /**
   * Convert a Buffer from sqlite-vec back to number[].
   */
  private bufferToVector(buf: Buffer): number[] {
    return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
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

    for (let i = 0; i < entities.length; i++) {
      this.store(entities[i].id, embeddings[i]);
    }
  }

  /**
   * Store an embedding for an entity using native vec0 storage.
   */
  private store(entityId: string, embedding: number[], contentHash?: string): void {
    // Delete existing embedding for this entity/model
    const existing = this.db.get<{ id: number }>(
      `SELECT id FROM ${this.vectorMetaTable} WHERE entity_id = ? AND model_id = ?`,
      [entityId, this.provider.modelId]
    );

    if (existing) {
      this.db.run(`DELETE FROM ${this.vecTable} WHERE rowid = ?`, [BigInt(existing.id)]);
      this.db.run(`DELETE FROM ${this.vectorMetaTable} WHERE id = ?`, [existing.id]);
    }

    // Insert new metadata
    const result = this.db.run(
      `INSERT INTO ${this.vectorMetaTable} (entity_id, model_id, content_hash)
       VALUES (?, ?, ?)`,
      [entityId, this.provider.modelId, contentHash || null]
    );

    // Insert vector with matching rowid
    const buf = this.vectorToBuffer(embedding);
    this.db.run(
      `INSERT INTO ${this.vecTable} (rowid, embedding) VALUES (?, ?)`,
      [BigInt(result.lastInsertRowid), buf]
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
   * Find similar entities by embedding vector using native sqlite-vec KNN.
   */
  findSimilarByVector(
    embedding: number[],
    options?: { limit?: number; threshold?: number; entityTypes?: string[] }
  ): SimilarityResult[] {
    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.0;
    const buf = this.vectorToBuffer(embedding);

    // Check if there are any vectors to search
    const vecCount = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorMetaTable}`
    );
    if (!vecCount || vecCount.count === 0) return [];

    // Over-fetch to handle model/type filtering
    const fetchLimit = Math.min(
      vecCount.count,
      (options?.entityTypes?.length ? limit * 5 : limit) * 2
    );

    const rows = this.db.all<{ entity_id: string; model_id: string; distance: number }>(
      `SELECT m.entity_id, m.model_id, v.distance
       FROM ${this.vecTable} v
       JOIN ${this.vectorMetaTable} m ON m.id = v.rowid
       WHERE v.embedding MATCH ? AND v.k = ?`,
      [buf, fetchLimit]
    );

    // Filter by current model
    let results = rows
      .filter(r => r.model_id === this.provider.modelId)
      .map(row => ({
        entityId: row.entity_id,
        score: 1 - row.distance,
        distance: row.distance
      }));

    // Filter by entity types if specified
    if (options?.entityTypes?.length && results.length > 0) {
      const typeSet = new Set(options.entityTypes);
      const placeholders = results.map(() => '?').join(', ');
      const entityTypes = this.db.all<{ id: string; type: string }>(
        `SELECT id, type FROM ${this.entitiesTable} WHERE id IN (${placeholders})`,
        results.map(r => r.entityId)
      );
      const typeMap = new Map(entityTypes.map(e => [e.id, e.type]));
      results = results.filter(r => {
        const type = typeMap.get(r.entityId);
        return type && typeSet.has(type);
      });
    }

    // Filter by threshold and limit
    return results
      .filter(r => r.score >= threshold)
      .slice(0, limit);
  }

  /**
   * Delete embedding for an entity.
   */
  async deleteForEntity(entityId: string): Promise<void> {
    const metas = this.db.all<{ id: number }>(
      `SELECT id FROM ${this.vectorMetaTable} WHERE entity_id = ?`,
      [entityId]
    );

    for (const meta of metas) {
      this.db.run(`DELETE FROM ${this.vecTable} WHERE rowid = ?`, [BigInt(meta.id)]);
    }

    this.db.run(
      `DELETE FROM ${this.vectorMetaTable} WHERE entity_id = ?`,
      [entityId]
    );
  }

  /**
   * Check if an entity has an embedding.
   */
  async hasEmbedding(entityId: string): Promise<boolean> {
    const row = this.db.get<{ id: number }>(
      `SELECT id FROM ${this.vectorMetaTable}
       WHERE entity_id = ? AND model_id = ? LIMIT 1`,
      [entityId, this.provider.modelId]
    );
    return !!row;
  }

  /**
   * Get embedding statistics.
   */
  async getStats(): Promise<{ count: number; modelId: string; dimensions: number }> {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorMetaTable} WHERE model_id = ?`,
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
    const meta = this.db.get<{ id: number }>(
      `SELECT id FROM ${this.vectorMetaTable}
       WHERE entity_id = ? AND model_id = ?`,
      [entityId, this.provider.modelId]
    );

    if (!meta) return null;

    const vec = this.db.get<{ embedding: Buffer }>(
      `SELECT embedding FROM ${this.vecTable} WHERE rowid = ?`,
      [BigInt(meta.id)]
    );

    return vec ? this.bufferToVector(vec.embedding) : null;
  }

  // ===== F10.2: Incremental Embedding Methods =====

  /**
   * Check if an entity needs re-embedding based on content hash.
   */
  needsEmbedding(entity: Entity): boolean {
    const currentHash = hashEntityContent(entity);

    const existing = this.db.get<{ content_hash: string | null }>(
      `SELECT content_hash FROM ${this.vectorMetaTable}
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
      `SELECT entity_id, content_hash FROM ${this.vectorMetaTable}
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
    const allEmbeddings = this.db.all<{ id: number; entity_id: string }>(
      `SELECT id, entity_id FROM ${this.vectorMetaTable} WHERE model_id = ?`,
      [this.provider.modelId]
    );

    let removed = 0;
    for (const row of allEmbeddings) {
      if (!validEntityIds.has(row.entity_id)) {
        this.db.run(`DELETE FROM ${this.vecTable} WHERE rowid = ?`, [BigInt(row.id)]);
        this.db.run(`DELETE FROM ${this.vectorMetaTable} WHERE id = ?`, [row.id]);
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
      `SELECT COUNT(*) as count FROM ${this.vectorMetaTable} WHERE model_id = ?`,
      [this.provider.modelId]
    );

    const stale = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorMetaTable}
       WHERE model_id = ? AND content_hash IS NULL`,
      [this.provider.modelId]
    );

    // Count vectors from other models (model mismatch)
    const mismatch = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.vectorMetaTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );

    // Per-model breakdown
    const byModel = this.db.all<{ model_id: string; count: number }>(
      `SELECT model_id, COUNT(*) as count FROM ${this.vectorMetaTable} GROUP BY model_id ORDER BY count DESC`
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
      `SELECT COUNT(*) as count FROM ${this.vectorMetaTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );
    return row?.count || 0;
  }

  /**
   * Get entities that have vectors from a different model (need model upgrade).
   */
  getModelMismatchEntityIds(): string[] {
    const rows = this.db.all<{ entity_id: string }>(
      `SELECT DISTINCT entity_id FROM ${this.vectorMetaTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );
    return rows.map(r => r.entity_id);
  }

  /**
   * Delete vectors from models other than the current one.
   */
  cleanupOldModelVectors(): number {
    // Get rowids to delete from vec0
    const oldMetas = this.db.all<{ id: number }>(
      `SELECT id FROM ${this.vectorMetaTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );

    for (const meta of oldMetas) {
      this.db.run(`DELETE FROM ${this.vecTable} WHERE rowid = ?`, [BigInt(meta.id)]);
    }

    const result = this.db.run(
      `DELETE FROM ${this.vectorMetaTable} WHERE model_id != ?`,
      [this.provider.modelId]
    );
    return result.changes;
  }
}
