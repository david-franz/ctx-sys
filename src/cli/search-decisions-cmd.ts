/**
 * CLI command for searching architectural decisions in conversation history.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatDate, truncate, colors } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

const DECISION_KEYWORDS = [
  'decided', 'decision', 'agreed', 'will use', 'chose',
  'choosing', "let's go with", "let's use", 'settled on',
  'going with', 'the plan is', 'the approach is'
];

interface DecisionResult {
  messageId: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
}

/**
 * Create the search-decisions command.
 */
export function createSearchDecisionsCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('search-decisions')
    .description('Search for architectural decisions across sessions')
    .argument('<query>', 'Search query')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-l, --limit <n>', 'Maximum results', '10')
    .option('-s, --session <id>', 'Filter by session ID')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (query: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await searchDecisions(query, projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function searchDecisions(
  query: string,
  projectPath: string,
  options: {
    limit?: string;
    session?: string;
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
  const limit = parseInt(options.limit || '10', 10);

  // Build keyword filter: messages containing the query AND decision-related language
  const keywordClauses = DECISION_KEYWORDS.map(() => 'LOWER(m.content) LIKE ?').join(' OR ');

  let sql = `
    SELECT m.id as messageId, m.session_id as sessionId, m.role, m.content, m.created_at as createdAt
    FROM ${prefix}_messages m
    WHERE LOWER(m.content) LIKE ?
      AND (${keywordClauses})
  `;

  const params: unknown[] = [`%${query.toLowerCase()}%`];
  for (const kw of DECISION_KEYWORDS) {
    params.push(`%${kw.toLowerCase()}%`);
  }

  if (options.session) {
    sql += ' AND m.session_id = ?';
    params.push(options.session);
  }

  sql += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);

  const results = db.all<DecisionResult>(sql, params);

  db.close();

  if (options.json) {
    output.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    output.log('No decisions found matching that query.');
    output.log('Decisions are extracted from conversation messages containing decision-related language.');
    return;
  }

  output.log(colors.bold(`Found ${results.length} decision(s) for "${query}":\n`));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    output.log(`${i + 1}. ${colors.dim(formatDate(r.createdAt))} [${r.role}] (session: ${r.sessionId.slice(0, 8)}...)`);
    output.log(`   ${truncate(r.content, 200)}`);
    output.log('');
  }
}

export { searchDecisions };
