/**
 * DatabaseConnection - SQLite database connection with extensions
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.1-database-schema.test.ts for expected behavior.
 */

export class DatabaseConnection {
  public db: any;
  public vecEnabled: boolean = false;

  constructor(path?: string) {
    throw new Error('Not implemented');
  }

  async initialize(): Promise<void> {
    throw new Error('Not implemented');
  }

  async createProjectTables(projectId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  transaction(fn: () => any): any {
    throw new Error('Not implemented');
  }

  run(sql: string, params?: any[]): any {
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

  query<T = any>(sql: string, params?: any[]): T[] {
    throw new Error('Not implemented');
  }

  execute(sql: string, params?: any[]): any {
    throw new Error('Not implemented');
  }

  close(): void {
    throw new Error('Not implemented');
  }

  async storeEmbedding(
    projectId: string,
    entityId: string,
    modelId: string,
    embedding: number[] | Float32Array
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async findSimilar(
    projectId: string,
    queryEmbedding: number[] | Float32Array,
    limit: number,
    options?: { modelId?: string }
  ): Promise<Array<{ entity_id: string; distance: number }>> {
    throw new Error('Not implemented');
  }

  async searchFTS(projectId: string, query: string): Promise<any[]> {
    throw new Error('Not implemented');
  }
}
