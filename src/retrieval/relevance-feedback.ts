/**
 * Relevance feedback for learning from search result usage.
 * Tracks which results were actually useful to improve future retrievals.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { EntityStore, Entity } from '../entities';

/**
 * Type of feedback signal.
 */
export type FeedbackType =
  | 'used'              // Entity content appeared in response
  | 'ignored'           // Entity was returned but not used
  | 'explicit_positive' // User marked as helpful
  | 'explicit_negative';// User marked as not helpful

/**
 * A recorded feedback signal.
 */
export interface FeedbackSignal {
  id: string;
  queryId: string;
  entityId: string;
  signal: FeedbackType;
  timestamp: Date;
}

/**
 * Aggregated feedback statistics for an entity.
 */
export interface FeedbackStats {
  entityId: string;
  totalReturns: number;
  usedCount: number;
  ignoredCount: number;
  positiveCount: number;
  negativeCount: number;
  useRate: number;
}

/**
 * Options for recording feedback.
 */
export interface RecordFeedbackOptions {
  queryId: string;
  entityId: string;
  signal: FeedbackType;
  metadata?: Record<string, unknown>;
}

/**
 * Manages relevance feedback for improving search results.
 */
export class RelevanceFeedback {
  private tableName: string;
  private projectPrefix: string;

  constructor(
    private db: DatabaseConnection,
    private projectId: string,
    private entityStore?: EntityStore
  ) {
    this.projectPrefix = sanitizeProjectId(projectId);
    this.tableName = `${this.projectPrefix}_feedback`;
    this.ensureTable();
  }

  /**
   * Ensure the feedback table exists.
   */
  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        query_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        signal TEXT NOT NULL,
        query_text TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_entity
        ON ${this.tableName}(entity_id)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_query
        ON ${this.tableName}(query_id)
    `);
  }

  /**
   * Record a single feedback signal.
   */
  record(options: RecordFeedbackOptions, queryText?: string): void {
    const id = this.generateId();

    this.db.run(
      `INSERT INTO ${this.tableName} (id, query_id, entity_id, signal, query_text, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        options.queryId,
        options.entityId,
        options.signal,
        queryText ?? null,
        options.metadata ? JSON.stringify(options.metadata) : null
      ]
    );
  }

  /**
   * Record multiple feedback signals in a batch.
   */
  recordBatch(
    queryId: string,
    signals: Array<{ entityId: string; signal: FeedbackType }>,
    queryText?: string
  ): void {
    this.db.transaction(() => {
      for (const signal of signals) {
        const id = this.generateId();
        this.db.run(
          `INSERT INTO ${this.tableName} (id, query_id, entity_id, signal, query_text)
           VALUES (?, ?, ?, ?, ?)`,
          [id, queryId, signal.entityId, signal.signal, queryText ?? null]
        );
      }
    });
  }

  /**
   * Record explicit user feedback.
   */
  recordExplicit(
    queryId: string,
    entityId: string,
    helpful: boolean,
    comment?: string
  ): void {
    this.record({
      queryId,
      entityId,
      signal: helpful ? 'explicit_positive' : 'explicit_negative',
      metadata: comment ? { comment } : undefined
    });
  }

  /**
   * Get feedback statistics for an entity.
   */
  getStats(entityId: string): FeedbackStats {
    interface StatsRow {
      total: number;
      used: number;
      ignored: number;
      positive: number;
      negative: number;
    }

    const stats = this.db.get<StatsRow>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN signal = 'used' THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN signal = 'ignored' THEN 1 ELSE 0 END) as ignored,
        SUM(CASE WHEN signal = 'explicit_positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN signal = 'explicit_negative' THEN 1 ELSE 0 END) as negative
      FROM ${this.tableName}
      WHERE entity_id = ?
    `, [entityId]);

    const total = stats?.total || 0;
    const used = stats?.used || 0;

    return {
      entityId,
      totalReturns: total,
      usedCount: used,
      ignoredCount: stats?.ignored || 0,
      positiveCount: stats?.positive || 0,
      negativeCount: stats?.negative || 0,
      useRate: total > 0 ? used / total : 0.5 // Default to 0.5 if no data
    };
  }

  /**
   * Get feedback history for a query.
   */
  getQueryFeedback(queryId: string): FeedbackSignal[] {
    interface FeedbackRow {
      id: string;
      query_id: string;
      entity_id: string;
      signal: string;
      created_at: string;
    }

    const rows = this.db.all<FeedbackRow>(
      `SELECT id, query_id, entity_id, signal, created_at
       FROM ${this.tableName}
       WHERE query_id = ?
       ORDER BY created_at DESC`,
      [queryId]
    );

    return rows.map(row => ({
      id: row.id,
      queryId: row.query_id,
      entityId: row.entity_id,
      signal: row.signal as FeedbackType,
      timestamp: new Date(row.created_at)
    }));
  }

  /**
   * Adjust search result scores based on historical feedback.
   */
  adjustScores(
    results: Array<{ entityId: string; score: number }>
  ): Array<{ entityId: string; score: number; adjustment: number }> {
    const adjusted: Array<{ entityId: string; score: number; adjustment: number }> = [];

    for (const result of results) {
      const stats = this.getStats(result.entityId);
      let multiplier = 1.0;

      // Only adjust if we have sufficient data
      if (stats.totalReturns >= 5) {
        // Base adjustment on use rate (0.5 to 1.5 range)
        multiplier = 0.5 + stats.useRate;

        // Explicit feedback has stronger effect
        if (stats.positiveCount > 0) {
          multiplier += 0.1 * Math.min(stats.positiveCount, 3);
        }
        if (stats.negativeCount > 0) {
          multiplier -= 0.15 * Math.min(stats.negativeCount, 3);
        }

        // Clamp multiplier to reasonable range
        multiplier = Math.max(0.3, Math.min(1.7, multiplier));
      }

      adjusted.push({
        entityId: result.entityId,
        score: result.score * multiplier,
        adjustment: multiplier
      });
    }

    // Re-sort by adjusted score
    adjusted.sort((a, b) => b.score - a.score);

    return adjusted;
  }

  /**
   * Detect implicit usage by checking if entity content appears in response.
   */
  async detectUsage(
    queryId: string,
    returnedEntityIds: string[],
    responseContent: string,
    queryText?: string
  ): Promise<{ used: string[]; ignored: string[] }> {
    const used: string[] = [];
    const ignored: string[] = [];
    const signals: Array<{ entityId: string; signal: FeedbackType }> = [];

    for (const entityId of returnedEntityIds) {
      const isUsed = await this.checkIfUsed(entityId, responseContent);

      if (isUsed) {
        used.push(entityId);
        signals.push({ entityId, signal: 'used' });
      } else {
        ignored.push(entityId);
        signals.push({ entityId, signal: 'ignored' });
      }
    }

    // Record all signals
    if (signals.length > 0) {
      this.recordBatch(queryId, signals, queryText);
    }

    return { used, ignored };
  }

  /**
   * Check if an entity was likely used in the response.
   */
  private async checkIfUsed(entityId: string, content: string): Promise<boolean> {
    if (!this.entityStore) {
      // Without entity store, assume used
      return true;
    }

    const entity = await this.entityStore.get(entityId);
    if (!entity) return false;

    const lowerContent = content.toLowerCase();

    // Check if entity name appears in content
    if (lowerContent.includes(entity.name.toLowerCase())) {
      return true;
    }

    // Check if significant parts of entity content appear
    if (entity.content) {
      // Extract meaningful identifiers from content
      const identifiers = this.extractIdentifiers(entity.content);
      const matchCount = identifiers.filter(id =>
        lowerContent.includes(id.toLowerCase())
      ).length;

      // If more than 30% of identifiers match, consider it used
      if (identifiers.length > 0 && matchCount / identifiers.length > 0.3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract identifiers (function names, variables) from code content.
   */
  private extractIdentifiers(content: string): string[] {
    // Simple regex to find camelCase and snake_case identifiers
    const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b/g;
    const identifiers = new Set<string>();

    let match;
    while ((match = identifierPattern.exec(content)) !== null) {
      // Filter out common keywords
      const id = match[1];
      if (!COMMON_KEYWORDS.has(id.toLowerCase())) {
        identifiers.add(id);
      }
    }

    return Array.from(identifiers);
  }

  /**
   * Get entities with the most positive feedback.
   */
  getMostHelpful(limit: number = 10): Array<{ entityId: string; score: number }> {
    interface HelpfulRow {
      entity_id: string;
      score: number;
    }

    const rows = this.db.all<HelpfulRow>(`
      SELECT
        entity_id,
        (SUM(CASE WHEN signal = 'used' THEN 1 ELSE 0 END) +
         SUM(CASE WHEN signal = 'explicit_positive' THEN 2 ELSE 0 END) -
         SUM(CASE WHEN signal = 'explicit_negative' THEN 2 ELSE 0 END)) as score
      FROM ${this.tableName}
      GROUP BY entity_id
      HAVING score > 0
      ORDER BY score DESC
      LIMIT ?
    `, [limit]);

    return rows.map(row => ({
      entityId: row.entity_id,
      score: row.score
    }));
  }

  /**
   * Get entities with the most negative feedback.
   */
  getMostIgnored(limit: number = 10): Array<{ entityId: string; ignoreRate: number }> {
    interface IgnoredRow {
      entity_id: string;
      ignore_rate: number;
    }

    const rows = this.db.all<IgnoredRow>(`
      SELECT
        entity_id,
        CAST(SUM(CASE WHEN signal = 'ignored' THEN 1 ELSE 0 END) AS REAL) /
        CAST(COUNT(*) AS REAL) as ignore_rate
      FROM ${this.tableName}
      GROUP BY entity_id
      HAVING COUNT(*) >= 5
      ORDER BY ignore_rate DESC
      LIMIT ?
    `, [limit]);

    return rows.map(row => ({
      entityId: row.entity_id,
      ignoreRate: row.ignore_rate
    }));
  }

  /**
   * Clear all feedback data.
   */
  clear(): void {
    this.db.run(`DELETE FROM ${this.tableName}`);
  }

  /**
   * Get total feedback count.
   */
  count(): number {
    const result = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return result?.count ?? 0;
  }

  /**
   * Generate a unique ID.
   */
  private generateId(): string {
    return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Common programming keywords to filter out from identifier extraction.
 */
const COMMON_KEYWORDS = new Set([
  'function', 'class', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
  'return', 'import', 'export', 'from', 'async', 'await', 'try', 'catch',
  'throw', 'new', 'this', 'super', 'extends', 'implements', 'interface',
  'type', 'enum', 'public', 'private', 'protected', 'static', 'readonly',
  'true', 'false', 'null', 'undefined', 'void', 'any', 'string', 'number',
  'boolean', 'object', 'array', 'date', 'map', 'set', 'promise', 'error'
]);
