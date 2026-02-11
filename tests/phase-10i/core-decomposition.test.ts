/**
 * Tests for F10i.1: CoreService decomposition.
 * Verifies that CoreService correctly delegates to domain services.
 */

import { CoreService } from '../../src/services/core-service';
import { ProjectService } from '../../src/services/project-service';
import { EntityService } from '../../src/services/entity-service';
import { IndexingService } from '../../src/services/indexing-service';
import { ConversationService } from '../../src/services/conversation-service';
import { GraphService } from '../../src/services/graph-service';
import { RetrievalService } from '../../src/services/retrieval-service';
import { AgentService } from '../../src/services/agent-service';
import { HooksService } from '../../src/services/hooks-service';

// Minimal mock AppContext
function mockContext(): any {
  return {
    db: {},
    projectManager: {
      create: jest.fn().mockResolvedValue({ id: 'p1', name: 'test', path: '/tmp' }),
      get: jest.fn().mockResolvedValue({ id: 'p1', name: 'test', path: '/tmp' }),
      list: jest.fn().mockResolvedValue([]),
      setActive: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      getActive: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
    },
    getEntityStore: jest.fn().mockReturnValue({
      create: jest.fn().mockResolvedValue({ id: 'e1', name: 'test', type: 'function' }),
      get: jest.fn().mockResolvedValue(null),
      getByQualifiedName: jest.fn().mockResolvedValue(null),
      search: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      getByName: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      listPaginated: jest.fn().mockReturnValue({ [Symbol.iterator]: () => ({ next: () => ({ done: true, value: undefined }) }) }),
    }),
    getEmbeddingManager: jest.fn().mockResolvedValue({
      embed: jest.fn().mockResolvedValue(undefined),
      embedBatch: jest.fn().mockResolvedValue(undefined),
    }),
    clearProjectCache: jest.fn(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
}

describe('CoreService Decomposition', () => {
  it('should expose all 8 domain services', () => {
    const core = new CoreService(mockContext());

    expect(core.projects).toBeInstanceOf(ProjectService);
    expect(core.entities).toBeInstanceOf(EntityService);
    expect(core.indexing).toBeInstanceOf(IndexingService);
    expect(core.conversations).toBeInstanceOf(ConversationService);
    expect(core.graph).toBeInstanceOf(GraphService);
    expect(core.retrieval).toBeInstanceOf(RetrievalService);
    expect(core.agent).toBeInstanceOf(AgentService);
    expect(core.hooks).toBeInstanceOf(HooksService);
  });

  it('should delegate createProject to ProjectService', async () => {
    const ctx = mockContext();
    const core = new CoreService(ctx);

    const result = await core.createProject('test', '/tmp');
    expect(ctx.projectManager.create).toHaveBeenCalledWith('test', '/tmp', undefined);
    expect(result).toEqual({ id: 'p1', name: 'test', path: '/tmp' });
  });

  it('should delegate listProjects to ProjectService', async () => {
    const ctx = mockContext();
    const core = new CoreService(ctx);

    await core.listProjects();
    expect(ctx.projectManager.list).toHaveBeenCalled();
  });

  it('should delegate addEntity to EntityService', async () => {
    const ctx = mockContext();
    const core = new CoreService(ctx);
    const input = { type: 'function' as const, name: 'test' };

    await core.addEntity('p1', input);
    expect(ctx.getEntityStore).toHaveBeenCalledWith('p1');
  });

  it('should delegate getEntity to EntityService', async () => {
    const ctx = mockContext();
    const core = new CoreService(ctx);

    await core.getEntity('p1', 'e1');
    expect(ctx.getEntityStore).toHaveBeenCalledWith('p1');
  });

  it('should delegate clearProjectCache to all domain services', () => {
    const ctx = mockContext();
    const core = new CoreService(ctx);

    core.clearProjectCache('p1');
    expect(ctx.clearProjectCache).toHaveBeenCalledWith('p1');
  });

  it('should delegate deleteProject and clear cache', async () => {
    const ctx = mockContext();
    const core = new CoreService(ctx);

    await core.deleteProject('test');
    expect(ctx.projectManager.get).toHaveBeenCalledWith('test');
    expect(ctx.projectManager.delete).toHaveBeenCalledWith('test', undefined);
    // Should have called clearProjectCache for the project
    expect(ctx.clearProjectCache).toHaveBeenCalledWith('p1');
  });
});
