/**
 * ProjectManager - Project CRUD and configuration management
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.2-project-management.test.ts for expected behavior.
 */

import { DatabaseConnection } from '../db/connection';
import { Project, ProjectConfig, DeepPartial } from './types';

export class ProjectManager {
  constructor(private connection: DatabaseConnection) {}

  async create(
    name: string,
    path: string,
    config?: Partial<ProjectConfig>
  ): Promise<Project> {
    throw new Error('Not implemented');
  }

  async createProject(options: { name: string; path: string; config?: Partial<ProjectConfig> }): Promise<Project> {
    throw new Error('Not implemented');
  }

  async get(id: string): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async getProject(id: string): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async getByName(name: string): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async list(): Promise<Project[]> {
    throw new Error('Not implemented');
  }

  async listProjects(): Promise<Project[]> {
    throw new Error('Not implemented');
  }

  async update(
    id: string,
    updates: Partial<Omit<Project, 'id' | 'createdAt' | 'config'>> & { config?: DeepPartial<ProjectConfig> }
  ): Promise<Project> {
    throw new Error('Not implemented');
  }

  async delete(id: string, options?: { keepData?: boolean }): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteProject(id: string, options?: { keepData?: boolean }): Promise<void> {
    throw new Error('Not implemented');
  }

  async setActive(id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async setActiveProject(id: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async getActive(): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async getActiveProject(): Promise<Project | null> {
    throw new Error('Not implemented');
  }

  async clearActive(): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateConfig(
    id: string,
    configUpdates: DeepPartial<ProjectConfig>
  ): Promise<Project> {
    throw new Error('Not implemented');
  }

  async getConfig(id: string): Promise<ProjectConfig> {
    throw new Error('Not implemented');
  }

  async getProjectConfig(id: string): Promise<ProjectConfig> {
    throw new Error('Not implemented');
  }

  async updateLastIndexed(id: string, commit?: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async updateLastIndexedAt(id: string, commit?: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async getIndexStatus(
    id: string
  ): Promise<{ lastIndexedAt: Date | null; lastSyncCommit: string | null }> {
    throw new Error('Not implemented');
  }
}
