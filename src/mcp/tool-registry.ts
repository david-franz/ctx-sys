import { AppContext } from '../context';
import { EntityType } from '../entities/types';
import { CoreService } from '../services';

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
 * Registry for MCP tools.
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private coreService: CoreService;

  constructor(private context: AppContext) {
    this.coreService = new CoreService(context);
    this.registerAllTools();
  }

  /**
   * Register a tool.
   */
  register(definition: Tool, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * Get all tool definitions.
   */
  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  /**
   * Execute a tool by name.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.handler(args);
  }

  /**
   * Check if a tool exists.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the CoreService instance.
   */
  getCoreService(): CoreService {
    return this.coreService;
  }

  /**
   * Register all tools.
   */
  private registerAllTools(): void {
    this.registerProjectTools();
    this.registerEntityTools();
    this.registerIndexingTools();
    this.registerConversationTools();
    this.registerGraphTools();
    this.registerRetrievalTools();
    this.registerAgentTools();
    this.registerAnalyticsTools();
    this.registerHooksTools();
  }

  // ─────────────────────────────────────────────────────────
  // PROJECT MANAGEMENT
  // ─────────────────────────────────────────────────────────

  private registerProjectTools(): void {
    this.register(
      {
        name: 'create_project',
        description: 'Create a new project for context management',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Unique project name (slug format: lowercase, alphanumeric, hyphens)'
            },
            path: {
              type: 'string',
              description: 'Absolute path to project root directory'
            },
            config: {
              type: 'object',
              description: 'Optional configuration overrides'
            }
          },
          required: ['name', 'path']
        }
      },
      async (args) => {
        const { name, path, config } = args as {
          name: string;
          path: string;
          config?: Record<string, unknown>;
        };
        const project = await this.coreService.createProject(name, path, config as any);
        return { success: true, project: { id: project.id, name: project.name, path: project.path } };
      }
    );

    this.register(
      {
        name: 'list_projects',
        description: 'List all registered projects',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      async () => {
        const projects = await this.coreService.listProjects();
        const active = await this.coreService.getActiveProject();
        return {
          projects: projects.map(p => ({
            name: p.name,
            path: p.path,
            lastIndexed: p.lastIndexedAt?.toISOString(),
            isActive: p.id === active?.id
          })),
          activeProject: active?.name
        };
      }
    );

    this.register(
      {
        name: 'set_active_project',
        description: 'Set the active project for subsequent operations',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Project name or ID'
            }
          },
          required: ['name']
        }
      },
      async (args) => {
        const { name } = args as { name: string };
        await this.coreService.setActiveProject(name);
        return { success: true, activeProject: name };
      }
    );

    this.register(
      {
        name: 'delete_project',
        description: 'Delete a project and optionally its data',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Project name or ID'
            },
            keep_data: {
              type: 'boolean',
              description: 'Keep project data tables (default: false)'
            }
          },
          required: ['name']
        }
      },
      async (args) => {
        const { name, keep_data } = args as { name: string; keep_data?: boolean };
        await this.coreService.deleteProject(name, keep_data);
        return { success: true, deleted: name };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // ENTITY MANAGEMENT
  // ─────────────────────────────────────────────────────────

  private registerEntityTools(): void {
    this.register(
      {
        name: 'add_entity',
        description: 'Add a custom entity (concept, technology, pattern, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Entity type (function, class, concept, technology, pattern, etc.)'
            },
            name: {
              type: 'string',
              description: 'Entity name'
            },
            content: {
              type: 'string',
              description: 'Entity description or content'
            },
            summary: {
              type: 'string',
              description: 'Brief summary of the entity'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata'
            },
            project: {
              type: 'string',
              description: 'Target project name (default: active project)'
            }
          },
          required: ['type', 'name']
        }
      },
      async (args) => {
        const { type, name, content, summary, metadata, project } = args as {
          type: string;
          name: string;
          content?: string;
          summary?: string;
          metadata?: Record<string, unknown>;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const entity = await this.coreService.addEntity(projectId, {
          type: type as EntityType,
          name,
          content,
          summary,
          metadata
        });

        return { success: true, entity: { id: entity.id, type: entity.type, name: entity.name } };
      }
    );

    this.register(
      {
        name: 'get_entity',
        description: 'Get an entity by ID or qualified name',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Entity ID'
            },
            qualified_name: {
              type: 'string',
              description: 'Entity qualified name (e.g., src/file.ts::functionName)'
            },
            project: {
              type: 'string',
              description: 'Target project name (default: active project)'
            }
          }
        }
      },
      async (args) => {
        const { id, qualified_name, project } = args as {
          id?: string;
          qualified_name?: string;
          project?: string;
        };

        if (!id && !qualified_name) {
          throw new Error('Either id or qualified_name is required');
        }

        const projectId = await this.resolveProjectId(project);
        const entity = id
          ? await this.coreService.getEntity(projectId, id)
          : await this.coreService.getEntityByName(projectId, qualified_name!);

        if (!entity) {
          return { success: false, error: 'Entity not found' };
        }

        return { success: true, entity };
      }
    );

    this.register(
      {
        name: 'search_entities',
        description: 'Search entities by text query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            type: {
              type: 'string',
              description: 'Filter by entity type'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)'
            },
            project: {
              type: 'string',
              description: 'Target project name (default: active project)'
            }
          },
          required: ['query']
        }
      },
      async (args) => {
        const { query, type, limit, project } = args as {
          query: string;
          type?: string;
          limit?: number;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const entities = await this.coreService.searchEntities(projectId, query, {
          type: type as EntityType,
          limit: limit || 10
        });

        return {
          success: true,
          count: entities.length,
          entities: entities.map(e => ({
            id: e.id,
            type: e.type,
            name: e.name,
            qualifiedName: e.qualifiedName,
            summary: e.summary
          }))
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // CODEBASE INDEXING
  // ─────────────────────────────────────────────────────────

  private registerIndexingTools(): void {
    this.register(
      {
        name: 'index_codebase',
        description: 'Index a codebase for context retrieval. Parses code files and extracts entities.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to codebase root (default: project path)'
            },
            depth: {
              type: 'string',
              enum: ['full', 'signatures', 'selective'],
              description: 'Indexing depth (default: full)'
            },
            ignore: {
              type: 'array',
              items: { type: 'string' },
              description: 'Patterns to ignore (e.g., node_modules)'
            },
            languages: {
              type: 'array',
              items: { type: 'string' },
              description: 'Languages to index (default: all detected)'
            },
            force: {
              type: 'boolean',
              description: 'Force re-index even if not stale'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { path, depth, ignore, languages, force, project } = args as {
          path?: string;
          depth?: string;
          ignore?: string[];
          languages?: string[];
          force?: boolean;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const proj = await this.coreService.getProject(projectId);
        const indexPath = path || proj?.path;

        if (!indexPath) {
          throw new Error('No path specified and project has no path');
        }

        const result = await this.coreService.indexCodebase(projectId, indexPath, {
          depth: depth as any,
          ignore,
          languages,
          force
        });

        return {
          success: true,
          ...result
        };
      }
    );

    this.register(
      {
        name: 'sync_from_git',
        description: 'Sync codebase index from git changes. Updates entities for changed files.',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              description: 'Commit SHA or "last_sync" (default: last_sync)'
            },
            summarize: {
              type: 'boolean',
              description: 'Generate AI summaries for changed entities'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { since, summarize, project } = args as {
          since?: string;
          summarize?: boolean;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const result = await this.coreService.syncFromGit(projectId, { since, summarize });

        return {
          success: true,
          ...result
        };
      }
    );

    this.register(
      {
        name: 'index_document',
        description: 'Index a documentation file (markdown, requirements, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to document file'
            },
            type: {
              type: 'string',
              enum: ['markdown', 'requirements', 'api_spec'],
              description: 'Document type'
            },
            link_to_code: {
              type: 'boolean',
              description: 'Attempt to link to code entities (default: true)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['path']
        }
      },
      async (args) => {
        const { path, type, link_to_code, project } = args as {
          path: string;
          type?: string;
          link_to_code?: boolean;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const result = await this.coreService.indexDocument(projectId, path, {
          type: type as any,
          linkToCode: link_to_code ?? true
        });

        return {
          success: true,
          ...result
        };
      }
    );

    this.register(
      {
        name: 'get_index_status',
        description: 'Get the current indexing status for a project',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { project } = args as { project?: string };
        const projectId = await this.resolveProjectId(project);
        const status = await this.coreService.getIndexStatus(projectId);

        return {
          success: true,
          ...status
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // CONVERSATION MEMORY
  // ─────────────────────────────────────────────────────────

  private registerConversationTools(): void {
    this.register(
      {
        name: 'store_message',
        description: 'Store a conversation message for context tracking',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Message content'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system'],
              description: 'Message role'
            },
            session: {
              type: 'string',
              description: 'Session ID (creates new if not specified)'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['content', 'role']
        }
      },
      async (args) => {
        const { content, role, session, metadata, project } = args as {
          content: string;
          role: 'user' | 'assistant' | 'system';
          session?: string;
          metadata?: Record<string, unknown>;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);

        // Create session if not specified, or auto-create if provided ID doesn't exist
        let sessionId = session;
        if (!sessionId) {
          const newSession = await this.coreService.createSession(projectId);
          sessionId = newSession.id;
        } else {
          const existing = await this.coreService.getSession(projectId, sessionId);
          if (!existing) {
            const newSession = await this.coreService.createSession(projectId, sessionId);
            sessionId = newSession.id;
          }
        }

        const message = await this.coreService.storeMessage(projectId, sessionId, {
          role,
          content,
          metadata
        });

        return {
          success: true,
          message: { id: message.id, sessionId: message.sessionId }
        };
      }
    );

    this.register(
      {
        name: 'get_history',
        description: 'Get conversation history',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session ID (default: most recent)'
            },
            limit: {
              type: 'number',
              description: 'Maximum messages to return (default: 50)'
            },
            before: {
              type: 'string',
              description: 'Get messages before this message ID'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { session, limit, before, project } = args as {
          session?: string;
          limit?: number;
          before?: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const messages = await this.coreService.getHistory(projectId, {
          sessionId: session,
          limit: limit || 50,
          before
        });

        return {
          success: true,
          count: messages.length,
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sessionId: m.sessionId,
            timestamp: m.createdAt.toLocaleString(),
            timestampUtc: m.createdAt.toISOString()
          }))
        };
      }
    );

    this.register(
      {
        name: 'summarize_session',
        description: 'Generate a summary of a conversation session',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session ID to summarize'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session']
        }
      },
      async (args) => {
        const { session, project } = args as {
          session: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const summary = await this.coreService.summarizeSession(projectId, session);

        return {
          success: true,
          sessionId: session,
          summary
        };
      }
    );

    this.register(
      {
        name: 'search_decisions',
        description: 'Search for architectural decisions across sessions',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            limit: {
              type: 'number',
              description: 'Maximum results (default: 10)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['query']
        }
      },
      async (args) => {
        const { query, limit, project } = args as {
          query: string;
          limit?: number;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const decisions = await this.coreService.searchDecisions(projectId, query, {
          limit: limit || 10
        });

        return {
          success: true,
          count: decisions.length,
          decisions: decisions.map(d => ({
            id: d.id,
            description: d.description,
            sessionId: d.sessionId,
            timestamp: d.createdAt.toISOString()
          }))
        };
      }
    );

    this.register(
      {
        name: 'list_sessions',
        description: 'List conversation sessions',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'archived', 'summarized'],
              description: 'Filter by status'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { status, project } = args as {
          status?: 'active' | 'archived' | 'summarized';
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const sessions = await this.coreService.listSessions(projectId, { status });

        return {
          success: true,
          count: sessions.length,
          sessions: sessions.map(s => ({
            id: s.id,
            name: s.name,
            status: s.status,
            messageCount: s.messageCount,
            createdAt: s.createdAt.toLocaleString()
          }))
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // GRAPH RAG
  // ─────────────────────────────────────────────────────────

  private registerGraphTools(): void {
    this.register(
      {
        name: 'link_entities',
        description: 'Create a relationship between two entities',
        inputSchema: {
          type: 'object',
          properties: {
            source: {
              type: 'string',
              description: 'Source entity ID or name'
            },
            target: {
              type: 'string',
              description: 'Target entity ID or name'
            },
            type: {
              type: 'string',
              description: 'Relationship type (calls, imports, implements, relates_to, etc.)'
            },
            weight: {
              type: 'number',
              description: 'Relationship strength 0-1 (default: 1.0)'
            },
            metadata: {
              type: 'object',
              description: 'Additional relationship metadata'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['source', 'target', 'type']
        }
      },
      async (args) => {
        const { source, target, type, weight, metadata, project } = args as {
          source: string;
          target: string;
          type: string;
          weight?: number;
          metadata?: Record<string, unknown>;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);

        // Resolve entity IDs
        const sourceId = await this.coreService.resolveEntityId(projectId, source);
        const targetId = await this.coreService.resolveEntityId(projectId, target);

        const result = await this.coreService.addRelationship(projectId, {
          sourceId,
          targetId,
          type,
          weight: weight ?? 1.0,
          metadata
        });

        return {
          success: true,
          relationship: result
        };
      }
    );

    this.register(
      {
        name: 'query_graph',
        description: 'Traverse the entity relationship graph',
        inputSchema: {
          type: 'object',
          properties: {
            entity: {
              type: 'string',
              description: 'Starting entity ID or name'
            },
            depth: {
              type: 'number',
              description: 'Maximum hops (default: 2)'
            },
            relationships: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by relationship types'
            },
            direction: {
              type: 'string',
              enum: ['in', 'out', 'both'],
              description: 'Traversal direction (default: both)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['entity']
        }
      },
      async (args) => {
        const { entity, depth, relationships, direction, project } = args as {
          entity: string;
          depth?: number;
          relationships?: string[];
          direction?: 'in' | 'out' | 'both';
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const entityId = await this.coreService.resolveEntityId(projectId, entity);

        const result = await this.coreService.queryGraph(projectId, entityId, {
          depth: depth ?? 2,
          relationships,
          direction: direction ?? 'both'
        });

        return {
          success: true,
          ...result
        };
      }
    );

    this.register(
      {
        name: 'get_graph_stats',
        description: 'Get statistics about the entity relationship graph',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { project } = args as { project?: string };
        const projectId = await this.resolveProjectId(project);
        const stats = await this.coreService.getGraphStats(projectId);

        return {
          success: true,
          ...stats
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // CONTEXT RETRIEVAL
  // ─────────────────────────────────────────────────────────

  private registerRetrievalTools(): void {
    this.register(
      {
        name: 'context_query',
        description: 'Query for relevant context using hybrid RAG (vector + graph + keyword)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            },
            max_tokens: {
              type: 'number',
              description: 'Token budget for response (default: 4000)'
            },
            strategies: {
              type: 'array',
              items: { type: 'string', enum: ['keyword', 'semantic', 'graph'] },
              description: 'Search strategies to use (default: all)'
            },
            include_types: {
              type: 'array',
              items: { type: 'string' },
              description: 'Entity types to include'
            },
            include_sources: {
              type: 'boolean',
              description: 'Include source attribution (default: true)'
            },
            min_score: {
              type: 'number',
              description: 'Minimum relevance score 0-1 (default: 0.3)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['query']
        }
      },
      async (args) => {
        const { query, max_tokens, strategies, include_types, include_sources, min_score, project } = args as {
          query: string;
          max_tokens?: number;
          strategies?: string[];
          include_types?: string[];
          include_sources?: boolean;
          min_score?: number;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const result = await this.coreService.queryContext(projectId, query, {
          maxTokens: max_tokens ?? 4000,
          strategies: strategies as any,
          includeTypes: include_types,
          includeSources: include_sources ?? true,
          minScore: min_score
        });

        return {
          success: true,
          context: result.context,
          sources: result.sources,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
          truncated: result.truncated
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // AGENT PATTERNS
  // ─────────────────────────────────────────────────────────

  private registerAgentTools(): void {
    // Checkpoints
    this.register(
      {
        name: 'checkpoint_save',
        description: 'Save agent state checkpoint for resumable tasks',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session/task ID'
            },
            state: {
              type: 'object',
              description: 'Agent state to save'
            },
            description: {
              type: 'string',
              description: 'Checkpoint description'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session', 'state']
        }
      },
      async (args) => {
        const { session, state, description, project } = args as {
          session: string;
          state: Record<string, unknown>;
          description?: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const checkpoint = await this.coreService.saveCheckpoint(projectId, session, state, {
          description
        });

        return {
          success: true,
          checkpointId: checkpoint.id,
          stepNumber: checkpoint.stepNumber
        };
      }
    );

    this.register(
      {
        name: 'checkpoint_load',
        description: 'Load agent state from checkpoint',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session/task ID'
            },
            checkpoint_id: {
              type: 'string',
              description: 'Specific checkpoint ID (default: latest)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session']
        }
      },
      async (args) => {
        const { session, checkpoint_id, project } = args as {
          session: string;
          checkpoint_id?: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const checkpoint = await this.coreService.loadCheckpoint(projectId, session, checkpoint_id);

        if (!checkpoint) {
          return { success: false, error: 'No checkpoint found' };
        }

        return {
          success: true,
          checkpoint: {
            id: checkpoint.id,
            stepNumber: checkpoint.stepNumber,
            state: checkpoint.state.context ?? checkpoint.state,
            createdAt: checkpoint.createdAt.toISOString()
          }
        };
      }
    );

    this.register(
      {
        name: 'checkpoint_list',
        description: 'List checkpoints for a session',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session/task ID'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session']
        }
      },
      async (args) => {
        const { session, project } = args as {
          session: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const checkpoints = await this.coreService.listCheckpoints(projectId, session);

        return {
          success: true,
          count: checkpoints.length,
          checkpoints: checkpoints.map((c: any) => ({
            id: c.id,
            stepNumber: c.stepNumber,
            description: c.description,
            createdAt: c.createdAt?.toISOString()
          }))
        };
      }
    );

    // Memory management
    this.register(
      {
        name: 'memory_spill',
        description: 'Spill hot memory items to cold storage to free up context',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session ID'
            },
            threshold: {
              type: 'number',
              description: 'Token threshold for spilling'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session']
        }
      },
      async (args) => {
        const { session, threshold, project } = args as {
          session: string;
          threshold?: number;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const result = await this.coreService.spillMemory(projectId, session, {
          threshold
        });

        return {
          success: true,
          ...result
        };
      }
    );

    this.register(
      {
        name: 'memory_recall',
        description: 'Recall relevant items from cold storage',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session ID'
            },
            query: {
              type: 'string',
              description: 'Query for relevant items to recall'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session', 'query']
        }
      },
      async (args) => {
        const { session, query, project } = args as {
          session: string;
          query: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const result = await this.coreService.recallMemory(projectId, session, query);

        return {
          success: true,
          ...result
        };
      }
    );

    this.register(
      {
        name: 'memory_status',
        description: 'Get current memory status (hot/cold distribution)',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session ID'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session']
        }
      },
      async (args) => {
        const { session, project } = args as {
          session: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const status = await this.coreService.getMemoryStatus(projectId, session);

        return {
          success: true,
          ...status
        };
      }
    );

    // Reflections
    this.register(
      {
        name: 'reflection_store',
        description: 'Store a learning reflection from agent experience',
        inputSchema: {
          type: 'object',
          properties: {
            session: {
              type: 'string',
              description: 'Session ID'
            },
            type: {
              type: 'string',
              enum: ['lesson', 'observation', 'decision'],
              description: 'Reflection type'
            },
            content: {
              type: 'string',
              description: 'Reflection content'
            },
            outcome: {
              type: 'string',
              enum: ['success', 'failure', 'partial'],
              description: 'Outcome of the experience'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['session', 'content']
        }
      },
      async (args) => {
        const { session, type, content, outcome, tags, project } = args as {
          session: string;
          type?: 'lesson' | 'observation' | 'decision';
          content: string;
          outcome?: 'success' | 'failure' | 'partial';
          tags?: string[];
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const result = await this.coreService.storeReflection(projectId, session, {
          type,
          content,
          outcome,
          tags
        });

        return {
          success: true,
          reflectionId: result.id
        };
      }
    );

    this.register(
      {
        name: 'reflection_query',
        description: 'Query stored reflections for relevant learnings',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            type: {
              type: 'string',
              enum: ['lesson', 'observation', 'decision'],
              description: 'Filter by reflection type'
            },
            outcome: {
              type: 'string',
              enum: ['success', 'failure', 'partial'],
              description: 'Filter by outcome'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['query']
        }
      },
      async (args) => {
        const { query, type, outcome, project } = args as {
          query: string;
          type?: string;
          outcome?: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const reflections = await this.coreService.searchReflections(projectId, query, { type, outcome });

        return {
          success: true,
          count: reflections.length,
          reflections: reflections.map((r: any) => ({
            id: r.id,
            type: r.metadata?.reflectionType,
            content: r.content,
            outcome: r.metadata?.outcome
          }))
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // ANALYTICS
  // ─────────────────────────────────────────────────────────

  private registerAnalyticsTools(): void {
    this.register(
      {
        name: 'analytics_get_stats',
        description: 'Get token savings and usage analytics',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['day', 'week', 'month', 'all'],
              description: 'Time period (default: week)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { period, project } = args as {
          period?: 'day' | 'week' | 'month' | 'all';
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const stats = await this.coreService.getAnalytics(projectId, period ?? 'week');

        return {
          success: true,
          ...stats
        };
      }
    );

    this.register(
      {
        name: 'analytics_dashboard',
        description: 'Get dashboard data with stats, recent queries, and top entities',
        inputSchema: {
          type: 'object',
          properties: {
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { project } = args as { project?: string };
        const projectId = await this.resolveProjectId(project);
        const data = await this.coreService.getDashboardData(projectId);

        return {
          success: true,
          ...data
        };
      }
    );

    this.register(
      {
        name: 'analytics_feedback',
        description: 'Record feedback on a query result',
        inputSchema: {
          type: 'object',
          properties: {
            query_id: {
              type: 'string',
              description: 'Query log ID'
            },
            was_useful: {
              type: 'boolean',
              description: 'Whether the result was useful'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          },
          required: ['query_id', 'was_useful']
        }
      },
      async (args) => {
        const { query_id, was_useful, project } = args as {
          query_id: string;
          was_useful: boolean;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        await this.coreService.recordFeedback(projectId, query_id, was_useful);

        return { success: true };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // GIT HOOKS
  // ─────────────────────────────────────────────────────────

  private registerHooksTools(): void {
    this.register(
      {
        name: 'hooks_install',
        description: 'Install git hooks for automatic indexing',
        inputSchema: {
          type: 'object',
          properties: {
            repo_path: {
              type: 'string',
              description: 'Path to git repository (default: project path)'
            },
            hooks: {
              type: 'array',
              items: { type: 'string', enum: ['post-commit', 'post-checkout', 'post-merge'] },
              description: 'Hooks to install (default: post-commit)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { repo_path, hooks, project } = args as {
          repo_path?: string;
          hooks?: string[];
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const proj = await this.coreService.getProject(projectId);
        const repoPath = repo_path || proj?.path;

        if (!repoPath) {
          throw new Error('No repository path specified');
        }

        await this.coreService.installHooks(projectId, repoPath, {
          hooks: hooks as any
        });

        return {
          success: true,
          installed: hooks || ['post-commit']
        };
      }
    );

    this.register(
      {
        name: 'hooks_impact_report',
        description: 'Get impact analysis report for pending changes',
        inputSchema: {
          type: 'object',
          properties: {
            base_branch: {
              type: 'string',
              description: 'Base branch for comparison (default: main)'
            },
            target_branch: {
              type: 'string',
              description: 'Target branch (default: HEAD)'
            },
            project: {
              type: 'string',
              description: 'Target project (default: active)'
            }
          }
        }
      },
      async (args) => {
        const { base_branch, target_branch, project } = args as {
          base_branch?: string;
          target_branch?: string;
          project?: string;
        };

        const projectId = await this.resolveProjectId(project);
        const report = await this.coreService.getImpactReport(
          projectId,
          base_branch || 'main',
          target_branch || 'HEAD'
        );

        return {
          success: true,
          ...report
        };
      }
    );
  }

  // ─────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────

  /**
   * Resolve project ID from name or get active project.
   */
  private async resolveProjectId(projectName?: string): Promise<string> {
    if (projectName) {
      const project = await this.coreService.getProject(projectName);
      if (!project) throw new Error(`Project not found: ${projectName}`);
      return project.id;
    }

    // Try active project first
    const active = await this.coreService.getActiveProject();
    if (active) return active.id;

    // Auto-detect from current working directory
    const cwd = process.cwd();
    const projects = await this.coreService.listProjects();
    const matching = projects.find(p => cwd.startsWith(p.path));
    if (matching) {
      // Auto-set as active for future calls
      await this.coreService.setActiveProject(matching.id);
      return matching.id;
    }

    throw new Error('No active project and could not auto-detect from working directory. Use set_active_project or create_project first.');
  }
}
