/**
 * F10i.1: Core Service — thin delegation facade.
 *
 * All business logic lives in domain services. CoreService delegates
 * to them, preserving the original public API for backwards compatibility.
 */

import { AppContext } from '../context';
import { ProjectConfig } from '../project/types';
import { EntityType } from '../entities/types';

import { ProjectService } from './project-service';
import { EntityService } from './entity-service';
import { IndexingService } from './indexing-service';
import { ConversationService } from './conversation-service';
import { GraphService } from './graph-service';
import { RetrievalService } from './retrieval-service';
import { AgentService } from './agent-service';
import { HooksService } from './hooks-service';

import {
  CreateEntityInput,
  CreateMessageInput,
  CreateRelationshipInput,
  IndexOptions,
  GitSyncOptions,
  QueryOptions,
  SessionListOptions,
  HistoryOptions,
  DecisionSearchOptions,
  RelationshipQueryOptions,
  GraphQueryOptions,
  SpillOptions,
  CreateReflectionInput,
  ReflectionQueryOptions,
  HookConfig,
  DocumentIndexOptions,
} from './types';

/**
 * Unified service layer for all ctx-sys operations.
 * Delegates to focused domain services.
 */
export class CoreService {
  readonly projects: ProjectService;
  readonly entities: EntityService;
  readonly indexing: IndexingService;
  readonly conversations: ConversationService;
  readonly graph: GraphService;
  readonly retrieval: RetrievalService;
  readonly agent: AgentService;
  readonly hooks: HooksService;

  constructor(private context: AppContext) {
    this.projects = new ProjectService(context);
    this.entities = new EntityService(context);
    this.indexing = new IndexingService(context);
    this.conversations = new ConversationService(context);
    this.graph = new GraphService(context);
    this.retrieval = new RetrievalService(context);
    this.agent = new AgentService(context);
    this.hooks = new HooksService(context);
  }

  // ── Project Management ───────────────────────────────────
  async createProject(name: string, path: string, config?: Partial<ProjectConfig>) { return this.projects.createProject(name, path, config); }
  async getProject(nameOrId: string) { return this.projects.getProject(nameOrId); }
  async listProjects() { return this.projects.listProjects(); }
  async setActiveProject(nameOrId: string) { return this.projects.setActiveProject(nameOrId); }
  async deleteProject(nameOrId: string, keepData?: boolean) {
    const project = await this.projects.getProject(nameOrId);
    await this.projects.deleteProject(nameOrId, keepData);
    if (project) this.clearProjectCache(project.id);
  }
  async getActiveProject() { return this.projects.getActiveProject(); }

  // ── Entity Management ────────────────────────────────────
  async addEntity(projectId: string, input: CreateEntityInput) { return this.entities.addEntity(projectId, input); }
  async getEntity(projectId: string, id: string) { return this.entities.getEntity(projectId, id); }
  async getEntityByName(projectId: string, qualifiedName: string) { return this.entities.getEntityByName(projectId, qualifiedName); }
  async searchEntities(projectId: string, query: string, options?: { type?: EntityType; limit?: number }) { return this.entities.searchEntities(projectId, query, options); }
  async deleteEntity(projectId: string, id: string) { return this.entities.deleteEntity(projectId, id); }
  async resolveEntityId(projectId: string, nameOrId: string) { return this.entities.resolveEntityId(projectId, nameOrId); }

  // ── Codebase Indexing ────────────────────────────────────
  async indexCodebase(projectId: string, path: string, options?: IndexOptions) { return this.indexing.indexCodebase(projectId, path, options); }
  async indexFile(projectId: string, filePath: string) { return this.indexing.indexFile(projectId, filePath); }
  async syncFromGit(projectId: string, options?: GitSyncOptions) { return this.indexing.syncFromGit(projectId, options); }
  async getIndexStatus(projectId: string) { return this.indexing.getIndexStatus(projectId); }
  async indexDocument(projectId: string, filePath: string, options?: DocumentIndexOptions) { return this.indexing.indexDocument(projectId, filePath, options); }

  // ── Conversation Memory ──────────────────────────────────
  async createSession(projectId: string, name?: string) { return this.conversations.createSession(projectId, name); }
  async getSession(projectId: string, sessionId: string) { return this.conversations.getSession(projectId, sessionId); }
  async listSessions(projectId: string, options?: SessionListOptions) { return this.conversations.listSessions(projectId, options); }
  async archiveSession(projectId: string, sessionId: string) { return this.conversations.archiveSession(projectId, sessionId); }
  async storeMessage(projectId: string, sessionId: string, message: CreateMessageInput) { return this.conversations.storeMessage(projectId, sessionId, message); }
  async getMessages(projectId: string, sessionId: string, options?: { limit?: number; before?: string }) { return this.conversations.getMessages(projectId, sessionId, options); }
  async getHistory(projectId: string, options?: HistoryOptions) { return this.conversations.getHistory(projectId, options); }
  async summarizeSession(projectId: string, sessionId: string) { return this.conversations.summarizeSession(projectId, sessionId); }
  async searchDecisions(projectId: string, query: string, options?: DecisionSearchOptions) { return this.conversations.searchDecisions(projectId, query, options); }
  async createDecision(projectId: string, input: { sessionId: string; messageId?: string; description: string; context?: string; alternatives?: string[]; relatedEntities?: string[] }) { return this.conversations.createDecision(projectId, input); }

  // ── Graph RAG ────────────────────────────────────────────
  async addRelationship(projectId: string, input: CreateRelationshipInput) { return this.graph.addRelationship(projectId, input); }
  async getRelationships(projectId: string, entityId: string, options?: RelationshipQueryOptions) { return this.graph.getRelationships(projectId, entityId, options); }
  async queryGraph(projectId: string, startEntityId: string, options?: GraphQueryOptions) { return this.graph.queryGraph(projectId, startEntityId, options); }
  async getGraphStats(projectId: string) { return this.graph.getGraphStats(projectId); }

  // ── Context Retrieval ────────────────────────────────────
  async queryContext(projectId: string, query: string, options?: QueryOptions) { return this.retrieval.queryContext(projectId, query, options); }

  // ── Agent Patterns ───────────────────────────────────────
  async saveCheckpoint(projectId: string, sessionId: string, state: unknown, metadata?: Record<string, unknown>) { return this.agent.saveCheckpoint(projectId, sessionId, state, metadata); }
  async loadCheckpoint(projectId: string, sessionId: string, checkpointId?: string) { return this.agent.loadCheckpoint(projectId, sessionId, checkpointId); }
  async listCheckpoints(projectId: string, sessionId: string) { return this.agent.listCheckpoints(projectId, sessionId); }
  async deleteCheckpoint(projectId: string, checkpointId: string) { return this.agent.deleteCheckpoint(projectId, checkpointId); }
  async spillMemory(projectId: string, sessionId: string, options?: SpillOptions) { return this.agent.spillMemory(projectId, sessionId, options); }
  async recallMemory(projectId: string, sessionId: string, query: string) { return this.agent.recallMemory(projectId, sessionId, query); }
  async getMemoryStatus(projectId: string, sessionId: string) { return this.agent.getMemoryStatus(projectId, sessionId); }
  async storeReflection(projectId: string, sessionId: string, input: CreateReflectionInput) { return this.agent.storeReflection(projectId, sessionId, input); }
  async getReflections(projectId: string, sessionId: string, options?: ReflectionQueryOptions) { return this.agent.getReflections(projectId, sessionId, options); }
  async searchReflections(projectId: string, query: string, options?: { type?: string; outcome?: string }) { return this.agent.searchReflections(projectId, query, options); }

  // ── Git Hooks ────────────────────────────────────────────
  async installHooks(projectId: string, repoPath: string, config?: HookConfig) { return this.hooks.installHooks(projectId, repoPath, config); }
  async getImpactReport(projectId: string, baseBranch: string, targetBranch: string) { return this.hooks.getImpactReport(projectId, baseBranch, targetBranch); }

  // ── Utilities ────────────────────────────────────────────
  clearProjectCache(projectId: string): void {
    this.indexing.clearProjectCache(projectId);
    this.conversations.clearProjectCache(projectId);
    this.graph.clearProjectCache(projectId);
    this.retrieval.clearProjectCache(projectId);
    this.agent.clearProjectCache(projectId);
    this.context.clearProjectCache(projectId);
  }
}
