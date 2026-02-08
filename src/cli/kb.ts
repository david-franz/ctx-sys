/**
 * F10e.4: CLI commands for knowledge base packaging.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { KnowledgeBasePackager } from '../kb/packager';
import { formatTable, formatBytes, formatDate, colors } from './formatters';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the kb command with subcommands.
 */
export function createKBCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('kb')
    .description('Knowledge base packaging (.ctx-kb)');

  // kb create
  command
    .command('create <name>')
    .description('Package current project as a .ctx-kb knowledge base')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--ver <version>', 'Package version', '1.0.0')
    .option('--description <text>', 'Package description')
    .option('--creator <name>', 'Creator name')
    .option('-o, --output <path>', 'Output file path')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (name: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await runKBCreate(name, projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // kb install
  command
    .command('install <file>')
    .description('Install a .ctx-kb file as a new project')
    .option('--as <name>', 'Override project name')
    .option('--merge', 'Merge into existing project')
    .option('--force', 'Skip embedding model mismatch warning')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (file: string, options) => {
      try {
        await runKBInstall(file, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // kb info
  command
    .command('info <file>')
    .description('Display manifest from a .ctx-kb file')
    .option('--json', 'Output as JSON')
    .action(async (file: string, options) => {
      try {
        await runKBInfo(file, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // kb list
  command
    .command('list')
    .description('List installed knowledge bases')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        await runKBList(options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function runKBCreate(
  name: string,
  projectPath: string,
  options: {
    ver?: string;
    description?: string;
    creator?: string;
    output?: string;
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
    const projectId = config.projectConfig.project.name || path.basename(projectPath);
    const packager = new KnowledgeBasePackager(db);

    const outputFile = options.output || `${name}.ctx-kb`;

    output.log(`Packaging project "${projectId}" as knowledge base...`);

    const result = await packager.create(projectId, {
      version: options.ver,
      description: options.description,
      creator: options.creator,
      outputPath: outputFile
    });

    const fileSize = fs.statSync(result.path).size;
    const m = result.manifest;

    output.log(colors.bold(`\nCreated: ${result.path} (${formatBytes(fileSize)})`));
    output.log(`  Version:        ${m.version}`);
    output.log(`  Entities:       ${m.content.entities}`);
    output.log(`  Vectors:        ${m.embedding.vectorCount}`);
    output.log(`  Relationships:  ${m.content.relationships}`);
    output.log(`  Embedding:      ${m.embedding.model} (${m.embedding.provider})`);

    if (m.description) {
      output.log(`  Description:    ${m.description}`);
    }
  } finally {
    db.close();
  }
}

async function runKBInstall(
  file: string,
  options: {
    as?: string;
    merge?: boolean;
    force?: boolean;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const absolutePath = path.resolve(file);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  // Determine DB path — use default or specified
  const configManager = new ConfigManager();
  const config = await configManager.resolve('.');
  const dbPath = options.db || config.database.path;

  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  try {
    const packager = new KnowledgeBasePackager(db);

    // Check manifest first for model mismatch
    const manifest = packager.info(file);
    const currentModel = db.get<{ name: string }>(`SELECT name FROM embedding_models LIMIT 1`);

    if (currentModel && currentModel.name !== manifest.embedding.model && !options.force) {
      output.log(colors.yellow(
        `Warning: KB uses "${manifest.embedding.model}" but current model is "${currentModel.name}".`
      ));
      output.log(colors.yellow('Vectors may not be compatible. Use --force to install anyway.'));
    }

    output.log(`Installing "${manifest.name}" v${manifest.version}...`);

    const result = await packager.install(absolutePath, {
      projectName: options.as,
      merge: options.merge,
      force: options.force
    });

    const countSummary = Object.entries(result.counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');

    output.log(colors.bold(`\nInstalled as project: ${result.projectId}`));
    output.log(`  ${countSummary}`);
    output.log(`\nUse: ctx-sys search "<query>" -p ${result.projectId}`);
  } finally {
    db.close();
  }
}

async function runKBInfo(
  file: string,
  options: { json?: boolean },
  output: CLIOutput
): Promise<void> {
  const absolutePath = path.resolve(file);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const fileSize = fs.statSync(absolutePath).size;

  // Read manifest without needing DB
  const packager = new KnowledgeBasePackager(null as unknown as DatabaseConnection);
  const manifest = packager.info(file);

  if (options.json) {
    output.log(JSON.stringify({ ...manifest, fileSize }, null, 2));
    return;
  }

  output.log(colors.bold(`Knowledge Base: ${manifest.name}\n`));
  output.log(`  Version:        ${manifest.version}`);
  output.log(`  Created:        ${manifest.created}`);
  if (manifest.creator) output.log(`  Creator:        ${manifest.creator}`);
  if (manifest.description) output.log(`  Description:    ${manifest.description}`);
  output.log(`  File size:      ${formatBytes(fileSize)}`);
  output.log(`  Checksum:       ${manifest.checksum.substring(0, 20)}...`);

  output.log(colors.bold('\n  Embedding:'));
  output.log(`    Model:        ${manifest.embedding.model}`);
  output.log(`    Provider:     ${manifest.embedding.provider}`);
  output.log(`    Dimensions:   ${manifest.embedding.dimensions}`);
  output.log(`    Vectors:      ${manifest.embedding.vectorCount}`);

  output.log(colors.bold('\n  Content:'));
  output.log(`    Entities:     ${manifest.content.entities}`);
  output.log(`    Relationships:${manifest.content.relationships}`);
  output.log(`    Sessions:     ${manifest.content.sessions}`);
  output.log(`    Messages:     ${manifest.content.messages}`);

  if (Object.keys(manifest.content.entityTypes).length > 0) {
    output.log(colors.bold('\n  Entity Types:'));
    for (const [type, count] of Object.entries(manifest.content.entityTypes)) {
      output.log(`    ${type.padEnd(15)} ${count}`);
    }
  }
}

async function runKBList(
  options: { json?: boolean; db?: string },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve('.');
  const dbPath = options.db || config.database.path;

  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  try {
    const packager = new KnowledgeBasePackager(db);
    const kbs = packager.list();

    if (options.json) {
      output.log(JSON.stringify(kbs, null, 2));
      return;
    }

    if (kbs.length === 0) {
      output.log('No knowledge bases installed.');
      return;
    }

    output.log(colors.bold('Installed Knowledge Bases\n'));
    output.log(formatTable(kbs, [
      { header: 'Project', key: 'name', width: 25 },
      { header: 'Version', key: 'version', width: 10 },
      { header: 'Source', key: 'source', width: 30 },
      { header: 'Installed', key: 'installedAt', format: (v) => v ? formatDate(new Date(String(v))) : '-', width: 20 }
    ]));
  } finally {
    db.close();
  }
}
