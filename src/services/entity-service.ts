/**
 * F10i.1: Entity management domain service.
 */

import { AppContext } from '../context';
import { Entity, EntityType } from '../entities/types';
import { CreateEntityInput } from './types';

export class EntityService {
  constructor(private context: AppContext) {}

  async addEntity(projectId: string, input: CreateEntityInput): Promise<Entity> {
    const entityStore = this.context.getEntityStore(projectId);
    const entity = await entityStore.create({
      type: input.type,
      name: input.name,
      qualifiedName: input.qualifiedName,
      content: input.content,
      summary: input.summary,
      filePath: input.filePath,
      startLine: input.startLine,
      endLine: input.endLine,
      metadata: input.metadata
    });

    if (input.content) {
      const project = await this.context.projectManager.get(projectId);
      const embeddingManager = await this.context.getEmbeddingManager(projectId, project?.config);
      await embeddingManager.embed(entity.id, input.content);
    }

    return entity;
  }

  async getEntity(projectId: string, id: string): Promise<Entity | null> {
    const entityStore = this.context.getEntityStore(projectId);
    return entityStore.get(id);
  }

  async getEntityByName(projectId: string, qualifiedName: string): Promise<Entity | null> {
    const entityStore = this.context.getEntityStore(projectId);
    return entityStore.getByQualifiedName(qualifiedName);
  }

  async searchEntities(projectId: string, query: string, options?: { type?: EntityType; limit?: number }): Promise<Entity[]> {
    const entityStore = this.context.getEntityStore(projectId);
    return entityStore.search(query, options);
  }

  async deleteEntity(projectId: string, id: string): Promise<void> {
    const entityStore = this.context.getEntityStore(projectId);
    await entityStore.delete(id);
  }

  async resolveEntityId(projectId: string, nameOrId: string): Promise<string> {
    const entityStore = this.context.getEntityStore(projectId);

    const byId = await entityStore.get(nameOrId);
    if (byId) return byId.id;

    const byQualified = await entityStore.getByQualifiedName(nameOrId);
    if (byQualified) return byQualified.id;

    const byExactName = await entityStore.getByName(nameOrId);
    if (byExactName) return byExactName.id;

    const searchResults = await entityStore.search(nameOrId, { limit: 1 });
    if (searchResults.length > 0) return searchResults[0].id;

    throw new Error(`Entity not found: ${nameOrId}`);
  }
}
