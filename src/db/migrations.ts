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
