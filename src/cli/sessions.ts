/**
 * F10.7: CLI commands for conversation sessions.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, formatDate, truncate, colors } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

interface SessionRow {
  id: string;
  status: string;
  message_count: number;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

/**
 * Create the sessions command.
 */
export function createSessionsCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('list')
    .description('List conversation sessions')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-s, --status <status>', 'Filter by status (active/archived/summarized)')
    .option('-l, --limit <n>', 'Max sessions to show', '20')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await listSessions(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the messages command.
 */
export function createMessagesCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('messages')
    .description('View messages in a session')
    .argument('[sessionId]', 'Session ID (optional, uses most recent)')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-l, --limit <n>', 'Max messages to show', '50')
    .option('--json', 'Output as JSON')
    .option('--raw', 'Show full message content without truncation')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (sessionId: string | undefined, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showMessages(projectPath, sessionId, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function listSessions(
  projectPath: string,
  options: {
    status?: string;
    limit?: string;
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

  const limit = parseInt(options.limit || '20', 10);

  let sql = `
    SELECT
      s.id,
      s.status,
      s.summary,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*) FROM ${prefix}_messages m WHERE m.session_id = s.id) as message_count
    FROM ${prefix}_sessions s
  `;

  const params: unknown[] = [];

  if (options.status) {
    sql += ' WHERE s.status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY s.updated_at DESC LIMIT ?';
  params.push(limit);

  const sessions = db.all<SessionRow>(sql, params);

  await db.close();

  if (options.json) {
    output.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    output.log('No sessions found.');
    return;
  }

  output.log(formatTable(sessions, [
    { header: 'ID', key: 'id', width: 12 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Messages', key: 'message_count', width: 10 },
    { header: 'Created', key: 'created_at', format: formatDate, width: 20 },
    { header: 'Summary', key: 'summary', format: (s) => truncate(s as string, 40), width: 42 }
  ]));

  output.log(`\nTotal: ${sessions.length} session(s)`);
}

async function showMessages(
  projectPath: string,
  sessionId: string | undefined,
  options: {
    limit?: string;
    json?: boolean;
    raw?: boolean;
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

  const limit = parseInt(options.limit || '50', 10);

  // If no session ID, get the most recent session
  if (!sessionId) {
    const recent = db.get<{ id: string }>(
      `SELECT id FROM ${prefix}_sessions ORDER BY updated_at DESC LIMIT 1`
    );
    if (!recent) {
      output.log('No sessions found.');
      await db.close();
      return;
    }
    sessionId = recent.id;
  }

  const messages = db.all<MessageRow>(
    `SELECT id, session_id, role, content, created_at
     FROM ${prefix}_messages
     WHERE session_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    [sessionId, limit]
  );

  await db.close();

  if (options.json) {
    output.log(JSON.stringify(messages, null, 2));
    return;
  }

  if (messages.length === 0) {
    output.log('No messages found.');
    return;
  }

  output.log(colors.bold(`Session: ${sessionId}\n`));

  for (const msg of messages) {
    const time = formatDate(msg.created_at);
    const role = msg.role.toUpperCase().padEnd(10);
    const roleColor = msg.role === 'user' ? colors.cyan : colors.yellow;

    output.log(`${colors.dim(time)} ${roleColor(role)}`);

    const content = options.raw ? msg.content : truncate(msg.content, 500);
    output.log(content);
    output.log('');
  }

  output.log(colors.dim(`Showing ${messages.length} message(s)`));
}
