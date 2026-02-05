/**
 * ProjectCommand - Manage projects
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 */

import { Command, ProjectCommandOptions, CommandResult } from '../types';

export class ProjectCommand implements Command {
  name = 'project';
  description = 'Manage projects';

  constructor(projectService: any) {
    throw new Error('Not implemented');
  }

  async execute(args: string[], options: ProjectCommandOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  async list(options: any): Promise<CommandResult> {
    throw new Error('Not implemented');
  }

  async switch(name: string): Promise<CommandResult> {
    throw new Error('Not implemented');
  }

  async delete(name: string, options: any): Promise<CommandResult> {
    throw new Error('Not implemented');
  }
}
