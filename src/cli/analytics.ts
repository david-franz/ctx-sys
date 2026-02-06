/**
 * F10.7: CLI commands for analytics.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, formatDate, colors, formatBytes } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

interface QueryLogRow {
  id: string;
  query: string;
  strategy: string;
  result_count: number;
  duration_ms: number;
  created_at: string;
}

interface UsageStats {
  total_queries: number;
  avg_duration_ms: number;
  total_entities: number;
  total_relationships: number;
}

/**
 * Create the analytics command.
 */
export function createAnalyticsCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('analytics')
    .description('View usage analytics')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--period <period>', 'Time period: day, week, month', 'week')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showAnalytics(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the dashboard command.
 */
export function createDashboardCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('dashboard')
    .description('Show project dashboard')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showDashboard(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function showAnalytics(
  projectPath: string,
  options: {
    period?: string;
    json?: boolean;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  const projectId = config.projectConfig.project.name || path.basename(projectPath);
  const prefix = sanitizeProjectId(projectId);

  // Calculate date filter
  const periodDays = {
    day: 1,
    week: 7,
    month: 30
  }[options.period || 'week'] || 7;

  const dateFilter = `datetime('now', '-${periodDays} days')`;

  // Get query stats
  const queryStats = db.get<{
    total: number;
    avg_duration: number;
    successful: number;
  }>(`
    SELECT
      COUNT(*) as total,
      AVG(duration_ms) as avg_duration,
      SUM(CASE WHEN result_count > 0 THEN 1 ELSE 0 END) as successful
    FROM ${prefix}_query_log
    WHERE created_at >= ${dateFilter}
  `);

  // Top queries
  const topQueries = db.all<{
    query: string;
    count: number;
    avg_results: number;
  }>(`
    SELECT
      query,
      COUNT(*) as count,
      AVG(result_count) as avg_results
    FROM ${prefix}_query_log
    WHERE created_at >= ${dateFilter}
    GROUP BY query
    ORDER BY count DESC
    LIMIT 10
  `);

  // Recent queries
  const recentQueries = db.all<QueryLogRow>(`
    SELECT id, query, strategy, result_count, duration_ms, created_at
    FROM ${prefix}_query_log
    ORDER BY created_at DESC
    LIMIT 20
  `);

  await db.close();

  const analytics = {
    period: options.period || 'week',
    queryStats,
    topQueries,
    recentQueries
  };

  if (options.json) {
    output.log(JSON.stringify(analytics, null, 2));
    return;
  }

  output.log(colors.bold(`Analytics (last ${options.period || 'week'})\n`));

  output.log(colors.bold('Query Statistics:'));
  output.log(`  Total queries:    ${queryStats?.total || 0}`);
  output.log(`  Successful:       ${queryStats?.successful || 0}`);
  output.log(`  Avg duration:     ${(queryStats?.avg_duration || 0).toFixed(0)}ms`);
  output.log(`  Success rate:     ${queryStats?.total
    ? ((queryStats.successful / queryStats.total) * 100).toFixed(1)
    : '0.0'}%`);

  if (topQueries.length > 0) {
    output.log(`\n${colors.bold('Top Queries:')}`);
    for (const q of topQueries.slice(0, 5)) {
      output.log(`  ${q.count}x "${q.query}" (avg ${q.avg_results.toFixed(1)} results)`);
    }
  }

  if (recentQueries.length > 0) {
    output.log(`\n${colors.bold('Recent Queries:')}`);
    output.log(formatTable(recentQueries.slice(0, 10), [
      { header: 'Query', key: 'query', format: (q) => (q as string).slice(0, 30), width: 32 },
      { header: 'Results', key: 'result_count', width: 10 },
      { header: 'Time', key: 'duration_ms', format: (d) => `${d}ms`, width: 10 },
      { header: 'When', key: 'created_at', format: formatDate, width: 18 }
    ]));
  }
}

async function showDashboard(
  projectPath: string,
  options: {
    json?: boolean;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  const projectId = config.projectConfig.project.name || path.basename(projectPath);
  const prefix = sanitizeProjectId(projectId);

  // Core stats
  const coreStats = db.get<UsageStats>(`
    SELECT
      (SELECT COUNT(*) FROM ${prefix}_query_log) as total_queries,
      (SELECT AVG(duration_ms) FROM ${prefix}_query_log) as avg_duration_ms,
      (SELECT COUNT(*) FROM ${prefix}_entities) as total_entities,
      (SELECT COUNT(*) FROM ${prefix}_relationships) as total_relationships
  `);

  // Entity breakdown
  const entityBreakdown = db.all<{ type: string; count: number }>(`
    SELECT type, COUNT(*) as count
    FROM ${prefix}_entities
    GROUP BY type
    ORDER BY count DESC
    LIMIT 10
  `);

  // Indexing status
  const indexStatus = db.get<{
    last_indexed: string | null;
    files_indexed: number;
    entities_with_content: number;
    entities_with_embeddings: number;
  }>(`
    SELECT
      (SELECT MAX(updated_at) FROM ${prefix}_entities) as last_indexed,
      (SELECT COUNT(DISTINCT file_path) FROM ${prefix}_entities) as files_indexed,
      (SELECT COUNT(*) FROM ${prefix}_entity_content) as entities_with_content,
      (SELECT COUNT(*) FROM ${prefix}_embeddings) as entities_with_embeddings
  `);

  // Session summary
  const sessionStats = db.get<{
    total_sessions: number;
    total_messages: number;
    active_sessions: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM ${prefix}_sessions) as total_sessions,
      (SELECT COUNT(*) FROM ${prefix}_messages) as total_messages,
      (SELECT COUNT(*) FROM ${prefix}_sessions WHERE status = 'active') as active_sessions
  `);

  await db.close();

  const dashboard = {
    project: projectId,
    coreStats,
    entityBreakdown,
    indexStatus,
    sessionStats
  };

  if (options.json) {
    output.log(JSON.stringify(dashboard, null, 2));
    return;
  }

  output.log(colors.bold(`Dashboard: ${projectId}\n`));

  output.log(colors.bold('Core Statistics:'));
  output.log(`  Entities:        ${coreStats?.total_entities || 0}`);
  output.log(`  Relationships:   ${coreStats?.total_relationships || 0}`);
  output.log(`  Total queries:   ${coreStats?.total_queries || 0}`);
  output.log(`  Avg query time:  ${(coreStats?.avg_duration_ms || 0).toFixed(0)}ms`);

  output.log(`\n${colors.bold('Indexing Status:')}`);
  output.log(`  Last indexed:    ${indexStatus?.last_indexed ? formatDate(indexStatus.last_indexed) : 'Never'}`);
  output.log(`  Files indexed:   ${indexStatus?.files_indexed || 0}`);
  output.log(`  With content:    ${indexStatus?.entities_with_content || 0}`);
  output.log(`  With embeddings: ${indexStatus?.entities_with_embeddings || 0}`);

  if (entityBreakdown.length > 0) {
    output.log(`\n${colors.bold('Entity Types:')}`);
    for (const e of entityBreakdown) {
      const bar = '█'.repeat(Math.min(20, Math.ceil(e.count / 5)));
      output.log(`  ${e.type.padEnd(12)} ${bar} ${e.count}`);
    }
  }

  output.log(`\n${colors.bold('Sessions:')}`);
  output.log(`  Total:           ${sessionStats?.total_sessions || 0}`);
  output.log(`  Active:          ${sessionStats?.active_sessions || 0}`);
  output.log(`  Messages:        ${sessionStats?.total_messages || 0}`);
}
