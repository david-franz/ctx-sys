/**
 * AppContext - Application context and dependencies
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.5-mcp-server.test.ts for expected behavior.
 */

import { DatabaseConnection } from '../db/connection';
import { ProjectManager } from '../project/manager';
import { EntityStore } from '../entities/store';
import { EmbeddingManager } from '../embeddings/manager';

export class AppContext {
  public db: DatabaseConnection;
  public projectManager: ProjectManager;

  constructor(dbPath: string) {
    throw new Error('Not implemented');
  }

  async initialize(): Promise<void> {
    throw new Error('Not implemented');
  }

  getEntityStore(projectId: string): EntityStore {
    throw new Error('Not implemented');
  }

  getEmbeddingManager(projectId: string): EmbeddingManager {
    throw new Error('Not implemented');
  }

  async resolveProjectId(name?: string): Promise<string> {
    throw new Error('Not implemented');
  }
}
