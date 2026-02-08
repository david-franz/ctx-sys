/**
 * CLI command for showing project status.
 * With --check flag, also runs doctor health checks.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config';
import { colors } from './formatters';
import { CLIOutput, defaultOutput } from './init';
import {
  CheckResult,
  checkOllamaService,
  checkModel,
  checkDatabase,
  checkConfig,
  checkProject,
  formatCheck
} from './doctor';

/**
 * Create the status command.
 */
export function createStatusCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('status')
    .description('Show project status and health checks')
    .argument('[directory]', 'Project directory', '.')
    .option('-d, --db <path>', 'Custom database path')
    .option('--check', 'Run full health checks (Ollama, models, database)', false)
    .option('--json', 'Output as JSON', false)
    .action(async (directory: string, options) => {
      try {
        const projectPath = path.resolve(directory);
        await runStatus(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Run the status command.
 */
async function runStatus(
  projectPath: string,
  options: { db?: string; check?: boolean; json?: boolean },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();

  // Check if project is initialized
  const hasProjectConfig = await configManager.projectConfigExists(projectPath);
  const hasGlobalConfig = await configManager.globalConfigExists();

  if (!hasProjectConfig && !options.json) {
    output.log('Project not initialized. Run "ctx-sys init" to set up.');
    output.log('');
  }

  // Load configuration
  const config = await configManager.resolve(projectPath);

  // Check if database exists
  const dbPath = options.db || config.database.path;
  let dbExists = false;
  let dbSize = 0;

  try {
    const stats = await fs.promises.stat(dbPath);
    dbExists = true;
    dbSize = stats.size;
  } catch {
    // Database doesn't exist
  }

  if (options.check) {
    // Full health check mode (replaces doctor command)
    let ollamaUrl = 'http://localhost:11434';
    let embeddingModel = 'mxbai-embed-large:latest';
    let hydeModel = 'gemma3:12b';
    let summarizationModel = 'qwen2.5-coder:7b';

    try {
      ollamaUrl = config.providers?.ollama?.base_url || ollamaUrl;
      embeddingModel = config.projectConfig?.embeddings?.model || embeddingModel;
      hydeModel = config.projectConfig?.hyde?.model || hydeModel;
      summarizationModel = config.projectConfig?.summarization?.model || summarizationModel;
    } catch {
      // Use defaults
    }

    const checks: CheckResult[] = [];

    const ollamaResult = await checkOllamaService(ollamaUrl);
    checks.push(ollamaResult);
    const ollamaOk = ollamaResult.status === 'ok';

    checks.push(checkModel('Embedding Model', embeddingModel, (ollamaResult as any).models, ollamaOk, 'fail'));
    checks.push(checkModel('HyDE Model', hydeModel, (ollamaResult as any).models, ollamaOk, 'warn'));
    checks.push(checkModel('Summarization Model', summarizationModel, (ollamaResult as any).models, ollamaOk, 'warn'));

    checks.push(await checkDatabase(dbPath));
    checks.push(await checkConfig(projectPath));
    checks.push(await checkProject(dbPath, projectPath));

    if (options.json) {
      const passed = checks.filter(c => c.status === 'ok').length;
      const warned = checks.filter(c => c.status === 'warn').length;
      const failed = checks.filter(c => c.status === 'fail').length;
      const recommendations = checks.filter(c => c.fix).map(c => c.fix!);
      output.log(JSON.stringify({
        project: { path: projectPath, name: config.projectConfig.project.name },
        database: { path: dbPath, exists: dbExists, sizeBytes: dbSize },
        checks, passed, warned, failed, recommendations
      }, null, 2));
    } else {
      output.log('');
      output.log(colors.bold('  ctx-sys Status'));
      output.log('');

      // Basic info
      output.log(`  Project: ${config.projectConfig.project.name}`);
      output.log(`  Path:    ${projectPath}`);
      output.log(`  DB:      ${dbPath} (${dbExists ? `${(dbSize / 1024).toFixed(1)} KB` : 'not created'})`);
      output.log('');

      // Health checks
      output.log(colors.bold('  Health Checks'));
      output.log('');
      const maxNameLen = Math.max(...checks.map(c => c.name.length));
      for (const check of checks) {
        output.log(formatCheck(check, maxNameLen));
      }

      const passed = checks.filter(c => c.status === 'ok').length;
      const warned = checks.filter(c => c.status === 'warn').length;
      const failed = checks.filter(c => c.status === 'fail').length;

      output.log('');
      const parts = [`${passed}/${checks.length} checks passed`];
      if (warned > 0) parts.push(`${warned} warning${warned > 1 ? 's' : ''}`);
      if (failed > 0) parts.push(`${failed} failed`);
      output.log(`  ${parts.join(', ')}`);

      const fixes = checks.filter(c => c.fix);
      if (fixes.length > 0) {
        output.log('');
        output.log(colors.bold('  Recommendations:'));
        for (const check of fixes) {
          output.log(`    ${colors.cyan(check.fix!)}${colors.dim(`  # ${check.name}`)}`);
        }
      }
      output.log('');
    }

    if (checks.some(c => c.status === 'fail')) {
      process.exit(1);
    }
  } else {
    // Quick status (no network calls)
    if (options.json) {
      outputJson({
        project: {
          path: projectPath,
          name: config.projectConfig.project.name,
          initialized: hasProjectConfig
        },
        config: {
          global: hasGlobalConfig,
          project: hasProjectConfig,
          database: dbPath
        },
        database: {
          exists: dbExists,
          sizeBytes: dbSize
        }
      }, output);
    } else {
      outputText(projectPath, config, { exists: dbExists, size: dbSize, path: dbPath }, output);
    }
  }
}

/**
 * Output status as plain text.
 */
function outputText(
  projectPath: string,
  config: any,
  dbInfo: { exists: boolean; size: number; path: string },
  output: CLIOutput
): void {
  output.log('ctx-sys Status');
  output.log('==============');
  output.log('');

  // Project info
  output.log('Project:');
  output.log(`  Path: ${projectPath}`);
  output.log(`  Name: ${config.projectConfig.project.name}`);
  output.log('');

  // Configuration
  output.log('Configuration:');
  output.log(`  Embedding Provider: ${config.defaults.embeddings.provider}`);
  output.log(`  Embedding Model: ${config.defaults.embeddings.model}`);
  output.log(`  Summarization Provider: ${config.defaults.summarization.provider}`);
  output.log(`  Summarization Model: ${config.defaults.summarization.model}`);
  output.log('');

  // Database status
  output.log('Database:');
  output.log(`  Path: ${dbInfo.path}`);
  output.log(`  Status: ${dbInfo.exists ? 'exists' : 'not created'}`);
  if (dbInfo.exists) {
    const sizeKB = (dbInfo.size / 1024).toFixed(1);
    output.log(`  Size: ${sizeKB} KB`);
  }
  output.log('');

  // Indexing configuration
  output.log('Indexing Configuration:');
  output.log(`  Mode: ${config.projectConfig.indexing.mode}`);
  output.log(`  Watch: ${config.projectConfig.indexing.watch ? 'enabled' : 'disabled'}`);
  if (config.projectConfig.indexing.ignore?.length > 0) {
    output.log(`  Ignored: ${config.projectConfig.indexing.ignore.join(', ')}`);
  }

  output.log('');
  output.log('Run with --check for full health diagnostics.');
}

/**
 * Output status as JSON.
 */
function outputJson(status: any, output: CLIOutput): void {
  output.log(JSON.stringify(status, null, 2));
}

/**
 * Export for testing.
 */
export { runStatus };
