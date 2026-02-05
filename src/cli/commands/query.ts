/**
 * QueryCommand - Query entities and relationships
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, QueryCommandOptions, CommandResult } from '../types';

export class QueryCommand implements Command {
  name = 'query';
  description = 'Query entities and relationships';

  constructor(searchService: any, projectService: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: QueryCommandOptions): Promise<void>;
  async execute(query: string, options: any): Promise<CommandResult>;
  async execute(queryOrArgs: any, options?: any): Promise<void | CommandResult> {
    throw new Error('Not implemented');
  }
}
