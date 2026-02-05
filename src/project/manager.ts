import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../db/connection';
import { generateId } from '../utils/id';
import {
  Project,
  ProjectConfig,
  ProjectRow,
  DEFAULT_PROJECT_CONFIG
} from './types';

/**
 * Manages project lifecycle and configuration.
 */
export class ProjectManager {
  private activeProjectId: string | null = null;

  constructor(private db: DatabaseConnection) {}

  /**
   * Create a new project.
   */
  async create(
    name: string,
    projectPath: string,
    config?: Partial<ProjectConfig>
  ): Promise<Project> {
    // Validate name format (slug: lowercase, alphanumeric, hyphens)
    if (!this.isValidName(name)) {
      throw new Error(
        `Invalid project name "${name}". Use lowercase letters, numbers, and hyphens only.`
      );
    }

    // Check for duplicate name
    const existing = await this.getByName(name);
    if (existing) {
      throw new Error(`Project "${name}" already exists`);
    }

    // Validate and resolve path
    const resolvedPath = path.resolve(projectPath);
    if (!this.validatePath(resolvedPath)) {
      throw new Error(`Path does not exist or is not a directory: ${resolvedPath}`);
    }

    const id = generateId();
    const mergedConfig = this.mergeConfig(config);

    this.db.run(
      `INSERT INTO projects (id, name, path, config) VALUES (?, ?, ?, ?)`,
      [id, name, resolvedPath, JSON.stringify(mergedConfig)]
    );

    // Create project-specific tables
    this.db.createProject(id);

    const project = await this.get(id);
    if (!project) {
      throw new Error('Failed to create project');
    }

    return project;
  }

  /**
   * Get a project by ID or name.
   */
  async get(idOrName: string): Promise<Project | null> {
    const row = this.db.get<ProjectRow>(
      `SELECT * FROM projects WHERE id = ? OR name = ?`,
      [idOrName, idOrName]
    );
    return row ? this.rowToProject(row) : null;
  }

  /**
   * Get a project by name.
   */
  async getByName(name: string): Promise<Project | null> {
    const row = this.db.get<ProjectRow>(
      `SELECT * FROM projects WHERE name = ?`,
      [name]
    );
    return row ? this.rowToProject(row) : null;
  }

  /**
   * List all projects.
   */
  async list(): Promise<Project[]> {
    const rows = this.db.all<ProjectRow>(
      `SELECT * FROM projects ORDER BY name`
    );
    return rows.map(row => this.rowToProject(row));
  }

  /**
   * Update a project.
   */
  async update(
    idOrName: string,
    updates: Partial<Pick<Project, 'name' | 'path' | 'config' | 'lastIndexedAt' | 'lastSyncCommit'>>
  ): Promise<Project> {
    const project = await this.get(idOrName);
    if (!project) {
      throw new Error(`Project not found: ${idOrName}`);
    }

    const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      if (!this.isValidName(updates.name)) {
        throw new Error(
          `Invalid project name "${updates.name}". Use lowercase letters, numbers, and hyphens only.`
        );
      }
      // Check for duplicate name (excluding current project)
      const existing = await this.getByName(updates.name);
      if (existing && existing.id !== project.id) {
        throw new Error(`Project "${updates.name}" already exists`);
      }
      setClauses.push('name = ?');
      params.push(updates.name);
    }

    if (updates.path !== undefined) {
      const resolvedPath = path.resolve(updates.path);
      if (!this.validatePath(resolvedPath)) {
        throw new Error(`Path does not exist or is not a directory: ${resolvedPath}`);
      }
      setClauses.push('path = ?');
      params.push(resolvedPath);
    }

    if (updates.config !== undefined) {
      // Deep merge config
      const mergedConfig = this.deepMergeConfig(project.config, updates.config);
      setClauses.push('config = ?');
      params.push(JSON.stringify(mergedConfig));
    }

    if (updates.lastIndexedAt !== undefined) {
      setClauses.push('last_indexed_at = ?');
      params.push(updates.lastIndexedAt.toISOString());
    }

    if (updates.lastSyncCommit !== undefined) {
      setClauses.push('last_sync_commit = ?');
      params.push(updates.lastSyncCommit);
    }

    params.push(project.id);

    this.db.run(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await this.get(project.id);
    if (!updated) {
      throw new Error('Failed to update project');
    }

    return updated;
  }

  /**
   * Delete a project.
   */
  async delete(idOrName: string, keepData: boolean = false): Promise<void> {
    const project = await this.get(idOrName);
    if (!project) {
      throw new Error(`Project not found: ${idOrName}`);
    }

    // Drop project tables unless keepData is true
    if (!keepData) {
      this.db.dropProject(project.id);
    }

    // Delete project record
    this.db.run(`DELETE FROM projects WHERE id = ?`, [project.id]);

    // Clear active if this was the active project
    if (this.activeProjectId === project.id) {
      this.activeProjectId = null;
      this.db.run(
        `DELETE FROM config WHERE key = 'active_project'`
      );
    }
  }

  /**
   * Set the active project.
   */
  async setActive(idOrName: string): Promise<void> {
    const project = await this.get(idOrName);
    if (!project) {
      throw new Error(`Project not found: ${idOrName}`);
    }

    this.activeProjectId = project.id;

    // Persist to config table
    this.db.run(
      `INSERT OR REPLACE INTO config (key, value) VALUES ('active_project', ?)`,
      [JSON.stringify(project.id)]
    );
  }

  /**
   * Get the active project.
   */
  async getActive(): Promise<Project | null> {
    // Check in-memory cache first
    if (this.activeProjectId) {
      return this.get(this.activeProjectId);
    }

    // Try to load from config
    const row = this.db.get<{ value: string }>(
      `SELECT value FROM config WHERE key = 'active_project'`
    );

    if (row) {
      this.activeProjectId = JSON.parse(row.value);
      return this.get(this.activeProjectId!);
    }

    return null;
  }

  /**
   * Clear the active project.
   */
  async clearActive(): Promise<void> {
    this.activeProjectId = null;
    this.db.run(`DELETE FROM config WHERE key = 'active_project'`);
  }

  /**
   * Check if a project exists.
   */
  async exists(idOrName: string): Promise<boolean> {
    const project = await this.get(idOrName);
    return project !== null;
  }

  /**
   * Get the count of projects.
   */
  async count(): Promise<number> {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM projects`
    );
    return row?.count || 0;
  }

  /**
   * Validate project name format.
   * Must be lowercase, alphanumeric with hyphens, 1-64 chars.
   */
  private isValidName(name: string): boolean {
    return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(name);
  }

  /**
   * Validate that a path exists and is a directory.
   */
  private validatePath(projectPath: string): boolean {
    try {
      const stats = fs.statSync(projectPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Merge partial config with defaults.
   */
  private mergeConfig(partial?: Partial<ProjectConfig>): ProjectConfig {
    if (!partial) {
      return { ...DEFAULT_PROJECT_CONFIG };
    }
    return this.deepMergeConfig(DEFAULT_PROJECT_CONFIG, partial);
  }

  /**
   * Deep merge two config objects.
   */
  private deepMergeConfig(base: ProjectConfig, override: Partial<ProjectConfig>): ProjectConfig {
    return {
      indexing: { ...base.indexing, ...override.indexing },
      summarization: { ...base.summarization, ...override.summarization },
      embeddings: { ...base.embeddings, ...override.embeddings },
      sessions: { ...base.sessions, ...override.sessions },
      retrieval: { ...base.retrieval, ...override.retrieval }
    };
  }

  /**
   * Deep merge two objects (generic helper).
   */
  private deepMerge<T>(base: T, override: Partial<T>): T {
    if (typeof base !== 'object' || base === null) {
      return (override ?? base) as T;
    }

    const result = { ...base } as T;

    for (const key of Object.keys(override) as (keyof T)[]) {
      const overrideValue = override[key];
      const baseValue = base[key];

      if (
        overrideValue !== undefined &&
        typeof overrideValue === 'object' &&
        overrideValue !== null &&
        !Array.isArray(overrideValue) &&
        typeof baseValue === 'object' &&
        baseValue !== null &&
        !Array.isArray(baseValue)
      ) {
        (result as Record<string, unknown>)[key as string] = this.deepMerge(
          baseValue,
          overrideValue as Partial<typeof baseValue>
        );
      } else if (overrideValue !== undefined) {
        (result as Record<string, unknown>)[key as string] = overrideValue;
      }
    }

    return result;
  }

  /**
   * Convert database row to Project object.
   */
  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastIndexedAt: row.last_indexed_at ? new Date(row.last_indexed_at) : undefined,
      lastSyncCommit: row.last_sync_commit || undefined
    };
  }
}
