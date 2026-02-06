/**
 * Full context estimator for measuring project size.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DatabaseConnection } from '../db';
import { estimateTokens } from '../retrieval/context-assembler';
import { FullContextEstimate } from './types';

/**
 * Estimates the full context size of a project for ROI calculation.
 */
export class FullContextEstimator {
  constructor(private db: DatabaseConnection) {}

  /**
   * Ensure the full_context_estimates table exists.
   */
  ensureTableExists(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS full_context_estimates (
        project_id TEXT PRIMARY KEY,
        measured_at TEXT NOT NULL,
        total_files INTEGER NOT NULL,
        total_lines INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        code_tokens INTEGER,
        doc_tokens INTEGER,
        config_tokens INTEGER,
        with_summaries INTEGER,
        with_filtering INTEGER,
        minimal INTEGER
      );
    `);
  }

  /**
   * Measure the full context size for a project.
   */
  async measureProject(projectId: string, projectPath: string): Promise<FullContextEstimate> {
    const stats = {
      totalFiles: 0,
      totalLines: 0,
      totalTokens: 0,
      codeTokens: 0,
      docTokens: 0,
      configTokens: 0
    };

    // Walk the project directory
    const files = await this.walkDirectory(projectPath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n').length;
        const tokens = estimateTokens(content);

        stats.totalFiles++;
        stats.totalLines += lines;
        stats.totalTokens += tokens;

        // Categorize by file type
        const ext = path.extname(file).toLowerCase();
        if (this.isCodeFile(ext)) {
          stats.codeTokens += tokens;
        } else if (this.isDocFile(ext)) {
          stats.docTokens += tokens;
        } else if (this.isConfigFile(ext, file)) {
          stats.configTokens += tokens;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Calculate compressed scenarios
    const withSummaries = Math.round(stats.totalTokens * 0.15); // ~85% reduction with summaries
    const withFiltering = Math.round(stats.totalTokens * 0.40); // ~60% after filtering tests etc
    const minimal = Math.round(stats.totalTokens * 0.05); // ~95% reduction, only entry points

    const estimate: FullContextEstimate = {
      projectId,
      measuredAt: new Date(),
      totalFiles: stats.totalFiles,
      totalLines: stats.totalLines,
      totalTokens: stats.totalTokens,
      codeTokens: stats.codeTokens,
      docTokens: stats.docTokens,
      configTokens: stats.configTokens,
      withSummaries,
      withFiltering,
      minimal
    };

    // Persist estimate
    await this.persistEstimate(estimate);

    return estimate;
  }

  /**
   * Get the stored estimate for a project.
   */
  async getEstimate(projectId: string): Promise<FullContextEstimate | null> {
    const row = this.db.get<Record<string, unknown>>(`
      SELECT * FROM full_context_estimates WHERE project_id = ?
    `, [projectId]);

    if (!row) return null;

    return {
      projectId: row.project_id as string,
      measuredAt: new Date(row.measured_at as string),
      totalFiles: row.total_files as number,
      totalLines: row.total_lines as number,
      totalTokens: row.total_tokens as number,
      codeTokens: row.code_tokens as number,
      docTokens: row.doc_tokens as number,
      configTokens: row.config_tokens as number,
      withSummaries: row.with_summaries as number,
      withFiltering: row.with_filtering as number,
      minimal: row.minimal as number
    };
  }

  /**
   * Check if a project has a recent estimate (within the last day).
   */
  async hasRecentEstimate(projectId: string, maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    const estimate = await this.getEstimate(projectId);
    if (!estimate) return false;

    const age = Date.now() - estimate.measuredAt.getTime();
    return age < maxAgeMs;
  }

  /**
   * Walk a directory recursively and return all file paths.
   */
  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const ignoreDirs = new Set([
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '__pycache__',
      '.next',
      '.cache',
      'vendor',
      'target'
    ]);

    const walk = (currentDir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          // Skip binary and very large files
          if (this.isBinaryFile(entry.name)) continue;

          try {
            const stat = fs.statSync(fullPath);
            // Skip files larger than 1MB
            if (stat.size > 1024 * 1024) continue;
            files.push(fullPath);
          } catch {
            // Skip files we can't stat
          }
        }
      }
    };

    walk(dir);
    return files;
  }

  /**
   * Check if a file extension indicates code.
   */
  private isCodeFile(ext: string): boolean {
    const codeExts = new Set([
      '.ts', '.js', '.tsx', '.jsx',
      '.py', '.java', '.go', '.rs',
      '.cpp', '.c', '.h', '.hpp',
      '.cs', '.rb', '.php', '.swift',
      '.kt', '.scala', '.vue', '.svelte'
    ]);
    return codeExts.has(ext);
  }

  /**
   * Check if a file extension indicates documentation.
   */
  private isDocFile(ext: string): boolean {
    const docExts = new Set(['.md', '.txt', '.rst', '.adoc', '.tex']);
    return docExts.has(ext);
  }

  /**
   * Check if a file is a config file.
   */
  private isConfigFile(ext: string, filepath: string): boolean {
    const configExts = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.env']);
    const configNames = new Set([
      'package.json', 'tsconfig.json', 'webpack.config.js',
      'jest.config.js', '.eslintrc', '.prettierrc',
      'Dockerfile', 'docker-compose.yml', 'Makefile'
    ]);
    return configExts.has(ext) || configNames.has(path.basename(filepath));
  }

  /**
   * Check if a file is likely binary based on extension.
   */
  private isBinaryFile(filename: string): boolean {
    const binaryExts = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.zip', '.tar', '.gz', '.rar',
      '.exe', '.dll', '.so', '.dylib',
      '.woff', '.woff2', '.ttf', '.eot',
      '.mp3', '.mp4', '.wav', '.avi',
      '.db', '.sqlite', '.sqlite3'
    ]);
    const ext = path.extname(filename).toLowerCase();
    return binaryExts.has(ext);
  }

  /**
   * Persist an estimate to the database.
   */
  private async persistEstimate(estimate: FullContextEstimate): Promise<void> {
    this.db.run(`
      INSERT OR REPLACE INTO full_context_estimates (
        project_id, measured_at, total_files, total_lines, total_tokens,
        code_tokens, doc_tokens, config_tokens,
        with_summaries, with_filtering, minimal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      estimate.projectId,
      estimate.measuredAt.toISOString(),
      estimate.totalFiles,
      estimate.totalLines,
      estimate.totalTokens,
      estimate.codeTokens,
      estimate.docTokens,
      estimate.configTokens,
      estimate.withSummaries,
      estimate.withFiltering,
      estimate.minimal
    ]);
  }

  /**
   * Delete an estimate for a project.
   */
  async deleteEstimate(projectId: string): Promise<void> {
    this.db.run(`DELETE FROM full_context_estimates WHERE project_id = ?`, [projectId]);
  }
}
