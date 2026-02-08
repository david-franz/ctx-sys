/**
 * F10.7: CLI commands for debugging and maintenance.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, formatDate, formatBytes, colors } from './formatters';
import { sanitizeProjectId, createVecTable } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the inspect command.
 */
export function createInspectCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('inspect')
    .description('Inspect database tables')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --table <name>', 'Specific table to inspect')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await inspectDatabase(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the query command.
 */
export function createQueryCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('query')
    .description('Execute a raw SQL query')
    .argument('<sql>', 'SQL query to execute')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (sql: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await executeQuery(projectPath, sql, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the export command.
 */
export function createExportCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('export')
    .description('Export project data')
    .argument('<output-file>', 'Output file path')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-f, --format <format>', 'Export format: json, sql', 'json')
    .option('--entities', 'Export entities only')
    .option('--relationships', 'Export relationships only')
    .option('--full', 'Include checkpoints, memory items, reflections')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (outputFile: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await exportData(projectPath, outputFile, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the import command.
 */
export function createImportCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('import')
    .description('Import project data')
    .argument('<input-file>', 'Input file path')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--merge', 'Merge with existing data (default: replace)')
    .option('--force', 'Skip embedding model mismatch warning')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (inputFile: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await importData(projectPath, inputFile, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the health command.
 */
export function createHealthCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('health')
    .description('Check system health')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await checkHealth(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function inspectDatabase(
  projectPath: string,
  options: {
    table?: string;
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

  // Get all tables
  const tables = db.all<{ name: string }>(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name LIKE '${prefix}_%'
    ORDER BY name
  `);

  if (options.table) {
    const tableName = options.table.startsWith(prefix) ? options.table : `${prefix}_${options.table}`;
    const schema = db.all<{ cid: number; name: string; type: string; notnull: number; pk: number }>(`
      PRAGMA table_info(${tableName})
    `);

    const rowCount = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
    const sample = db.all(`SELECT * FROM ${tableName} LIMIT 5`);

    await db.close();

    const result = {
      table: tableName,
      columns: schema,
      rowCount: rowCount?.count || 0,
      sample
    };

    if (options.json) {
      output.log(JSON.stringify(result, null, 2));
      return;
    }

    output.log(colors.bold(`Table: ${tableName}\n`));
    output.log(`Rows: ${rowCount?.count || 0}\n`);

    output.log(colors.bold('Schema:'));
    output.log(formatTable(schema, [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Nullable', key: 'notnull', format: (n) => n ? 'NO' : 'YES', width: 10 },
      { header: 'PK', key: 'pk', format: (p) => p ? 'YES' : '-', width: 5 }
    ]));

    if (sample.length > 0) {
      output.log(`\n${colors.bold('Sample Data:')}`);
      output.log(JSON.stringify(sample, null, 2));
    }

    return;
  }

  // Show all tables overview
  const tableStats: { name: string; rows: number; columns: number }[] = [];

  for (const table of tables) {
    const rowCount = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table.name}`);
    const colCount = db.all<{ name: string }>(`PRAGMA table_info(${table.name})`);
    tableStats.push({
      name: table.name.replace(`${prefix}_`, ''),
      rows: rowCount?.count || 0,
      columns: colCount.length
    });
  }

  await db.close();

  if (options.json) {
    output.log(JSON.stringify(tableStats, null, 2));
    return;
  }

  output.log(colors.bold('Database Tables\n'));
  output.log(formatTable(tableStats, [
    { header: 'Table', key: 'name', width: 25 },
    { header: 'Rows', key: 'rows', width: 12 },
    { header: 'Columns', key: 'columns', width: 10 }
  ]));
}

async function executeQuery(
  projectPath: string,
  sql: string,
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

  try {
    // Detect if this is a SELECT query
    const isSelect = sql.trim().toLowerCase().startsWith('select');

    if (isSelect) {
      const results = db.all(sql);

      if (options.json) {
        output.log(JSON.stringify(results, null, 2));
      } else {
        output.log(JSON.stringify(results, null, 2));
        output.log(`\n${results.length} row(s) returned`);
      }
    } else {
      db.run(sql);
      output.log('Query executed successfully');
    }
  } finally {
    await db.close();
  }
}

async function exportData(
  projectPath: string,
  outputFile: string,
  options: {
    format?: string;
    entities?: boolean;
    relationships?: boolean;
    full?: boolean;
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

  const data: Record<string, unknown> = {};

  // Export entities and their vectors
  if (!options.relationships) {
    data.entities = db.all(`SELECT * FROM ${prefix}_entities`);
    // F10h.2: export vectors from vec0 + metadata, serialize as JSON arrays
    const vectorMetas = db.all<{ id: number; entity_id: string; model_id: string; content_hash: string | null; created_at: string }>(
      `SELECT id, entity_id, model_id, content_hash, created_at FROM ${prefix}_vector_meta`
    );
    data.vectors = vectorMetas.map(vm => {
      const vec = db.get<{ embedding: Buffer }>(`SELECT embedding FROM ${prefix}_vec WHERE rowid = ?`, [BigInt(vm.id)]);
      return {
        entity_id: vm.entity_id,
        model_id: vm.model_id,
        embedding: vec ? Array.from(new Float32Array(vec.embedding.buffer, vec.embedding.byteOffset, vec.embedding.byteLength / 4)) : [],
        content_hash: vm.content_hash,
        created_at: vm.created_at
      };
    });
  }

  // Export relationships
  if (!options.entities) {
    data.relationships = db.all(`SELECT * FROM ${prefix}_relationships`);
  }

  // Export sessions and messages
  if (!options.entities && !options.relationships) {
    data.sessions = db.all(`SELECT * FROM ${prefix}_sessions`);
    data.messages = db.all(`SELECT * FROM ${prefix}_messages`);
  }

  // Full export: include checkpoints, memory items, reflections
  if (options.full && !options.entities && !options.relationships) {
    data.checkpoints = db.all(`SELECT * FROM ${prefix}_checkpoints`);
    data.memory_items = db.all(`SELECT * FROM ${prefix}_memory_items`);
    data.reflections = db.all(`SELECT * FROM ${prefix}_reflections`);
  }

  // Get embedding model info
  const embeddingModel = db.get<{ name: string }>(`SELECT name FROM embedding_models LIMIT 1`);

  // Build metadata header
  const counts: Record<string, number> = {};
  for (const [key, val] of Object.entries(data)) {
    if (Array.isArray(val)) {
      counts[key] = val.length;
    }
  }

  const exportPayload: Record<string, unknown> = {
    _meta: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projectId,
      embeddingModel: embeddingModel?.name || null,
      counts
    },
    ...data
  };

  await db.close();

  const format = options.format || 'json';
  const outputPath = path.resolve(outputFile);

  if (format === 'json') {
    fs.writeFileSync(outputPath, JSON.stringify(exportPayload, null, 2));
  } else if (format === 'sql') {
    // Generate SQL insert statements
    const lines: string[] = [];
    // Map data keys to actual table names
    const tableMap: Record<string, string> = {
      entities: `${prefix}_entities`,
      vectors: `${prefix}_vector_meta`,
      relationships: `${prefix}_relationships`,
      sessions: `${prefix}_sessions`,
      messages: `${prefix}_messages`,
      checkpoints: `${prefix}_checkpoints`,
      memory_items: `${prefix}_memory_items`,
      reflections: `${prefix}_reflections`,
    };
    for (const [key, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) continue;
      const tableName = tableMap[key] || `${prefix}_${key}`;
      for (const row of rows as Record<string, unknown>[]) {
        const cols = Object.keys(row).join(', ');
        const vals = Object.values(row).map(v =>
          v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
        ).join(', ');
        lines.push(`INSERT INTO ${tableName} (${cols}) VALUES (${vals});`);
      }
    }
    fs.writeFileSync(outputPath, lines.join('\n'));
  }

  const stats = fs.statSync(outputPath);
  const countSummary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
  output.log(`Exported to ${outputPath} (${formatBytes(stats.size)})`);
  output.log(`  ${countSummary}`);
}

async function importData(
  projectPath: string,
  inputFile: string,
  options: {
    merge?: boolean;
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

  const inputPath = path.resolve(inputFile);
  const content = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(content);

  // Check metadata if present
  if (data._meta) {
    output.log(`Import: version ${data._meta.version}, exported ${data._meta.exportedAt}`);
    if (data._meta.embeddingModel) {
      const currentModel = db.get<{ name: string }>(`SELECT name FROM embedding_models LIMIT 1`);
      if (currentModel && currentModel.name !== data._meta.embeddingModel && !options.force) {
        output.log(colors.yellow(
          `Warning: Export used embedding model "${data._meta.embeddingModel}" but current is "${currentModel.name}". ` +
          `Vectors may not be compatible. Use --force to import anyway.`
        ));
      }
    }
  }

  const counts: Record<string, number> = {};

  // Clear existing data if not merging (order matters for foreign keys)
  if (!options.merge) {
    // F10h.2: delete from vec0 first, then metadata
    const allVecMeta = db.all<{ id: number }>(`SELECT id FROM ${prefix}_vector_meta`);
    for (const vm of allVecMeta) {
      db.run(`DELETE FROM ${prefix}_vec WHERE rowid = ?`, [BigInt(vm.id)]);
    }
    db.run(`DELETE FROM ${prefix}_vector_meta`);
    db.run(`DELETE FROM ${prefix}_relationships`);
    db.run(`DELETE FROM ${prefix}_messages`);
    db.run(`DELETE FROM ${prefix}_sessions`);
    db.run(`DELETE FROM ${prefix}_checkpoints`);
    db.run(`DELETE FROM ${prefix}_memory_items`);
    db.run(`DELETE FROM ${prefix}_reflections`);
    db.run(`DELETE FROM ${prefix}_entities`);
  }

  // Import entities (with content and metadata)
  if (data.entities) {
    let entityCount = 0;
    for (const entity of data.entities) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_entities
          (id, qualified_name, name, type, content, summary, metadata,
           file_path, start_line, end_line, hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          entity.id, entity.qualified_name, entity.name, entity.type,
          entity.content, entity.summary,
          typeof entity.metadata === 'string' ? entity.metadata : JSON.stringify(entity.metadata || null),
          entity.file_path, entity.start_line, entity.end_line,
          entity.hash || entity.content_hash, entity.created_at, entity.updated_at
        ]);
        entityCount++;
      } catch {
        // Skip duplicates in merge mode
      }
    }
    counts.entities = entityCount;
  }

  // Import vectors (F10h.2: into vector_meta + vec0)
  // Ensure vec0 table exists — infer dimensions from first vector
  if (data.vectors && data.vectors.length > 0) {
    const firstEmb = typeof data.vectors[0].embedding === 'string'
      ? JSON.parse(data.vectors[0].embedding)
      : data.vectors[0].embedding;
    if (firstEmb && firstEmb.length > 0) {
      db.exec(createVecTable(projectId, firstEmb.length));
    }
  }
  if (data.vectors) {
    let vectorCount = 0;
    for (const v of data.vectors) {
      try {
        // Parse embedding from old JSON string or new array format
        const embedding: number[] = typeof v.embedding === 'string'
          ? JSON.parse(v.embedding)
          : v.embedding;

        // Insert metadata
        const result = db.run(`
          INSERT OR REPLACE INTO ${prefix}_vector_meta
          (entity_id, model_id, content_hash, created_at)
          VALUES (?, ?, ?, ?)
        `, [v.entity_id, v.model_id, v.content_hash, v.created_at]);

        // Get rowid and insert vector
        const meta = db.get<{ id: number }>(
          `SELECT id FROM ${prefix}_vector_meta WHERE entity_id = ? AND model_id = ?`,
          [v.entity_id, v.model_id]
        );
        if (meta && embedding.length > 0) {
          // Delete existing vec0 entry if any (from OR REPLACE)
          db.run(`DELETE FROM ${prefix}_vec WHERE rowid = ?`, [BigInt(meta.id)]);
          const buf = Buffer.from(new Float32Array(embedding).buffer);
          db.run(`INSERT INTO ${prefix}_vec (rowid, embedding) VALUES (?, ?)`, [BigInt(meta.id), buf]);
        }
        vectorCount++;
      } catch {
        // Skip orphaned vectors (entity_id not found)
      }
    }
    counts.vectors = vectorCount;
  }

  // Import relationships
  if (data.relationships) {
    let relCount = 0;
    for (const rel of data.relationships) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_relationships
          (id, source_id, target_id, relationship, weight, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          rel.id, rel.source_id, rel.target_id,
          rel.relationship || rel.type, rel.weight,
          typeof rel.metadata === 'string' ? rel.metadata : JSON.stringify(rel.metadata || null),
          rel.created_at
        ]);
        relCount++;
      } catch {
        // Skip orphaned relationships
      }
    }
    counts.relationships = relCount;
  }

  // Import sessions
  if (data.sessions) {
    let sessionCount = 0;
    for (const session of data.sessions) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_sessions
          (id, name, status, summary, message_count, created_at, updated_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          session.id, session.name, session.status, session.summary,
          session.message_count, session.created_at, session.updated_at, session.archived_at
        ]);
        sessionCount++;
      } catch { /* skip */ }
    }
    counts.sessions = sessionCount;
  }

  // Import messages
  if (data.messages) {
    let msgCount = 0;
    for (const msg of data.messages) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_messages
          (id, session_id, role, content, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          msg.id, msg.session_id, msg.role, msg.content,
          typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata || null),
          msg.created_at
        ]);
        msgCount++;
      } catch { /* skip */ }
    }
    counts.messages = msgCount;
  }

  // Import checkpoints (if present, from --full export)
  if (data.checkpoints) {
    let cpCount = 0;
    for (const cp of data.checkpoints) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_checkpoints
          (id, session_id, step_number, created_at, state_json, description, trigger_type, duration_ms, token_usage)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          cp.id, cp.session_id, cp.step_number, cp.created_at,
          cp.state_json, cp.description, cp.trigger_type, cp.duration_ms, cp.token_usage
        ]);
        cpCount++;
      } catch { /* skip */ }
    }
    counts.checkpoints = cpCount;
  }

  // Import memory items (if present)
  if (data.memory_items) {
    let memCount = 0;
    for (const mi of data.memory_items) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_memory_items
          (id, session_id, content, type, tier, access_count, last_accessed_at, created_at,
           relevance_score, token_count, metadata_json, embedding_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          mi.id, mi.session_id, mi.content, mi.type, mi.tier,
          mi.access_count, mi.last_accessed_at, mi.created_at,
          mi.relevance_score, mi.token_count, mi.metadata_json, mi.embedding_json
        ]);
        memCount++;
      } catch { /* skip */ }
    }
    counts.memory_items = memCount;
  }

  // Import reflections (if present)
  if (data.reflections) {
    let refCount = 0;
    for (const ref of data.reflections) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_reflections
          (id, session_id, created_at, task_description, attempt_number, outcome,
           what_worked_json, what_did_not_work_json, next_strategy, tags_json,
           embedding_json, related_entity_ids_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          ref.id, ref.session_id, ref.created_at, ref.task_description,
          ref.attempt_number, ref.outcome, ref.what_worked_json,
          ref.what_did_not_work_json, ref.next_strategy, ref.tags_json,
          ref.embedding_json, ref.related_entity_ids_json
        ]);
        refCount++;
      } catch { /* skip */ }
    }
    counts.reflections = refCount;
  }

  await db.close();

  const countSummary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ');
  output.log(`Imported ${countSummary} from ${inputPath}`);
}

async function checkHealth(
  projectPath: string,
  options: {
    json?: boolean;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const checks: { name: string; status: 'ok' | 'warning' | 'error'; message: string }[] = [];

  // Check database
  const dbPath = options.db || config.database.path;
  try {
    const db = new DatabaseConnection(dbPath);
    await db.initialize();

    const projectId = config.projectConfig.project.name || path.basename(projectPath);
    const prefix = sanitizeProjectId(projectId);

    // Check tables exist
    const tables = db.all<{ name: string }>(`
      SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${prefix}_%'
    `);

    if (tables.length > 0) {
      checks.push({ name: 'Database', status: 'ok', message: `${tables.length} tables` });
    } else {
      checks.push({ name: 'Database', status: 'warning', message: 'No tables found' });
    }

    // Check entities
    const entityCount = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${prefix}_entities`);
    if ((entityCount?.count || 0) > 0) {
      checks.push({ name: 'Entities', status: 'ok', message: `${entityCount?.count} entities` });
    } else {
      checks.push({ name: 'Entities', status: 'warning', message: 'No entities indexed' });
    }

    // Check for orphaned relationships
    const orphanedRels = db.get<{ count: number }>(`
      SELECT COUNT(*) as count FROM ${prefix}_relationships r
      WHERE NOT EXISTS (SELECT 1 FROM ${prefix}_entities e WHERE e.id = r.source_id)
         OR NOT EXISTS (SELECT 1 FROM ${prefix}_entities e WHERE e.id = r.target_id)
    `);
    if ((orphanedRels?.count || 0) === 0) {
      checks.push({ name: 'Relationships', status: 'ok', message: 'No orphaned relationships' });
    } else {
      checks.push({ name: 'Relationships', status: 'warning', message: `${orphanedRels?.count} orphaned` });
    }

    // Check embeddings coverage
    const embeddingStats = db.get<{ total: number; embedded: number }>(`
      SELECT
        (SELECT COUNT(*) FROM ${prefix}_entities WHERE hash IS NOT NULL) as total,
        (SELECT COUNT(*) FROM ${prefix}_vector_meta) as embedded
    `);
    const coverage = embeddingStats?.total
      ? (embeddingStats.embedded / embeddingStats.total) * 100
      : 0;
    if (coverage >= 80) {
      checks.push({ name: 'Embeddings', status: 'ok', message: `${coverage.toFixed(0)}% coverage` });
    } else if (coverage >= 50) {
      checks.push({ name: 'Embeddings', status: 'warning', message: `${coverage.toFixed(0)}% coverage` });
    } else {
      checks.push({ name: 'Embeddings', status: 'warning', message: `${coverage.toFixed(0)}% coverage (run embed)` });
    }

    await db.close();
  } catch (error) {
    checks.push({ name: 'Database', status: 'error', message: String(error) });
  }

  // Check config
  if (config.projectConfig) {
    checks.push({ name: 'Config', status: 'ok', message: 'Project config found' });
  } else {
    checks.push({ name: 'Config', status: 'warning', message: 'Using defaults' });
  }

  if (options.json) {
    output.log(JSON.stringify(checks, null, 2));
    return;
  }

  output.log(colors.bold('Health Check\n'));

  for (const check of checks) {
    const icon = check.status === 'ok' ? colors.green('✓')
      : check.status === 'warning' ? colors.yellow('⚠')
      : colors.red('✗');
    output.log(`  ${icon} ${check.name.padEnd(15)} ${check.message}`);
  }

  const hasErrors = checks.some(c => c.status === 'error');
  const hasWarnings = checks.some(c => c.status === 'warning');

  output.log('');
  if (hasErrors) {
    output.log(colors.red('Health check failed'));
  } else if (hasWarnings) {
    output.log(colors.yellow('Health check passed with warnings'));
  } else {
    output.log(colors.green('All checks passed'));
  }
}
