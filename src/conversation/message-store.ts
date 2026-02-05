import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { Message, MessageMetadata, MessageQueryOptions } from './types';

/**
 * Database row representation of a message.
 */
interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  metadata: string | null;
  created_at: string;
}

/**
 * Input for creating a message.
 */
export interface MessageInput {
  sessionId: string;
  role: Message['role'];
  content: string;
  metadata?: MessageMetadata;
}

/**
 * Stores and retrieves conversation messages.
 */
export class MessageStore {
  private messagesTable: string;
  private sessionsTable: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string
  ) {
    const prefix = sanitizeProjectId(projectId);
    this.messagesTable = `${prefix}_messages`;
    this.sessionsTable = `${prefix}_sessions`;
  }

  /**
   * Create a new message.
   */
  create(input: MessageInput): Message {
    const id = generateId();

    this.db.run(
      `INSERT INTO ${this.messagesTable}
       (id, session_id, role, content, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        input.sessionId,
        input.role,
        input.content,
        JSON.stringify(input.metadata || {})
      ]
    );

    // Update session message count and timestamp
    this.db.run(
      `UPDATE ${this.sessionsTable}
       SET message_count = message_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [input.sessionId]
    );

    return this.get(id)!;
  }

  /**
   * Get a message by ID.
   */
  get(id: string): Message | null {
    const row = this.db.get<MessageRow>(
      `SELECT * FROM ${this.messagesTable} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToMessage(row) : null;
  }

  /**
   * Get all messages for a session.
   */
  getBySession(
    sessionId: string,
    options?: { limit?: number; before?: string; after?: string }
  ): Message[] {
    let sql = `SELECT * FROM ${this.messagesTable} WHERE session_id = ?`;
    const params: unknown[] = [sessionId];

    if (options?.before) {
      sql += ' AND created_at < ?';
      params.push(options.before);
    }

    if (options?.after) {
      sql += ' AND created_at > ?';
      params.push(options.after);
    }

    sql += ' ORDER BY created_at ASC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.all<MessageRow>(sql, params);
    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Get most recent messages across all sessions.
   */
  getRecent(limit: number = 10): Message[] {
    const rows = this.db.all<MessageRow>(
      `SELECT * FROM ${this.messagesTable}
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(row => this.rowToMessage(row)).reverse();
  }

  /**
   * Get most recent messages for a specific session.
   */
  getRecentBySession(sessionId: string, limit: number = 10): Message[] {
    const rows = this.db.all<MessageRow>(
      `SELECT * FROM ${this.messagesTable}
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [sessionId, limit]
    );
    return rows.map(row => this.rowToMessage(row)).reverse();
  }

  /**
   * Search messages by content.
   */
  search(query: string, options?: { sessionId?: string; limit?: number }): Message[] {
    let sql = `SELECT * FROM ${this.messagesTable} WHERE content LIKE ?`;
    const params: unknown[] = [`%${query}%`];

    if (options?.sessionId) {
      sql += ' AND session_id = ?';
      params.push(options.sessionId);
    }

    sql += ' ORDER BY created_at DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.all<MessageRow>(sql, params);
    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Query messages with flexible options.
   */
  query(options: MessageQueryOptions): Message[] {
    let sql = `SELECT * FROM ${this.messagesTable} WHERE 1=1`;
    const params: unknown[] = [];

    if (options.sessionId) {
      sql += ' AND session_id = ?';
      params.push(options.sessionId);
    }

    if (options.role) {
      sql += ' AND role = ?';
      params.push(options.role);
    }

    if (options.before) {
      sql += ' AND created_at < ?';
      params.push(options.before instanceof Date ? options.before.toISOString() : options.before);
    }

    if (options.after) {
      sql += ' AND created_at > ?';
      params.push(options.after instanceof Date ? options.after.toISOString() : options.after);
    }

    sql += ' ORDER BY created_at ASC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.all<MessageRow>(sql, params);
    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Count messages, optionally filtered by session.
   */
  count(sessionId?: string): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.messagesTable}`;
    const params: unknown[] = [];

    if (sessionId) {
      sql += ' WHERE session_id = ?';
      params.push(sessionId);
    }

    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count || 0;
  }

  /**
   * Delete a message by ID.
   */
  delete(id: string): boolean {
    const message = this.get(id);
    if (!message) {
      return false;
    }

    this.db.run(`DELETE FROM ${this.messagesTable} WHERE id = ?`, [id]);

    // Update session message count
    this.db.run(
      `UPDATE ${this.sessionsTable}
       SET message_count = message_count - 1
       WHERE id = ?`,
      [message.sessionId]
    );

    return true;
  }

  /**
   * Delete all messages for a session.
   */
  deleteBySession(sessionId: string): number {
    const count = this.count(sessionId);
    this.db.run(
      `DELETE FROM ${this.messagesTable} WHERE session_id = ?`,
      [sessionId]
    );

    // Reset session message count
    this.db.run(
      `UPDATE ${this.sessionsTable}
       SET message_count = 0
       WHERE id = ?`,
      [sessionId]
    );

    return count;
  }

  /**
   * Get conversation pairs (user message followed by assistant response).
   */
  getConversationPairs(
    sessionId: string,
    limit?: number
  ): Array<{ user: Message; assistant: Message }> {
    const messages = this.getBySession(sessionId);
    const pairs: Array<{ user: Message; assistant: Message }> = [];

    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
        pairs.push({
          user: messages[i],
          assistant: messages[i + 1]
        });
        i++; // Skip the assistant message
      }
    }

    return limit ? pairs.slice(-limit) : pairs;
  }

  /**
   * Build a transcript from messages.
   */
  buildTranscript(messages: Message[]): string {
    return messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');
  }

  /**
   * Convert database row to Message object.
   */
  private rowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role as Message['role'],
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}
