/**
 * Core Service Layer - Unified API for all ctx-sys functionality.
 * Single source of truth for business logic shared between MCP and VS Code.
 */

import { AppContext } from '../context';
import { Project, ProjectConfig } from '../project/types';
import { Entity, EntityType } from '../entities/types';
import { CodebaseIndexer } from '../indexer';
import { SessionManager, MessageStore, MessageInput, DecisionStore } from '../conversation';
import { Session, Message, Decision } from '../conversation/types';
import { RelationshipStore, GraphTraversal } from '../graph';
import { DocumentIndexer } from '../documents/document-indexer';
import { MultiStrategySearch, ContextAssembler, SearchResult, HeuristicReranker, ContextExpander, RetrievalGate, QueryDecomposer } from '../retrieval';
import { CheckpointManager, Checkpoint, AgentState, SaveOptions } from '../agent/checkpoints';
import { MemoryTierManager } from '../agent/memory-tier';
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
  private memoryManagers: Map<string, MemoryTierManager> = new Map();
  private decisionStores: Map<string, DecisionStore> = new Map();

  constructor(private context: AppContext) {}

  private getMemoryManager(projectId: string): MemoryTierManager {
    if (!this.memoryManagers.has(projectId)) {
      this.memoryManagers.set(projectId, new MemoryTierManager(
        this.context.db,
        projectId
      ));
    }
    return this.memoryManagers.get(projectId)!;
  }

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

  private getDecisionStore(projectId: string): DecisionStore {
    if (!this.decisionStores.has(projectId)) {
      this.decisionStores.set(projectId, new DecisionStore(this.context.db, projectId));
    }
    return this.decisionStores.get(projectId)!;
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
        graphTraversal,
        undefined,
        new HeuristicReranker()
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

    let embeddingsGenerated = 0;
    const embeddingErrors: Array<{ path: string; error: string }> = [];

    // Generate embeddings if requested
    if (options?.generateEmbeddings !== false) {
      try {
        const entityStore = this.context.getEntityStore(projectId);
        const embeddingManager = this.context.getEmbeddingManager(projectId);

        // Get all entities that need embeddings
        const entities = await entityStore.list({ limit: 10000 });
        const toEmbed = entities.map((e) => ({
          id: e.id,
          content: `${e.name}: ${e.content || ''}`
        }));

        if (toEmbed.length > 0) {
          await embeddingManager.embedBatch(toEmbed);
          embeddingsGenerated = toEmbed.length;
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
      relationshipsCreated: 0, // Would need to track from relationship extractor
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
    const messages = messageStore.getBySession(sessionId);

    if (messages.length === 0) return 'Empty session.';

    // Try LLM summarization first
    let summary: string;
    try {
      const { LLMSummarizationManager } = await import('../summarization/llm-manager.js');
      const manager = new LLMSummarizationManager();
      const provider = await manager.getProvider();

      if (provider) {
        const transcript = messages
          .map(m => `[${m.role}]: ${m.content}`)
          .join('\n\n');
        summary = await provider.summarize(
          `Summarize this conversation session concisely:\n\n${transcript.slice(0, 4000)}`,
          { entityType: 'session', name: sessionId, maxTokens: 200, temperature: 0.3 }
        );
      } else {
        summary = this.buildTemplateSummary(messages);
      }
    } catch {
      summary = this.buildTemplateSummary(messages);
    }

    // Mark session as summarized
    const sessionManager = this.getSessionManager(projectId);
    sessionManager.markSummarized(sessionId, summary);

    return summary;
  }

  private buildTemplateSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const topics = messages.slice(0, 5).map(m => m.content.slice(0, 80)).join('; ');
    return `Session with ${userMessages} user messages and ${assistantMessages} assistant responses. ` +
      `Topics: ${topics}`;
  }

  async searchDecisions(projectId: string, query: string, options?: DecisionSearchOptions): Promise<Decision[]> {
    const decisionStore = this.getDecisionStore(projectId);
    const limit = options?.limit || 10;

    // Strategy 1: Search persistent decisions table (fast, ranked via FTS5)
    try {
      const decisions = decisionStore.search(query, {
        sessionId: options?.sessionId,
        limit
      });
      if (decisions.length > 0) {
        return decisions;
      }
    } catch {
      // Decisions table may not exist for legacy projects
    }

    // Strategy 2: Fallback to message scanning (for un-processed sessions)
    const messageStore = this.getMessageStore(projectId);
    const seen = new Set<string>();
    const decisions: Decision[] = [];

    const toDecision = (m: Message): Decision => ({
      id: m.id,
      sessionId: m.sessionId,
      messageId: m.id,
      description: m.content,
      context: (m.metadata?.context as string) || '',
      relatedEntities: (m.metadata?.relatedEntities as string[]) || [],
      createdAt: m.createdAt
    });

    // Messages with decision metadata
    const allMessages = messageStore.getRecent(500);
    for (const m of allMessages) {
      if (m.metadata?.type === 'decision') {
        if (!query || m.content.toLowerCase().includes(query.toLowerCase())) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            decisions.push(toDecision(m));
          }
        }
      }
      if (decisions.length >= limit) return decisions;
    }

    // Keyword-based detection in search results
    if (query) {
      const searchResults = messageStore.search(query, { limit: limit * 3 });
      const decisionKeywords = ['decided', 'decision', 'agreed', 'will use', 'chose', 'choosing'];
      for (const m of searchResults) {
        if (!seen.has(m.id) && decisionKeywords.some(kw => m.content.toLowerCase().includes(kw))) {
          seen.add(m.id);
          decisions.push(toDecision(m));
          if (decisions.length >= limit) break;
        }
      }
    }

    return decisions;
  }

  /**
   * Create a persistent decision.
   */
  async createDecision(projectId: string, input: { sessionId: string; messageId?: string; description: string; context?: string; alternatives?: string[]; relatedEntities?: string[] }): Promise<Decision> {
    const decisionStore = this.getDecisionStore(projectId);
    return decisionStore.create({
      sessionId: input.sessionId,
      messageId: input.messageId || '',
      description: input.description,
      context: input.context,
      alternatives: input.alternatives,
      relatedEntities: input.relatedEntities
    });
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
    const entityStore = this.context.getEntityStore(projectId);
    const relationshipStore = this.getRelationshipStore(projectId);
    const stats = await relationshipStore.getStatsByType();
    const avgDegree = await relationshipStore.getAverageDegree();
    const totalEdges = await relationshipStore.count();
    const totalNodes = await entityStore.count();

    return {
      totalNodes,
      totalEdges,
      averageDegree: avgDegree,
      byType: stats
    };
  }

  // ─────────────────────────────────────────────────────────
  // CONTEXT RETRIEVAL
  // ─────────────────────────────────────────────────────────

  async queryContext(projectId: string, query: string, options?: QueryOptions): Promise<ContextResult> {
    // Gate check: skip retrieval for trivial queries (opt-in)
    if (options?.gate) {
      const gate = new RetrievalGate();
      const decision = await gate.shouldRetrieve({ query });
      if (!decision.shouldRetrieve) {
        return {
          context: '',
          sources: [],
          confidence: 0,
          tokensUsed: 0,
          truncated: false
        };
      }
    }

    const searchService = await this.getSearchService(projectId);

    // Query decomposition: break complex queries into sub-queries (opt-in)
    let results: SearchResult[];
    if (options?.decompose) {
      const decomposer = new QueryDecomposer();
      const decomposed = decomposer.decompose(query);

      if (decomposed.wasDecomposed) {
        // Search each sub-query and merge results
        const allResults = new Map<string, SearchResult>();
        for (const sub of decomposed.subQueries) {
          const subResults = await searchService.search(sub.text, {
            strategies: options?.strategies,
            limit: 10,
            entityTypes: options?.includeTypes as EntityType[],
            minScore: options?.minScore
          });
          for (const r of subResults) {
            const existing = allResults.get(r.entity.id);
            const weighted = r.score * sub.weight;
            if (!existing || weighted > existing.score) {
              allResults.set(r.entity.id, { ...r, score: existing ? Math.max(existing.score, weighted) : weighted });
            }
          }
        }
        results = Array.from(allResults.values()).sort((a, b) => b.score - a.score).slice(0, 20);
      } else {
        results = await searchService.search(query, {
          strategies: options?.strategies,
          limit: 20,
          entityTypes: options?.includeTypes as EntityType[],
          minScore: options?.minScore
        });
      }
    } else {
      results = await searchService.search(query, {
        strategies: options?.strategies,
        limit: 20,
        entityTypes: options?.includeTypes as EntityType[],
        minScore: options?.minScore
      });
    }

    // Context expansion: add parent classes, imports, type defs (opt-in)
    if (options?.expand && results.length > 0) {
      const entityStore = this.context.getEntityStore(projectId);
      const relationshipStore = this.getRelationshipStore(projectId);
      const expander = new ContextExpander(entityStore, relationshipStore);
      results = await expander.expand(results, {
        maxExpansionTokens: options?.expandTokens || 2000
      });
    }

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

    // Auto-increment step number from existing checkpoints
    const existing = await checkpointManager.list(sessionId);
    const nextStep = existing.length > 0
      ? Math.max(...existing.map(c => c.stepNumber)) + 1
      : 1;

    // Wrap state in AgentState format
    const agentState: AgentState = {
      query: '',
      plan: [],
      currentStepIndex: nextStep,
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
    let checkpoint: Checkpoint | null;
    if (checkpointId) {
      checkpoint = await checkpointManager.load(checkpointId);
    } else {
      checkpoint = await checkpointManager.loadLatest(sessionId);
    }

    // Unwrap AgentState to return user's state directly in state.context
    // while keeping the full checkpoint structure intact
    return checkpoint;
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
      tokensFreed: result.spilledCount * 100 // estimate
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

  async getMemoryStatus(projectId: string, sessionId: string): Promise<MemoryStatus> {
    const manager = this.getMemoryManager(projectId);
    const status = await manager.getStatus(sessionId);
    return {
      hotCount: status.hot.items,
      coldCount: status.cold.items + status.warm.items,
      hotTokens: status.hot.tokens,
      coldTokens: status.cold.tokens + status.warm.tokens
    };
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

  async searchReflections(projectId: string, query: string, options?: { type?: string; outcome?: string }): Promise<any[]> {
    const messageStore = this.getMessageStore(projectId);
    const messages = messageStore.search(query, { limit: 100 });
    return messages.filter(m => {
      if (m.metadata?.type !== 'reflection') return false;
      if (options?.type && m.metadata?.reflectionType !== options.type) return false;
      if (options?.outcome && m.metadata?.outcome !== options.outcome) return false;
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────
  // GIT HOOKS (Simplified)
  // ─────────────────────────────────────────────────────────

  async installHooks(projectId: string, repoPath: string, config?: HookConfig): Promise<string[]> {
    const fs = await import('fs');
    const path = await import('path');

    const hooksDir = path.join(repoPath, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) {
      throw new Error('Not a git repository or .git/hooks directory not found');
    }

    const hookNames = config?.hooks || ['post-commit'];
    const installed: string[] = [];

    for (const hookName of hookNames) {
      const hookPath = path.join(hooksDir, hookName as string);

      // Check for existing ctx-sys hook
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');
        if (content.includes('ctx-sys')) continue; // Already installed
      }

      const script = `#!/bin/sh\n# ctx-sys-hook: ${hookName}\nctx-sys sync --project ${projectId} 2>/dev/null &\n`;
      fs.writeFileSync(hookPath, script, { mode: 0o755 });
      installed.push(hookName as string);
    }

    return installed;
  }

  async getImpactReport(projectId: string, baseBranch: string, targetBranch: string): Promise<ImpactReport> {
    const projectPath = await this.getProjectPath(projectId);
    const entityStore = this.context.getEntityStore(projectId);

    // Get changed files from git diff
    const { execSync } = await import('child_process');
    let changedFiles: string[];
    try {
      const diff = execSync(
        `git diff --name-only ${baseBranch}...${targetBranch}`,
        { cwd: projectPath, encoding: 'utf-8' }
      );
      changedFiles = diff.trim().split('\n').filter(Boolean);
    } catch {
      // Fallback: try two-dot diff (works when branches share no merge base)
      try {
        const diff = execSync(
          `git diff --name-only ${baseBranch} ${targetBranch}`,
          { cwd: projectPath, encoding: 'utf-8' }
        );
        changedFiles = diff.trim().split('\n').filter(Boolean);
      } catch {
        changedFiles = [];
      }
    }

    // Find affected entities by matching file paths
    const affectedEntities: Array<{ id: string; name: string; type: string }> = [];
    for (const file of changedFiles) {
      const entities = await entityStore.getByFile(file);
      for (const entity of entities) {
        affectedEntities.push({
          id: entity.id,
          name: entity.name,
          type: entity.type,
        });
      }
    }

    // Determine risk level based on scope
    const riskLevel = changedFiles.length > 20 ? 'high'
      : changedFiles.length > 5 ? 'medium'
      : 'low';

    // Generate suggestions
    const suggestions = this.generateImpactSuggestions(changedFiles, affectedEntities);

    return {
      riskLevel,
      filesChanged: changedFiles.length,
      entitiesAffected: affectedEntities.length,
      decisionsAffected: 0,
      suggestions,
      affectedEntities
    };
  }

  private generateImpactSuggestions(
    files: string[],
    entities: Array<{ type: string }>
  ): string[] {
    const suggestions: string[] = [];
    if (files.some(f => f.includes('test'))) {
      suggestions.push('Test files modified - ensure test suite passes');
    }
    if (files.some(f => f.endsWith('.sql') || f.includes('migration'))) {
      suggestions.push('Database changes detected - review migration strategy');
    }
    if (entities.filter(e => e.type === 'class').length > 3) {
      suggestions.push('Multiple class changes - consider integration testing');
    }
    if (files.some(f => f.includes('package.json') || f.includes('tsconfig'))) {
      suggestions.push('Configuration files changed - verify build compatibility');
    }
    return suggestions;
  }

  // ─────────────────────────────────────────────────────────
  // DOCUMENTS (Simplified)
  // ─────────────────────────────────────────────────────────

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
    this.memoryManagers.delete(projectId);
    this.context.clearProjectCache(projectId);
  }

  /**
   * Resolve entity ID from name or ID.
   */
  async resolveEntityId(projectId: string, nameOrId: string): Promise<string> {
    const entityStore = this.context.getEntityStore(projectId);

    // 1. Try as UUID
    const byId = await entityStore.get(nameOrId);
    if (byId) return byId.id;

    // 2. Try as qualified name (exact match)
    const byQualified = await entityStore.getByQualifiedName(nameOrId);
    if (byQualified) return byQualified.id;

    // 3. Try exact name match (prevents wrong entity from fuzzy search)
    const byExactName = await entityStore.getByName(nameOrId);
    if (byExactName) return byExactName.id;

    // 4. Fuzzy search as last resort
    const searchResults = await entityStore.search(nameOrId, { limit: 1 });
    if (searchResults.length > 0) return searchResults[0].id;

    throw new Error(`Entity not found: ${nameOrId}`);
  }
}
