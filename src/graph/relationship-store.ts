import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import {
  StoredRelationship,
  RelationshipInput,
  RelationshipRow,
  RelationshipQueryOptions,
  GraphRelationshipType
} from './types';

/**
 * Database-backed storage for graph relationships.
 */
export class RelationshipStore {
  private tableName: string;
  private projectPrefix: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string
  ) {
    this.projectPrefix = sanitizeProjectId(projectId);
    this.tableName = `${this.projectPrefix}_relationships`;
  }

  /**
   * Create a new relationship.
   */
  async create(input: RelationshipInput): Promise<StoredRelationship> {
    const id = generateId();

    this.db.run(
      `INSERT INTO ${this.tableName}
       (id, source_id, target_id, relationship, weight, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.sourceId,
        input.targetId,
        input.relationship,
        input.weight ?? 1.0,
        JSON.stringify(input.metadata || {})
      ]
    );

    const rel = await this.get(id);
    if (!rel) {
      throw new Error('Failed to create relationship');
    }
    return rel;
  }

  /**
   * Create multiple relationships in a transaction.
   */
  async createMany(inputs: RelationshipInput[]): Promise<StoredRelationship[]> {
    const ids: string[] = [];

    this.db.transaction(() => {
      for (const input of inputs) {
        const id = generateId();
        this.db.run(
          `INSERT INTO ${this.tableName}
           (id, source_id, target_id, relationship, weight, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            input.sourceId,
            input.targetId,
            input.relationship,
            input.weight ?? 1.0,
            JSON.stringify(input.metadata || {})
          ]
        );
        ids.push(id);
      }
    });

    const relationships: StoredRelationship[] = [];
    for (const id of ids) {
      const rel = await this.get(id);
      if (rel) relationships.push(rel);
    }
    return relationships;
  }

  /**
   * Get a relationship by ID.
   */
  async get(id: string): Promise<StoredRelationship | null> {
    const row = this.db.get<RelationshipRow>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToRelationship(row) : null;
  }

  /**
   * Get all relationships for an entity.
   */
  async getForEntity(
    entityId: string,
    direction: 'out' | 'in' | 'both' = 'both',
    options?: RelationshipQueryOptions
  ): Promise<StoredRelationship[]> {
    let sql: string;
    const params: unknown[] = [];

    if (direction === 'out') {
      sql = `SELECT * FROM ${this.tableName} WHERE source_id = ?`;
      params.push(entityId);
    } else if (direction === 'in') {
      sql = `SELECT * FROM ${this.tableName} WHERE target_id = ?`;
      params.push(entityId);
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE source_id = ? OR target_id = ?`;
      params.push(entityId, entityId);
    }

    if (options?.types?.length) {
      const placeholders = options.types.map(() => '?').join(', ');
      sql += ` AND relationship IN (${placeholders})`;
      params.push(...options.types);
    }

    if (options?.minWeight !== undefined) {
      sql += ' AND weight >= ?';
      params.push(options.minWeight);
    }

    sql += ' ORDER BY weight DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.all<RelationshipRow>(sql, params);
    return rows.map(row => this.rowToRelationship(row));
  }

  /**
   * Get relationships by type.
   */
  async getByType(
    type: GraphRelationshipType,
    options?: { limit?: number }
  ): Promise<StoredRelationship[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE relationship = ? ORDER BY weight DESC`;
    const params: unknown[] = [type];

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.all<RelationshipRow>(sql, params);
    return rows.map(row => this.rowToRelationship(row));
  }

  /**
   * Check if a relationship exists between two entities.
   */
  async exists(
    sourceId: string,
    targetId: string,
    type?: GraphRelationshipType
  ): Promise<boolean> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}
               WHERE source_id = ? AND target_id = ?`;
    const params: unknown[] = [sourceId, targetId];

    if (type) {
      sql += ' AND relationship = ?';
      params.push(type);
    }

    const row = this.db.get<{ count: number }>(sql, params);
    return (row?.count || 0) > 0;
  }

  /**
   * Update relationship weight.
   */
  async updateWeight(id: string, weight: number): Promise<void> {
    this.db.run(
      `UPDATE ${this.tableName} SET weight = ? WHERE id = ?`,
      [weight, id]
    );
  }

  /**
   * Delete a relationship.
   */
  async delete(id: string): Promise<void> {
    this.db.run(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  /**
   * Delete all relationships for an entity.
   */
  async deleteForEntity(entityId: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.tableName} WHERE source_id = ? OR target_id = ?`,
      [entityId, entityId]
    );
    return result.changes;
  }

  /**
   * Delete relationships between two specific entities.
   */
  async deleteBetween(sourceId: string, targetId: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.tableName} WHERE source_id = ? AND target_id = ?`,
      [sourceId, targetId]
    );
    return result.changes;
  }

  /**
   * Get count of relationships.
   */
  async count(type?: GraphRelationshipType): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (type) {
      sql += ' WHERE relationship = ?';
      params.push(type);
    }

    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count || 0;
  }

  /**
   * Get relationship statistics grouped by type.
   */
  async getStatsByType(): Promise<Record<string, number>> {
    const rows = this.db.all<{ relationship: string; count: number }>(
      `SELECT relationship, COUNT(*) as count FROM ${this.tableName}
       GROUP BY relationship`
    );

    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.relationship] = row.count;
    }
    return stats;
  }

  /**
   * Get entities with most connections.
   */
  async getMostConnected(limit: number = 10): Promise<Array<{ entityId: string; connections: number }>> {
    const rows = this.db.all<{ entity_id: string; connections: number }>(
      `SELECT entity_id, connections FROM (
        SELECT source_id as entity_id, COUNT(*) as connections FROM ${this.tableName} GROUP BY source_id
        UNION ALL
        SELECT target_id as entity_id, COUNT(*) as connections FROM ${this.tableName} GROUP BY target_id
      )
      GROUP BY entity_id
      ORDER BY SUM(connections) DESC
      LIMIT ?`,
      [limit]
    );

    // Actually need to sum properly
    const connectionMap = new Map<string, number>();

    // Outgoing connections
    const outRows = this.db.all<{ entity_id: string; count: number }>(
      `SELECT source_id as entity_id, COUNT(*) as count FROM ${this.tableName} GROUP BY source_id`
    );
    for (const row of outRows) {
      connectionMap.set(row.entity_id, (connectionMap.get(row.entity_id) || 0) + row.count);
    }

    // Incoming connections
    const inRows = this.db.all<{ entity_id: string; count: number }>(
      `SELECT target_id as entity_id, COUNT(*) as count FROM ${this.tableName} GROUP BY target_id`
    );
    for (const row of inRows) {
      connectionMap.set(row.entity_id, (connectionMap.get(row.entity_id) || 0) + row.count);
    }

    // Sort and return top N
    return Array.from(connectionMap.entries())
      .map(([entityId, connections]) => ({ entityId, connections }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);
  }

  /**
   * Get average degree (connections per entity).
   */
  async getAverageDegree(): Promise<number> {
    const totalRels = await this.count();
    if (totalRels === 0) return 0;

    const uniqueEntities = this.db.get<{ count: number }>(
      `SELECT COUNT(DISTINCT entity_id) as count FROM (
        SELECT source_id as entity_id FROM ${this.tableName}
        UNION
        SELECT target_id as entity_id FROM ${this.tableName}
      )`
    );

    const entityCount = uniqueEntities?.count || 0;
    if (entityCount === 0) return 0;

    // Each relationship contributes 2 to total degree (one for each endpoint)
    return (totalRels * 2) / entityCount;
  }

  /**
   * Convert database row to StoredRelationship.
   */
  private rowToRelationship(row: RelationshipRow): StoredRelationship {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      relationship: row.relationship as GraphRelationshipType,
      weight: row.weight,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at)
    };
  }
}
