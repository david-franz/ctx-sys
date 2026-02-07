import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AppContext } from '../context';
import { ToolRegistry, Tool } from './tool-registry';

/**
 * MCP Server configuration.
 */
export interface McpServerConfig {
  name?: string;
  version?: string;
  dbPath?: string;
}

/**
 * MCP Server for ctx-sys context management.
 */
export class CtxSysMcpServer {
  private mcp: McpServer;
  private context: AppContext;
  private toolRegistry: ToolRegistry;
  private initialized: boolean = false;

  constructor(config: McpServerConfig = {}) {
    const name = config.name || 'ctx-sys';
    const version = config.version || '1.0.0';

    this.mcp = new McpServer(
      { name, version },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        instructions: 'Context management system for AI coding assistants. Use tools to manage projects, entities, and semantic search.'
      }
    );

    this.context = new AppContext(config.dbPath);
    this.toolRegistry = new ToolRegistry(this.context);
  }

  /**
   * Initialize the server.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.context.initialize();
    this.registerTools();
    this.initialized = true;
  }

  /**
   * Register all tools from the registry with MCP.
   */
  private registerTools(): void {
    const tools = this.toolRegistry.getToolDefinitions();

    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Register a single tool with MCP.
   */
  private registerTool(tool: Tool): void {
    // Create a Zod schema from the JSON schema properties
    const zodSchema = this.createZodSchema(tool.inputSchema);

    this.mcp.tool(
      tool.name,
      tool.description,
      zodSchema,
      async (args) => {
        try {
          const result = await this.toolRegistry.execute(tool.name, args as Record<string, unknown>);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ error: message }, null, 2)
              }
            ],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Create a Zod schema from JSON schema properties.
   */
  private createZodSchema(inputSchema: Tool['inputSchema']): Record<string, z.ZodTypeAny> {
    const schema: Record<string, z.ZodTypeAny> = {};
    const required = new Set(inputSchema.required || []);

    for (const [key, value] of Object.entries(inputSchema.properties)) {
      const prop = value as { type?: string; description?: string };
      let zodType: z.ZodTypeAny;

      switch (prop.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'object':
          zodType = z.record(z.string(), z.unknown());
          break;
        case 'array':
          zodType = z.array(z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      if (!required.has(key)) {
        zodType = zodType.optional();
      }

      schema[key] = zodType;
    }

    return schema;
  }

  /**
   * Start the server with stdio transport.
   */
  async start(): Promise<void> {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.mcp.connect(transport);
  }

  /**
   * Close the server.
   */
  async close(): Promise<void> {
    await this.mcp.close();
    await this.context.close();
  }

  /**
   * Check if the server is connected.
   */
  isConnected(): boolean {
    return this.mcp.isConnected();
  }

  /**
   * Get the underlying AppContext.
   */
  getContext(): AppContext {
    return this.context;
  }

  /**
   * Get the tool registry.
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }
}
