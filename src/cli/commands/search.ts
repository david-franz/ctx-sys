/**
 * SearchCommand - Search for entities
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, SearchCommandOptions, CommandResult } from '../types';

export class SearchCommand implements Command {
  name = 'search';
  description = 'Search for entities';

  constructor(searchService: any, projectService: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: SearchCommandOptions): Promise<void>;
  async execute(term: string, options: any): Promise<CommandResult>;
  async execute(termOrArgs: any, options?: any): Promise<void | CommandResult> {
    throw new Error('Not implemented');
  }
}
