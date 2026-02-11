/**
 * F10i.1: Project management domain service.
 */

import { AppContext } from '../context';
import { Project, ProjectConfig } from '../project/types';

export class ProjectService {
  constructor(private context: AppContext) {}

  async createProject(name: string, path: string, config?: Partial<ProjectConfig>): Promise<Project> {
    return this.context.projectManager.create(name, path, config);
  }

  async getProject(nameOrId: string): Promise<Project | null> {
    return this.context.projectManager.get(nameOrId);
  }

  async listProjects(): Promise<Project[]> {
    return this.context.projectManager.list();
  }

  async setActiveProject(nameOrId: string): Promise<void> {
    await this.context.projectManager.setActive(nameOrId);
  }

  async deleteProject(nameOrId: string, keepData?: boolean): Promise<void> {
    await this.context.projectManager.delete(nameOrId, keepData);
  }

  async getActiveProject(): Promise<Project | null> {
    return this.context.projectManager.getActive();
  }
}
