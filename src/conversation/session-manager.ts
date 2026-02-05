import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { Session, SessionConfig } from './types';

/**
 * Database row representation of a session.
 */
interface SessionRow {
  id: string;
  name: string | null;
  status: string;
  summary: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/**
 * Default session configuration.
 */
const DEFAULT_CONFIG: SessionConfig = {
  retention: 30,           // 30 days
  autoSummarize: true,
  maxActiveMessages: 100
};

/**
 * Manages conversation sessions.
 */
export class SessionManager {
  private sessionsTable: string;
  private messagesTable: string;
  private currentSessionId: string | null = null;
  private config: SessionConfig;

  constructor(
    private db: DatabaseConnection,
    private projectId: string,
    config?: Partial<SessionConfig>
  ) {
    const prefix = sanitizeProjectId(projectId);
    this.sessionsTable = `${prefix}_sessions`;
    this.messagesTable = `${prefix}_messages`;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a new session.
   */
  create(name?: string): Session {
    const id = generateId();

    this.db.run(
      `INSERT INTO ${this.sessionsTable} (id, name, status, message_count)
       VALUES (?, ?, 'active', 0)`,
      [id, name || null]
    );

    return this.get(id)!;
  }

  /**
   * Get a session by ID.
   */
  get(id: string): Session | null {
    const row = this.db.get<SessionRow>(
      `SELECT * FROM ${this.sessionsTable} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToSession(row) : null;
  }

  /**
   * Get or create the current active session.
   */
  getCurrent(): Session {
    // Return existing current session
    if (this.currentSessionId) {
      const session = this.get(this.currentSessionId);
      if (session && session.status === 'active') {
        return session;
      }
    }

    // Find most recent active session
    const row = this.db.get<SessionRow>(
      `SELECT * FROM ${this.sessionsTable}
       WHERE status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`
    );

    if (row) {
      this.currentSessionId = row.id;
      return this.rowToSession(row);
    }

    // Create new session
    const session = this.create();
    this.currentSessionId = session.id;
    return session;
  }

  /**
   * Set the current session.
   */
  setCurrent(id: string): void {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }
    this.currentSessionId = id;
  }

  /**
   * Get the current session ID (if set).
   */
  getCurrentId(): string | null {
    return this.currentSessionId;
  }

  /**
   * List sessions, optionally filtered by status.
   */
  list(status?: Session['status']): Session[] {
    let sql = `SELECT * FROM ${this.sessionsTable}`;
    const params: unknown[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = this.db.all<SessionRow>(sql, params);
    return rows.map(row => this.rowToSession(row));
  }

  /**
   * Update a session.
   */
  update(
    id: string,
    updates: Partial<Pick<Session, 'name' | 'status' | 'summary'>>
  ): Session {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
      if (updates.status === 'archived' || updates.status === 'summarized') {
        setClauses.push('archived_at = CURRENT_TIMESTAMP');
      }
    }
    if (updates.summary !== undefined) {
      setClauses.push('summary = ?');
      params.push(updates.summary);
    }

    params.push(id);

    this.db.run(
      `UPDATE ${this.sessionsTable} SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return this.get(id)!;
  }

  /**
   * Archive a session.
   */
  archive(id: string): Session {
    return this.update(id, { status: 'archived' });
  }

  /**
   * Mark a session as summarized.
   */
  markSummarized(id: string, summary: string): Session {
    return this.update(id, { status: 'summarized', summary });
  }

  /**
   * Delete a session and all its messages.
   */
  delete(id: string): boolean {
    const session = this.get(id);
    if (!session) {
      return false;
    }

    // Delete messages first (cascade)
    this.db.run(
      `DELETE FROM ${this.messagesTable} WHERE session_id = ?`,
      [id]
    );

    this.db.run(`DELETE FROM ${this.sessionsTable} WHERE id = ?`, [id]);

    if (this.currentSessionId === id) {
      this.currentSessionId = null;
    }

    return true;
  }

  /**
   * Clean up old archived/summarized sessions based on retention policy.
   */
  cleanup(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retention);

    // Get sessions to delete
    const toDelete = this.db.all<{ id: string }>(
      `SELECT id FROM ${this.sessionsTable}
       WHERE status IN ('archived', 'summarized')
       AND archived_at < ?`,
      [cutoffDate.toISOString()]
    );

    // Delete each session and its messages
    for (const { id } of toDelete) {
      this.delete(id);
    }

    return toDelete.length;
  }

  /**
   * Get session statistics.
   */
  getStats(): {
    active: number;
    archived: number;
    summarized: number;
    totalMessages: number;
  } {
    const stats = this.db.get<{
      active: number;
      archived: number;
      summarized: number;
      total_messages: number;
    }>(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN status = 'summarized' THEN 1 ELSE 0 END) as summarized,
        SUM(message_count) as total_messages
      FROM ${this.sessionsTable}
    `);

    return {
      active: stats?.active || 0,
      archived: stats?.archived || 0,
      summarized: stats?.summarized || 0,
      totalMessages: stats?.total_messages || 0
    };
  }

  /**
   * Check if a session should trigger summarization.
   */
  shouldSummarize(id: string): boolean {
    const session = this.get(id);
    if (!session) return false;
    return session.messageCount >= this.config.maxActiveMessages;
  }

  /**
   * Get the session configuration.
   */
  getConfig(): SessionConfig {
    return { ...this.config };
  }

  /**
   * Convert database row to Session object.
   */
  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id,
      name: row.name || undefined,
      status: row.status as Session['status'],
      summary: row.summary || undefined,
      messageCount: row.message_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      archivedAt: row.archived_at ? new Date(row.archived_at) : undefined
    };
  }
}
