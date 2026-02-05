import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { hashContent } from '../utils/hash';
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
  async create(input: EntityCreateInput): Promise<Entity> {
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

    const entity = await this.get(id);
    if (!entity) {
      throw new Error('Failed to create entity');
    }
    return entity;
  }

  /**
   * Create multiple entities in a transaction.
   */
  async createMany(inputs: EntityCreateInput[]): Promise<Entity[]> {
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
      const entity = await this.get(id);
      if (entity) entities.push(entity);
    }
    return entities;
  }

  /**
   * Get an entity by ID.
   */
  async get(id: string): Promise<Entity | null> {
    const row = this.db.get<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Get an entity by name, optionally filtered by type.
   */
  async getByName(name: string, type?: EntityType): Promise<Entity | null> {
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
  async getByQualifiedName(qualifiedName: string): Promise<Entity | null> {
    const row = this.db.get<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE qualified_name = ?`,
      [qualifiedName]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Get all entities for a file, ordered by start line.
   */
  async getByFile(filePath: string): Promise<Entity[]> {
    const rows = this.db.all<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE file_path = ? ORDER BY start_line`,
      [filePath]
    );
    return rows.map(row => this.rowToEntity(row));
  }

  /**
   * Get entities by type.
   */
  async getByType(type: EntityType | EntityType[]): Promise<Entity[]> {
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
  async update(id: string, updates: EntityUpdateInput): Promise<Entity> {
    const entity = await this.get(id);
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

    const updated = await this.get(id);
    if (!updated) {
      throw new Error('Failed to update entity');
    }
    return updated;
  }

  /**
   * Delete an entity by ID.
   */
  async delete(id: string): Promise<void> {
    this.db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  /**
   * Delete all entities for a file.
   */
  async deleteByFile(filePath: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.tableName} WHERE file_path = ?`,
      [filePath]
    );
    return result.changes;
  }

  /**
   * Delete all entities of a specific type.
   */
  async deleteByType(type: EntityType): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.tableName} WHERE type = ?`,
      [type]
    );
    return result.changes;
  }

  /**
   * Search entities using LIKE-based text matching.
   */
  async search(query: string, options?: EntitySearchOptions): Promise<Entity[]> {
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
  async existsByHash(hash: string): Promise<boolean> {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE hash = ?`,
      [hash]
    );
    return (row?.count || 0) > 0;
  }

  /**
   * Find entity by content hash.
   */
  async findByHash(hash: string): Promise<Entity | null> {
    const row = this.db.get<EntityRow>(
      `SELECT * FROM ${this.tableName} WHERE hash = ?`,
      [hash]
    );
    return row ? this.rowToEntity(row) : null;
  }

  /**
   * Count entities, optionally filtered by type.
   */
  async count(type?: EntityType): Promise<number> {
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
  async list(options?: { limit?: number; offset?: number; type?: EntityType }): Promise<Entity[]> {
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
