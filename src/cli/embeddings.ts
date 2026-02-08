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
import { EntityStore } from '../entities';
import { EmbeddingManager } from '../embeddings/manager';
import { OllamaEmbeddingProvider } from '../embeddings/ollama';

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
  const command = new Command('run')
    .description('Generate embeddings for entities')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --type <type>', 'Only embed entities of this type')
    .option('-f, --force', 'Regenerate all embeddings')
    .option('--model-upgrade', 'Re-embed only vectors from a different model')
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
  const command = new Command('status')
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
  const command = new Command('cleanup')
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
    modelUpgrade?: boolean;
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

  const ollamaProvider = await OllamaEmbeddingProvider.create({
    baseUrl: config.providers?.ollama?.base_url || 'http://localhost:11434',
    model: config.defaults?.embeddings?.model || 'mxbai-embed-large:latest'
  });

  // Handle --model-upgrade: re-embed entities with vectors from a different model
  if (options.modelUpgrade) {
    const embeddingManager = new EmbeddingManager(db, projectId, ollamaProvider);
    const mismatchIds = embeddingManager.getModelMismatchEntityIds();

    if (mismatchIds.length === 0) {
      await db.close();
      output.log(`All vectors match current model (${ollamaProvider.modelId}).`);
      return;
    }

    if (options.dryRun) {
      await db.close();
      output.log(`${mismatchIds.length} entities have vectors from a different model.`);
      output.log(`Current model: ${ollamaProvider.modelId}`);
      return;
    }

    output.log(`Found ${mismatchIds.length} entities with vectors from a different model. Re-embedding...`);

    try {
      const entityStore = new EntityStore(db, projectId);
      const fullEntities = [];
      for (const id of mismatchIds) {
        const entity = await entityStore.get(id);
        if (entity) fullEntities.push(entity);
      }

      const result = await embeddingManager.embedIncremental(fullEntities, {
        batchSize: 50,
        onProgress: (completed, total) => {
          if (completed % 50 === 0) {
            output.log(`  Progress: ${completed}/${total}`);
          }
        }
      });

      // Clean up old model vectors
      const cleaned = embeddingManager.cleanupOldModelVectors();
      output.log(colors.bold(`Re-embedded ${result.embedded} entities, cleaned ${cleaned} old vectors`));
      db.save();
    } catch (err) {
      output.error(`Embedding failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await db.close();
    }
    return;
  }

  // Find entities needing embeddings
  let sql = `
    SELECT e.id, e.name, e.type, e.hash as content_hash,
           emb.content_hash as embedding_hash
    FROM ${prefix}_entities e
    LEFT JOIN ${prefix}_vector_meta emb ON e.id = emb.entity_id
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

  if (entities.length === 0) {
    // Check for model mismatch and report
    const embeddingManager = new EmbeddingManager(db, projectId, ollamaProvider);
    const mismatchCount = embeddingManager.getModelMismatchCount();
    await db.close();
    output.log('All entities are up to date.');
    if (mismatchCount > 0) {
      output.log(colors.yellow(
        `Note: ${mismatchCount} vectors from a different model. Run --model-upgrade to re-embed.`
      ));
    }
    return;
  }

  if (options.dryRun) {
    await db.close();
    output.log(colors.bold('Would embed:\n'));
    output.log(formatTable(entities, [
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Status', key: 'embedding_hash', format: (h) => h ? 'stale' : 'new', width: 10 }
    ]));
    output.log(`\n${entities.length} entities would be embedded`);
    return;
  }

  output.log(`Found ${entities.length} entities needing embeddings. Generating...`);

  try {
    const embeddingManager = new EmbeddingManager(db, projectId, ollamaProvider);
    const entityStore = new EntityStore(db, projectId);

    // Load full entity objects for embedding
    const fullEntities = [];
    for (const e of entities) {
      const entity = await entityStore.get(e.id);
      if (entity) fullEntities.push(entity);
    }

    const result = await embeddingManager.embedIncremental(fullEntities, {
      batchSize: 50,
      onProgress: (completed, total, skipped) => {
        if (completed % 50 === 0) {
          output.log(`  Progress: ${completed}/${total} embedded (${skipped} unchanged)`);
        }
      }
    });

    let msg = `Embedded ${result.embedded}, skipped ${result.skipped} unchanged`;
    if (result.errors) msg += `, ${result.errors} failed`;
    msg += ` (${result.total} total)`;
    output.log(colors.bold(msg));

    db.save();
  } catch (err) {
    output.error(`Embedding failed: ${err instanceof Error ? err.message : String(err)}`);
    output.log('Make sure Ollama is running with the configured embedding model.');
  } finally {
    await db.close();
  }
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

  const currentModel = config.defaults?.embeddings?.model || 'mxbai-embed-large:latest';
  const ollamaProvider = await OllamaEmbeddingProvider.create({
    baseUrl: config.providers?.ollama?.base_url || 'http://localhost:11434',
    model: currentModel
  });
  const embeddingManager = new EmbeddingManager(db, projectId, ollamaProvider);
  const detailedStats = await embeddingManager.getDetailedStats();

  const stats = db.get<EmbeddingStats>(`
    SELECT
      (SELECT COUNT(*) FROM ${prefix}_entities) as total_entities,
      (SELECT COUNT(*) FROM ${prefix}_vector_meta emb
       WHERE EXISTS (SELECT 1 FROM ${prefix}_entities e WHERE e.id = emb.entity_id)) as embedded,
      (SELECT COUNT(*) FROM ${prefix}_entities e
       WHERE NOT EXISTS (SELECT 1 FROM ${prefix}_vector_meta emb WHERE emb.entity_id = e.id)) as pending,
      (SELECT COUNT(*) FROM ${prefix}_vector_meta emb
       JOIN ${prefix}_entities e ON emb.entity_id = e.id
       WHERE e.hash IS NOT NULL AND emb.content_hash != e.hash) as stale
  `);

  const byType = db.all<{ type: string; count: number; embedded: number }>(`
    SELECT
      e.type,
      COUNT(*) as count,
      SUM(CASE WHEN emb.id IS NOT NULL THEN 1 ELSE 0 END) as embedded
    FROM ${prefix}_entities e
    LEFT JOIN ${prefix}_vector_meta emb ON e.id = emb.entity_id
    GROUP BY e.type
    ORDER BY count DESC
  `);

  // F10h.2: estimate storage from vec0 (768 dims * 4 bytes * count)
  const vecMetaCount = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${prefix}_vector_meta`);
  const storageSize = { size: (vecMetaCount?.count || 0) * 768 * 4 };

  await db.close();

  const result = {
    ...stats,
    currentModel: ollamaProvider.modelId,
    modelMismatch: detailedStats.modelMismatchCount,
    byModel: detailedStats.byModel,
    byType,
    storageBytes: storageSize?.size || 0
  };

  if (options.json) {
    output.log(JSON.stringify(result, null, 2));
    return;
  }

  output.log(colors.bold('Embedding Status\n'));
  output.log(`  Current model:   ${ollamaProvider.modelId}`);
  output.log(`  Total entities:  ${stats?.total_entities || 0}`);
  output.log(`  Embedded:        ${stats?.embedded || 0}`);
  output.log(`  Pending:         ${stats?.pending || 0}`);
  output.log(`  Stale:           ${stats?.stale || 0}`);
  if (detailedStats.modelMismatchCount && detailedStats.modelMismatchCount > 0) {
    output.log(colors.yellow(`  Model mismatch:  ${detailedStats.modelMismatchCount} (run embed --model-upgrade)`));
  }
  output.log(`  Storage:         ${formatBytes(result.storageBytes)}`);

  const coverage = stats?.total_entities
    ? ((stats.embedded / stats.total_entities) * 100).toFixed(1)
    : '0.0';
  output.log(`  Coverage:        ${coverage}%`);

  // Per-model breakdown
  if (detailedStats.byModel && detailedStats.byModel.length > 1) {
    output.log(`\n${colors.bold('By Model:')}`);
    for (const m of detailedStats.byModel) {
      const isCurrent = m.modelId === ollamaProvider.modelId;
      const label = isCurrent ? `${m.modelId} (current)` : m.modelId;
      output.log(`  ${label}: ${m.count} vectors`);
    }
  }

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
  const orphaned = db.all<{ id: number; entity_id: string }>(`
    SELECT emb.id, emb.entity_id
    FROM ${prefix}_vector_meta emb
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

  // Delete orphaned embeddings (F10h.2: delete from vec0 first, then metadata)
  for (const o of orphaned) {
    db.run(`DELETE FROM ${prefix}_vec WHERE rowid = ?`, [BigInt(o.id)]);
  }
  db.run(`
    DELETE FROM ${prefix}_vector_meta
    WHERE entity_id NOT IN (SELECT id FROM ${prefix}_entities)
  `);

  await db.close();

  output.log(`Deleted ${orphaned.length} orphaned embeddings.`);
}
