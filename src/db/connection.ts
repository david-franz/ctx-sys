import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import * as fs from 'fs';
import * as path from 'path';
import { GLOBAL_SCHEMA, createProjectTables, dropProjectTables } from './schema';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Database connection wrapper using better-sqlite3.
 * F10.10: Migrated from sql.js to enable FTS5 and native extensions.
 */
export class DatabaseConnection {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database connection.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    // Load sqlite-vec extension for native vector search
    sqliteVec.load(this.db);

    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    // Wait up to 5s for locks instead of failing immediately (multi-process safety)
    this.db.pragma('busy_timeout = 5000');

    this.initialized = true;

    // Create global schema
    this.exec(GLOBAL_SCHEMA);
  }

  /**
   * Ensure database is initialized before operations.
   */
  private ensureInitialized(): Database.Database {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute multiple SQL statements.
   */
  exec(sql: string): void {
    const db = this.ensureInitialized();
    db.exec(sql);
  }

  /**
   * Execute a single SQL statement with parameters.
   */
  run(sql: string, params?: unknown[]): RunResult {
    const db = this.ensureInitialized();
    const stmt = db.prepare(sql);
    const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  /**
   * Execute a query and return the first row.
   */
  get<T>(sql: string, params?: unknown[]): T | undefined {
    const db = this.ensureInitialized();
    const stmt = db.prepare(sql);
    const row = params && params.length > 0 ? stmt.get(...params) : stmt.get();
    return row as T | undefined;
  }

  /**
   * Execute a query and return all rows.
   */
  all<T>(sql: string, params?: unknown[]): T[] {
    const db = this.ensureInitialized();
    const stmt = db.prepare(sql);
    const rows = params && params.length > 0 ? stmt.all(...params) : stmt.all();
    return rows as T[];
  }

  /**
   * Execute a function within a transaction.
   */
  transaction<T>(fn: () => T): T {
    const db = this.ensureInitialized();
    const trx = db.transaction(() => fn());
    return trx();
  }

  /**
   * Create project-specific tables.
   */
  createProject(projectId: string): void {
    this.exec(createProjectTables(projectId));
  }

  /**
   * Drop project-specific tables.
   */
  dropProject(projectId: string): void {
    this.exec(dropProjectTables(projectId));
  }

  /**
   * Save database to file.
   * With better-sqlite3 in WAL mode, data is auto-persisted.
   * This method triggers a WAL checkpoint for safety.
   */
  save(): void {
    const db = this.ensureInitialized();
    db.pragma('wal_checkpoint(TRUNCATE)');
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db && this.initialized) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Check if the database is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the database file path.
   */
  getPath(): string {
    return this.dbPath;
  }
}
