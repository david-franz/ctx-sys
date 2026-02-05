/**
 * WatchCommand - Watch for file changes
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, WatchCommandOptions, CommandResult } from '../types';

export class WatchCommand implements Command {
  name = 'watch';
  description = 'Watch for file changes';

  constructor(fileWatcher: any, indexerService: any, projectService: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: WatchCommandOptions): Promise<void>;
  async execute(options: any): Promise<CommandResult>;
  async execute(argsOrOptions: any, options?: any): Promise<void | CommandResult> {
    throw new Error('Not implemented');
  }
}
