/**
 * CLI command for showing project status.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the status command.
 */
export function createStatusCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('status')
    .description('Show project status and statistics')
    .argument('[directory]', 'Project directory', '.')
    .option('-d, --db <path>', 'Custom database path')
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
  options: { db?: string; json?: boolean },
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

  // Output status
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
