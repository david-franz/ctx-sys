import { AppContext } from '../context';
import { EntityType } from '../entities/types';

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

  constructor(private context: AppContext) {
    this.registerCoreTools();
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
   * Register core Phase 1 tools.
   */
  private registerCoreTools(): void {
    // Project management tools
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
        const project = await this.context.projectManager.create(name, path, config as any);
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
        const projects = await this.context.projectManager.list();
        const active = await this.context.projectManager.getActive();
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
        await this.context.projectManager.setActive(name);
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
        await this.context.projectManager.delete(name, keep_data);
        return { success: true, deleted: name };
      }
    );

    // Entity management tools
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
        const entityStore = this.context.getEntityStore(projectId);

        const entity = await entityStore.create({
          type: type as EntityType,
          name,
          content,
          summary,
          metadata
        });

        // Generate embedding if content provided
        if (content) {
          const proj = await this.context.projectManager.get(projectId);
          const embeddingManager = this.context.getEmbeddingManager(projectId, proj?.config);
          await embeddingManager.embed(entity.id, content);
        }

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
        const entityStore = this.context.getEntityStore(projectId);

        const entity = id
          ? await entityStore.get(id)
          : await entityStore.getByQualifiedName(qualified_name!);

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
        const entityStore = this.context.getEntityStore(projectId);

        const entities = await entityStore.search(query, {
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

    // Placeholder tools for future phases
    this.registerPlaceholder('context_query', 'Query context (Phase 6)');
    this.registerPlaceholder('index_codebase', 'Index codebase (Phase 2)');
    this.registerPlaceholder('index_document', 'Index document (Phase 4)');
    this.registerPlaceholder('sync_from_git', 'Sync from git (Phase 2)');
    this.registerPlaceholder('store_message', 'Store message (Phase 3)');
    this.registerPlaceholder('get_history', 'Get history (Phase 3)');
    this.registerPlaceholder('summarize_session', 'Summarize session (Phase 3)');
    this.registerPlaceholder('link_entities', 'Link entities (Phase 5)');
    this.registerPlaceholder('query_graph', 'Query graph (Phase 5)');
  }

  /**
   * Register a placeholder tool for future phases.
   */
  private registerPlaceholder(name: string, description: string): void {
    this.register(
      {
        name,
        description: `[Not yet implemented] ${description}`,
        inputSchema: { type: 'object', properties: {} }
      },
      async () => {
        throw new Error(`Tool "${name}" is not yet implemented`);
      }
    );
  }

  /**
   * Resolve project ID from name or get active project.
   */
  private async resolveProjectId(projectName?: string): Promise<string> {
    if (projectName) {
      const project = await this.context.projectManager.get(projectName);
      if (!project) throw new Error(`Project not found: ${projectName}`);
      return project.id;
    }

    const active = await this.context.projectManager.getActive();
    if (!active) throw new Error('No active project. Use set_active_project first.');
    return active.id;
  }
}
