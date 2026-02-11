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

    it('should have project management tool with actions', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('project');
      const project = tools.find(t => t.name === 'project')!;
      const actions = (project.inputSchema.properties.action as any).enum;
      expect(actions).toContain('create');
      expect(actions).toContain('list');
      expect(actions).toContain('set_active');
      expect(actions).toContain('delete');
    });

    it('should have entity management tool with actions', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('entity');
      const entity = tools.find(t => t.name === 'entity')!;
      const actions = (entity.inputSchema.properties.action as any).enum;
      expect(actions).toContain('add');
      expect(actions).toContain('get');
      expect(actions).toContain('search');
    });

    it('should have all 12 consolidated tools', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const toolNames = tools.map(t => t.name).sort();

      expect(toolNames).toEqual([
        'checkpoint', 'context_query', 'decision', 'entity',
        'graph', 'hooks', 'index', 'memory',
        'message', 'project', 'reflection', 'session',
      ]);
    });

    it('should check tool existence', () => {
      const registry = new ToolRegistry(context);

      expect(registry.hasTool('project')).toBe(true);
      expect(registry.hasTool('entity')).toBe(true);
      expect(registry.hasTool('nonexistent_tool')).toBe(false);
    });

    it('should execute project create action', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      const result = await registry.execute('project', {
        action: 'create',
        name: 'test-proj',
        path: projectPath
      }) as { success: boolean; project: { name: string } };

      expect(result.success).toBe(true);
      expect(result.project.name).toBe('test-proj');
    });

    it('should execute project list action', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('project', {
        action: 'create',
        name: 'test-proj',
        path: projectPath
      });

      const result = await registry.execute('project', { action: 'list' }) as {
        projects: Array<{ name: string }>;
      };

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].name).toBe('test-proj');
    });

    it('should execute project set_active action', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('project', {
        action: 'create',
        name: 'test-proj',
        path: projectPath
      });

      const result = await registry.execute('project', {
        action: 'set_active',
        name: 'test-proj'
      }) as { success: boolean; activeProject: string };

      expect(result.success).toBe(true);
      expect(result.activeProject).toBe('test-proj');
    });

    it('should execute entity add action', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('project', {
        action: 'create',
        name: 'test-proj',
        path: projectPath
      });
      await registry.execute('project', { action: 'set_active', name: 'test-proj' });

      // Don't provide content to skip embedding generation (tested separately)
      const result = await registry.execute('entity', {
        action: 'add',
        type: 'concept',
        name: 'test-concept',
        summary: 'Test concept summary'
      }) as { success: boolean; entity: { name: string; type: string } };

      expect(result.success).toBe(true);
      expect(result.entity.name).toBe('test-concept');
      expect(result.entity.type).toBe('concept');
    });

    it('should execute entity search action', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('project', {
        action: 'create',
        name: 'test-proj',
        path: projectPath
      });
      await registry.execute('project', { action: 'set_active', name: 'test-proj' });
      // Don't provide content to skip embedding generation (tested separately)
      await registry.execute('entity', {
        action: 'add',
        type: 'concept',
        name: 'test-concept',
        summary: 'Test concept summary'
      });

      const result = await registry.execute('entity', {
        action: 'search',
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

    it('project tool should require action', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const project = tools.find(t => t.name === 'project');

      expect(project).toBeDefined();
      expect(project!.inputSchema.required).toContain('action');
    });

    it('entity tool should require action', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const entity = tools.find(t => t.name === 'entity');

      expect(entity).toBeDefined();
      expect(entity!.inputSchema.required).toContain('action');
    });

    it('context_query should require query, not action', () => {
      const registry = new ToolRegistry(context);
      const tools = registry.getToolDefinitions();
      const cq = tools.find(t => t.name === 'context_query');

      expect(cq).toBeDefined();
      expect(cq!.inputSchema.required).toContain('query');
      expect(cq!.inputSchema.properties.action).toBeUndefined();
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
        registry.execute('entity', {
          action: 'add',
          type: 'concept',
          name: 'test'
        })
      ).rejects.toThrow('No active project');
    });

    it('should throw when project not found', async () => {
      const registry = new ToolRegistry(context);

      await expect(
        registry.execute('project', {
          action: 'set_active',
          name: 'nonexistent'
        })
      ).rejects.toThrow();
    });

    it('should throw when entity get missing id or qualified_name', async () => {
      const registry = new ToolRegistry(context);
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await registry.execute('project', {
        action: 'create',
        name: 'test-proj',
        path: projectPath
      });
      await registry.execute('project', { action: 'set_active', name: 'test-proj' });

      await expect(
        registry.execute('entity', { action: 'get' })
      ).rejects.toThrow();
    });
  });
});
