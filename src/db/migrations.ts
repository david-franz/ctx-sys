import { DatabaseConnection } from './connection';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

/**
 * List of migrations in order.
 * Add new migrations to the end of this array.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `-- Initial schema is created in GLOBAL_SCHEMA`,
    down: `
      DROP TABLE IF EXISTS cross_project_links;
      DROP TABLE IF EXISTS shared_entities;
      DROP TABLE IF EXISTS config;
      DROP TABLE IF EXISTS embedding_models;
      DROP TABLE IF EXISTS projects;
    `
  },
  {
    version: 2,
    name: 'analytics_tables',
    up: `
      -- Query logs for detailed tracking
      CREATE TABLE IF NOT EXISTS query_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        session_id TEXT,
        timestamp TEXT NOT NULL,
        query TEXT,
        query_type TEXT NOT NULL,
        tokens_retrieved INTEGER NOT NULL,
        tokens_estimated_full INTEGER NOT NULL,
        tokens_saved INTEGER NOT NULL,
        cost_actual_cents INTEGER,
        cost_estimated_full_cents INTEGER,
        cost_saved_cents INTEGER,
        relevance_score REAL,
        item_count INTEGER,
        was_useful INTEGER,
        latency_ms INTEGER,
        strategies_json TEXT,
        item_types_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_query_logs_project_time ON query_logs(project_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_query_logs_session ON query_logs(session_id, timestamp DESC);

      -- Aggregated daily stats (for long-term storage)
      CREATE TABLE IF NOT EXISTS daily_stats (
        project_id TEXT NOT NULL,
        date TEXT NOT NULL,
        queries INTEGER NOT NULL DEFAULT 0,
        tokens_retrieved INTEGER NOT NULL DEFAULT 0,
        tokens_saved INTEGER NOT NULL DEFAULT 0,
        cost_saved_cents INTEGER NOT NULL DEFAULT 0,
        avg_relevance REAL,
        useful_count INTEGER DEFAULT 0,
        not_useful_count INTEGER DEFAULT 0,
        PRIMARY KEY (project_id, date)
      );

      -- Full context estimates per project
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
    `,
    down: `
      DROP TABLE IF EXISTS query_logs;
      DROP TABLE IF EXISTS daily_stats;
      DROP TABLE IF EXISTS full_context_estimates;
    `
  },
  {
    version: 3,
    name: 'hooks_tables',
    up: `
      -- Track hook executions for debugging
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

      -- Store impact reports for PR reviews
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

      -- Track which files have been indexed from which commits
      CREATE TABLE IF NOT EXISTS indexed_commits (
        project_id TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        indexed_at TEXT NOT NULL,
        file_count INTEGER NOT NULL,
        PRIMARY KEY (project_id, commit_hash)
      );
    `,
    down: `
      DROP TABLE IF EXISTS hook_executions;
      DROP TABLE IF EXISTS impact_reports;
      DROP TABLE IF EXISTS indexed_commits;
    `
  }
];

/**
 * Manages database schema migrations.
 */
export class MigrationManager {
  constructor(private db: DatabaseConnection) {}

  /**
   * Get the current schema version.
   */
  getCurrentVersion(): number {
    const row = this.db.get<{ version: number }>(
      `SELECT MAX(version) as version FROM schema_version`
    );
    return row?.version || 0;
  }

  /**
   * Get list of applied migrations.
   */
  getAppliedMigrations(): Array<{ version: number; name: string; applied_at: string }> {
    return this.db.all(
      `SELECT version, name, applied_at FROM schema_version ORDER BY version`
    );
  }

  /**
   * Apply pending migrations up to target version.
   * If no target specified, applies all pending migrations.
   */
  migrate(targetVersion?: number): { applied: number[]; current: number } {
    const currentVersion = this.getCurrentVersion();
    const target = targetVersion ?? MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
    const applied: number[] = [];

    // Find migrations to apply
    const pendingMigrations = MIGRATIONS.filter(
      m => m.version > currentVersion && m.version <= target
    ).sort((a, b) => a.version - b.version);

    if (pendingMigrations.length === 0) {
      return { applied: [], current: currentVersion };
    }

    // Apply each migration in a transaction
    for (const migration of pendingMigrations) {
      this.db.transaction(() => {
        // Run the migration
        if (migration.up.trim()) {
          this.db.exec(migration.up);
        }

        // Record the migration
        this.db.run(
          `INSERT INTO schema_version (version, name) VALUES (?, ?)`,
          [migration.version, migration.name]
        );
      });

      applied.push(migration.version);
    }

    return { applied, current: this.getCurrentVersion() };
  }

  /**
   * Rollback migrations.
   * @param steps Number of migrations to rollback (default: 1)
   */
  rollback(steps: number = 1): { rolledBack: number[]; current: number } {
    const currentVersion = this.getCurrentVersion();
    const rolledBack: number[] = [];

    // Get migrations to rollback (in reverse order)
    const appliedVersions = this.getAppliedMigrations()
      .map(m => m.version)
      .sort((a, b) => b - a)
      .slice(0, steps);

    for (const version of appliedVersions) {
      const migration = MIGRATIONS.find(m => m.version === version);
      if (!migration) continue;

      this.db.transaction(() => {
        // Run the down migration
        if (migration.down.trim()) {
          this.db.exec(migration.down);
        }

        // Remove the migration record
        this.db.run(
          `DELETE FROM schema_version WHERE version = ?`,
          [version]
        );
      });

      rolledBack.push(version);
    }

    return { rolledBack, current: this.getCurrentVersion() };
  }

  /**
   * Check if there are pending migrations.
   */
  hasPendingMigrations(): boolean {
    const currentVersion = this.getCurrentVersion();
    return MIGRATIONS.some(m => m.version > currentVersion);
  }

  /**
   * Get list of pending migrations.
   */
  getPendingMigrations(): Migration[] {
    const currentVersion = this.getCurrentVersion();
    return MIGRATIONS.filter(m => m.version > currentVersion);
  }
}
