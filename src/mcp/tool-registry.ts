import { AppContext } from '../context';
import { EntityType } from '../entities/types';
import { CoreService } from '../services';
import { ProjectConfig } from '../project/types';
import { isIndexDepth, isDocumentType, isSearchStrategy, isHookType, isGraphRelationshipType, asGraphRelationshipType } from '../utils/type-guards';

/**
 * Tool definition for MCP.
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

interface RegisteredTool {
  definition: Tool;
  handler: ToolHandler;
}

/**
 * F10i.9: Consolidated MCP tool registry.
 * 30 tools → 12 action-based tools.
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private coreService: CoreService;

  constructor(private context: AppContext) {
    this.coreService = new CoreService(context);
    this.registerAllTools();
  }

  register(definition: Tool, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return tool.handler(args);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getCoreService(): CoreService {
    return this.coreService;
  }

  private requireParams(args: Record<string, unknown>, required: string[]): void {
    const missing = required.filter(p => args[p] === undefined || args[p] === null);
    if (missing.length > 0) {
      throw new Error(`Missing required parameter(s) for action "${args.action}": ${missing.join(', ')}`);
    }
  }

  private registerAllTools(): void {
    this.registerProjectTool();
    this.registerEntityTool();
    this.registerIndexTool();
    this.registerSessionTool();
    this.registerMessageTool();
    this.registerDecisionTool();
    this.registerGraphTool();
    this.registerContextQueryTool();
    this.registerCheckpointTool();
    this.registerMemoryTool();
    this.registerReflectionTool();
    this.registerHooksTool();
  }

  // ── 1. project ───────────────────────────────────────────

  private registerProjectTool(): void {
    this.register(
      {
        name: 'project',
        description: 'Manage projects. Actions: create (register a project), list (show all), set_active (set working project), delete (remove a project)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['create', 'list', 'set_active', 'delete'], description: 'The operation to perform' },
            name: { type: 'string', description: 'Project name (required for: create, set_active, delete)' },
            path: { type: 'string', description: 'Project root path (required for: create)' },
            config: { type: 'object', description: 'Optional configuration (for: create)' },
            keep_data: { type: 'boolean', description: 'Keep data when deleting (for: delete)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        switch (a.action) {
          case 'create': {
            this.requireParams(a, ['name', 'path']);
            const project = await this.coreService.createProject(a.name, a.path, a.config as Partial<ProjectConfig>);
            return { success: true, project: { id: project.id, name: project.name, path: project.path } };
          }
          case 'list': {
            const projects = await this.coreService.listProjects();
            const active = await this.coreService.getActiveProject();
            return {
              projects: projects.map(p => ({
                name: p.name, path: p.path,
                lastIndexed: p.lastIndexedAt?.toISOString(),
                isActive: p.id === active?.id,
              })),
              activeProject: active?.name,
            };
          }
          case 'set_active': {
            this.requireParams(a, ['name']);
            await this.coreService.setActiveProject(a.name);
            return { success: true, activeProject: a.name };
          }
          case 'delete': {
            this.requireParams(a, ['name']);
            await this.coreService.deleteProject(a.name, a.keep_data);
            return { success: true, deleted: a.name };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: create, list, set_active, delete`);
        }
      },
    );
  }

  // ── 2. entity ────────────────────────────────────────────

  private registerEntityTool(): void {
    this.register(
      {
        name: 'entity',
        description: 'Manage entities. Actions: add (create entity), get (by ID or qualified name), search (text query), delete',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'get', 'search', 'delete'], description: 'The operation to perform' },
            type: { type: 'string', description: 'Entity type (for: add, search filter)' },
            name: { type: 'string', description: 'Entity name (for: add)' },
            content: { type: 'string', description: 'Entity content (for: add)' },
            summary: { type: 'string', description: 'Brief summary (for: add)' },
            metadata: { type: 'object', description: 'Additional metadata (for: add)' },
            id: { type: 'string', description: 'Entity ID (for: get, delete)' },
            qualified_name: { type: 'string', description: 'Qualified name (for: get)' },
            query: { type: 'string', description: 'Search query (for: search)' },
            limit: { type: 'number', description: 'Max results (for: search, default: 10)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'add': {
            this.requireParams(a, ['type', 'name']);
            const entity = await this.coreService.addEntity(projectId, {
              type: a.type as EntityType, name: a.name,
              content: a.content, summary: a.summary, metadata: a.metadata,
            });
            return { success: true, entity: { id: entity.id, type: entity.type, name: entity.name } };
          }
          case 'get': {
            if (!a.id && !a.qualified_name) throw new Error('Either id or qualified_name is required');
            const entity = a.id
              ? await this.coreService.getEntity(projectId, a.id)
              : await this.coreService.getEntityByName(projectId, a.qualified_name);
            if (!entity) return { success: false, error: 'Entity not found' };
            return { success: true, entity };
          }
          case 'search': {
            this.requireParams(a, ['query']);
            const entities = await this.coreService.searchEntities(projectId, a.query, {
              type: a.type as EntityType, limit: a.limit || 10,
            });
            return {
              success: true, count: entities.length,
              entities: entities.map(e => ({ id: e.id, type: e.type, name: e.name, qualifiedName: e.qualifiedName, summary: e.summary })),
            };
          }
          case 'delete': {
            this.requireParams(a, ['id']);
            await this.coreService.deleteEntity(projectId, a.id);
            return { success: true, deleted: a.id };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: add, get, search, delete`);
        }
      },
    );
  }

  // ── 3. index ─────────────────────────────────────────────

  private registerIndexTool(): void {
    this.register(
      {
        name: 'index',
        description: 'Index code and documents. Actions: codebase (full index), document (single doc), sync (git changes), status (check index state)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['codebase', 'document', 'sync', 'status'], description: 'The operation to perform' },
            path: { type: 'string', description: 'Path to codebase or document (for: codebase, document)' },
            depth: { type: 'string', description: 'Indexing depth (for: codebase)' },
            ignore: { type: 'array', items: { type: 'string' }, description: 'Patterns to ignore (for: codebase)' },
            languages: { type: 'array', items: { type: 'string' }, description: 'Languages to index (for: codebase)' },
            force: { type: 'boolean', description: 'Force re-index (for: codebase)' },
            type: { type: 'string', description: 'Document type (for: document)' },
            link_to_code: { type: 'boolean', description: 'Link to code entities (for: document, default: true)' },
            since: { type: 'string', description: 'Commit SHA (for: sync)' },
            summarize: { type: 'boolean', description: 'Generate summaries (for: sync)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'codebase': {
            const proj = await this.coreService.getProject(projectId);
            const indexPath = a.path || proj?.path;
            if (!indexPath) throw new Error('No path specified and project has no path');
            const result = await this.coreService.indexCodebase(projectId, indexPath, {
              depth: a.depth && isIndexDepth(a.depth) ? a.depth : undefined,
              ignore: a.ignore, languages: a.languages, force: a.force,
            });
            return { success: true, ...result };
          }
          case 'document': {
            this.requireParams(a, ['path']);
            const result = await this.coreService.indexDocument(projectId, a.path, {
              type: a.type && isDocumentType(a.type) ? a.type : undefined,
              linkToCode: a.link_to_code ?? true,
            });
            return { success: true, ...result };
          }
          case 'sync': {
            const result = await this.coreService.syncFromGit(projectId, { since: a.since, summarize: a.summarize });
            return { success: true, ...result };
          }
          case 'status': {
            const status = await this.coreService.getIndexStatus(projectId);
            return { success: true, ...status };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: codebase, document, sync, status`);
        }
      },
    );
  }

  // ── 4. session ───────────────────────────────────────────

  private registerSessionTool(): void {
    this.register(
      {
        name: 'session',
        description: 'Manage conversation sessions. Actions: create, list, archive, summarize',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['create', 'list', 'archive', 'summarize'], description: 'The operation to perform' },
            session: { type: 'string', description: 'Session ID (for: archive, summarize)' },
            name: { type: 'string', description: 'Session name (for: create)' },
            status: { type: 'string', enum: ['active', 'archived', 'summarized'], description: 'Filter by status (for: list)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'create': {
            const session = await this.coreService.createSession(projectId, a.name);
            return { success: true, session: { id: session.id, name: session.name } };
          }
          case 'list': {
            const sessions = await this.coreService.listSessions(projectId, { status: a.status });
            return {
              success: true, count: sessions.length,
              sessions: sessions.map(s => ({
                id: s.id, name: s.name, status: s.status,
                messageCount: s.messageCount, createdAt: s.createdAt.toLocaleString(),
              })),
            };
          }
          case 'archive': {
            this.requireParams(a, ['session']);
            await this.coreService.archiveSession(projectId, a.session);
            return { success: true, archived: a.session };
          }
          case 'summarize': {
            this.requireParams(a, ['session']);
            const summary = await this.coreService.summarizeSession(projectId, a.session);
            return { success: true, sessionId: a.session, summary };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: create, list, archive, summarize`);
        }
      },
    );
  }

  // ── 5. message ───────────────────────────────────────────

  private registerMessageTool(): void {
    this.register(
      {
        name: 'message',
        description: 'Store and retrieve conversation messages. Actions: store (save a message), history (get messages)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['store', 'history'], description: 'The operation to perform' },
            content: { type: 'string', description: 'Message content (for: store)' },
            role: { type: 'string', enum: ['user', 'assistant', 'system'], description: 'Message role (for: store)' },
            session: { type: 'string', description: 'Session ID (auto-creates if not specified)' },
            metadata: { type: 'object', description: 'Additional metadata (for: store)' },
            limit: { type: 'number', description: 'Max messages (for: history, default: 50)' },
            before: { type: 'string', description: 'Get messages before this ID (for: history)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'store': {
            this.requireParams(a, ['content', 'role']);
            let sessionId: string;
            if (!a.session) {
              const newSession = await this.coreService.createSession(projectId);
              sessionId = newSession.id;
            } else {
              sessionId = await this.resolveSessionId(projectId, a.session);
            }
            const message = await this.coreService.storeMessage(projectId, sessionId, {
              role: a.role, content: a.content, metadata: a.metadata,
            });
            return { success: true, message: { id: message.id, sessionId: message.sessionId } };
          }
          case 'history': {
            const messages = await this.coreService.getHistory(projectId, {
              sessionId: a.session, limit: a.limit || 50, before: a.before,
            });
            return {
              success: true, count: messages.length,
              messages: messages.map(m => ({
                id: m.id, role: m.role, content: m.content,
                sessionId: m.sessionId, timestamp: m.createdAt.toLocaleString(),
                timestampUtc: m.createdAt.toISOString(),
              })),
            };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: store, history`);
        }
      },
    );
  }

  // ── 6. decision ──────────────────────────────────────────

  private registerDecisionTool(): void {
    this.register(
      {
        name: 'decision',
        description: 'Search and create architectural decisions. Actions: search, create',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['search', 'create'], description: 'The operation to perform' },
            query: { type: 'string', description: 'Search query (for: search)' },
            limit: { type: 'number', description: 'Max results (for: search, default: 10)' },
            session: { type: 'string', description: 'Session ID (for: create)' },
            description: { type: 'string', description: 'Decision description (for: create)' },
            context: { type: 'string', description: 'Decision context (for: create)' },
            alternatives: { type: 'array', items: { type: 'string' }, description: 'Alternatives considered (for: create)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'search': {
            this.requireParams(a, ['query']);
            const decisions = await this.coreService.searchDecisions(projectId, a.query, { limit: a.limit || 10 });
            return {
              success: true, count: decisions.length,
              decisions: decisions.map(d => ({
                id: d.id, description: d.description,
                sessionId: d.sessionId, timestamp: d.createdAt.toISOString(),
              })),
            };
          }
          case 'create': {
            this.requireParams(a, ['description']);
            const sessionId = a.session ? await this.resolveSessionId(projectId, a.session) : (await this.coreService.createSession(projectId)).id;
            const decision = await this.coreService.createDecision(projectId, {
              sessionId, description: a.description,
              context: a.context, alternatives: a.alternatives,
            });
            return { success: true, decision: { id: decision.id, sessionId: decision.sessionId } };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: search, create`);
        }
      },
    );
  }

  // ── 7. graph ─────────────────────────────────────────────

  private registerGraphTool(): void {
    this.register(
      {
        name: 'graph',
        description: 'Manage entity relationships. Actions: link (create relationship), query (traverse graph), stats (get statistics)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['link', 'query', 'stats'], description: 'The operation to perform' },
            source: { type: 'string', description: 'Source entity ID or name (for: link)' },
            target: { type: 'string', description: 'Target entity ID or name (for: link)' },
            type: { type: 'string', description: 'Relationship type (for: link)' },
            weight: { type: 'number', description: 'Relationship strength 0-1 (for: link, default: 1.0)' },
            metadata: { type: 'object', description: 'Relationship metadata (for: link)' },
            entity: { type: 'string', description: 'Starting entity ID or name (for: query)' },
            depth: { type: 'number', description: 'Max hops (for: query, default: 2)' },
            relationships: { type: 'array', items: { type: 'string' }, description: 'Filter relationship types (for: query)' },
            direction: { type: 'string', enum: ['in', 'out', 'both'], description: 'Traversal direction (for: query)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'link': {
            this.requireParams(a, ['source', 'target', 'type']);
            const sourceId = await this.coreService.resolveEntityId(projectId, a.source);
            const targetId = await this.coreService.resolveEntityId(projectId, a.target);
            const result = await this.coreService.addRelationship(projectId, {
              sourceId, targetId, type: asGraphRelationshipType(a.type),
              weight: a.weight ?? 1.0, metadata: a.metadata,
            });
            return { success: true, relationship: result };
          }
          case 'query': {
            this.requireParams(a, ['entity']);
            const entityId = await this.coreService.resolveEntityId(projectId, a.entity);
            const result = await this.coreService.queryGraph(projectId, entityId, {
              depth: a.depth ?? 2,
              relationships: a.relationships?.filter(isGraphRelationshipType),
              direction: a.direction ?? 'both',
            });
            return { success: true, ...result };
          }
          case 'stats': {
            const stats = await this.coreService.getGraphStats(projectId);
            return { success: true, ...stats };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: link, query, stats`);
        }
      },
    );
  }

  // ── 8. context_query (unchanged) ─────────────────────────

  private registerContextQueryTool(): void {
    this.register(
      {
        name: 'context_query',
        description: 'Query for relevant context using hybrid RAG (vector + graph + keyword). Defaults: expand=true (auto-includes related entities), gate=true (skips trivial queries).',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
            max_tokens: { type: 'number', description: 'Token budget for response (default: 4000)' },
            strategies: { type: 'array', items: { type: 'string', enum: ['keyword', 'semantic', 'graph'] }, description: 'Search strategies to use (default: all)' },
            include_types: { type: 'array', items: { type: 'string' }, description: 'Entity types to include' },
            include_sources: { type: 'boolean', description: 'Include source attribution (default: true)' },
            min_score: { type: 'number', description: 'Minimum relevance score 0-1 (default: 0.3)' },
            expand: { type: 'boolean', description: 'Auto-include parent classes, imports, type definitions' },
            expand_tokens: { type: 'number', description: 'Token budget for expansion (default: 2000)' },
            decompose: { type: 'boolean', description: 'Break complex queries into sub-queries' },
            gate: { type: 'boolean', description: 'Skip retrieval for trivial queries' },
            hyde: { type: 'boolean', description: 'Use HyDE for better semantic search' },
            hyde_model: { type: 'string', description: 'Model for HyDE generation' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['query'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        const result = await this.coreService.queryContext(projectId, a.query, {
          maxTokens: a.max_tokens ?? 4000,
          strategies: a.strategies?.filter(isSearchStrategy),
          includeTypes: a.include_types,
          includeSources: a.include_sources ?? true,
          minScore: a.min_score,
          expand: a.expand ?? true,
          expandTokens: a.expand_tokens,
          decompose: a.decompose,
          gate: a.gate ?? true,
          hyde: a.hyde,
          hydeModel: a.hyde_model,
        });
        return {
          success: true,
          context: result.context, sources: result.sources,
          confidence: result.confidence, tokensUsed: result.tokensUsed,
          truncated: result.truncated,
        };
      },
    );
  }

  // ── 9. checkpoint ────────────────────────────────────────

  private registerCheckpointTool(): void {
    this.register(
      {
        name: 'checkpoint',
        description: 'Manage agent state checkpoints. Actions: save, load, list, delete',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['save', 'load', 'list', 'delete'], description: 'The operation to perform' },
            session: { type: 'string', description: 'Session/task ID (for: save, load, list)' },
            state: { type: 'object', description: 'Agent state to save (for: save)' },
            description: { type: 'string', description: 'Checkpoint description (for: save)' },
            checkpoint_id: { type: 'string', description: 'Checkpoint ID (for: load specific, delete)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'save': {
            this.requireParams(a, ['session', 'state']);
            const checkpoint = await this.coreService.saveCheckpoint(projectId, a.session, a.state, { description: a.description });
            return { success: true, checkpointId: checkpoint.id, stepNumber: checkpoint.stepNumber };
          }
          case 'load': {
            this.requireParams(a, ['session']);
            const checkpoint = await this.coreService.loadCheckpoint(projectId, a.session, a.checkpoint_id);
            if (!checkpoint) return { success: false, error: 'No checkpoint found' };
            return {
              success: true,
              checkpoint: {
                id: checkpoint.id, stepNumber: checkpoint.stepNumber,
                state: checkpoint.state.context ?? checkpoint.state,
                createdAt: checkpoint.createdAt.toISOString(),
              },
            };
          }
          case 'list': {
            this.requireParams(a, ['session']);
            const checkpoints = await this.coreService.listCheckpoints(projectId, a.session);
            return {
              success: true, count: checkpoints.length,
              checkpoints: checkpoints.map((c: any) => ({
                id: c.id, stepNumber: c.stepNumber,
                description: c.description, createdAt: c.createdAt?.toISOString(),
              })),
            };
          }
          case 'delete': {
            this.requireParams(a, ['checkpoint_id']);
            await this.coreService.deleteCheckpoint(projectId, a.checkpoint_id);
            return { success: true, deleted: a.checkpoint_id };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: save, load, list, delete`);
        }
      },
    );
  }

  // ── 10. memory ───────────────────────────────────────────

  private registerMemoryTool(): void {
    this.register(
      {
        name: 'memory',
        description: 'Manage agent memory tiers. Actions: spill (move to cold storage), recall (retrieve from cold), status (hot/cold distribution)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['spill', 'recall', 'status'], description: 'The operation to perform' },
            session: { type: 'string', description: 'Session ID' },
            query: { type: 'string', description: 'Query for relevant items (for: recall)' },
            threshold: { type: 'number', description: 'Token threshold for spilling (for: spill)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'spill': {
            this.requireParams(a, ['session']);
            const result = await this.coreService.spillMemory(projectId, a.session, { threshold: a.threshold });
            return { success: true, ...result };
          }
          case 'recall': {
            this.requireParams(a, ['session', 'query']);
            const result = await this.coreService.recallMemory(projectId, a.session, a.query);
            return { success: true, ...result };
          }
          case 'status': {
            this.requireParams(a, ['session']);
            const status = await this.coreService.getMemoryStatus(projectId, a.session);
            return { success: true, ...status };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: spill, recall, status`);
        }
      },
    );
  }

  // ── 11. reflection ───────────────────────────────────────

  private registerReflectionTool(): void {
    this.register(
      {
        name: 'reflection',
        description: 'Store and query agent learning reflections. Actions: store, query',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['store', 'query'], description: 'The operation to perform' },
            session: { type: 'string', description: 'Session ID (for: store)' },
            content: { type: 'string', description: 'Reflection content (for: store)' },
            type: { type: 'string', enum: ['lesson', 'observation', 'decision'], description: 'Reflection type (for: store, query filter)' },
            outcome: { type: 'string', enum: ['success', 'failure', 'partial'], description: 'Outcome (for: store, query filter)' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags (for: store)' },
            query: { type: 'string', description: 'Search query (for: query)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'store': {
            this.requireParams(a, ['session', 'content']);
            const sessionId = await this.resolveSessionId(projectId, a.session);
            const reflection = await this.coreService.storeReflection(projectId, sessionId, {
              type: a.type, content: a.content, outcome: a.outcome, tags: a.tags,
            });
            return {
              success: true, reflectionId: reflection.id,
              session_id: reflection.sessionId, outcome: reflection.outcome,
              tags: reflection.tags, created_at: reflection.createdAt.toISOString(),
            };
          }
          case 'query': {
            this.requireParams(a, ['query']);
            const reflections = await this.coreService.searchReflections(projectId, a.query, { type: a.type, outcome: a.outcome });
            return {
              success: true, count: reflections.length,
              reflections: reflections.map(r => ({
                id: r.id, content: r.taskDescription, outcome: r.outcome,
                tags: r.tags, created_at: r.createdAt.toISOString(),
              })),
            };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: store, query`);
        }
      },
    );
  }

  // ── 12. hooks ────────────────────────────────────────────

  private registerHooksTool(): void {
    this.register(
      {
        name: 'hooks',
        description: 'Manage git hooks. Actions: install (set up auto-indexing hooks), impact_report (analyze pending changes)',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['install', 'impact_report'], description: 'The operation to perform' },
            repo_path: { type: 'string', description: 'Git repository path (for: install, default: project path)' },
            hooks: { type: 'array', items: { type: 'string' }, description: 'Hooks to install (for: install, default: post-commit)' },
            base_branch: { type: 'string', description: 'Base branch (for: impact_report, default: main)' },
            target_branch: { type: 'string', description: 'Target branch (for: impact_report, default: HEAD)' },
            project: { type: 'string', description: 'Target project (default: active)' },
          },
          required: ['action'],
        },
      },
      async (args) => {
        const a = args as Record<string, any>;
        const projectId = await this.resolveProjectId(a.project);
        switch (a.action) {
          case 'install': {
            const proj = await this.coreService.getProject(projectId);
            const repoPath = a.repo_path || proj?.path;
            if (!repoPath) throw new Error('No repository path specified');
            const installed = await this.coreService.installHooks(projectId, repoPath, {
              hooks: a.hooks?.filter(isHookType),
            });
            return { success: true, installed };
          }
          case 'impact_report': {
            const report = await this.coreService.getImpactReport(projectId, a.base_branch || 'main', a.target_branch || 'HEAD');
            return { success: true, ...report };
          }
          default:
            throw new Error(`Unknown action: ${a.action}. Valid: install, impact_report`);
        }
      },
    );
  }

  // ── Utilities ────────────────────────────────────────────

  private async resolveSessionId(projectId: string, session: string): Promise<string> {
    const existing = await this.coreService.getSession(projectId, session);
    if (existing) return existing.id;
    const newSession = await this.coreService.createSession(projectId, session);
    return newSession.id;
  }

  private async resolveProjectId(projectName?: string): Promise<string> {
    if (projectName) {
      const project = await this.coreService.getProject(projectName);
      if (!project) throw new Error(`Project not found: ${projectName}`);
      return project.id;
    }
    const active = await this.coreService.getActiveProject();
    if (active) return active.id;
    const cwd = process.cwd();
    const projects = await this.coreService.listProjects();
    const matching = projects.find(p => cwd.startsWith(p.path));
    if (matching) {
      await this.coreService.setActiveProject(matching.id);
      return matching.id;
    }
    throw new Error('No active project. Use project action=create or project action=set_active first.');
  }
}
