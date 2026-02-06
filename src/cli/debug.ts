/**
 * F10.7: CLI commands for debugging and maintenance.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, formatDate, formatBytes, colors } from './formatters';
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
  const prefix = projectId.toLowerCase().replace(/[^a-z0-9]/g, '_');

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
  const prefix = projectId.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const data: Record<string, unknown[]> = {};

  // Export entities
  if (!options.relationships) {
    data.entities = db.all(`SELECT * FROM ${prefix}_entities`);
    data.entity_content = db.all(`SELECT * FROM ${prefix}_entity_content`);
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

  await db.close();

  const format = options.format || 'json';
  const outputPath = path.resolve(outputFile);

  if (format === 'json') {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  } else if (format === 'sql') {
    // Generate SQL insert statements
    const lines: string[] = [];
    for (const [table, rows] of Object.entries(data)) {
      for (const row of rows as Record<string, unknown>[]) {
        const cols = Object.keys(row).join(', ');
        const vals = Object.values(row).map(v =>
          v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
        ).join(', ');
        lines.push(`INSERT INTO ${prefix}_${table} (${cols}) VALUES (${vals});`);
      }
    }
    fs.writeFileSync(outputPath, lines.join('\n'));
  }

  const stats = fs.statSync(outputPath);
  output.log(`Exported to ${outputPath} (${formatBytes(stats.size)})`);
}

async function importData(
  projectPath: string,
  inputFile: string,
  options: {
    merge?: boolean;
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
  const prefix = projectId.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const inputPath = path.resolve(inputFile);
  const content = fs.readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(content);

  let imported = 0;

  // Clear existing data if not merging
  if (!options.merge) {
    db.run(`DELETE FROM ${prefix}_relationships`);
    db.run(`DELETE FROM ${prefix}_entity_content`);
    db.run(`DELETE FROM ${prefix}_entities`);
    db.run(`DELETE FROM ${prefix}_messages`);
    db.run(`DELETE FROM ${prefix}_sessions`);
  }

  // Import entities
  if (data.entities) {
    for (const entity of data.entities) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_entities
          (id, qualified_name, name, type, file_path, start_line, end_line, summary, content_hash, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          entity.id, entity.qualified_name, entity.name, entity.type,
          entity.file_path, entity.start_line, entity.end_line,
          entity.summary, entity.content_hash, entity.created_at, entity.updated_at
        ]);
        imported++;
      } catch {
        // Skip duplicates in merge mode
      }
    }
  }

  // Import entity content
  if (data.entity_content) {
    for (const content of data.entity_content) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_entity_content (id, entity_id, content, created_at)
          VALUES (?, ?, ?, ?)
        `, [content.id, content.entity_id, content.content, content.created_at]);
      } catch {
        // Skip duplicates
      }
    }
  }

  // Import relationships
  if (data.relationships) {
    for (const rel of data.relationships) {
      try {
        db.run(`
          INSERT OR REPLACE INTO ${prefix}_relationships
          (id, source_id, target_id, type, weight, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [rel.id, rel.source_id, rel.target_id, rel.type, rel.weight, rel.created_at]);
        imported++;
      } catch {
        // Skip duplicates
      }
    }
  }

  await db.close();

  output.log(`Imported ${imported} records from ${inputPath}`);
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
    const prefix = projectId.toLowerCase().replace(/[^a-z0-9]/g, '_');

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
        (SELECT COUNT(*) FROM ${prefix}_entities WHERE content_hash IS NOT NULL) as total,
        (SELECT COUNT(*) FROM ${prefix}_embeddings) as embedded
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
