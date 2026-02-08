/**
 * F10e.6: Summary version store for incremental session summarization.
 * Stores multiple summary versions per session with message range tracking.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { ConversationSummary } from './types';

export interface SummaryVersion {
  id: string;
  sessionId: string;
  version: number;
  summary: ConversationSummary;
  messageRangeStart?: string;
  messageRangeEnd?: string;
  messageCount: number;
  model?: string;
  createdAt: Date;
}

interface SummaryRow {
  id: string;
  session_id: string;
  version: number;
  summary: string;
  topics: string | null;
  decisions: string | null;
  code_references: string | null;
  key_points: string | null;
  message_range_start: string | null;
  message_range_end: string | null;
  message_count: number;
  model: string | null;
  created_at: string;
}

export class SummaryVersionStore {
  private tableName: string;

  constructor(
    private db: DatabaseConnection,
    projectId: string
  ) {
    const prefix = sanitizeProjectId(projectId);
    this.tableName = `${prefix}_session_summaries`;
  }

  /**
   * Store a new summary version.
   */
  create(input: {
    sessionId: string;
    summary: ConversationSummary;
    messageRangeStart?: string;
    messageRangeEnd?: string;
    messageCount: number;
    model?: string;
  }): SummaryVersion {
    const id = generateId();

    // Get next version number
    const latest = this.getLatest(input.sessionId);
    const version = latest ? latest.version + 1 : 1;

    this.db.run(`
      INSERT INTO ${this.tableName}
      (id, session_id, version, summary, topics, decisions, code_references, key_points,
       message_range_start, message_range_end, message_count, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      input.sessionId,
      version,
      input.summary.overview,
      JSON.stringify(input.summary.topics),
      JSON.stringify(input.summary.decisions),
      JSON.stringify(input.summary.codeReferences),
      JSON.stringify(input.summary.keyPoints),
      input.messageRangeStart || null,
      input.messageRangeEnd || null,
      input.messageCount,
      input.model || null
    ]);

    return this.get(id)!;
  }

  /**
   * Get a summary version by ID.
   */
  get(id: string): SummaryVersion | null {
    const row = this.db.get<SummaryRow>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return row ? this.rowToVersion(row) : null;
  }

  /**
   * Get the latest summary version for a session.
   */
  getLatest(sessionId: string): SummaryVersion | null {
    const row = this.db.get<SummaryRow>(
      `SELECT * FROM ${this.tableName} WHERE session_id = ? ORDER BY version DESC LIMIT 1`,
      [sessionId]
    );
    return row ? this.rowToVersion(row) : null;
  }

  /**
   * Get all summary versions for a session.
   */
  listBySession(sessionId: string): SummaryVersion[] {
    const rows = this.db.all<SummaryRow>(
      `SELECT * FROM ${this.tableName} WHERE session_id = ? ORDER BY version ASC`,
      [sessionId]
    );
    return rows.map(r => this.rowToVersion(r));
  }

  /**
   * Get the last message ID covered by the latest summary.
   */
  getLastSummarizedMessageId(sessionId: string): string | null {
    const latest = this.getLatest(sessionId);
    return latest?.messageRangeEnd || null;
  }

  private rowToVersion(row: SummaryRow): SummaryVersion {
    return {
      id: row.id,
      sessionId: row.session_id,
      version: row.version,
      summary: {
        overview: row.summary,
        topics: row.topics ? JSON.parse(row.topics) : [],
        decisions: row.decisions ? JSON.parse(row.decisions) : [],
        codeReferences: row.code_references ? JSON.parse(row.code_references) : [],
        keyPoints: row.key_points ? JSON.parse(row.key_points) : []
      },
      messageRangeStart: row.message_range_start || undefined,
      messageRangeEnd: row.message_range_end || undefined,
      messageCount: row.message_count,
      model: row.model || undefined,
      createdAt: new Date(row.created_at.replace(' ', 'T') + 'Z')
    };
  }
}
