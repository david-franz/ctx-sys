/**
 * Core Service Layer - Unified API for all ctx-sys functionality.
 * Single source of truth for business logic shared between MCP and VS Code.
 */

import { AppContext } from '../context';
import { Project, ProjectConfig } from '../project/types';
import { Entity, EntityType } from '../entities/types';
import { CodebaseIndexer } from '../indexer';
import { SessionManager, MessageStore, MessageInput } from '../conversation';
import { Session, Message, Decision } from '../conversation/types';
import { RelationshipStore, GraphTraversal } from '../graph';
import { MultiStrategySearch, ContextAssembler, SearchResult } from '../retrieval';
import { CheckpointManager, Checkpoint, AgentState, SaveOptions } from '../agent/checkpoints';
import { QueryLogger } from '../analytics/query-logger';
import {
  CreateEntityInput,
  CreateMessageInput,
  CreateRelationshipInput,
  IndexOptions,
  IndexResult,
  GitSyncOptions,
  SyncResult,
  IndexStatus,
  QueryOptions,
  ContextResult,
  SessionListOptions,
  MessageQueryOptions,
  HistoryOptions,
  DecisionSearchOptions,
  RelationshipQueryOptions,
  GraphQueryOptions,
  GraphQueryResult,
  GraphStats,
  AnalyticsPeriod,
  AnalyticsStats,
  DashboardData,
  SpillOptions,
  SpillResult,
  RecallResult,
  MemoryStatus,
  CreateReflectionInput,
  ReflectionQueryOptions,
  HookConfig,
  ImpactReport,
  DocumentIndexOptions,
  DocumentResult
} from './types';

/**
 * Unified service layer for all ctx-sys operations.
 */
export class CoreService {
  // Lazy-initialized services per project
  private indexers: Map<string, CodebaseIndexer> = new Map();
  private sessionManagers: Map<string, SessionManager> = new Map();
  private messageStores: Map<string, MessageStore> = new Map();
  private relationshipStores: Map<string, RelationshipStore> = new Map();
  private graphTraversals: Map<string, GraphTraversal> = new Map();
  private searchServices: Map<string, MultiStrategySearch> = new Map();
  private checkpointManagers: Map<string, CheckpointManager> = new Map();
  private queryLoggers: Map<string, QueryLogger> = new Map();

  constructor(private context: AppContext) {}

  // ─────────────────────────────────────────────────────────
  // SERVICE ACCESSORS (Lazy initialization)
  // ─────────────────────────────────────────────────────────

  private async getProjectPath(projectId: string): Promise<string> {
    const project = await this.context.projectManager.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project.path;
  }

  private getIndexer(projectId: string, projectPath: string): CodebaseIndexer {
    if (!this.indexers.has(projectId)) {
      const entityStore = this.context.getEntityStore(projectId);
      this.indexers.set(projectId, new CodebaseIndexer(projectPath, entityStore));
    }
    return this.indexers.get(projectId)!;
  }

  private getSessionManager(projectId: string): SessionManager {
    if (!this.sessionManagers.has(projectId)) {
      this.sessionManagers.set(projectId, new SessionManager(this.context.db, projectId));
    }
    return this.sessionManagers.get(projectId)!;
  }

  private getMessageStore(projectId: string): MessageStore {
    if (!this.messageStores.has(projectId)) {
      this.messageStores.set(projectId, new MessageStore(this.context.db, projectId));
    }
    return this.messageStores.get(projectId)!;
  }

  private getRelationshipStore(projectId: string): RelationshipStore {
    if (!this.relationshipStores.has(projectId)) {
      this.relationshipStores.set(projectId, new RelationshipStore(this.context.db, projectId));
    }
    return this.relationshipStores.get(projectId)!;
  }

  private getGraphTraversal(projectId: string): GraphTraversal {
    if (!this.graphTraversals.has(projectId)) {
      const relationshipStore = this.getRelationshipStore(projectId);
      const entityStore = this.context.getEntityStore(projectId);
      this.graphTraversals.set(projectId, new GraphTraversal(
        this.context.db,
        projectId,
        relationshipStore,
        entityStore
      ));
    }
    return this.graphTraversals.get(projectId)!;
  }

  private async getSearchService(projectId: string): Promise<MultiStrategySearch> {
    if (!this.searchServices.has(projectId)) {
      const entityStore = this.context.getEntityStore(projectId);
      const project = await this.context.projectManager.get(projectId);
      const embeddingManager = this.context.getEmbeddingManager(projectId, project?.config);
      const graphTraversal = this.getGraphTraversal(projectId);
      this.searchServices.set(projectId, new MultiStrategySearch(
        entityStore,
        embeddingManager,
        graphTraversal
      ));
    }
    return this.searchServices.get(projectId)!;
  }

  private getCheckpointManager(projectId: string): CheckpointManager {
    if (!this.checkpointManagers.has(projectId)) {
      this.checkpointManagers.set(projectId, new CheckpointManager(this.context.db, projectId));
    }
    return this.checkpointManagers.get(projectId)!;
  }

  private getQueryLogger(projectId: string): QueryLogger {
    if (!this.queryLoggers.has(projectId)) {
      const logger = new QueryLogger(this.context.db);
      logger.ensureTablesExist();
      this.queryLoggers.set(projectId, logger);
    }
    return this.queryLoggers.get(projectId)!;
  }

  // ─────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT
  // ─────────────────────────────────────────────────────────

  async createProject(name: string, path: string, config?: Partial<ProjectConfig>): Promise<Project> {
    return this.context.projectManager.create(name, path, config);
  }

  async getProject(nameOrId: string): Promise<Project | null> {
    return this.context.projectManager.get(nameOrId);
  }

  async listProjects(): Promise<Project[]> {
    return this.context.projectManager.list();
  }

  async setActiveProject(nameOrId: string): Promise<void> {
    await this.context.projectManager.setActive(nameOrId);
  }

  async deleteProject(nameOrId: string, keepData?: boolean): Promise<void> {
    await this.context.projectManager.delete(nameOrId, keepData);
    // Clear cached services
    const project = await this.context.projectManager.get(nameOrId);
    if (project) {
      this.clearProjectCache(project.id);
    }
  }

  async getActiveProject(): Promise<Project | null> {
    return this.context.projectManager.getActive();
  }

  // ─────────────────────────────────────────────────────────
  // ENTITY MANAGEMENT
  // ─────────────────────────────────────────────────────────

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

    // Generate embedding if content provided
    if (input.content) {
      const project = await this.context.projectManager.get(projectId);
      const embeddingManager = this.context.getEmbeddingManager(projectId, project?.config);
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

  // ─────────────────────────────────────────────────────────
  // CODEBASE INDEXING
  // ─────────────────────────────────────────────────────────

  async indexCodebase(projectId: string, path: string, options?: IndexOptions): Promise<IndexResult> {
    const startTime = Date.now();
    const indexer = this.getIndexer(projectId, path);

    const result = await indexer.indexAll({
      exclude: options?.ignore,
      force: options?.force
    });

    // Update project last indexed timestamp
    await this.context.projectManager.update(projectId, { lastIndexedAt: new Date() });

    return {
      filesProcessed: result.added.length + result.modified.length + result.unchanged.length,
      entitiesCreated: result.added.length,
      entitiesUpdated: result.modified.length,
      relationshipsCreated: 0, // Would need to track from relationship extractor
      errors: result.errors,
      durationMs: Date.now() - startTime
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

  async syncFromGit(projectId: string, options?: GitSyncOptions): Promise<SyncResult> {
    // For now, do a full update - incremental git sync would require git integration
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
      filesIndexed: 0, // Would need to track separately
      entitiesCount: entities.length > 0 ? await entityStore.count() : 0,
      isStale: !project?.lastIndexedAt ||
        (Date.now() - project.lastIndexedAt.getTime()) > 24 * 60 * 60 * 1000
    };
  }

  // ─────────────────────────────────────────────────────────
  // CONVERSATION MEMORY
  // ─────────────────────────────────────────────────────────

  async createSession(projectId: string, name?: string): Promise<Session> {
    const sessionManager = this.getSessionManager(projectId);
    return sessionManager.create(name);
  }

  async getSession(projectId: string, sessionId: string): Promise<Session | null> {
    const sessionManager = this.getSessionManager(projectId);
    return sessionManager.get(sessionId);
  }

  async listSessions(projectId: string, options?: SessionListOptions): Promise<Session[]> {
    const sessionManager = this.getSessionManager(projectId);
    return sessionManager.list(options?.status);
  }

  async archiveSession(projectId: string, sessionId: string): Promise<void> {
    const sessionManager = this.getSessionManager(projectId);
    sessionManager.archive(sessionId);
  }

  async storeMessage(projectId: string, sessionId: string, message: CreateMessageInput): Promise<Message> {
    const messageStore = this.getMessageStore(projectId);
    return messageStore.create({
      sessionId,
      role: message.role,
      content: message.content,
      metadata: message.metadata
    });
  }

  async getMessages(projectId: string, sessionId: string, options?: { limit?: number; before?: string }): Promise<Message[]> {
    const messageStore = this.getMessageStore(projectId);
    return messageStore.getBySession(sessionId, options);
  }

  async getHistory(projectId: string, options?: HistoryOptions): Promise<Message[]> {
    const messageStore = this.getMessageStore(projectId);
    if (options?.sessionId) {
      return messageStore.getBySession(options.sessionId, { limit: options.limit, before: options.before });
    }
    return messageStore.getRecent(options?.limit || 10);
  }

  async summarizeSession(projectId: string, sessionId: string): Promise<string> {
    const messageStore = this.getMessageStore(projectId);
    const messages = await messageStore.getBySession(sessionId);

    // Simple summary - would use LLM in production
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;

    const summary = `Session with ${userMessages} user messages and ${assistantMessages} assistant responses. ` +
      `Topics discussed: ${messages.slice(0, 3).map(m => m.content.slice(0, 50)).join(', ')}...`;

    // Mark session as summarized
    const sessionManager = this.getSessionManager(projectId);
    sessionManager.markSummarized(sessionId, summary);

    return summary;
  }

  async searchDecisions(projectId: string, query: string, options?: DecisionSearchOptions): Promise<Decision[]> {
    const messageStore = this.getMessageStore(projectId);
    const messages = await messageStore.search(query, { limit: options?.limit || 10 });

    // Filter messages that look like decisions
    const decisionKeywords = ['decided', 'decision', 'agreed', 'will use', 'chose', 'choosing'];
    const decisions: Decision[] = messages
      .filter(m => decisionKeywords.some(kw => m.content.toLowerCase().includes(kw)))
      .map(m => ({
        id: m.id,
        sessionId: m.sessionId,
        messageId: m.id,
        description: m.content,
        context: '',
        relatedEntities: [],
        createdAt: m.createdAt
      }));

    return decisions;
  }

  // ─────────────────────────────────────────────────────────
  // GRAPH RAG
  // ─────────────────────────────────────────────────────────

  async addRelationship(projectId: string, input: CreateRelationshipInput): Promise<{ id: string }> {
    const relationshipStore = this.getRelationshipStore(projectId);
    const relationship = await relationshipStore.create({
      sourceId: input.sourceId,
      targetId: input.targetId,
      relationship: input.type as any,
      weight: input.weight,
      metadata: input.metadata
    });
    return { id: relationship.id };
  }

  async getRelationships(projectId: string, entityId: string, options?: RelationshipQueryOptions): Promise<any[]> {
    const relationshipStore = this.getRelationshipStore(projectId);
    return relationshipStore.getForEntity(entityId, 'both', {
      types: options?.types as any,
      minWeight: options?.minWeight,
      limit: options?.limit
    });
  }

  async queryGraph(projectId: string, startEntityId: string, options?: GraphQueryOptions): Promise<GraphQueryResult> {
    const graphTraversal = this.getGraphTraversal(projectId);
    const entityStore = this.context.getEntityStore(projectId);

    const neighborhood = await graphTraversal.getNeighborhood(startEntityId, {
      maxDepth: options?.depth || 2,
      direction: options?.direction || 'both',
      types: options?.relationships as any
    });

    // Get entity details
    const entities: GraphQueryResult['entities'] = [];
    for (const rel of neighborhood.relationships) {
      const targetId = rel.source === startEntityId ? rel.target : rel.source;
      const entity = await entityStore.get(targetId);
      if (entity && !entities.find(e => e.id === entity.id)) {
        entities.push({
          id: entity.id,
          name: entity.name,
          type: entity.type,
          depth: 1 // Would need to calculate actual depth
        });
      }
    }

    return {
      startEntity: startEntityId,
      entities,
      relationships: neighborhood.relationships.map((r, idx) => ({
        id: `rel-${idx}`,
        source: r.source,
        target: r.target,
        type: r.type,
        weight: r.weight
      })),
      totalNodes: entities.length + 1,
      totalEdges: neighborhood.relationships.length
    };
  }

  async getGraphStats(projectId: string): Promise<GraphStats> {
    const relationshipStore = this.getRelationshipStore(projectId);
    const stats = await relationshipStore.getStatsByType();
    const avgDegree = await relationshipStore.getAverageDegree();
    const totalEdges = await relationshipStore.count();

    return {
      totalNodes: 0, // Would need entity count
      totalEdges,
      averageDegree: avgDegree,
      byType: stats
    };
  }

  // ─────────────────────────────────────────────────────────
  // CONTEXT RETRIEVAL
  // ─────────────────────────────────────────────────────────

  async queryContext(projectId: string, query: string, options?: QueryOptions): Promise<ContextResult> {
    const startTime = Date.now();
    const searchService = await this.getSearchService(projectId);

    const results = await searchService.search(query, {
      strategies: options?.strategies,
      limit: 20,
      entityTypes: options?.includeTypes as EntityType[],
      minScore: options?.minScore
    });

    const assembler = new ContextAssembler();
    const assembled = assembler.assemble(results, {
      maxTokens: options?.maxTokens || 4000,
      includeSources: options?.includeSources ?? true,
      format: 'markdown'
    });

    // Calculate average relevance
    const avgRelevance = results.length > 0
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length
      : 0;

    // Log query for analytics
    const queryLogger = this.getQueryLogger(projectId);
    await queryLogger.logQuery(projectId, query, {
      totalTokens: assembled.tokenCount,
      averageRelevance: avgRelevance,
      items: results.map(r => ({ type: r.entity.type })),
      strategiesUsed: options?.strategies || ['keyword', 'semantic']
    }, {
      latencyMs: Date.now() - startTime
    });

    return {
      context: assembled.context,
      sources: assembled.sources,
      confidence: avgRelevance,
      tokensUsed: assembled.tokenCount,
      truncated: assembled.truncated
    };
  }

  // ─────────────────────────────────────────────────────────
  // AGENT PATTERNS
  // ─────────────────────────────────────────────────────────

  async saveCheckpoint(
    projectId: string,
    sessionId: string,
    state: unknown,
    metadata?: Record<string, unknown>
  ): Promise<Checkpoint> {
    const checkpointManager = this.getCheckpointManager(projectId);

    // Wrap state in AgentState format
    const agentState: AgentState = {
      query: '',
      plan: [],
      currentStepIndex: 0,
      results: [],
      context: state as Record<string, unknown>
    };

    return checkpointManager.save(sessionId, agentState, {
      description: metadata?.description as string,
      triggerType: (metadata?.triggerType as any) || 'manual'
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

  // Simplified memory operations (would need full MemoryTierManager in production)
  async spillMemory(projectId: string, sessionId: string, options?: SpillOptions): Promise<SpillResult> {
    // Placeholder - would implement with MemoryTierManager
    return { spilledCount: 0, tokensFreed: 0 };
  }

  async recallMemory(projectId: string, sessionId: string, query: string): Promise<RecallResult> {
    // Placeholder - would implement with MemoryTierManager
    return { items: [], tokensRecalled: 0 };
  }

  async getMemoryStatus(projectId: string, sessionId: string): Promise<MemoryStatus> {
    // Placeholder - would implement with MemoryTierManager
    return { hotCount: 0, coldCount: 0, hotTokens: 0, coldTokens: 0 };
  }

  // Simplified reflection operations (would need full ReflectionStore in production)
  async storeReflection(projectId: string, sessionId: string, input: CreateReflectionInput): Promise<{ id: string }> {
    // Store as a message with reflection metadata for now
    const messageStore = this.getMessageStore(projectId);
    const message = await messageStore.create({
      sessionId,
      role: 'system',
      content: input.content,
      metadata: {
        type: 'reflection',
        reflectionType: input.type,
        outcome: input.outcome,
        tags: input.tags
      }
    });
    return { id: message.id };
  }

  async getReflections(projectId: string, sessionId: string, options?: ReflectionQueryOptions): Promise<any[]> {
    const messageStore = this.getMessageStore(projectId);
    const messages = await messageStore.getBySession(sessionId);
    return messages
      .filter(m => m.metadata?.type === 'reflection')
      .slice(0, options?.limit || 10);
  }

  async searchReflections(projectId: string, query: string): Promise<any[]> {
    const messageStore = this.getMessageStore(projectId);
    const messages = await messageStore.search(query);
    return messages.filter(m => m.metadata?.type === 'reflection');
  }

  // ─────────────────────────────────────────────────────────
  // ANALYTICS
  // ─────────────────────────────────────────────────────────

  async getAnalytics(projectId: string, period: AnalyticsPeriod): Promise<AnalyticsStats> {
    const queryLogger = this.getQueryLogger(projectId);
    const stats = await queryLogger.getStats(projectId, period);

    return {
      period: stats.period,
      totalQueries: stats.totalQueries,
      tokensSaved: stats.totalTokensSaved,
      costSaved: stats.totalCostSaved,
      savingsPercent: stats.savingsPercent,
      averageRelevance: stats.averageRelevance
    };
  }

  async getDashboardData(projectId: string): Promise<DashboardData> {
    const queryLogger = this.getQueryLogger(projectId);
    const stats = await queryLogger.getStats(projectId, 'week');
    const recentLogs = await queryLogger.getRecentLogs(projectId, 10);

    return {
      stats: {
        period: stats.period,
        totalQueries: stats.totalQueries,
        tokensSaved: stats.totalTokensSaved,
        costSaved: stats.totalCostSaved,
        savingsPercent: stats.savingsPercent,
        averageRelevance: stats.averageRelevance
      },
      recentQueries: recentLogs.map(log => ({
        id: log.id,
        query: log.query,
        tokensRetrieved: log.tokensRetrieved,
        tokensSaved: log.tokensSaved,
        timestamp: log.timestamp
      })),
      topEntities: [] // Would need to aggregate from logs
    };
  }

  async recordFeedback(projectId: string, queryLogId: string, wasUseful: boolean): Promise<void> {
    const queryLogger = this.getQueryLogger(projectId);
    await queryLogger.recordFeedback(queryLogId, wasUseful);
  }

  // ─────────────────────────────────────────────────────────
  // GIT HOOKS (Simplified)
  // ─────────────────────────────────────────────────────────

  async installHooks(projectId: string, repoPath: string, config?: HookConfig): Promise<void> {
    // Would use HookInstaller in production
    // Stub implementation - actual git hooks would be written to .git/hooks/
    // For now, this is a no-op placeholder
  }

  async getImpactReport(projectId: string, baseBranch: string, targetBranch: string): Promise<ImpactReport> {
    // Would use ImpactAnalyzer in production
    return {
      riskLevel: 'low',
      filesChanged: 0,
      entitiesAffected: 0,
      decisionsAffected: 0,
      suggestions: [],
      affectedEntities: []
    };
  }

  // ─────────────────────────────────────────────────────────
  // DOCUMENTS (Simplified)
  // ─────────────────────────────────────────────────────────

  async indexDocument(projectId: string, path: string, options?: DocumentIndexOptions): Promise<DocumentResult> {
    // Would use MarkdownParser and RequirementExtractor in production
    const entityStore = this.context.getEntityStore(projectId);

    // Create a document entity
    const entity = await entityStore.create({
      type: 'document',
      name: path.split('/').pop() || path,
      qualifiedName: path,
      filePath: path
    });

    return {
      entityId: entity.id,
      sectionsCreated: 0,
      requirementsExtracted: 0,
      codeLinksCreated: 0
    };
  }

  // ─────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────

  /**
   * Clear cached services for a project.
   */
  clearProjectCache(projectId: string): void {
    this.indexers.delete(projectId);
    this.sessionManagers.delete(projectId);
    this.messageStores.delete(projectId);
    this.relationshipStores.delete(projectId);
    this.graphTraversals.delete(projectId);
    this.searchServices.delete(projectId);
    this.checkpointManagers.delete(projectId);
    this.queryLoggers.delete(projectId);
    this.context.clearProjectCache(projectId);
  }

  /**
   * Resolve entity ID from name or ID.
   */
  async resolveEntityId(projectId: string, nameOrId: string): Promise<string> {
    const entityStore = this.context.getEntityStore(projectId);

    // Try as ID first
    const byId = await entityStore.get(nameOrId);
    if (byId) return byId.id;

    // Try as qualified name
    const byName = await entityStore.getByQualifiedName(nameOrId);
    if (byName) return byName.id;

    // Try as name search
    const searchResults = await entityStore.search(nameOrId, { limit: 1 });
    if (searchResults.length > 0) return searchResults[0].id;

    throw new Error(`Entity not found: ${nameOrId}`);
  }
}
