import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { hashContent } from '../utils/hash';
import { splitIdentifier } from '../utils/identifier-splitter';
import {
  Entity,
  EntityType,
  EntityCreateInput,
  EntityUpdateInput,
  EntitySearchOptions,
  EntityRow
} from './types';

/**
 * Manages entity storage and retrieval for a project.
 */
export class EntityStore {
  private tableName: string;
  private projectPrefix: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string
  ) {
    this.projectPrefix = sanitizeProjectId(projectId);
    this.tableName = `${this.projectPrefix}_entities`;
  }

  /**
   * Create a new entity.
   */
  create(input: EntityCreateInput): Entity {
    const id = generateId();
    const hash = input.content ? hashContent(input.content) : null;
    const qualifiedName = input.qualifiedName || this.generateQualifiedName(input);

    this.db.run(
      `INSERT INTO ${this.tableName}
       (id, type, name, qualified_name, content, summary, metadata, file_path, start_line, end_line, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.type,
        input.name,
        qualifiedName,
        input.content || null,
        input.summary || null,
        JSON.stringify(input.metadata || {}),
        input.filePath || null,
        input.startLine || null,
        input.endLine || null,
        hash
      ]
    );

    const entity = this.get(id);
    if (!entity) {
      throw new Error('Failed to create entity');
    }
    return entity;
  }

  /**
   * Create or update an entity by qualified name.
   * Keeps the same ID if the entity already exists (preserving embedding references).
   */
  upsert(input: EntityCreateInput): Entity {
    const qualifiedName = input.qualifiedName || this.generateQualifiedName(input);
    const existing = this.getByQualifiedName(qualifiedName);

    if (existing) {
      // Update in place — keeps the same ID so embeddings stay linked
      const hash = input.content ? hashContent(input.content) : null;
      this.db.run(
        `UPDATE ${this.tableName}
         SET type = ?, name = ?, content = ?, summary = ?, metadata = ?,
             file_path = ?, start_line = ?, end_line = ?, hash = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          input.type,
          input.name,
          input.content || null,
          input.summary || null,
          JSON.stringify(input.metadata || {}),
          input.filePath || null,
          input.startLine || null,
          input.endLine || null,
          hash,
          existing.id
        ]
      );
      const updated = this.get(existing.id);
      if (!updated) throw new Error('Failed to update entity');
      return updated;
    }

    // No existing entity — create new
    return this.create(input);
  }

  /**
   * Create multiple entities in a transaction.
   */
  createMany(inputs: EntityCreateInput[]): Entity[] {
    const ids: string[] = [];

    this.db.transaction(() => {
      for (const input of inputs) {
        const id = generateId();
        const hash = input.content ? hashContent(input.content) : null;
        const qualifiedName = input.qualifiedName || this.generateQualifiedName(input);

        this.db.run(
          `INSERT INTO ${this.tableName}
           (id, type, name, qualified_name, content, summary, metadata, file_path, start_line, end_line, hash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.type,
            input.name,
            qualifiedName,
            input.content || null,
            input.summary || null,
            JSON.stringify(input.metadata || {}),
            input.filePath || null,
            input.startLine || null,
            input.endLine || null,
            hash
          ]
        );

        ids.push(id);
      }
    });

    const entities: Entity[] = [];
    for (const id of ids) {
      const entity = this.get(id);
      if (entity) entities.push(entity);
    }
    return entities;
  }

  /**
   * Get an entity by ID.
   */
  get(id: string): Entity | null {
    const row = this.db.get<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Get an entity by name, optionally filtered by type.
   */
  getByName(name: string, type?: EntityType): Entity | null {
    let sql = `SELECT * FROM ${this.tableName} WHERE name = ?`;
    const params: unknown[] = [name];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    const row = this.db.get<EntityRow>(sql, params);
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Get an entity by qualified name.
   */
  getByQualifiedName(qualifiedName: string): Entity | null {
    const row = this.db.get<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE qualified_name = ?`,
      [qualifiedName]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Get all entities for a file, ordered by start line.
   */
  getByFile(filePath: string): Entity[] {
    const rows = this.db.all<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE file_path = ? ORDER BY start_line`,
      [filePath]
    );
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Get entities by type.
   */
  getByType(type: EntityType | EntityType[]): Entity[] {
    const types = Array.isArray(type) ? type : [type];
    const placeholders = types.map(() => '?').join(', ');
    const rows = this.db.all<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE type IN (${placeholders})`,
      types
    );
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Update an entity.
   */
  update(id: string, updates: EntityUpdateInput): Entity {
    const entity = this.get(id);
    if (!entity) {
      throw new Error(`Entity not found: ${id}`);
    }

    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }

    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      setClauses.push('hash = ?');
      params.push(updates.content);
      params.push(hashContent(updates.content));
    }

    if (updates.summary !== undefined) {
      setClauses.push('summary = ?');
      params.push(updates.summary);
    }

    if (updates.metadata !== undefined) {
      // Merge with existing metadata
      const mergedMetadata = { ...entity.metadata, ...updates.metadata };
      setClauses.push('metadata = ?');
      params.push(JSON.stringify(mergedMetadata));
    }

    if (updates.startLine !== undefined) {
      setClauses.push('start_line = ?');
      params.push(updates.startLine);
    }

    if (updates.endLine !== undefined) {
      setClauses.push('end_line = ?');
      params.push(updates.endLine);
    }

    params.push(id);

    this.db.run(
      `UPDATE ${this.tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const updated = this.get(id);
    if (!updated) {
      throw new Error('Failed to update entity');
    }
    return updated;
  }

  /**
   * Delete an entity by ID.
   */
  delete(id: string): void {
    this.db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  /**
   * Delete all entities for a file.
   */
  deleteByFile(filePath: string): number {
    const result = this.db.run(
      `DELETE FROM ${this.tableName} WHERE file_path = ?`,
      [filePath]
    );
    return result.changes;
  }

  /**
   * Delete all entities of a specific type.
   */
  deleteByType(type: EntityType): number {
    const result = this.db.run(
      `DELETE FROM ${this.tableName} WHERE type = ?`,
      [type]
    );
    return result.changes;
  }

  /**
   * Search entities using FTS5 full-text search with BM25 ranking.
   * F10.10: Falls back to LIKE if FTS5 table doesn't exist or returns no results.
   */
  search(query: string, options?: EntitySearchOptions): Entity[] {
    // Empty query: return all entities with limit/offset
    if (!query.trim()) {
      return this.searchAll(options);
    }

    const limit = options?.limit || 20;

    // Priority 1: Exact name match (always check first)
    const exactResults = this.searchExactName(query, options);
    if (exactResults.length >= limit) {
      return exactResults.slice(0, limit);
    }

    // Priority 1.5: Qualified name suffix match (e.g., "EmbeddingManager" matches "src/embeddings/manager.ts::EmbeddingManager")
    const seenExact = new Set(exactResults.map(e => e.id));
    const qualifiedResults = this.searchQualifiedName(query, options);
    for (const r of qualifiedResults) {
      if (!seenExact.has(r.id)) {
        exactResults.push(r);
        seenExact.add(r.id);
      }
    }
    if (exactResults.length >= limit) {
      return exactResults.slice(0, limit);
    }

    // Priority 2: Try FTS5
    const seenIds = new Set(exactResults.map(e => e.id));
    // Merge the already-seen qualified name IDs
    for (const id of seenExact) seenIds.add(id);
    try {
      const ftsResults = this.searchFTS5(query, options);
      for (const r of ftsResults) {
        if (!seenIds.has(r.id)) {
          exactResults.push(r);
          seenIds.add(r.id);
        }
      }
      if (exactResults.length > 0) return exactResults.slice(0, limit);
    } catch {
      // FTS5 failed, continue to LIKE fallback
    }

    // Priority 3: LIKE-based search (handles substring matching)
    const likeResults = this.searchLike(query, options);
    for (const r of likeResults) {
      if (!seenIds.has(r.id)) {
        exactResults.push(r);
        seenIds.add(r.id);
      }
    }
    return exactResults.slice(0, limit);
  }

  /**
   * Search entities and return scored results.
   * Exact matches get score 1.0, qualified name matches 0.95,
   * FTS5 results use normalized BM25 rank, LIKE fallback gets 0.3.
   */
  searchWithScores(query: string, options?: EntitySearchOptions): Array<{ entity: Entity; score: number }> {
    if (!query.trim()) {
      return this.searchAll(options).map(entity => ({ entity, score: 0.5 }));
    }

    const limit = options?.limit || 20;
    const results: Array<{ entity: Entity; score: number }> = [];
    const seenIds = new Set<string>();

    // Priority 1: Exact name match → score 1.0
    const exactResults = this.searchExactName(query, options);
    for (const entity of exactResults) {
      results.push({ entity, score: 1.0 });
      seenIds.add(entity.id);
    }
    if (results.length >= limit) return results.slice(0, limit);

    // Priority 1.5: Qualified name suffix → score 0.95
    const qualifiedResults = this.searchQualifiedName(query, options);
    for (const entity of qualifiedResults) {
      if (!seenIds.has(entity.id)) {
        results.push({ entity, score: 0.95 });
        seenIds.add(entity.id);
      }
    }
    if (results.length >= limit) return results.slice(0, limit);

    // Priority 2: FTS5 with real BM25 rank
    try {
      const ftsResults = this.searchFTS5WithRank(query, options);
      for (const { entity, rank } of ftsResults) {
        if (!seenIds.has(entity.id)) {
          // BM25 rank is negative; more negative = more relevant
          // Normalize to 0-1: score = 1 / (1 + |rank|)
          const score = 1 / (1 + Math.abs(rank));
          results.push({ entity, score });
          seenIds.add(entity.id);
        }
      }
      if (results.length > 0) return results.slice(0, limit);
    } catch {
      // FTS5 not available
    }

    // Priority 3: LIKE fallback → score 0.3
    const likeResults = this.searchLike(query, options);
    for (const entity of likeResults) {
      if (!seenIds.has(entity.id)) {
        results.push({ entity, score: 0.3 });
        seenIds.add(entity.id);
      }
    }
    return results.slice(0, limit);
  }

  /**
   * Exact name match search (highest priority).
   */
  private searchExactName(query: string, options?: EntitySearchOptions): Entity[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE name = ? COLLATE NOCASE`;
    const params: unknown[] = [query];

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const placeholders = types.map(() => '?').join(', ');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    if (options?.filePath) {
      sql += ' AND file_path = ?';
      params.push(options.filePath);
    }

    const rows = this.db.all<EntityRow>(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Qualified name suffix match (e.g., query "Foo" matches "src/bar.ts::Foo").
   */
  private searchQualifiedName(query: string, options?: EntitySearchOptions): Entity[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE qualified_name LIKE ? COLLATE NOCASE`;
    const params: unknown[] = [`%::${query}`];

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const placeholders = types.map(() => '?').join(', ');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    const rows = this.db.all<EntityRow>(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Return all entities (for empty query with pagination).
   */
  private searchAll(options?: EntitySearchOptions): Entity[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: unknown[] = [];

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const placeholders = types.map(() => '?').join(', ');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    if (options?.filePath) {
      sql += ' AND file_path = ?';
      params.push(options.filePath);
    }

    sql += ' ORDER BY name';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.all<EntityRow>(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * FTS5-based search with BM25 ranking.
   */
  private searchFTS5(query: string, options?: EntitySearchOptions): Entity[] {
    const ftsTable = `${this.projectPrefix}_entities_fts`;
    // Expand compound identifiers (PascalCase, camelCase, snake_case) into search tokens
    const rawTerms = query.replace(/['"]/g, '').split(/\s+/);
    const expandedTerms = new Set<string>();
    for (const term of rawTerms) {
      // Add original term
      expandedTerms.add(term);
      // Add split parts (e.g., "EntityStore" → "Entity", "Store")
      const parts = splitIdentifier(term).split(/\s+/);
      for (const part of parts) {
        if (part.length > 1) expandedTerms.add(part);
      }
    }
    const ftsQuery = [...expandedTerms].map(t => `"${t}"*`).join(' OR ');

    let sql = `
      SELECT e.*, rank
      FROM ${ftsTable} fts
      JOIN ${this.tableName} e ON e.rowid = fts.rowid
      WHERE ${ftsTable} MATCH ?
    `;
    const params: unknown[] = [ftsQuery];

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const placeholders = types.map(() => '?').join(', ');
      sql += ` AND e.type IN (${placeholders})`;
      params.push(...types);
    }

    if (options?.filePath) {
      sql += ' AND e.file_path = ?';
      params.push(options.filePath);
    }

    sql += ' ORDER BY rank';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.all<EntityRow>(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * FTS5 search that preserves BM25 rank for scoring.
   */
  private searchFTS5WithRank(query: string, options?: EntitySearchOptions): Array<{ entity: Entity; rank: number }> {
    const ftsTable = `${this.projectPrefix}_entities_fts`;
    const rawTerms = query.replace(/['"]/g, '').split(/\s+/);
    const expandedTerms = new Set<string>();
    for (const term of rawTerms) {
      expandedTerms.add(term);
      const parts = splitIdentifier(term).split(/\s+/);
      for (const part of parts) {
        if (part.length > 1) expandedTerms.add(part);
      }
    }
    const ftsQuery = [...expandedTerms].map(t => `"${t}"*`).join(' OR ');

    let sql = `
      SELECT e.*, rank
      FROM ${ftsTable} fts
      JOIN ${this.tableName} e ON e.rowid = fts.rowid
      WHERE ${ftsTable} MATCH ?
    `;
    const params: unknown[] = [ftsQuery];

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const placeholders = types.map(() => '?').join(', ');
      sql += ` AND e.type IN (${placeholders})`;
      params.push(...types);
    }

    if (options?.filePath) {
      sql += ' AND e.file_path = ?';
      params.push(options.filePath);
    }

    sql += ' ORDER BY rank';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.all<EntityRow & { rank: number }>(sql, params);
    return rows.map(row => ({
      entity: this.rowToEntity(row),
      rank: row.rank
    }));
  }

  /**
   * LIKE-based fallback search.
   */
  private searchLike(query: string, options?: EntitySearchOptions): Entity[] {
    const searchPattern = `%${query}%`;
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE (name LIKE ? OR content LIKE ? OR summary LIKE ?)
    `;
    const params: unknown[] = [searchPattern, searchPattern, searchPattern];

    if (options?.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      const placeholders = types.map(() => '?').join(', ');
      sql += ` AND type IN (${placeholders})`;
      params.push(...types);
    }

    if (options?.filePath) {
      sql += ' AND file_path = ?';
      params.push(options.filePath);
    }

    sql += ' ORDER BY name';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.all<EntityRow>(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Check if content with given hash already exists.
   */
  existsByHash(hash: string): boolean {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE hash = ?`,
      [hash]
    );
    return (row?.count || 0) > 0;
  }

  /**
   * Find entity by content hash.
   */
  findByHash(hash: string): Entity | null {
    const row = this.db.get<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE hash = ?`,
      [hash]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Count entities, optionally filtered by type.
   */
  count(type?: EntityType): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }

    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count || 0;
  }

  /**
   * List all entities with pagination.
   */
  list(options?: { limit?: number; offset?: number; type?: EntityType }): Entity[] {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (options?.type) {
      sql += ' WHERE type = ?';
      params.push(options.type);
    }

    sql += ' ORDER BY name';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.all<EntityRow>(sql, params);
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Iterate entities in fixed-size pages using a synchronous generator.
   * Only one page of entities is in memory at a time.
   */
  *listPaginated(options?: {
    type?: EntityType;
    pageSize?: number;
  }): Generator<Entity[]> {
    const pageSize = options?.pageSize ?? 500;
    let offset = 0;

    while (true) {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: unknown[] = [];

      if (options?.type) {
        sql += ' WHERE type = ?';
        params.push(options.type);
      }

      sql += ' ORDER BY id LIMIT ? OFFSET ?';
      params.push(pageSize, offset);

      const rows = this.db.all<EntityRow>(sql, params);
      if (rows.length === 0) break;

      yield rows.map(row => this.rowToEntity(row));
      offset += pageSize;

      if (rows.length < pageSize) break;
    }
  }

  /**
   * Generate a qualified name for an entity.
   */
  private generateQualifiedName(input: EntityCreateInput): string {
    if (input.filePath) {
      // Code entity: file::name
      return `${input.filePath}::${input.name}`;
    }
    // Domain entity: type::name
    return `${input.type}::${input.name}`;
  }

  /**
   * Convert database row to Entity object.
   */
  private rowToEntity(row: EntityRow): Entity {
    return {
      id: row.id,
      type: row.type as EntityType,
      name: row.name,
      qualifiedName: row.qualified_name || undefined,
      content: row.content || undefined,
      summary: row.summary || undefined,
      metadata: JSON.parse(row.metadata || '{}'),
      filePath: row.file_path || undefined,
      startLine: row.start_line || undefined,
      endLine: row.end_line || undefined,
      hash: row.hash || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
