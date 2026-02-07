/**
 * F10.7: CLI commands for embedding operations.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, formatBytes, colors } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

interface EmbeddingRow {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  content_hash: string;
  embedding_hash: string | null;
  created_at: string;
}

interface EmbeddingStats {
  total_entities: number;
  embedded: number;
  pending: number;
  stale: number;
}

/**
 * Create the embed command.
 */
export function createEmbedCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('embed')
    .description('Generate embeddings for entities')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --type <type>', 'Only embed entities of this type')
    .option('-f, --force', 'Regenerate all embeddings')
    .option('-l, --limit <n>', 'Max entities to embed')
    .option('--dry-run', 'Show what would be embedded')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await generateEmbeddings(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the embed-status command.
 */
export function createEmbedStatusCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('embed-status')
    .description('Show embedding status')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showEmbeddingStatus(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the embed-cleanup command.
 */
export function createEmbedCleanupCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('embed-cleanup')
    .description('Remove orphaned embeddings')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--force', 'Actually delete (otherwise dry-run)')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await cleanupEmbeddings(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function generateEmbeddings(
  projectPath: string,
  options: {
    type?: string;
    force?: boolean;
    limit?: string;
    dryRun?: boolean;
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

  // Find entities needing embeddings
  let sql = `
    SELECT e.id, e.name, e.type, e.hash as content_hash,
           emb.content_hash as embedding_hash
    FROM ${prefix}_entities e
    LEFT JOIN ${prefix}_vectors emb ON e.id = emb.entity_id
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (options.type) {
    sql += ' AND e.type = ?';
    params.push(options.type);
  }

  if (!options.force) {
    // Only entities without embeddings or with stale embeddings
    sql += ' AND (emb.id IS NULL OR (e.hash IS NOT NULL AND emb.content_hash != e.hash))';
  }

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(options.limit, 10));
  }

  const entities = db.all<{
    id: string;
    name: string;
    type: string;
    content_hash: string;
    embedding_hash: string | null;
  }>(sql, params);

  await db.close();

  if (entities.length === 0) {
    output.log('All entities are up to date.');
    return;
  }

  if (options.dryRun) {
    output.log(colors.bold('Would embed:\n'));
    output.log(formatTable(entities, [
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Status', key: 'embedding_hash', format: (h) => h ? 'stale' : 'new', width: 10 }
    ]));
    output.log(`\n${entities.length} entities would be embedded`);
    return;
  }

  // For now, just report what would be done
  // Actual embedding generation would use the EmbeddingService
  output.log(`Found ${entities.length} entities needing embeddings.`);
  output.log('Use ctx-sys index to generate embeddings during indexing.');
}

async function showEmbeddingStatus(
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

  const stats = db.get<EmbeddingStats>(`
    SELECT
      (SELECT COUNT(*) FROM ${prefix}_entities) as total_entities,
      (SELECT COUNT(*) FROM ${prefix}_vectors emb
       WHERE EXISTS (SELECT 1 FROM ${prefix}_entities e WHERE e.id = emb.entity_id)) as embedded,
      (SELECT COUNT(*) FROM ${prefix}_entities e
       WHERE NOT EXISTS (SELECT 1 FROM ${prefix}_vectors emb WHERE emb.entity_id = e.id)) as pending,
      (SELECT COUNT(*) FROM ${prefix}_vectors emb
       JOIN ${prefix}_entities e ON emb.entity_id = e.id
       WHERE e.hash IS NOT NULL AND emb.content_hash != e.hash) as stale
  `);

  const byType = db.all<{ type: string; count: number; embedded: number }>(`
    SELECT
      e.type,
      COUNT(*) as count,
      SUM(CASE WHEN emb.id IS NOT NULL THEN 1 ELSE 0 END) as embedded
    FROM ${prefix}_entities e
    LEFT JOIN ${prefix}_vectors emb ON e.id = emb.entity_id
    GROUP BY e.type
    ORDER BY count DESC
  `);

  const storageSize = db.get<{ size: number }>(`
    SELECT SUM(length(embedding)) as size FROM ${prefix}_vectors
  `);

  await db.close();

  const result = {
    ...stats,
    byType,
    storageBytes: storageSize?.size || 0
  };

  if (options.json) {
    output.log(JSON.stringify(result, null, 2));
    return;
  }

  output.log(colors.bold('Embedding Status\n'));
  output.log(`  Total entities:  ${stats?.total_entities || 0}`);
  output.log(`  Embedded:        ${stats?.embedded || 0}`);
  output.log(`  Pending:         ${stats?.pending || 0}`);
  output.log(`  Stale:           ${stats?.stale || 0}`);
  output.log(`  Storage:         ${formatBytes(result.storageBytes)}`);

  const coverage = stats?.total_entities
    ? ((stats.embedded / stats.total_entities) * 100).toFixed(1)
    : '0.0';
  output.log(`  Coverage:        ${coverage}%`);

  if (byType.length > 0) {
    output.log(`\n${colors.bold('By Type:')}`);
    output.log(formatTable(byType, [
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Total', key: 'count', width: 10 },
      { header: 'Embedded', key: 'embedded', width: 10 },
      { header: 'Coverage', key: 'count', format: (_, row) =>
        row.count > 0 ? `${((row.embedded / row.count) * 100).toFixed(0)}%` : '-', width: 10 }
    ]));
  }
}

async function cleanupEmbeddings(
  projectPath: string,
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

  // Find orphaned embeddings
  const orphaned = db.all<{ id: string; entity_id: string }>(`
    SELECT emb.id, emb.entity_id
    FROM ${prefix}_vectors emb
    LEFT JOIN ${prefix}_entities e ON emb.entity_id = e.id
    WHERE e.id IS NULL
  `);

  if (orphaned.length === 0) {
    output.log('No orphaned embeddings found.');
    await db.close();
    return;
  }

  if (!options.force) {
    output.log(`Found ${orphaned.length} orphaned embeddings.`);
    output.log('Use --force to delete them.');
    await db.close();
    return;
  }

  // Delete orphaned embeddings
  db.run(`
    DELETE FROM ${prefix}_vectors
    WHERE entity_id NOT IN (SELECT id FROM ${prefix}_entities)
  `);

  await db.close();

  output.log(`Deleted ${orphaned.length} orphaned embeddings.`);
}
