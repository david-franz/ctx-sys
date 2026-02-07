/**
 * Query logger for tracking token usage and ROI metrics.
 */

import { DatabaseConnection } from '../db';
import { generateId } from '../utils';
import { estimateTokens } from '../retrieval/context-assembler';
import {
  QueryLog,
  UsageStats,
  DailyStats,
  QueryTypeStats,
  AnalyticsConfig,
  QueryResult,
  LogOptions,
  DEFAULT_ANALYTICS_CONFIG
} from './types';

/**
 * Logs queries with token metrics for ROI tracking.
 */
export class QueryLogger {
  private config: AnalyticsConfig;

  constructor(
    private db: DatabaseConnection,
    config: Partial<AnalyticsConfig> = {}
  ) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
  }

  /**
   * Ensure analytics tables exist.
   */
  ensureTablesExist(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        query TEXT,
        query_type TEXT NOT NULL,
        tokens_retrieved INTEGER NOT NULL,
        tokens_estimated_full INTEGER NOT NULL,
        tokens_saved INTEGER NOT NULL,
        cost_actual_cents INTEGER,
        cost_estimated_full_cents INTEGER,
        cost_saved_cents INTEGER,
        relevance_score REAL,
        item_count INTEGER,
        was_useful INTEGER,
        latency_ms INTEGER,
        strategies_json TEXT,
        item_types_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_query_logs_project_time ON query_logs(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_query_logs_session ON query_logs(session_id, timestamp DESC);

      CREATE TABLE IF NOT EXISTS daily_stats (
        project_id TEXT NOT NULL,
        date TEXT NOT NULL,
        queries INTEGER NOT NULL DEFAULT 0,
        tokens_retrieved INTEGER NOT NULL DEFAULT 0,
        tokens_saved INTEGER NOT NULL DEFAULT 0,
        cost_saved_cents INTEGER NOT NULL DEFAULT 0,
        avg_relevance REAL,
        useful_count INTEGER DEFAULT 0,
        not_useful_count INTEGER DEFAULT 0,
        PRIMARY KEY (project_id, date)
      );

      CREATE TABLE IF NOT EXISTS full_context_estimates (
        project_id TEXT PRIMARY KEY,
        measured_at TEXT NOT NULL,
        total_files INTEGER NOT NULL,
        total_lines INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        code_tokens INTEGER,
        doc_tokens INTEGER,
        config_tokens INTEGER,
        with_summaries INTEGER,
        with_filtering INTEGER,
        minimal INTEGER
      );
    `);
  }

  /**
   * Log a query with its token metrics.
   */
  async logQuery(
    projectId: string,
    query: string,
    result: QueryResult,
    options: LogOptions = {}
  ): Promise<QueryLog> {
    const fullContextEstimate = await this.getFullContextEstimate(projectId);

    // Only count savings when we actually retrieved tokens
    const hasResults = result.totalTokens > 0;
    const tokensSaved = hasResults ? Math.max(0, fullContextEstimate - result.totalTokens) : 0;
    const costActual = this.calculateCost(result.totalTokens);
    const costEstimatedFull = hasResults ? this.calculateCost(fullContextEstimate) : 0;
    const costSaved = hasResults ? Math.max(0, costEstimatedFull - costActual) : 0;

    const log: QueryLog = {
      id: generateId('qlog'),
      projectId,
      sessionId: options.sessionId,
      timestamp: new Date(),

      query: this.config.logQueries ? query : undefined,
      queryType: options.queryType || 'context',

      // Token calculations
      tokensRetrieved: result.totalTokens,
      tokensEstimatedFull: fullContextEstimate,
      tokensSaved,

      // Cost calculations
      costActual,
      costEstimatedFull,
      costSaved,

      // Quality
      relevanceScore: result.averageRelevance,
      itemCount: result.items.length,

      // Performance
      latencyMs: options.latencyMs || 0,

      // Details
      retrievalStrategies: result.strategiesUsed,
      itemTypes: this.countByType(result.items)
    };

    await this.persistLog(log);

    // Check if we need to aggregate old logs
    await this.maybeAggregateOldLogs(projectId);

    return log;
  }

  /**
   * Record user feedback on usefulness.
   */
  async recordFeedback(logId: string, wasUseful: boolean): Promise<void> {
    this.db.run(
      `UPDATE query_logs SET was_useful = ? WHERE id = ?`,
      [wasUseful ? 1 : 0, logId]
    );
  }

  /**
   * Get usage statistics for a period.
   */
  async getStats(
    projectId: string,
    period: 'day' | 'week' | 'month' | 'all' = 'week'
  ): Promise<UsageStats> {
    const { startDate, endDate } = this.getPeriodDates(period);

    // Get aggregate stats
    const stats = this.db.get<{
      total_queries: number;
      total_tokens_retrieved: number;
      total_tokens_saved: number;
      total_tokens_full: number;
      total_cost_actual: number;
      total_cost_saved: number;
      avg_relevance: number;
      useful_count: number;
      not_useful_count: number;
    }>(`
      SELECT
        COUNT(*) as total_queries,
        COALESCE(SUM(tokens_retrieved), 0) as total_tokens_retrieved,
        COALESCE(SUM(tokens_saved), 0) as total_tokens_saved,
        COALESCE(SUM(tokens_estimated_full), 0) as total_tokens_full,
        COALESCE(SUM(cost_actual_cents), 0) as total_cost_actual,
        COALESCE(SUM(cost_saved_cents), 0) as total_cost_saved,
        AVG(relevance_score) as avg_relevance,
        SUM(CASE WHEN was_useful = 1 THEN 1 ELSE 0 END) as useful_count,
        SUM(CASE WHEN was_useful = 0 THEN 1 ELSE 0 END) as not_useful_count
      FROM query_logs
      WHERE project_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
    `, [projectId, startDate.toISOString(), endDate.toISOString()]);

    // Get daily breakdown
    const dailyRows = this.db.all<{
      date: string;
      queries: number;
      tokens_retrieved: number;
      tokens_saved: number;
      cost_saved: number;
      avg_relevance: number;
    }>(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as queries,
        SUM(tokens_retrieved) as tokens_retrieved,
        SUM(tokens_saved) as tokens_saved,
        SUM(cost_saved_cents) as cost_saved,
        AVG(relevance_score) as avg_relevance
      FROM query_logs
      WHERE project_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `, [projectId, startDate.toISOString(), endDate.toISOString()]);

    // Get breakdown by query type
    const typeRows = this.db.all<{
      query_type: string;
      queries: number;
      avg_tokens: number;
      avg_savings: number;
      avg_relevance: number;
    }>(`
      SELECT
        query_type,
        COUNT(*) as queries,
        AVG(tokens_retrieved) as avg_tokens,
        AVG(tokens_saved) as avg_savings,
        AVG(relevance_score) as avg_relevance
      FROM query_logs
      WHERE project_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      GROUP BY query_type
    `, [projectId, startDate.toISOString(), endDate.toISOString()]);

    const usefulTotal = (stats?.useful_count || 0) + (stats?.not_useful_count || 0);

    return {
      period,
      startDate,
      endDate,

      totalQueries: stats?.total_queries || 0,
      totalTokensRetrieved: stats?.total_tokens_retrieved || 0,
      totalTokensSaved: stats?.total_tokens_saved || 0,
      totalTokensEstimatedFull: stats?.total_tokens_full || 0,

      totalCostActual: (stats?.total_cost_actual || 0) / 100,
      totalCostSaved: (stats?.total_cost_saved || 0) / 100,
      savingsPercent: stats?.total_tokens_full
        ? ((stats.total_tokens_saved / stats.total_tokens_full) * 100)
        : 0,

      averageRelevance: stats?.avg_relevance || 0,
      usefulnessRate: usefulTotal > 0
        ? ((stats?.useful_count || 0) / usefulTotal) * 100
        : null,

      byDay: dailyRows.map(row => ({
        date: row.date,
        queries: row.queries,
        tokensRetrieved: row.tokens_retrieved,
        tokensSaved: row.tokens_saved,
        costSaved: row.cost_saved / 100,
        avgRelevance: row.avg_relevance || 0
      })),

      byQueryType: Object.fromEntries(
        typeRows.map(row => [row.query_type, {
          queryType: row.query_type,
          queries: row.queries,
          avgTokens: Math.round(row.avg_tokens),
          avgSavings: Math.round(row.avg_savings),
          avgRelevance: row.avg_relevance || 0
        }])
      ) as Record<string, QueryTypeStats>,

      byProject: {} // Populated for cross-project queries
    };
  }

  /**
   * Get recent query logs with details.
   */
  async getRecentLogs(
    projectId: string,
    limit: number = 50
  ): Promise<QueryLog[]> {
    const rows = this.db.all<Record<string, unknown>>(`
      SELECT * FROM query_logs
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, [projectId, limit]);

    return rows.map(row => this.rowToLog(row));
  }

  /**
   * Get the full context estimate for a project.
   */
  private async getFullContextEstimate(projectId: string): Promise<number> {
    // Check for measured estimate
    const estimate = this.db.get<{ total_tokens: number }>(`
      SELECT total_tokens FROM full_context_estimates
      WHERE project_id = ?
    `, [projectId]);

    if (estimate) {
      return estimate.total_tokens;
    }

    // Fall back to heuristic
    return this.config.fullContextSize || 100000;
  }

  /**
   * Calculate cost in dollars for a token count.
   */
  private calculateCost(tokens: number): number {
    return (tokens / 1000) * this.config.pricing.inputTokens;
  }

  /**
   * Count items by type.
   */
  private countByType(items: Array<{ type?: string; [key: string]: unknown }>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const type = item.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Persist a query log to the database.
   */
  private async persistLog(log: QueryLog): Promise<void> {
    this.db.run(`
      INSERT INTO query_logs (
        id, project_id, session_id, timestamp,
        query, query_type,
        tokens_retrieved, tokens_estimated_full, tokens_saved,
        cost_actual_cents, cost_estimated_full_cents, cost_saved_cents,
        relevance_score, item_count, latency_ms,
        strategies_json, item_types_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      log.id,
      log.projectId,
      log.sessionId || null,
      log.timestamp.toISOString(),
      log.query || null,
      log.queryType,
      log.tokensRetrieved,
      log.tokensEstimatedFull,
      log.tokensSaved,
      Math.round(log.costActual * 100),
      Math.round(log.costEstimatedFull * 100),
      Math.round(log.costSaved * 100),
      log.relevanceScore,
      log.itemCount,
      log.latencyMs,
      JSON.stringify(log.retrievalStrategies),
      JSON.stringify(log.itemTypes)
    ]);
  }

  /**
   * Aggregate old logs into daily stats.
   */
  private async maybeAggregateOldLogs(projectId: string): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.aggregateAfterDays);

    // Aggregate old logs into daily stats
    this.db.run(`
      INSERT OR REPLACE INTO daily_stats (
        project_id, date, queries, tokens_retrieved, tokens_saved,
        cost_saved_cents, avg_relevance, useful_count, not_useful_count
      )
      SELECT
        project_id,
        DATE(timestamp) as date,
        COUNT(*),
        SUM(tokens_retrieved),
        SUM(tokens_saved),
        SUM(cost_saved_cents),
        AVG(relevance_score),
        SUM(CASE WHEN was_useful = 1 THEN 1 ELSE 0 END),
        SUM(CASE WHEN was_useful = 0 THEN 1 ELSE 0 END)
      FROM query_logs
      WHERE project_id = ?
        AND timestamp < ?
      GROUP BY DATE(timestamp)
    `, [projectId, cutoffDate.toISOString()]);

    // Delete aggregated logs
    this.db.run(`
      DELETE FROM query_logs
      WHERE project_id = ? AND timestamp < ?
    `, [projectId, cutoffDate.toISOString()]);
  }

  /**
   * Get date range for a period.
   */
  private getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Convert a database row to a QueryLog object.
   */
  private rowToLog(row: Record<string, unknown>): QueryLog {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      sessionId: row.session_id as string | undefined,
      timestamp: new Date(row.timestamp as string),
      query: row.query as string | undefined,
      queryType: row.query_type as 'context' | 'search' | 'decision' | 'entity',
      tokensRetrieved: row.tokens_retrieved as number,
      tokensEstimatedFull: row.tokens_estimated_full as number,
      tokensSaved: row.tokens_saved as number,
      costActual: (row.cost_actual_cents as number) / 100,
      costEstimatedFull: (row.cost_estimated_full_cents as number) / 100,
      costSaved: (row.cost_saved_cents as number) / 100,
      relevanceScore: row.relevance_score as number,
      itemCount: row.item_count as number,
      wasUseful: row.was_useful === null ? undefined : (row.was_useful as number) === 1,
      latencyMs: row.latency_ms as number,
      retrievalStrategies: JSON.parse((row.strategies_json as string) || '[]'),
      itemTypes: JSON.parse((row.item_types_json as string) || '{}')
    };
  }

  /**
   * Get the analytics configuration.
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update the analytics configuration.
   */
  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
