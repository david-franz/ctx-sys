import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { CtxSysMcpServer } from '../mcp';
import { ConfigManager } from '../config/manager';

const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

/**
 * Resolve the database path for the MCP server.
 * Priority: explicit --db flag > project-local .ctx-sys/ > global default
 */
async function resolveDbPath(explicitDb?: string, projectDir?: string): Promise<string | undefined> {
  if (explicitDb) return explicitDb;

  const targetDir = projectDir ? resolve(projectDir) : process.cwd();
  if (existsSync(join(targetDir, '.ctx-sys'))) {
    const configManager = new ConfigManager({ inMemoryOnly: true });
    const resolved = await configManager.resolve(targetDir);
    return resolved.database.path;
  }

  return undefined; // Fall back to AppContext default
}

/**
 * Create the serve command for running the MCP server.
 */
export function createServeCommand(): Command {
  const command = new Command('serve')
    .description('Start the MCP server')
    .option('-d, --db <path>', 'Database path')
    .option('-p, --project <path>', 'Project directory (auto-detects database)')
    .option('-n, --name <name>', 'Server name', 'ctx-sys')
    .option('-v, --version <version>', 'Server version', pkg.version)
    .action(async (options) => {
      const dbPath = await resolveDbPath(options.db, options.project);
      const server = new CtxSysMcpServer({
        dbPath,
        name: options.name,
        version: options.version
      });

      // Handle graceful shutdown
      const shutdown = async () => {
        await server.close();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      try {
        await server.start();
      } catch (error) {
        console.error('Server error:', error);
        process.exit(1);
      }
    });

  return command;
}
