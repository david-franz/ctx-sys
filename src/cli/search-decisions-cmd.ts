/**
 * CLI command for searching architectural decisions in conversation history.
 * Searches the dedicated decisions table (FTS) first, then falls back to
 * scanning messages for decision-related language.
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

interface StoredDecision {
  id: string;
  sessionId: string;
  description: string;
  context: string | null;
  alternatives: string | null;
  createdAt: string;
}

interface MessageDecision {
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

  // 1. Search the dedicated decisions table (FTS + LIKE fallback)
  const storedDecisions = searchStoredDecisions(db, prefix, query, limit, options.session);

  // 2. Search messages for decision-related language
  const messageDecisions = searchMessageDecisions(db, prefix, query, limit, options.session);

  db.close();

  if (options.json) {
    output.log(JSON.stringify({ decisions: storedDecisions, messageMatches: messageDecisions }, null, 2));
    return;
  }

  const totalResults = storedDecisions.length + messageDecisions.length;

  if (totalResults === 0) {
    output.log('No decisions found matching that query.');
    output.log('Create decisions via the MCP decision tool or store messages containing decision language.');
    return;
  }

  // Show stored decisions first
  if (storedDecisions.length > 0) {
    output.log(colors.bold(`Decisions (${storedDecisions.length}):\n`));

    for (let i = 0; i < storedDecisions.length; i++) {
      const d = storedDecisions[i];
      output.log(`${i + 1}. ${colors.dim(formatDate(d.createdAt))} (session: ${d.sessionId})`);
      output.log(`   ${d.description}`);
      if (d.context) {
        output.log(`   ${colors.dim('Context:')} ${truncate(d.context, 150)}`);
      }
      if (d.alternatives) {
        try {
          const alts = JSON.parse(d.alternatives);
          if (Array.isArray(alts) && alts.length > 0) {
            output.log(`   ${colors.dim('Alternatives:')} ${alts.join('; ')}`);
          }
        } catch {
          // not JSON, show raw
          output.log(`   ${colors.dim('Alternatives:')} ${truncate(d.alternatives, 150)}`);
        }
      }
      output.log('');
    }
  }

  // Show message-based matches
  if (messageDecisions.length > 0) {
    if (storedDecisions.length > 0) {
      output.log(colors.bold(`Message matches (${messageDecisions.length}):\n`));
    } else {
      output.log(colors.bold(`Found ${messageDecisions.length} decision(s) in messages for "${query}":\n`));
    }

    for (let i = 0; i < messageDecisions.length; i++) {
      const r = messageDecisions[i];
      output.log(`${i + 1}. ${colors.dim(formatDate(r.createdAt))} [${r.role}] (session: ${r.sessionId})`);
      output.log(`   ${truncate(r.content, 200)}`);
      output.log('');
    }
  }
}

function searchStoredDecisions(
  db: DatabaseConnection,
  prefix: string,
  query: string,
  limit: number,
  sessionId?: string
): StoredDecision[] {
  const tableName = `${prefix}_decisions`;
  const ftsTable = `${prefix}_decisions_fts`;

  // Escape double-quotes for FTS5 phrase query
  const safeQuery = query.replace(/"/g, '""');

  // 1. Try FTS on description column only (most targeted)
  try {
    let sql = `
      SELECT d.id, d.session_id as sessionId, d.description, d.context, d.alternatives, d.created_at as createdAt
      FROM ${ftsTable} fts
      JOIN ${tableName} d ON d.rowid = fts.rowid
      WHERE ${ftsTable} MATCH ?
    `;
    const params: unknown[] = [`description:"${safeQuery}"`];

    if (sessionId) {
      sql += ' AND d.session_id = ?';
      params.push(sessionId);
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    const results = db.all<StoredDecision>(sql, params);
    if (results.length > 0) return results;
  } catch {
    // FTS table may not exist or match failed — fall through
  }

  // 2. Try FTS on all columns (description + context)
  try {
    let sql = `
      SELECT d.id, d.session_id as sessionId, d.description, d.context, d.alternatives, d.created_at as createdAt
      FROM ${ftsTable} fts
      JOIN ${tableName} d ON d.rowid = fts.rowid
      WHERE ${ftsTable} MATCH ?
    `;
    const params: unknown[] = [`"${safeQuery}"`];

    if (sessionId) {
      sql += ' AND d.session_id = ?';
      params.push(sessionId);
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    const results = db.all<StoredDecision>(sql, params);
    if (results.length > 0) return results;
  } catch {
    // FTS match failed — fall through to LIKE
  }

  // 3. Fallback: LIKE search on description first, then context
  const likePattern = `%${query.toLowerCase()}%`;

  let sql = `
    SELECT id, session_id as sessionId, description, context, alternatives, created_at as createdAt
    FROM ${tableName}
    WHERE (LOWER(description) LIKE ? OR LOWER(context) LIKE ?)
  `;
  const params: unknown[] = [likePattern, likePattern];

  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }

  // Rank description matches above context-only matches
  sql += ` ORDER BY CASE WHEN LOWER(description) LIKE ? THEN 0 ELSE 1 END, created_at DESC LIMIT ?`;
  params.push(likePattern, limit);

  try {
    return db.all<StoredDecision>(sql, params);
  } catch {
    return [];
  }
}

function searchMessageDecisions(
  db: DatabaseConnection,
  prefix: string,
  query: string,
  limit: number,
  sessionId?: string
): MessageDecision[] {
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

  if (sessionId) {
    sql += ' AND m.session_id = ?';
    params.push(sessionId);
  }

  sql += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);

  try {
    return db.all<MessageDecision>(sql, params);
  } catch {
    return [];
  }
}

export { searchDecisions };
