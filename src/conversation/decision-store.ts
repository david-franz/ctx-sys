/**
 * F10e.5: Persistent decision store.
 * Stores architectural decisions extracted from conversations for fast, ranked retrieval.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { Decision, DecisionInput } from './types';

interface DecisionRow {
  id: string;
  session_id: string;
  message_id: string | null;
  description: string;
  context: string | null;
  alternatives: string | null;
  related_entity_ids: string | null;
  status: string;
  superseded_by: string | null;
  created_at: string;
}

export interface DecisionSearchOptions {
  sessionId?: string;
  status?: string;
  entityId?: string;
  limit?: number;
}

export class DecisionStore {
  private decisionsTable: string;
  private decisionsFtsTable: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string
  ) {
    const prefix = sanitizeProjectId(projectId);
    this.decisionsTable = `${prefix}_decisions`;
    this.decisionsFtsTable = `${prefix}_decisions_fts`;
  }

  /**
   * Create a new decision.
   */
  create(input: DecisionInput): Decision {
    const id = generateId();

    this.db.run(`
      INSERT INTO ${this.decisionsTable}
      (id, session_id, message_id, description, context, alternatives, related_entity_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      input.sessionId,
      input.messageId || null,
      input.description,
      input.context || null,
      input.alternatives ? JSON.stringify(input.alternatives) : null,
      input.relatedEntities ? JSON.stringify(input.relatedEntities) : null
    ]);

    return this.get(id)!;
  }

  /**
   * Get a decision by ID.
   */
  get(id: string): Decision | null {
    const row = this.db.get<DecisionRow>(
      `SELECT * FROM ${this.decisionsTable} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToDecision(row) : null;
  }

  /**
   * Search decisions using FTS5 full-text search.
   */
  search(query: string, options?: DecisionSearchOptions): Decision[] {
    const limit = options?.limit || 10;
    const ftsQuery = query.replace(/['"]/g, '').trim();

    if (!ftsQuery) return [];

    try {
      // Try FTS search first
      let sql = `
        SELECT d.* FROM ${this.decisionsFtsTable} fts
        JOIN ${this.decisionsTable} d ON d.rowid = fts.rowid
        WHERE ${this.decisionsFtsTable} MATCH ?
      `;
      const params: unknown[] = [ftsQuery];

      if (options?.sessionId) {
        sql += ' AND d.session_id = ?';
        params.push(options.sessionId);
      }

      if (options?.status) {
        sql += ' AND d.status = ?';
        params.push(options.status);
      }

      sql += ' ORDER BY rank LIMIT ?';
      params.push(limit);

      const rows = this.db.all<DecisionRow>(sql, params);

      // If searching by entity, also check related_entity_ids
      if (options?.entityId) {
        const entityRows = this.db.all<DecisionRow>(
          `SELECT * FROM ${this.decisionsTable}
           WHERE related_entity_ids LIKE ?
           ${options.status ? 'AND status = ?' : ''}
           LIMIT ?`,
          options.status
            ? [`%${options.entityId}%`, options.status, limit]
            : [`%${options.entityId}%`, limit]
        );
        // Merge, deduplicate by ID
        const seen = new Set(rows.map(r => r.id));
        for (const r of entityRows) {
          if (!seen.has(r.id)) {
            rows.push(r);
            seen.add(r.id);
          }
        }
      }

      return rows.map(r => this.rowToDecision(r));
    } catch {
      // FTS not available, fall back to LIKE
      return this.searchFallback(query, options);
    }
  }

  /**
   * Fallback search using LIKE for legacy projects without FTS tables.
   */
  private searchFallback(query: string, options?: DecisionSearchOptions): Decision[] {
    const limit = options?.limit || 10;
    let sql = `SELECT * FROM ${this.decisionsTable} WHERE (description LIKE ? OR context LIKE ?)`;
    const params: unknown[] = [`%${query}%`, `%${query}%`];

    if (options?.sessionId) {
      sql += ' AND session_id = ?';
      params.push(options.sessionId);
    }

    if (options?.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.all<DecisionRow>(sql, params);
    return rows.map(r => this.rowToDecision(r));
  }

  /**
   * Supersede a decision with a new one.
   */
  supersede(id: string, newDecisionId: string): void {
    this.db.run(
      `UPDATE ${this.decisionsTable} SET status = 'superseded', superseded_by = ? WHERE id = ?`,
      [newDecisionId, id]
    );
  }

  /**
   * List decisions for a session.
   */
  listBySession(sessionId: string, status?: string): Decision[] {
    let sql = `SELECT * FROM ${this.decisionsTable} WHERE session_id = ?`;
    const params: unknown[] = [sessionId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = this.db.all<DecisionRow>(sql, params);
    return rows.map(r => this.rowToDecision(r));
  }

  /**
   * List decisions that reference an entity.
   */
  listByEntity(entityId: string): Decision[] {
    const rows = this.db.all<DecisionRow>(
      `SELECT * FROM ${this.decisionsTable}
       WHERE related_entity_ids LIKE ?
       ORDER BY created_at DESC`,
      [`%${entityId}%`]
    );
    return rows.map(r => this.rowToDecision(r));
  }

  /**
   * Count decisions, optionally filtered.
   */
  count(status?: string): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.decisionsTable}`;
    const params: unknown[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count || 0;
  }

  private rowToDecision(row: DecisionRow): Decision {
    return {
      id: row.id,
      sessionId: row.session_id,
      messageId: row.message_id || '',
      description: row.description,
      context: row.context || undefined,
      alternatives: row.alternatives ? JSON.parse(row.alternatives) : undefined,
      relatedEntities: row.related_entity_ids ? JSON.parse(row.related_entity_ids) : [],
      createdAt: new Date(row.created_at.replace(' ', 'T') + 'Z')
    };
  }
}
