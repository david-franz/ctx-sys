/**
 * Database
 *
 * Database connection and operations.
 */

export class Database {
  run(sql: string, params?: any[]): { changes: number; lastInsertRowid?: number } {
    throw new Error('Not implemented');
  }

  get<T = any>(sql: string, params?: any[]): T | undefined {
    throw new Error('Not implemented');
  }

  all<T = any>(sql: string, params?: any[]): T[] {
    throw new Error('Not implemented');
  }

  exec(sql: string): void {
    throw new Error('Not implemented');
  }

  transaction<T>(fn: () => T): T {
    throw new Error('Not implemented');
  }

  close(): void {
    throw new Error('Not implemented');
  }

  reset(): void {
    throw new Error('Not implemented');
  }
}
