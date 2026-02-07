/**
 * F10.7: CLI commands for entity management.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, formatDate, truncate, colors, formatBytes } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

interface EntityRow {
  id: string;
  qualified_name: string;
  name: string;
  type: string;
  file_path: string | null;
  start_line: number | null;
  end_line: number | null;
  summary: string | null;
  hash: string | null;
  created_at: string;
  updated_at: string;
}

interface EntityStatsRow {
  type: string;
  count: number;
  with_summary: number;
  with_content: number;
}

/**
 * Create the entities list command.
 */
export function createEntitiesCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('entities')
    .description('List entities in the project')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --type <type>', 'Filter by entity type')
    .option('-f, --file <path>', 'Filter by file path')
    .option('-l, --limit <n>', 'Max entities to show', '50')
    .option('-o, --offset <n>', 'Skip first N entities', '0')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await listEntities(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the entity show command.
 */
export function createEntityCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('entity')
    .description('Show entity details')
    .argument('<id>', 'Entity ID or qualified name')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('--content', 'Include full content')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (id: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showEntity(projectPath, id, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the entity delete command.
 */
export function createEntityDeleteCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('entity-delete')
    .description('Delete an entity')
    .argument('<id>', 'Entity ID')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--force', 'Skip confirmation')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (id: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await deleteEntity(projectPath, id, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the entity stats command.
 */
export function createEntityStatsCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('entity-stats')
    .description('Show entity statistics')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showEntityStats(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function listEntities(
  projectPath: string,
  options: {
    type?: string;
    file?: string;
    limit?: string;
    offset?: string;
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

  const limit = parseInt(options.limit || '50', 10);
  const offset = parseInt(options.offset || '0', 10);

  let sql = `
    SELECT
      id, qualified_name, name, type, file_path,
      start_line, end_line, summary, hash,
      created_at, updated_at
    FROM ${prefix}_entities
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (options.type) {
    sql += ' AND type = ?';
    params.push(options.type);
  }

  if (options.file) {
    sql += ' AND file_path LIKE ?';
    params.push(`%${options.file}%`);
  }

  sql += ' ORDER BY file_path, start_line LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const entities = db.all<EntityRow>(sql, params);

  await db.close();

  if (options.json) {
    output.log(JSON.stringify(entities, null, 2));
    return;
  }

  if (entities.length === 0) {
    output.log('No entities found.');
    return;
  }

  output.log(formatTable(entities, [
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'File', key: 'file_path', format: (f) => f ? path.basename(f as string) : '-', width: 25 },
    { header: 'Lines', key: 'start_line', format: (s, row) =>
      s && row.end_line ? `${s}-${row.end_line}` : '-', width: 12 },
    { header: 'Summary', key: 'summary', format: (s) => s ? '✓' : '-', width: 8 }
  ]));

  output.log(`\nShowing ${entities.length} entities (offset: ${offset})`);
}

async function showEntity(
  projectPath: string,
  id: string,
  options: {
    json?: boolean;
    content?: boolean;
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

  // Try by ID first, then by qualified name
  let entity = db.get<EntityRow & { content?: string }>(
    `SELECT * FROM ${prefix}_entities WHERE id = ?`,
    [id]
  );

  if (!entity) {
    entity = db.get<EntityRow & { content?: string }>(
      `SELECT * FROM ${prefix}_entities WHERE qualified_name = ?`,
      [id]
    );
  }

  // Fallback: search by name (exact match, then LIKE)
  if (!entity) {
    entity = db.get<EntityRow & { content?: string }>(
      `SELECT * FROM ${prefix}_entities WHERE name = ?`,
      [id]
    );
  }

  if (!entity) {
    entity = db.get<EntityRow & { content?: string }>(
      `SELECT * FROM ${prefix}_entities WHERE name LIKE ?`,
      [`%${id}%`]
    );
  }

  if (!entity) {
    output.error(`Entity not found: ${id}`);
    await db.close();
    process.exit(1);
  }

  // Get content from entity directly
  const content: string | null = options.content ? (entity.content || null) : null;

  // Get relationships
  const relationships = db.all<{ type: string; target_id: string; target_name: string }>(
    `SELECT r.relationship as type, r.target_id, e.name as target_name
     FROM ${prefix}_relationships r
     LEFT JOIN ${prefix}_entities e ON r.target_id = e.id
     WHERE r.source_id = ?
     LIMIT 20`,
    [entity.id]
  );

  await db.close();

  if (options.json) {
    output.log(JSON.stringify({ ...entity, content, relationships }, null, 2));
    return;
  }

  output.log(colors.bold(`Entity: ${entity.name}\n`));
  output.log(`  ID:            ${entity.id}`);
  output.log(`  Qualified:     ${entity.qualified_name}`);
  output.log(`  Type:          ${entity.type}`);
  output.log(`  File:          ${entity.file_path || '-'}`);
  output.log(`  Lines:         ${entity.start_line || '-'} - ${entity.end_line || '-'}`);
  output.log(`  Created:       ${formatDate(entity.created_at)}`);
  output.log(`  Updated:       ${formatDate(entity.updated_at)}`);

  if (entity.summary) {
    output.log(`\n${colors.bold('Summary:')}`);
    output.log(`  ${entity.summary}`);
  }

  if (relationships.length > 0) {
    output.log(`\n${colors.bold('Relationships:')}`);
    for (const rel of relationships) {
      output.log(`  ${colors.dim(rel.type)} → ${rel.target_name || rel.target_id}`);
    }
  }

  if (content) {
    output.log(`\n${colors.bold('Content:')}`);
    output.log(content);
  }
}

async function deleteEntity(
  projectPath: string,
  id: string,
  options: {
    force?: boolean;
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

  // Check entity exists
  const entity = db.get<EntityRow>(
    `SELECT * FROM ${prefix}_entities WHERE id = ?`,
    [id]
  );

  if (!entity) {
    output.error(`Entity not found: ${id}`);
    await db.close();
    process.exit(1);
  }

  if (!options.force) {
    output.log(`Would delete entity: ${entity.name} (${entity.type})`);
    output.log('Use --force to confirm deletion');
    await db.close();
    return;
  }

  // Delete relationships
  db.run(`DELETE FROM ${prefix}_relationships WHERE source_id = ? OR target_id = ?`, [id, id]);

  // Delete embeddings
  db.run(`DELETE FROM ${prefix}_vectors WHERE entity_id = ?`, [id]);

  // Delete entity
  db.run(`DELETE FROM ${prefix}_entities WHERE id = ?`, [id]);

  await db.close();

  output.log(`Deleted entity: ${entity.name}`);
}

async function showEntityStats(
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

  const stats = db.all<EntityStatsRow>(`
    SELECT
      type,
      COUNT(*) as count,
      SUM(CASE WHEN summary IS NOT NULL THEN 1 ELSE 0 END) as with_summary,
      SUM(CASE WHEN hash IS NOT NULL THEN 1 ELSE 0 END) as with_content
    FROM ${prefix}_entities
    GROUP BY type
    ORDER BY count DESC
  `);

  const totals = db.get<{ total: number; files: number }>(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT file_path) as files
    FROM ${prefix}_entities
  `);

  await db.close();

  if (options.json) {
    output.log(JSON.stringify({ stats, totals }, null, 2));
    return;
  }

  output.log(colors.bold('Entity Statistics\n'));

  output.log(formatTable(stats, [
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Count', key: 'count', width: 10 },
    { header: 'With Summary', key: 'with_summary', width: 15 },
    { header: 'With Content', key: 'with_content', width: 15 }
  ]));

  output.log(`\nTotal: ${totals?.total || 0} entities across ${totals?.files || 0} files`);
}
