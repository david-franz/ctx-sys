import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CtxSysMcpServer } from '../mcp';

const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

/**
 * Create the serve command for running the MCP server.
 */
export function createServeCommand(): Command {
  const command = new Command('serve')
    .description('Start the MCP server')
    .option('-d, --db <path>', 'Database path')
    .option('-n, --name <name>', 'Server name', 'ctx-sys')
    .option('-v, --version <version>', 'Server version', pkg.version)
    .action(async (options) => {
      const server = new CtxSysMcpServer({
        dbPath: options.db,
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
