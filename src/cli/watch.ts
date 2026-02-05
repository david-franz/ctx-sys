/**
 * CLI command for watching and auto-reindexing.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { EntityStore } from '../entities';
import { CodebaseIndexer } from '../indexer';
import { FileWatcher, WatchEvent } from '../watch';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the watch command.
 */
export function createWatchCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('watch')
    .description('Watch for file changes and auto-reindex')
    .argument('[directory]', 'Project directory to watch', '.')
    .option('-d, --db <path>', 'Custom database path')
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
    .option('--include <patterns>', 'Comma-separated glob patterns to include')
    .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude')
    .option('-q, --quiet', 'Suppress event output', false)
    .action(async (directory: string, options) => {
      try {
        const projectPath = path.resolve(directory);
        await runWatch(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Run the watch operation.
 */
async function runWatch(
  projectPath: string,
  options: {
    db?: string;
    debounce?: string;
    include?: string;
    exclude?: string;
    quiet?: boolean;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  // Set up database connection
  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  // Set up entity store with project ID
  const projectId = config.projectConfig.project.name || path.basename(projectPath);
  const entityStore = new EntityStore(db, projectId);

  // Create indexer
  const indexer = new CodebaseIndexer(projectPath, entityStore);

  // Create watcher
  const watcher = new FileWatcher(
    {
      root: projectPath,
      debounceMs: parseInt(options.debounce || '300', 10),
      include: options.include
        ? options.include.split(',').map(s => s.trim())
        : config.projectConfig.indexing.ignore
          ? ['**/*']
          : undefined,
      exclude: options.exclude
        ? options.exclude.split(',').map(s => s.trim())
        : config.projectConfig.indexing.ignore
    },
    indexer
  );

  // Set up event handlers
  watcher.on('ready', () => {
    output.success(`Watching ${projectPath} for changes...`);
    output.log('Press Ctrl+C to stop.');
    output.log('');
  });

  watcher.on('change', (event: WatchEvent) => {
    if (!options.quiet) {
      const icon = event.type === 'add' ? '+' : event.type === 'unlink' ? '-' : '~';
      output.log(`[${icon}] ${event.path}`);
    }
  });

  watcher.on('reindex', (result: { added: string[]; modified: string[]; deleted: string[] }) => {
    if (!options.quiet) {
      const total = result.added.length + result.modified.length + result.deleted.length;
      if (total > 0) {
        output.success(`Reindexed ${total} file(s)`);
      }
    }
  });

  watcher.on('error', (error: any) => {
    output.error(error.message || String(error));
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    output.log('');
    output.log('Stopping watcher...');
    watcher.stop();
    await db.close();
    output.success('Done.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start watching
  await watcher.start();

  // Keep process running
  await new Promise(() => {}); // Never resolves
}

/**
 * Export for testing.
 */
export { runWatch };
