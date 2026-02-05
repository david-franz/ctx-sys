/**
 * ServeCommand - Start MCP server
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, ServeCommandOptions, CommandResult } from '../types';

export class ServeCommand implements Command {
  name = 'serve';
  description = 'Start MCP server';

  constructor(mcpServer: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: ServeCommandOptions): Promise<void>;
  async execute(options: any): Promise<CommandResult>;
  async execute(argsOrOptions: any, options?: any): Promise<void | CommandResult> {
    throw new Error('Not implemented');
  }
}
