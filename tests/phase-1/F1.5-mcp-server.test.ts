/**
 * F1.5 MCP Server Tests
 *
 * Tests for MCP server, tool registry, and app context
 * covering tool registration, execution, and error handling.
 *
 * These tests will FAIL until the actual implementations are created.
 * Expected source files:
 * - src/mcp/server.ts (McpServer class)
 * - src/mcp/registry.ts (ToolRegistry class)
 * - src/mcp/context.ts (AppContext class)
 * - src/mcp/types.ts (ToolDefinition, ToolHandler types)
 * - src/database/connection.ts (DatabaseConnection class)
 * - src/project/manager.ts (ProjectManager class)
 * - src/entities/store.ts (EntityStore class)
 * - src/embeddings/manager.ts (EmbeddingManager class)
 *
 * @see docs/phase-1/F1.5-mcp-server.md
 */

// Import actual implementations - these will fail until implemented
import { McpServer } from '../../src/mcp/server';
import { ToolRegistry } from '../../src/mcp/registry';
import { AppContext } from '../../src/mcp/context';
import {
  ToolDefinition,
  ToolHandler,
  ToolExecutionResult,
  McpError
} from '../../src/mcp/types';
import { DatabaseConnection } from '../../src/db/connection';
import { ProjectManager } from '../../src/project/manager';
import { EntityStore } from '../../src/entities/store';
import { EmbeddingManager } from '../../src/embeddings/manager';

// Import mock helpers
import {
  createMockDatabase,
  createMockProject,
  createMockEntity,
  createMockEmbeddingProvider,
  MockDatabase
} from '../helpers/mocks';

// Mock dependencies
jest.mock('../../src/db/connection');
jest.mock('../../src/project/manager');
jest.mock('../../src/entities/store');
jest.mock('../../src/embeddings/manager');

describe('F1.5 MCP Server', () => {
  let mockDb: MockDatabase;
  let appContext: AppContext;
  let server: McpServer;
  let registry: ToolRegistry;

  beforeEach(() => {
    mockDb = createMockDatabase();

    // Mock DatabaseConnection
    (DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>).mockImplementation(() => ({
      db: mockDb,
      close: jest.fn(),
      transaction: mockDb.transaction,
    } as unknown as DatabaseConnection));

    // Mock ProjectManager
    (ProjectManager as jest.MockedClass<typeof ProjectManager>).mockImplementation(() => ({
      create: jest.fn(),
      get: jest.fn(),
      getByName: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getActiveProject: jest.fn(),
      setActiveProject: jest.fn(),
    } as unknown as ProjectManager));

    appContext = new AppContext('/test/.ctx-sys/context.db');
    registry = new ToolRegistry(appContext);
    server = new McpServer('ctx-sys', '0.1.0', appContext);

    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // McpServer Tests
  // ============================================================================

  describe('McpServer', () => {
    describe('constructor', () => {
      it('should create server with name and version', () => {
        expect(server.name).toBe('ctx-sys');
        expect(server.version).toBe('0.1.0');
      });

      it('should configure tools capability', () => {
        expect(server.capabilities.tools).toBeDefined();
      });

      it('should initialize tool registry', () => {
        expect(server.registry).toBeDefined();
        expect(server.registry).toBeInstanceOf(ToolRegistry);
      });
    });

    describe('setupHandlers', () => {
      it('should handle ListToolsRequest', async () => {
        const tools = await server.listTools();

        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBeGreaterThan(0);
        expect(tools[0]).toHaveProperty('name');
        expect(tools[0]).toHaveProperty('description');
      });

      it('should handle CallToolRequest', async () => {
        mockDb.mockRun({ changes: 1, lastInsertRowid: 1 });
        mockDb.mockGet({ id: 'proj-1', name: 'test', path: '/test' });

        const result = await server.callTool('create_project', {
          name: 'test',
          path: '/test'
        });

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
      });

      it('should return text content for string results', async () => {
        const handler: ToolHandler = async () => 'Project created successfully';
        registry.register({
          name: 'test_string_tool',
          description: 'Returns a string'
        }, handler);

        const result = await server.callTool('test_string_tool', {});

        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBe('Project created successfully');
      });

      it('should return JSON content for object results', async () => {
        const handler: ToolHandler = async () => ({ success: true, id: '123' });
        registry.register({
          name: 'test_object_tool',
          description: 'Returns an object'
        }, handler);

        const result = await server.callTool('test_object_tool', {});

        expect(result.content[0].type).toBe('text');
        expect(JSON.parse(result.content[0].text)).toEqual({ success: true, id: '123' });
      });

      it('should throw McpError for tool errors', async () => {
        const handler: ToolHandler = async () => {
          throw new Error('Tool execution failed');
        };
        registry.register({
          name: 'failing_tool',
          description: 'Always fails'
        }, handler);

        await expect(server.callTool('failing_tool', {})).rejects.toThrow(McpError);
      });

      it('should throw McpError for unknown tools', async () => {
        await expect(server.callTool('nonexistent_tool', {})).rejects.toThrow(McpError);
        await expect(server.callTool('nonexistent_tool', {})).rejects.toThrow(/Unknown tool/);
      });
    });

    describe('start', () => {
      it('should connect to stdio transport', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await server.start();

        expect(server.isRunning).toBe(true);
        consoleSpy.mockRestore();
      });

      it('should log startup message to stderr', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await server.start();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('MCP server started')
        );
        consoleSpy.mockRestore();
      });
    });

    describe('stop', () => {
      it('should close server connection', async () => {
        await server.start();
        await server.stop();

        expect(server.isRunning).toBe(false);
      });
    });
  });

  // ============================================================================
  // ToolRegistry Tests
  // ============================================================================

  describe('ToolRegistry', () => {
    describe('register', () => {
      it('should register tool with definition and handler', () => {
        const definition: ToolDefinition = {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              arg1: { type: 'string' }
            }
          }
        };
        const handler: ToolHandler = jest.fn();

        registry.register(definition, handler);

        expect(registry.has('test_tool')).toBe(true);
      });

      it('should overwrite existing tool with same name', () => {
        const handler1: ToolHandler = jest.fn().mockResolvedValue('v1');
        const handler2: ToolHandler = jest.fn().mockResolvedValue('v2');

        registry.register({ name: 'test_tool', description: 'v1' }, handler1);
        registry.register({ name: 'test_tool', description: 'v2' }, handler2);

        const tool = registry.get('test_tool');
        expect(tool?.definition.description).toBe('v2');
      });
    });

    describe('getToolDefinitions', () => {
      it('should return all tool definitions', () => {
        registry.register({ name: 'tool1', description: 'd1' }, jest.fn());
        registry.register({ name: 'tool2', description: 'd2' }, jest.fn());

        const definitions = registry.getToolDefinitions();

        expect(definitions).toHaveLength(2);
        expect(definitions.map((d: ToolDefinition) => d.name)).toContain('tool1');
        expect(definitions.map((d: ToolDefinition) => d.name)).toContain('tool2');
      });
    });

    describe('execute', () => {
      it('should execute tool handler with args', async () => {
        const handler = jest.fn().mockResolvedValue({ success: true });
        registry.register({ name: 'test_tool', description: 'test' }, handler);

        await registry.execute('test_tool', { name: 'test', path: '/test' });

        expect(handler).toHaveBeenCalledWith(
          { name: 'test', path: '/test' },
          expect.any(Object) // AppContext
        );
      });

      it('should throw for unknown tool', async () => {
        await expect(registry.execute('unknown_tool', {})).rejects.toThrow('Unknown tool');
      });
    });

    describe('core tools', () => {
      describe('create_project', () => {
        it('should have correct input schema', () => {
          const tool = registry.get('create_project');

          expect(tool).toBeDefined();
          expect(tool?.definition.inputSchema?.required).toContain('name');
          expect(tool?.definition.inputSchema?.required).toContain('path');
          expect(tool?.definition.inputSchema?.required).not.toContain('config');
        });

        it('should create project and return success', async () => {
          const mockProject = createMockProject({ name: 'test-proj' });
          mockDb.mockRun({ changes: 1, lastInsertRowid: 1 });
          mockDb.mockGet({ id: mockProject.id, name: mockProject.name, path: mockProject.path });

          const result = await registry.execute('create_project', {
            name: 'test-proj',
            path: '/path/to/project'
          }) as ToolExecutionResult;

          expect(result.success).toBe(true);
          expect(result.project).toBeDefined();
          expect(result.project.name).toBe('test-proj');
        });
      });

      describe('list_projects', () => {
        it('should have empty input schema', () => {
          const tool = registry.get('list_projects');

          expect(tool).toBeDefined();
          expect(tool?.definition.inputSchema?.required).toBeUndefined();
        });

        it('should return all projects with active indicator', async () => {
          const mockProjects = [
            createMockProject({ id: 'p1', name: 'project-a' }),
            createMockProject({ id: 'p2', name: 'project-b' })
          ];
          mockDb.mockAll(mockProjects.map(p => ({
            id: p.id,
            name: p.name,
            path: p.path,
            last_indexed_at: p.lastIndexedAt?.toISOString()
          })));
          mockDb.mockGet({ value: JSON.stringify('p1') }); // active project

          const result = await registry.execute('list_projects', {}) as ToolExecutionResult;

          expect(result.projects).toHaveLength(2);
          expect(result.projects[0].isActive).toBe(true);
          expect(result.activeProject).toBe('project-a');
        });
      });

      describe('set_active_project', () => {
        it('should have name as required parameter', () => {
          const tool = registry.get('set_active_project');

          expect(tool).toBeDefined();
          expect(tool?.definition.inputSchema?.required).toContain('name');
        });

        it('should set active project and return success', async () => {
          mockDb.mockGet({ id: 'p1', name: 'my-project' });
          mockDb.mockRun({ changes: 1 });

          const result = await registry.execute('set_active_project', {
            name: 'my-project'
          }) as ToolExecutionResult;

          expect(result.success).toBe(true);
          expect(result.activeProject).toBe('my-project');
        });
      });

      describe('add_entity', () => {
        it('should have correct input schema', () => {
          const tool = registry.get('add_entity');

          expect(tool).toBeDefined();
          expect(tool?.definition.inputSchema?.required).toContain('type');
          expect(tool?.definition.inputSchema?.required).toContain('name');
        });

        it('should create entity in specified project', async () => {
          mockDb.mockGet({ id: 'p1', name: 'test-project' }); // project lookup
          mockDb.mockGet({ value: JSON.stringify('p1') }); // active project
          mockDb.mockRun({ changes: 1 }); // entity insert

          const result = await registry.execute('add_entity', {
            type: 'concept',
            name: 'rate-limiting',
            content: 'Rate limiting is...'
          }) as ToolExecutionResult;

          expect(result.success).toBe(true);
          expect(result.entity).toBeDefined();
        });

        it('should generate embedding if content provided', async () => {
          const mockProvider = createMockEmbeddingProvider();
          mockDb.mockGet({ id: 'p1', name: 'test' });
          mockDb.mockGet({ value: JSON.stringify('p1') });
          mockDb.mockRun({ changes: 1 });

          // Mock EmbeddingManager to use our provider
          (EmbeddingManager as jest.MockedClass<typeof EmbeddingManager>).mockImplementation(() => ({
            embed: mockProvider.embed,
          } as unknown as EmbeddingManager));

          await registry.execute('add_entity', {
            type: 'concept',
            name: 'test',
            content: 'Test content'
          });

          // Embedding should have been called
          expect(mockProvider.embed).toHaveBeenCalledWith('Test content');
        });

        it('should use active project if not specified', async () => {
          mockDb.mockGet({ value: JSON.stringify('proj-active') }); // active project config
          mockDb.mockGet({ id: 'proj-active', name: 'active-project' }); // project
          mockDb.mockRun({ changes: 1 });

          const result = await registry.execute('add_entity', {
            type: 'concept',
            name: 'test'
            // No project specified
          }) as ToolExecutionResult;

          expect(result.success).toBe(true);
        });
      });

      describe('placeholder tools', () => {
        it('should register placeholder for context_query', () => {
          const tool = registry.get('context_query');

          expect(tool).toBeDefined();
          expect(tool?.definition.description).toContain('Not yet implemented');
        });

        it('should throw error when placeholder is called', async () => {
          await expect(registry.execute('context_query', { query: 'test' }))
            .rejects.toThrow(/not yet implemented/);
        });

        it('should register all future phase tools', () => {
          const placeholderTools = [
            'context_query',
            'index_codebase',
            'index_document',
            'sync_from_git',
            'store_message',
            'get_history',
            'summarize_session',
            'link_entities',
            'query_graph'
          ];

          placeholderTools.forEach(toolName => {
            expect(registry.has(toolName)).toBe(true);
          });
        });
      });
    });

    describe('resolveProjectId', () => {
      it('should return project ID when name provided', async () => {
        mockDb.mockGet({ id: 'proj-123', name: 'my-project' });

        const projectId = await appContext.resolveProjectId('my-project');

        expect(projectId).toBe('proj-123');
      });

      it('should throw if project not found', async () => {
        mockDb.mockGet(undefined);

        await expect(appContext.resolveProjectId('nonexistent'))
          .rejects.toThrow(/Project not found/);
      });

      it('should use active project when not specified', async () => {
        mockDb.mockGet({ value: JSON.stringify('proj-active') });

        const projectId = await appContext.resolveProjectId();

        expect(projectId).toBe('proj-active');
      });

      it('should throw if no active project', async () => {
        mockDb.mockGet(undefined); // No active project config

        await expect(appContext.resolveProjectId())
          .rejects.toThrow(/No active project/);
      });
    });
  });

  // ============================================================================
  // AppContext Tests
  // ============================================================================

  describe('AppContext', () => {
    describe('constructor', () => {
      it('should create database connection', () => {
        const context = new AppContext('/test/.ctx-sys/context.db');

        expect(context.db).toBeDefined();
        expect(DatabaseConnection).toHaveBeenCalledWith('/test/.ctx-sys/context.db');
      });

      it('should create project manager', () => {
        const context = new AppContext('/test/.ctx-sys/context.db');

        expect(context.projectManager).toBeDefined();
        expect(ProjectManager).toHaveBeenCalled();
      });
    });

    describe('initialize', () => {
      it('should initialize database schema', async () => {
        await appContext.initialize();

        expect(mockDb.exec).toHaveBeenCalled();
      });
    });

    describe('getEntityStore', () => {
      it('should return entity store for project', () => {
        const store = appContext.getEntityStore('proj-123');

        expect(store).toBeDefined();
        expect(EntityStore).toHaveBeenCalledWith(
          expect.anything(),
          'proj-123'
        );
      });

      it('should cache entity store instances', () => {
        const store1 = appContext.getEntityStore('proj-123');
        const store2 = appContext.getEntityStore('proj-123');

        expect(store1).toBe(store2);
      });
    });

    describe('getEmbeddingManager', () => {
      it('should return embedding manager for project', () => {
        const manager = appContext.getEmbeddingManager('proj-123');

        expect(manager).toBeDefined();
        expect(EmbeddingManager).toHaveBeenCalled();
      });

      it('should cache embedding manager instances', () => {
        const manager1 = appContext.getEmbeddingManager('proj-123');
        const manager2 = appContext.getEmbeddingManager('proj-123');

        expect(manager1).toBe(manager2);
      });

      it('should use default embedding provider config', () => {
        appContext.getEmbeddingManager('proj-123');

        // Should use ollama:nomic-embed-text by default
        expect(EmbeddingManager).toHaveBeenCalledWith(
          expect.anything(),
          'proj-123',
          expect.objectContaining({
            modelId: expect.stringContaining('nomic-embed-text')
          })
        );
      });
    });
  });

  // ============================================================================
  // MCP Protocol Tests
  // ============================================================================

  describe('MCP Protocol', () => {
    it('should use JSON-RPC 2.0 format', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'list_projects',
          arguments: {}
        }
      };

      const response = await server.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
    });

    it('should handle tools/list request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      const response = await server.handleRequest(request);

      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
    });

    it('should handle tools/call request', async () => {
      mockDb.mockAll([]); // Empty projects
      mockDb.mockGet(undefined); // No active project

      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'list_projects',
          arguments: {}
        }
      };

      const response = await server.handleRequest(request);

      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
    });

    it('should return error response for failures', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBeLessThan(0);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should convert unknown errors to McpError', async () => {
      const handler: ToolHandler = async () => {
        throw new Error('Some internal error');
      };
      registry.register({ name: 'error_tool', description: 'test' }, handler);

      try {
        await server.callTool('error_tool', {});
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(-32603); // InternalError
        expect((error as McpError).message).toBe('Some internal error');
      }
    });

    it('should preserve McpError as-is', async () => {
      const handler: ToolHandler = async () => {
        throw new McpError(-32602, 'Invalid parameter: name is required');
      };
      registry.register({ name: 'mcp_error_tool', description: 'test' }, handler);

      try {
        await server.callTool('mcp_error_tool', {});
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).code).toBe(-32602);
      }
    });

    it('should handle undefined error messages', async () => {
      const handler: ToolHandler = async () => {
        const err: Error = {} as Error;
        throw err;
      };
      registry.register({ name: 'undefined_error_tool', description: 'test' }, handler);

      try {
        await server.callTool('undefined_error_tool', {});
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).message).toBe('Unknown error');
      }
    });
  });

  // ============================================================================
  // Integration Scenarios
  // ============================================================================

  describe('integration scenarios', () => {
    it('should create project and add entity', async () => {
      // 1. Create project
      mockDb.mockRun({ changes: 1, lastInsertRowid: 1 });
      mockDb.mockGet({ id: 'p1', name: 'my-app', path: '/app' });

      const createResult = await registry.execute('create_project', {
        name: 'my-app',
        path: '/app'
      }) as ToolExecutionResult;

      expect(createResult.success).toBe(true);

      // 2. Add entity
      mockDb.mockGet({ id: 'p1', name: 'my-app' });
      mockDb.mockGet({ value: JSON.stringify('p1') });
      mockDb.mockRun({ changes: 1 });

      const addResult = await registry.execute('add_entity', {
        type: 'concept',
        name: 'authentication'
      }) as ToolExecutionResult;

      expect(addResult.success).toBe(true);
    });

    it('should list projects and switch active', async () => {
      // 1. List projects
      mockDb.mockAll([
        { id: 'p1', name: 'project-a', path: '/a' },
        { id: 'p2', name: 'project-b', path: '/b' }
      ]);
      mockDb.mockGet({ value: JSON.stringify('p1') });

      const listResult = await registry.execute('list_projects', {}) as ToolExecutionResult;
      expect(listResult.projects).toHaveLength(2);

      // 2. Switch active
      mockDb.mockGet({ id: 'p2', name: 'project-b' });
      mockDb.mockRun({ changes: 1 });

      const switchResult = await registry.execute('set_active_project', {
        name: 'project-b'
      }) as ToolExecutionResult;

      expect(switchResult.activeProject).toBe('project-b');
    });

    it('should add entity with embedding', async () => {
      const mockProvider = createMockEmbeddingProvider();
      (EmbeddingManager as jest.MockedClass<typeof EmbeddingManager>).mockImplementation(() => ({
        embed: mockProvider.embed,
      } as unknown as EmbeddingManager));

      mockDb.mockGet({ value: JSON.stringify('p1') });
      mockDb.mockGet({ id: 'p1', name: 'test' });
      mockDb.mockRun({ changes: 1 });
      mockDb.mockRun({ changes: 1 }); // For embedding

      await registry.execute('add_entity', {
        type: 'concept',
        name: 'test',
        content: 'Test content for embedding'
      });

      expect(mockProvider.embed).toHaveBeenCalledWith('Test content for embedding');
    });
  });

  // ============================================================================
  // Claude Code Configuration Tests
  // ============================================================================

  describe('Claude Code configuration', () => {
    it('should support stdio transport', () => {
      expect(server.transportType).toBe('stdio');
    });

    it('should provide valid MCP server configuration', () => {
      const config = server.getClaudeCodeConfig();

      expect(config).toHaveProperty('command');
      expect(config).toHaveProperty('args');
      expect(config.args).toContain('--stdio');
    });

    it('should support development configuration', () => {
      const devConfig = server.getClaudeCodeConfig({ development: true });

      expect(devConfig.command).toBe('npx');
      expect(devConfig.args).toContain('ts-node');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle tool with no arguments', async () => {
      mockDb.mockAll([]);
      mockDb.mockGet(undefined);

      const result = await registry.execute('list_projects', {});

      expect(result).toBeDefined();
    });

    it('should handle very large tool response', async () => {
      const largeEntities = Array(1000).fill(null).map((_, i) =>
        createMockEntity({ id: `e${i}`, name: `entity-${i}`, content: 'x'.repeat(1000) })
      );

      mockDb.mockAll(largeEntities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        content: e.content
      })));

      // This should not throw
      const tool = registry.get('list_projects');
      expect(tool).toBeDefined();
    });

    it('should handle concurrent tool calls', async () => {
      mockDb.mockAll([]);
      mockDb.mockGet(undefined);

      const calls = [
        registry.execute('list_projects', {}),
        registry.execute('list_projects', {}),
        registry.execute('list_projects', {})
      ];

      const results = await Promise.all(calls);

      expect(results).toHaveLength(3);
    });

    it('should handle tool call with undefined optional params', async () => {
      mockDb.mockRun({ changes: 1, lastInsertRowid: 1 });
      mockDb.mockGet({ id: 'p1', name: 'test', path: '/test' });

      const result = await registry.execute('create_project', {
        name: 'test',
        path: '/test',
        config: undefined
      }) as ToolExecutionResult;

      expect(result.success).toBe(true);
    });

    it('should handle special characters in arguments', async () => {
      mockDb.mockRun({ changes: 1, lastInsertRowid: 1 });
      mockDb.mockGet({ id: 'p1', name: 'test-project', path: '/home/user/my project/app' });

      const result = await registry.execute('create_project', {
        name: 'test-project',
        path: '/home/user/my project/app'
      }) as ToolExecutionResult;

      expect(result.success).toBe(true);
      expect(result.project.path).toContain(' ');
    });
  });
});
