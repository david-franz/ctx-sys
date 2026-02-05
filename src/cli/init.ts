/**
 * CLI command for initializing a project configuration.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager, DEFAULT_PROJECT_CONFIG_FILE } from '../config';

/**
 * Output interface for formatting.
 */
export interface CLIOutput {
  log: (message: string) => void;
  error: (message: string) => void;
  success: (message: string) => void;
}

/**
 * Default CLI output using console.
 */
export const defaultOutput: CLIOutput = {
  log: (msg) => console.log(msg),
  error: (msg) => console.error(`Error: ${msg}`),
  success: (msg) => console.log(`✓ ${msg}`)
};

/**
 * Create the init command.
 */
export function createInitCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('init')
    .description('Initialize ctx-sys configuration for a project')
    .argument('[directory]', 'Project directory', '.')
    .option('-n, --name <name>', 'Project name')
    .option('-f, --force', 'Overwrite existing configuration', false)
    .option('--global', 'Initialize global configuration instead', false)
    .action(async (directory: string, options) => {
      try {
        const projectPath = path.resolve(directory);
        const configManager = new ConfigManager();

        if (options.global) {
          await initGlobalConfig(configManager, options, output);
        } else {
          await initProjectConfig(configManager, projectPath, options, output);
        }
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Initialize global configuration.
 */
async function initGlobalConfig(
  configManager: ConfigManager,
  options: { force?: boolean },
  output: CLIOutput
): Promise<void> {
  const exists = await configManager.globalConfigExists();

  if (exists && !options.force) {
    output.error('Global configuration already exists. Use --force to overwrite.');
    process.exit(1);
  }

  const config = await configManager.loadGlobal();
  await configManager.saveGlobal(config);

  output.success(`Global configuration initialized at ${configManager.getGlobalConfigPath()}`);
}

/**
 * Initialize project configuration.
 */
async function initProjectConfig(
  configManager: ConfigManager,
  projectPath: string,
  options: { name?: string; force?: boolean },
  output: CLIOutput
): Promise<void> {
  const exists = await configManager.projectConfigExists(projectPath);

  if (exists && !options.force) {
    output.error('Project configuration already exists. Use --force to overwrite.');
    process.exit(1);
  }

  // Create config with optional custom name
  const config = {
    ...DEFAULT_PROJECT_CONFIG_FILE,
    project: {
      ...DEFAULT_PROJECT_CONFIG_FILE.project,
      name: options.name || path.basename(projectPath)
    }
  };

  await configManager.saveProject(projectPath, config);

  output.success(`Project configuration initialized at ${configManager.getProjectConfigFilePath(projectPath)}`);
  output.log('');
  output.log('Next steps:');
  output.log('  1. Edit .ctx-sys/config.yaml to customize settings');
  output.log('  2. Run "ctx-sys index" to index your codebase');
}
