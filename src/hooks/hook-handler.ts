/**
 * Git hook event handler.
 */

import { execSync } from 'child_process';
import { DatabaseConnection } from '../db';
import { generateId } from '../utils';
import {
  HookEvent,
  HookResult,
  HookConfig,
  HookExecution,
  DEFAULT_HOOK_CONFIG
} from './types';
import { ImpactAnalyzer, ToolClient } from './impact-analyzer';

/**
 * Handles git hook events.
 */
export class HookHandler {
  private config: HookConfig;
  private impactAnalyzer: ImpactAnalyzer;

  constructor(
    private db: DatabaseConnection,
    config: Partial<HookConfig> = {},
    private client?: ToolClient
  ) {
    this.config = { ...DEFAULT_HOOK_CONFIG, ...config };
    this.impactAnalyzer = new ImpactAnalyzer(client);
  }

  /**
   * Ensure hook tables exist.
   */
  ensureTablesExist(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hook_executions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        hook_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        repository TEXT NOT NULL,
        branch TEXT NOT NULL,
        commit_hash TEXT,
        duration_ms INTEGER,
        success INTEGER NOT NULL,
        files_indexed INTEGER DEFAULT 0,
        entities_updated INTEGER DEFAULT 0,
        message TEXT,
        warnings_json TEXT,
        errors_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_hook_executions_project ON hook_executions(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_hook_executions_type ON hook_executions(hook_type, success);

      CREATE TABLE IF NOT EXISTS impact_reports (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        base_branch TEXT NOT NULL,
        target_branch TEXT NOT NULL,
        commit_range TEXT,
        files_added INTEGER DEFAULT 0,
        files_modified INTEGER DEFAULT 0,
        files_deleted INTEGER DEFAULT 0,
        affected_entities INTEGER DEFAULT 0,
        affected_decisions INTEGER DEFAULT 0,
        risk_level TEXT,
        reasons_json TEXT,
        report_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_impact_reports_project ON impact_reports(project_id, generated_at DESC);

      CREATE TABLE IF NOT EXISTS indexed_commits (
        project_id TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        file_count INTEGER NOT NULL,
        PRIMARY KEY (project_id, commit_hash)
      );
    `);
  }

  /**
   * Handle a git hook event.
   */
  async handle(event: HookEvent): Promise<HookResult> {
    const startTime = Date.now();

    try {
      this.log('verbose', `Handling ${event.type} hook`);

      let result: Partial<HookResult>;

      switch (event.type) {
        case 'pre-commit':
          result = await this.handlePreCommit(event);
          break;
        case 'post-merge':
          result = await this.handlePostMerge(event);
          break;
        case 'pre-push':
          result = await this.handlePrePush(event);
          break;
        case 'post-checkout':
          result = await this.handlePostCheckout(event);
          break;
        default:
          throw new Error(`Unknown hook type: ${event.type}`);
      }

      const duration = Date.now() - startTime;

      // Log execution
      await this.logExecution(event, { ...result, success: true, duration });

      return {
        success: true,
        duration,
        filesIndexed: result.filesIndexed || 0,
        entitiesUpdated: result.entitiesUpdated || 0,
        decisionsLinked: result.decisionsLinked || 0,
        message: result.message,
        warnings: result.warnings,
        errors: result.errors,
        impactReport: result.impactReport
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      this.log('normal', `Hook failed: ${errorMsg}`);

      await this.logExecution(event, {
        success: false,
        duration,
        errors: [errorMsg]
      });

      return {
        success: false,
        duration,
        filesIndexed: 0,
        entitiesUpdated: 0,
        decisionsLinked: 0,
        errors: [errorMsg]
      };
    }
  }

  /**
   * Handle pre-commit hook.
   */
  private async handlePreCommit(event: HookEvent): Promise<Partial<HookResult>> {
    if (!this.config.indexOnCommit) {
      return { message: 'Indexing on commit disabled' };
    }

    // Get staged files
    const stagedFiles = event.stagedFiles || this.getStagedFiles(event.repository);

    if (stagedFiles.length === 0) {
      return { message: 'No files to index' };
    }

    if (stagedFiles.length > this.config.maxFilesToIndex) {
      return {
        message: `Too many files (${stagedFiles.length}), skipping auto-index`,
        warnings: ['Consider manually running ctx-sys index after commit']
      };
    }

    this.log('normal', `Indexing ${stagedFiles.length} staged files...`);

    // If we have a client, index files via MCP
    if (this.client) {
      try {
        const result = await this.client.callTool('index_files', {
          projectId: this.config.projectId,
          filePaths: stagedFiles
        }) as { filesIndexed?: number; entitiesExtracted?: number };

        return {
          filesIndexed: result.filesIndexed || stagedFiles.length,
          entitiesUpdated: result.entitiesExtracted || 0,
          message: `Indexed ${result.filesIndexed || stagedFiles.length} files`
        };
      } catch (error) {
        return {
          filesIndexed: 0,
          warnings: [`Index failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        };
      }
    }

    // Without client, just report what would be indexed
    return {
      filesIndexed: stagedFiles.length,
      message: `Would index ${stagedFiles.length} files (client not configured)`
    };
  }

  /**
   * Handle post-merge hook.
   */
  private async handlePostMerge(event: HookEvent): Promise<Partial<HookResult>> {
    const results: Partial<HookResult> = {
      warnings: [],
      errors: []
    };

    // 1. Sync index if enabled
    if (this.config.syncOnMerge) {
      this.log('normal', 'Syncing index after merge...');

      const mergedFiles = event.mergedFiles || this.getMergedFiles(event.repository);

      if (mergedFiles.length > 0 && mergedFiles.length <= this.config.maxFilesToIndex) {
        if (this.client) {
          try {
            const syncResult = await this.client.callTool('index_files', {
              projectId: this.config.projectId,
              filePaths: mergedFiles
            }) as { filesIndexed?: number; entitiesExtracted?: number };

            results.filesIndexed = syncResult.filesIndexed || mergedFiles.length;
            results.entitiesUpdated = syncResult.entitiesExtracted || 0;
          } catch (err) {
            results.warnings?.push(`Index sync failed: ${err instanceof Error ? err.message : 'Unknown'}`);
          }
        } else {
          results.filesIndexed = mergedFiles.length;
        }
      }
    }

    // 2. Generate impact report if enabled
    if (this.config.generateImpactReport) {
      this.log('normal', 'Generating impact report...');

      try {
        const report = await this.impactAnalyzer.analyze({
          projectId: this.config.projectId,
          baseBranch: this.detectBaseBranch(event.repository),
          targetBranch: event.currentBranch,
          previousCommit: event.previousCommit,
          currentCommit: event.currentCommit,
          repoPath: event.repository
        });

        results.impactReport = report;

        // Save report to database
        await this.saveImpactReport(this.config.projectId, report);

        // Display summary
        this.displayImpactSummary(report);
      } catch (err) {
        results.warnings?.push(`Impact analysis failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return results;
  }

  /**
   * Handle pre-push hook.
   */
  private async handlePrePush(event: HookEvent): Promise<Partial<HookResult>> {
    if (!this.config.validateOnPush) {
      return { message: 'Push validation disabled' };
    }

    // Check if index is up to date (if we have a client)
    if (this.client) {
      try {
        const status = await this.client.callTool('index_status', {
          projectId: this.config.projectId
        }) as { isUpToDate?: boolean; unindexedCount?: number };

        if (!status.isUpToDate) {
          return {
            success: false,
            errors: [
              'Index is out of date. Run `ctx-sys index` before pushing.',
              `Unindexed files: ${status.unindexedCount || 'unknown'}`
            ]
          };
        }
      } catch {
        // If we can't check, don't block the push
        return {
          warnings: ['Could not validate index status']
        };
      }
    }

    return {
      message: 'Index validation passed'
    };
  }

  /**
   * Handle post-checkout hook.
   */
  private async handlePostCheckout(event: HookEvent): Promise<Partial<HookResult>> {
    // Check if we switched branches (not just checked out a file)
    if (!event.previousCommit || event.previousCommit === event.currentCommit) {
      return { message: 'File checkout, skipping' };
    }

    this.log('normal', `Switched to ${event.currentBranch}`);

    // Get changed files between the commits
    const changedFiles = this.getChangedFilesBetween(
      event.repository,
      event.previousCommit,
      event.currentCommit
    );

    if (changedFiles.length > 10) {
      return {
        warnings: [`Branch has ${changedFiles.length} changes, consider running ctx-sys index`]
      };
    }

    return { message: 'Branch switched' };
  }

  /**
   * Get staged files from git.
   */
  getStagedFiles(repoPath: string): string[] {
    try {
      const output = execSync('git diff --cached --name-only', {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Get files changed in the last merge.
   */
  getMergedFiles(repoPath: string): string[] {
    try {
      const output = execSync('git diff --name-only HEAD@{1} HEAD', {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Get changed files between two commits.
   */
  private getChangedFilesBetween(repoPath: string, from: string, to: string): string[] {
    try {
      const output = execSync(`git diff --name-only ${from} ${to}`, {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Detect the base branch name.
   */
  private detectBaseBranch(repoPath: string): string {
    try {
      const branches = execSync('git branch -r', {
        cwd: repoPath,
        encoding: 'utf-8'
      });

      if (branches.includes('origin/main')) return 'main';
      if (branches.includes('origin/master')) return 'master';
      return 'main';
    } catch {
      return 'main';
    }
  }

  /**
   * Display impact summary to console.
   */
  private displayImpactSummary(report: import('./types').ImpactReport): void {
    if (this.config.verbosity === 'silent') return;

    console.log('\n=== Impact Analysis ===');
    console.log(`Risk Level: ${report.riskLevel.toUpperCase()}`);
    console.log(`Files: +${report.filesAdded.length} ~${report.filesModified.length} -${report.filesDeleted.length}`);
    console.log(`Affected: ${report.affectedEntities.length} entities, ${report.affectedDecisions.length} decisions`);

    if (report.suggestions.length > 0) {
      console.log('\nRecommendations:');
      report.suggestions.forEach(s => console.log(`  - ${s}`));
    }

    console.log('');
  }

  /**
   * Save impact report to database.
   */
  private async saveImpactReport(
    projectId: string,
    report: import('./types').ImpactReport
  ): Promise<void> {
    this.db.run(`
      INSERT INTO impact_reports (
        id, project_id, generated_at, base_branch, target_branch,
        files_added, files_modified, files_deleted,
        affected_entities, affected_decisions,
        risk_level, reasons_json, report_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      generateId('ir'),
      projectId,
      report.generatedAt.toISOString(),
      report.baseBranch,
      report.targetBranch,
      report.filesAdded.length,
      report.filesModified.length,
      report.filesDeleted.length,
      report.affectedEntities.length,
      report.affectedDecisions.length,
      report.riskLevel,
      JSON.stringify(report.reasons),
      JSON.stringify(report)
    ]);
  }

  /**
   * Log hook execution.
   */
  private async logExecution(event: HookEvent, result: Partial<HookResult>): Promise<void> {
    try {
      this.db.run(`
        INSERT INTO hook_executions (
          id, project_id, hook_type, timestamp,
          repository, branch, commit_hash,
          duration_ms, success, files_indexed, entities_updated,
          message, warnings_json, errors_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        generateId('hex'),
        this.config.projectId,
        event.type,
        event.timestamp.toISOString(),
        event.repository,
        event.currentBranch,
        event.currentCommit,
        result.duration || 0,
        result.success ? 1 : 0,
        result.filesIndexed || 0,
        result.entitiesUpdated || 0,
        result.message || null,
        JSON.stringify(result.warnings || []),
        JSON.stringify(result.errors || [])
      ]);
    } catch {
      // Don't fail hook if logging fails
      this.log('verbose', 'Failed to log execution');
    }
  }

  /**
   * Log message based on verbosity.
   */
  private log(level: 'silent' | 'normal' | 'verbose', message: string): void {
    const levels = { silent: 0, normal: 1, verbose: 2 };
    const configLevel = levels[this.config.verbosity];
    const messageLevel = levels[level];

    if (messageLevel <= configLevel) {
      console.error(`ctx-sys: ${message}`);
    }
  }

  /**
   * Get recent hook executions.
   */
  async getRecentExecutions(
    projectId: string,
    hookType?: string,
    limit: number = 20
  ): Promise<HookExecution[]> {
    let query = `
      SELECT * FROM hook_executions
      WHERE project_id = ?
    `;
    const params: unknown[] = [projectId];

    if (hookType) {
      query += ` AND hook_type = ?`;
      params.push(hookType);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.all<Record<string, unknown>>(query, params);

    return rows.map(row => ({
      id: row.id as string,
      projectId: row.project_id as string,
      hookType: row.hook_type as string,
      timestamp: new Date(row.timestamp as string),
      repository: row.repository as string,
      branch: row.branch as string,
      commitHash: row.commit_hash as string | undefined,
      durationMs: row.duration_ms as number,
      success: (row.success as number) === 1,
      filesIndexed: row.files_indexed as number,
      entitiesUpdated: row.entities_updated as number,
      message: row.message as string | undefined,
      warnings: JSON.parse((row.warnings_json as string) || '[]'),
      errors: JSON.parse((row.errors_json as string) || '[]')
    }));
  }

  /**
   * Get the handler configuration.
   */
  getConfig(): HookConfig {
    return { ...this.config };
  }

  /**
   * Update the handler configuration.
   */
  updateConfig(config: Partial<HookConfig>): void {
    this.config = { ...this.config, ...config };
    this.impactAnalyzer = new ImpactAnalyzer(this.client);
  }
}
