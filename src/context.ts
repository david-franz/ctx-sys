import * as path from 'path';
import { DatabaseConnection } from './db/connection';
import { ProjectManager, ProjectConfig } from './project';
import { EntityStore } from './entities';
import { EmbeddingManager, EmbeddingProviderFactory, EmbeddingProvider, MockEmbeddingProvider, OllamaEmbeddingProvider } from './embeddings';

/**
 * Default database path — local to the current working directory.
 * Use a global path (~/.ctx-sys/ctx-sys.db) only when explicitly configured.
 */
export function getDefaultDbPath(): string {
  return path.join(process.cwd(), '.ctx-sys', 'ctx-sys.db');
}

/**
 * Application context containing shared resources.
 */
export class AppContext {
  public readonly db: DatabaseConnection;
  public readonly projectManager: ProjectManager;

  private entityStores: Map<string, EntityStore> = new Map();
  private embeddingManagers: Map<string, EmbeddingManager> = new Map();
  private embeddingProviders: Map<string, EmbeddingProvider> = new Map();

  constructor(dbPath?: string) {
    this.db = new DatabaseConnection(dbPath || getDefaultDbPath());
    this.projectManager = new ProjectManager(this.db);
  }

  /**
   * Initialize the application context.
   */
  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  /**
   * Close the application context.
   */
  async close(): Promise<void> {
    this.entityStores.clear();
    this.embeddingManagers.clear();
    this.embeddingProviders.clear();
    this.db.close();
  }

  /**
   * Get EntityStore for a project.
   */
  getEntityStore(projectId: string): EntityStore {
    if (!this.entityStores.has(projectId)) {
      this.entityStores.set(projectId, new EntityStore(this.db, projectId));
    }
    return this.entityStores.get(projectId)!;
  }

  /**
   * Get EmbeddingManager for a project.
   */
  getEmbeddingManager(projectId: string, config?: ProjectConfig): EmbeddingManager {
    if (!this.embeddingManagers.has(projectId)) {
      const provider = this.getEmbeddingProvider(projectId, config);
      this.embeddingManagers.set(
        projectId,
        new EmbeddingManager(this.db, projectId, provider)
      );
    }
    return this.embeddingManagers.get(projectId)!;
  }

  /**
   * Get or create an embedding provider for a project.
   */
  private getEmbeddingProvider(projectId: string, config?: ProjectConfig): EmbeddingProvider {
    if (!this.embeddingProviders.has(projectId)) {
      if (config?.embeddings) {
        const provider = EmbeddingProviderFactory.create({
          provider: config.embeddings.provider,
          model: config.embeddings.model
        });
        this.embeddingProviders.set(projectId, provider);
      } else {
        // Default to Ollama with mxbai-embed-large to match stored embeddings.
        // Falls back to mock if Ollama is unavailable (semantic search will
        // gracefully degrade via per-strategy error handling).
        this.embeddingProviders.set(projectId, new OllamaEmbeddingProvider({
          baseUrl: 'http://localhost:11434',
          model: 'mxbai-embed-large:latest'
        }));
      }
    }
    return this.embeddingProviders.get(projectId)!;
  }

  /**
   * Clear cached resources for a project.
   */
  clearProjectCache(projectId: string): void {
    this.entityStores.delete(projectId);
    this.embeddingManagers.delete(projectId);
    this.embeddingProviders.delete(projectId);
  }
}
