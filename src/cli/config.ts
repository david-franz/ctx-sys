/**
 * CLI command for managing configuration.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the config command with subcommands.
 */
export function createConfigCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('config')
    .description('Manage ctx-sys configuration');

  // config get
  command
    .command('get <key>')
    .description('Get a configuration value')
    .option('-p, --project <path>', 'Project directory')
    .option('-g, --global', 'Get from global config only', false)
    .action(async (key: string, options) => {
      try {
        await configGet(key, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // config set
  command
    .command('set <key> <value>')
    .description('Set a configuration value')
    .option('-p, --project <path>', 'Project directory')
    .option('-g, --global', 'Set in global config', false)
    .action(async (key: string, value: string, options) => {
      try {
        await configSet(key, value, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // config list
  command
    .command('list')
    .description('List all configuration values')
    .option('-p, --project <path>', 'Project directory')
    .option('-g, --global', 'List global config only', false)
    .action(async (options) => {
      try {
        await configList(options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // config path
  command
    .command('path')
    .description('Show configuration file paths')
    .option('-p, --project <path>', 'Project directory')
    .action(async (options) => {
      try {
        await configPath(options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Get a configuration value.
 */
async function configGet(
  key: string,
  options: { project?: string; global?: boolean },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const projectPath = options.global ? null : (options.project ? path.resolve(options.project) : process.cwd());

  const value = await configManager.get(projectPath, key);

  if (value === undefined) {
    output.error(`Configuration key '${key}' not found`);
    process.exit(1);
  }

  if (typeof value === 'object') {
    output.log(JSON.stringify(value, null, 2));
  } else {
    output.log(String(value));
  }
}

/**
 * Set a configuration value.
 */
async function configSet(
  key: string,
  value: string,
  options: { project?: string; global?: boolean },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const projectPath = options.global ? null : (options.project ? path.resolve(options.project) : process.cwd());

  // Parse value as JSON if it looks like JSON
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Not JSON, use as string
    parsedValue = value;
  }

  await configManager.set(projectPath, key, parsedValue);

  output.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
}

/**
 * List all configuration values.
 */
async function configList(
  options: { project?: string; global?: boolean },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();

  if (options.global) {
    const config = await configManager.loadGlobal();
    output.log('Global configuration:');
    output.log(JSON.stringify(config, null, 2));
  } else {
    const projectPath = options.project ? path.resolve(options.project) : process.cwd();
    const resolved = await configManager.resolve(projectPath);

    output.log('Resolved configuration:');
    output.log(JSON.stringify(resolved, null, 2));
  }
}

/**
 * Show configuration file paths.
 */
async function configPath(
  options: { project?: string },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const projectPath = options.project ? path.resolve(options.project) : process.cwd();

  output.log('Configuration paths:');
  output.log(`  Global:  ${configManager.getGlobalConfigPath()}`);
  output.log(`  Project: ${configManager.getProjectConfigFilePath(projectPath)}`);

  // Check existence
  const globalExists = await configManager.globalConfigExists();
  const projectExists = await configManager.projectConfigExists(projectPath);

  output.log('');
  output.log('Status:');
  output.log(`  Global:  ${globalExists ? 'exists' : 'not found'}`);
  output.log(`  Project: ${projectExists ? 'exists' : 'not found'}`);
}

/**
 * Export functions for testing.
 */
export { configGet, configSet, configList, configPath };
