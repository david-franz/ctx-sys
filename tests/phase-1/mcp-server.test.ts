import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CtxSysMcpServer, ToolRegistry, AppContext } from '../../src';

describe('F1.5 MCP Server Scaffold', () => {
  let testDir: string;
  let testDbPath: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('CtxSysMcpServer', () => {
    it('should create server with default config', () => {
      const server = new CtxSysMcpServer({ dbPath: testDbPath });
      expect(server).toBeDefined();
    });

    it('should create server with custom name and version', () => {
      const server = new CtxSysMcpServer({
        dbPath: testDbPath,
        name: 'test-server',
        version: '1.0.0'
      });
      expect(server).toBeDefined();
    });

    it('should initialize successfully', async () => {
      const server = new CtxSysMcpServer({ dbPath: testDbPath });
      await server.initialize();
      expect(server.getContext()).toBeDefined();
      await server.close();
    });

    it('should initialize only once', async () => {
      const server = new CtxSysMcpServer({ dbPath: testDbPath });
      await server.initialize();
      await server.initialize(); // Should not throw
      await server.close();
    });

    it('should expose tool registry', async () => {
      const server = new CtxSysMcpServer({ dbPath: testDbPath });
      await server.initialize();

      const registry = server.getToolRegistry();
      expect(registry).toBeInstanceOf(ToolRegistry);
      expect(registry.getToolDefinitions().length).toBeGreaterThan(0);

      await server.close();
    });

    it('should expose app context', async () => {
      const server = new CtxSysMcpServer({ dbPath: testDbPath });
      await server.initialize();

      const context = server.getContext();
      expect(context).toBeInstanceOf(AppContext);
      expect(context.db).toBeDefined();
      expect(context.projectManager).toBeDefined();

      await server.close();
    });

    it('should report not connected when not started', async () => {
      const server = new CtxSysMcpServer({ dbPath: testDbPath });
      await server.initialize();
      expect(server.isConnected()).toBe(false);
      await server.close();
    });
  });

  describe('ToolRegistry', () => {
    let context: AppContext;

    beforeEach(async () => {
      context = new AppContext(testDbPath);
      await context.initialize();
    });

    afterEach(async () => {
      await context.close();
    });

    it('should register core tools', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();

      expect(tools.length).toBeGreaterThan(0);
    });

    it('should have project management tools', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('create_project');
      expect(toolNames).toContain('list_projects');
      expect(toolNames).toContain('set_active_project');
      expect(toolNames).toContain('delete_project');
    });

    it('should have entity management tools', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('add_entity');
      expect(toolNames).toContain('get_entity');
      expect(toolNames).toContain('search_entities');
    });

    it('should have all core tools implemented', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const toolNames = tools.map(t => t.name);

      // Retrieval tools
      expect(toolNames).toContain('context_query');

      // Indexing tools
      expect(toolNames).toContain('index_codebase');
      expect(toolNames).toContain('index_document');
      expect(toolNames).toContain('sync_from_git');
      expect(toolNames).toContain('get_index_status');

      // Conversation tools
      expect(toolNames).toContain('store_message');
      expect(toolNames).toContain('get_history');
      expect(toolNames).toContain('summarize_session');
      expect(toolNames).toContain('list_sessions');

      // Graph tools
      expect(toolNames).toContain('link_entities');
      expect(toolNames).toContain('query_graph');
      expect(toolNames).toContain('get_graph_stats');

      // Agent tools
      expect(toolNames).toContain('checkpoint_save');
      expect(toolNames).toContain('checkpoint_load');
      expect(toolNames).toContain('memory_spill');
      expect(toolNames).toContain('reflection_store');

    });

    it('should check tool existence', () => {
      const registry = new ToolRegistry(context);

      expect(registry.hasTool('create_project')).toBe(true);
      expect(registry.hasTool('nonexistent_tool')).toBe(false);
    });

    it('should execute create_project tool', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await registry.execute('create_project', {
        name: 'test-proj',
        path: projectPath
      }) as { success: boolean; project: { name: string } };

      expect(result.success).toBe(true);
      expect(result.project.name).toBe('test-proj');
    });

    it('should execute list_projects tool', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('create_project', {
        name: 'test-proj',
        path: projectPath
      });

      const result = await registry.execute('list_projects', {}) as {
        projects: Array<{ name: string }>;
      };

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].name).toBe('test-proj');
    });

    it('should execute set_active_project tool', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('create_project', {
        name: 'test-proj',
        path: projectPath
      });

      const result = await registry.execute('set_active_project', {
        name: 'test-proj'
      }) as { success: boolean; activeProject: string };

      expect(result.success).toBe(true);
      expect(result.activeProject).toBe('test-proj');
    });

    it('should execute add_entity tool', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('create_project', {
        name: 'test-proj',
        path: projectPath
      });
      await registry.execute('set_active_project', { name: 'test-proj' });

      // Don't provide content to skip embedding generation (tested separately)
      const result = await registry.execute('add_entity', {
        type: 'concept',
        name: 'test-concept',
        summary: 'Test concept summary'
      }) as { success: boolean; entity: { name: string; type: string } };

      expect(result.success).toBe(true);
      expect(result.entity.name).toBe('test-concept');
      expect(result.entity.type).toBe('concept');
    });

    it('should execute search_entities tool', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('create_project', {
        name: 'test-proj',
        path: projectPath
      });
      await registry.execute('set_active_project', { name: 'test-proj' });
      // Don't provide content to skip embedding generation (tested separately)
      await registry.execute('add_entity', {
        type: 'concept',
        name: 'test-concept',
        summary: 'Test concept summary'
      });

      const result = await registry.execute('search_entities', {
        query: 'test'
      }) as { success: boolean; count: number; entities: Array<{ name: string }> };

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should throw for unknown tool', async () => {
      const registry = new ToolRegistry(context);

      await expect(
        registry.execute('unknown_tool', {})
      ).rejects.toThrow('Unknown tool');
    });

    it('should expose CoreService', () => {
      const registry = new ToolRegistry(context);
      const coreService = registry.getCoreService();

      expect(coreService).toBeDefined();
    });

    it('should register custom tool', () => {
      const registry = new ToolRegistry(context);

      registry.register(
        {
          name: 'custom_tool',
          description: 'A custom tool',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            },
            required: ['message']
          }
        },
        async (args) => {
          return { echo: (args as { message: string }).message };
        }
      );

      expect(registry.hasTool('custom_tool')).toBe(true);
    });

    it('should execute custom tool', async () => {
      const registry = new ToolRegistry(context);

      registry.register(
        {
          name: 'custom_tool',
          description: 'A custom tool',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            },
            required: ['message']
          }
        },
        async (args) => {
          return { echo: (args as { message: string }).message };
        }
      );

      const result = await registry.execute('custom_tool', {
        message: 'hello'
      }) as { echo: string };

      expect(result.echo).toBe('hello');
    });
  });

  describe('Tool definitions', () => {
    let context: AppContext;

    beforeEach(async () => {
      context = new AppContext(testDbPath);
      await context.initialize();
    });

    afterEach(async () => {
      await context.close();
    });

    it('should have valid input schemas', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have descriptions for all tools', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();

      for (const tool of tools) {
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it('create_project should have required name and path', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const createProject = tools.find(t => t.name === 'create_project');

      expect(createProject).toBeDefined();
      expect(createProject!.inputSchema.required).toContain('name');
      expect(createProject!.inputSchema.required).toContain('path');
    });

    it('add_entity should have required type and name', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const addEntity = tools.find(t => t.name === 'add_entity');

      expect(addEntity).toBeDefined();
      expect(addEntity!.inputSchema.required).toContain('type');
      expect(addEntity!.inputSchema.required).toContain('name');
    });

    it('search_entities should have required query', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const searchEntities = tools.find(t => t.name === 'search_entities');

      expect(searchEntities).toBeDefined();
      expect(searchEntities!.inputSchema.required).toContain('query');
    });
  });

  describe('Error handling', () => {
    let context: AppContext;

    beforeEach(async () => {
      context = new AppContext(testDbPath);
      await context.initialize();
    });

    afterEach(async () => {
      await context.close();
    });

    it('should throw when no active project for entity operations', async () => {
      const registry = new ToolRegistry(context);

      await expect(
        registry.execute('add_entity', {
          type: 'concept',
          name: 'test'
        })
      ).rejects.toThrow('No active project');
    });

    it('should throw when project not found', async () => {
      const registry = new ToolRegistry(context);

      await expect(
        registry.execute('set_active_project', {
          name: 'nonexistent'
        })
      ).rejects.toThrow();
    });

    it('should throw when entity id or qualified_name not provided', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('create_project', {
        name: 'test-proj',
        path: projectPath
      });
      await registry.execute('set_active_project', { name: 'test-proj' });

      await expect(
        registry.execute('get_entity', {})
      ).rejects.toThrow('Either id or qualified_name is required');
    });
  });
});
