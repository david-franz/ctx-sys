import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { GLOBAL_SCHEMA, createProjectTables, dropProjectTables } from './schema';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Database connection wrapper for sql.js.
 * Provides a synchronous-style API similar to better-sqlite3.
 */
export class DatabaseConnection {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database connection.
   * Loads existing database from file or creates a new one.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs();

    // Try to load existing database
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new SQL.Database();
    }

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');

    // Mark as initialized before creating schema (so exec() works)
    this.initialized = true;

    // Create global schema
    this.exec(GLOBAL_SCHEMA);
  }

  /**
   * Ensure database is initialized before operations.
   */
  private ensureInitialized(): SqlJsDatabase {
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
    db.run(sql);
  }

  /**
   * Execute a single SQL statement with parameters.
   */
  run(sql: string, params?: unknown[]): RunResult {
    const db = this.ensureInitialized();

    if (params && params.length > 0) {
      db.run(sql, params as (string | number | null | Uint8Array)[]);
    } else {
      db.run(sql);
    }

    // Get changes and last insert rowid
    const changesResult = db.exec('SELECT changes() as changes, last_insert_rowid() as lastId');
    const changes = changesResult[0]?.values[0]?.[0] as number || 0;
    const lastInsertRowid = changesResult[0]?.values[0]?.[1] as number || 0;

    return { changes, lastInsertRowid };
  }

  /**
   * Execute a query and return the first row.
   */
  get<T>(sql: string, params?: unknown[]): T | undefined {
    const db = this.ensureInitialized();

    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
    }

    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();

      const row: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        row[col] = values[i];
      });
      return row as T;
    }

    stmt.free();
    return undefined;
  }

  /**
   * Execute a query and return all rows.
   */
  all<T>(sql: string, params?: unknown[]): T[] {
    const db = this.ensureInitialized();

    const stmt = db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
    }

    const results: T[] = [];
    const columns = stmt.getColumnNames();

    while (stmt.step()) {
      const values = stmt.get();
      const row: Record<string, unknown> = {};
      columns.forEach((col: string, i: number) => {
        row[col] = values[i];
      });
      results.push(row as T);
    }

    stmt.free();
    return results;
  }

  /**
   * Execute a function within a transaction.
   */
  transaction<T>(fn: () => T): T {
    const db = this.ensureInitialized();

    db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      db.run('COMMIT');
      return result;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
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
   */
  save(): void {
    const db = this.ensureInitialized();
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db && this.initialized) {
      this.save();
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
