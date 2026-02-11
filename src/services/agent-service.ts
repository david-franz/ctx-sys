/**
 * F10i.1: Agent patterns domain service.
 */

import { AppContext } from '../context';
import { CheckpointManager, Checkpoint, AgentState } from '../agent/checkpoints';
import { MemoryTierManager } from '../agent/memory-tier';
import { ReflectionStore, Reflection } from '../agent/reflection';
import {
  SpillOptions, SpillResult, RecallResult, MemoryStatus,
  CreateReflectionInput, ReflectionQueryOptions
} from './types';

export class AgentService {
  private checkpointManagers = new Map<string, CheckpointManager>();
  private memoryManagers = new Map<string, MemoryTierManager>();
  private reflectionStores = new Map<string, ReflectionStore>();

  constructor(private context: AppContext) {}

  private getCheckpointManager(projectId: string): CheckpointManager {
    if (!this.checkpointManagers.has(projectId)) {
      this.checkpointManagers.set(projectId, new CheckpointManager(this.context.db, projectId));
    }
    return this.checkpointManagers.get(projectId)!;
  }

  private getMemoryManager(projectId: string): MemoryTierManager {
    if (!this.memoryManagers.has(projectId)) {
      this.memoryManagers.set(projectId, new MemoryTierManager(this.context.db, projectId));
    }
    return this.memoryManagers.get(projectId)!;
  }

  private getReflectionStore(projectId: string): ReflectionStore {
    if (!this.reflectionStores.has(projectId)) {
      this.reflectionStores.set(projectId, new ReflectionStore(this.context.db, projectId));
    }
    return this.reflectionStores.get(projectId)!;
  }

  async saveCheckpoint(
    projectId: string,
    sessionId: string,
    state: unknown,
    metadata?: Record<string, unknown>
  ): Promise<Checkpoint> {
    const checkpointManager = this.getCheckpointManager(projectId);

    const existing = await checkpointManager.list(sessionId);
    const nextStep = existing.length > 0
      ? Math.max(...existing.map(c => c.stepNumber)) + 1
      : 1;

    const agentState: AgentState = {
      query: '',
      plan: [],
      currentStepIndex: nextStep,
      results: [],
      context: state as Record<string, unknown>
    };

    return checkpointManager.save(sessionId, agentState, {
      description: metadata?.description as string,
      triggerType: (metadata?.triggerType === 'auto' || metadata?.triggerType === 'manual' || metadata?.triggerType === 'error') ? metadata.triggerType : 'manual'
    });
  }

  async loadCheckpoint(projectId: string, sessionId: string, checkpointId?: string): Promise<Checkpoint | null> {
    const checkpointManager = this.getCheckpointManager(projectId);
    if (checkpointId) {
      return checkpointManager.load(checkpointId);
    }
    return checkpointManager.loadLatest(sessionId);
  }

  async listCheckpoints(projectId: string, sessionId: string): Promise<any[]> {
    const checkpointManager = this.getCheckpointManager(projectId);
    return checkpointManager.list(sessionId);
  }

  async deleteCheckpoint(projectId: string, checkpointId: string): Promise<void> {
    const checkpointManager = this.getCheckpointManager(projectId);
    await checkpointManager.delete(checkpointId);
  }

  async spillMemory(projectId: string, sessionId: string, options?: SpillOptions): Promise<SpillResult> {
    const manager = this.getMemoryManager(projectId);
    const result = await manager.spillToWarm(sessionId, {
      count: options?.threshold ? Math.ceil(options.threshold / 100) : 4
    });
    return {
      spilledCount: result.spilledCount,
      tokensFreed: result.spilledCount * 100
    };
  }

  async recallMemory(projectId: string, sessionId: string, query: string): Promise<RecallResult> {
    const manager = this.getMemoryManager(projectId);
    const result = await manager.recall(sessionId, query);
    return {
      items: result.items.map(item => ({
        id: item.id,
        content: item.content,
        type: item.type,
        relevance: item.relevanceScore
      })),
      tokensRecalled: result.items.reduce((sum, item) => sum + item.tokenCount, 0)
    };
  }

  async getMemoryStatus(projectId: string, sessionId?: string): Promise<MemoryStatus> {
    const manager = this.getMemoryManager(projectId);
    if (!sessionId) {
      return manager.getStatusAll();
    }
    const status = await manager.getStatus(sessionId);
    return {
      hotCount: status.hot.items,
      coldCount: status.cold.items + status.warm.items,
      hotTokens: status.hot.tokens,
      coldTokens: status.cold.tokens + status.warm.tokens
    };
  }

  async storeReflection(projectId: string, sessionId: string, input: CreateReflectionInput): Promise<Reflection> {
    const store = this.getReflectionStore(projectId);
    return store.store({
      sessionId,
      taskDescription: input.content,
      outcome: (input.outcome as Reflection['outcome']) ?? 'partial',
      nextStrategy: '',
      whatWorked: input.outcome === 'success' ? [input.content] : undefined,
      whatDidNotWork: input.outcome === 'failure' ? [input.content] : undefined,
      tags: [
        ...(input.tags ?? []),
        ...(input.type ? [input.type] : []),
      ],
    });
  }

  async getReflections(projectId: string, sessionId: string, options?: ReflectionQueryOptions): Promise<Reflection[]> {
    const store = this.getReflectionStore(projectId);
    return store.getRecent(sessionId, options?.limit ?? 10);
  }

  async searchReflections(projectId: string, query: string, options?: { type?: string; outcome?: string }): Promise<Reflection[]> {
    const store = this.getReflectionStore(projectId);
    return store.search({
      taskDescription: query,
      outcomeFilter: options?.outcome ? [options.outcome as Reflection['outcome']] : undefined,
      tags: options?.type ? [options.type] : undefined,
      limit: 10,
    });
  }

  clearProjectCache(projectId: string): void {
    this.checkpointManagers.delete(projectId);
    this.memoryManagers.delete(projectId);
    this.reflectionStores.delete(projectId);
  }
}
