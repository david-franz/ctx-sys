/**
 * IndexCommand - Index a project codebase
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, IndexCommandOptions, CommandResult } from '../types';

export class IndexCommand implements Command {
  name = 'index';
  description = 'Index a project codebase';

  constructor(indexerService: any, projectService: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: IndexCommandOptions): Promise<void>;
  async execute(options: any): Promise<CommandResult>;
  async execute(argsOrOptions: any, options?: any): Promise<void | CommandResult> {
    throw new Error('Not implemented');
  }
}
