/**
 * SyncCommand - Sync project with git
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, SyncCommandOptions, CommandResult } from '../types';

export class SyncCommand implements Command {
  name = 'sync';
  description = 'Sync project with git';

  constructor(gitService: any, indexerService: any, projectService: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: SyncCommandOptions): Promise<void>;
  async execute(options: any): Promise<CommandResult>;
  async execute(argsOrOptions: any, options?: any): Promise<void | CommandResult> {
    throw new Error('Not implemented');
  }
}
