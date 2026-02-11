/**
 * F10i.1: Codebase indexing domain service.
 */

import { AppContext } from '../context';
import { CodebaseIndexer } from '../indexer';
import { RelationshipStore } from '../graph';
import { DocumentIndexer } from '../documents/document-indexer';
import {
  IndexOptions, IndexResult, GitSyncOptions, SyncResult, IndexStatus,
  DocumentIndexOptions, DocumentResult
} from './types';

export class IndexingService {
  private indexers = new Map<string, CodebaseIndexer>();
  private relationshipStores = new Map<string, RelationshipStore>();

  constructor(private context: AppContext) {}

  private async getProjectPath(projectId: string): Promise<string> {
    const project = await this.context.projectManager.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project.path;
  }

  private getRelationshipStore(projectId: string): RelationshipStore {
    if (!this.relationshipStores.has(projectId)) {
      this.relationshipStores.set(projectId, new RelationshipStore(this.context.db, projectId));
    }
    return this.relationshipStores.get(projectId)!;
  }

  private getIndexer(projectId: string, projectPath: string): CodebaseIndexer {
    if (!this.indexers.has(projectId)) {
      const entityStore = this.context.getEntityStore(projectId);
      const relationshipStore = this.getRelationshipStore(projectId);
      this.indexers.set(projectId, new CodebaseIndexer(
        projectPath, entityStore, undefined, undefined, relationshipStore
      ));
    }
    return this.indexers.get(projectId)!;
  }

  async indexCodebase(projectId: string, path: string, options?: IndexOptions): Promise<IndexResult> {
    const startTime = Date.now();
    const indexer = this.getIndexer(projectId, path);

    const result = await indexer.indexAll({
      exclude: options?.ignore,
      force: options?.force
    });

    await this.context.projectManager.update(projectId, { lastIndexedAt: new Date() });

    let embeddingsGenerated = 0;
    const embeddingErrors: Array<{ path: string; error: string }> = [];

    if (options?.generateEmbeddings !== false) {
      try {
        const entityStore = this.context.getEntityStore(projectId);
        const embeddingManager = await this.context.getEmbeddingManager(projectId);

        for (const page of entityStore.listPaginated({ pageSize: 500 })) {
          const toEmbed = page.map((e) => ({
            id: e.id,
            content: `${e.name}: ${e.content || ''}`
          }));

          if (toEmbed.length > 0) {
            await embeddingManager.embedBatch(toEmbed);
            embeddingsGenerated += toEmbed.length;
          }
        }
      } catch (err) {
        embeddingErrors.push({
          path: 'embeddings',
          error: `Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`
        });
      }
    }

    return {
      filesProcessed: result.added.length + result.modified.length + result.unchanged.length,
      entitiesCreated: result.added.length,
      entitiesUpdated: result.modified.length,
      relationshipsCreated: 0,
      errors: [...result.errors, ...embeddingErrors],
      durationMs: Date.now() - startTime,
      embeddingsGenerated
    };
  }

  async indexFile(projectId: string, filePath: string): Promise<IndexResult> {
    const projectPath = await this.getProjectPath(projectId);
    const indexer = this.getIndexer(projectId, projectPath);
    const startTime = Date.now();

    try {
      const summary = await indexer.indexFile(filePath);
      return {
        filesProcessed: 1,
        entitiesCreated: summary ? summary.symbols.length + 1 : 0,
        entitiesUpdated: 0,
        relationshipsCreated: 0,
        errors: [],
        durationMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        filesProcessed: 1,
        entitiesCreated: 0,
        entitiesUpdated: 0,
        relationshipsCreated: 0,
        errors: [{ path: filePath, error: error instanceof Error ? error.message : String(error) }],
        durationMs: Date.now() - startTime
      };
    }
  }

  async syncFromGit(projectId: string, _options?: GitSyncOptions): Promise<SyncResult> {
    const projectPath = await this.getProjectPath(projectId);
    const indexer = this.getIndexer(projectId, projectPath);
    const result = await indexer.updateIndex();

    return {
      filesChanged: result.added.length + result.modified.length + result.deleted.length,
      entitiesCreated: result.added.length,
      entitiesUpdated: result.modified.length,
      entitiesDeleted: result.deleted.length
    };
  }

  async getIndexStatus(projectId: string): Promise<IndexStatus> {
    const project = await this.context.projectManager.get(projectId);
    const entityStore = this.context.getEntityStore(projectId);
    const entities = await entityStore.search('', { limit: 1 });

    return {
      lastIndexed: project?.lastIndexedAt || null,
      filesIndexed: 0,
      entitiesCount: entities.length > 0 ? await entityStore.count() : 0,
      isStale: !project?.lastIndexedAt ||
        (Date.now() - project.lastIndexedAt.getTime()) > 24 * 60 * 60 * 1000
    };
  }

  async indexDocument(projectId: string, filePath: string, options?: DocumentIndexOptions): Promise<DocumentResult> {
    const entityStore = this.context.getEntityStore(projectId);
    const relationshipStore = this.getRelationshipStore(projectId);
    const indexer = new DocumentIndexer(entityStore, relationshipStore);

    const result = await indexer.indexFile(filePath, {
      extractEntities: options?.extractRequirements,
      extractRelationships: options?.linkToCode,
    });

    return {
      entityId: result.documentId,
      sectionsCreated: result.entitiesCreated - 1,
      requirementsExtracted: 0,
      codeLinksCreated: result.crossDocLinks,
    };
  }

  clearProjectCache(projectId: string): void {
    this.indexers.delete(projectId);
    this.relationshipStores.delete(projectId);
  }
}
