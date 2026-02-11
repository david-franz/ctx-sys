/**
 * Tests for F10i.9: MCP tool consolidation.
 * Verifies that 30 tools are consolidated into 12 action-based tools,
 * and that action dispatch and parameter validation work correctly.
 */

import { ToolRegistry, Tool } from '../../src/mcp/tool-registry';

// ── Mock AppContext ──────────────────────────────────────

function mockContext(): any {
  return {
    db: {},
    projectManager: {
      create: jest.fn().mockResolvedValue({ id: 'p1', name: 'test', path: '/tmp' }),
      get: jest.fn().mockResolvedValue({ id: 'p1', name: 'test', path: '/tmp', config: {} }),
      list: jest.fn().mockResolvedValue([{ id: 'p1', name: 'test', path: '/tmp' }]),
      setActive: jest.fn().mockResolvedValue(undefined),
      getActive: jest.fn().mockResolvedValue({ id: 'p1', name: 'test', path: '/tmp' }),
      delete: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    },
    getEntityStore: jest.fn().mockReturnValue({
      create: jest.fn().mockResolvedValue({ id: 'e1', name: 'myFunc', type: 'function', qualifiedName: 'src/a.ts::myFunc' }),
      upsert: jest.fn().mockResolvedValue({ id: 'e1', name: 'myFunc', type: 'function' }),
      get: jest.fn().mockResolvedValue({ id: 'e1', name: 'myFunc', type: 'function', qualifiedName: 'src/a.ts::myFunc', summary: 'A function' }),
      getByQualifiedName: jest.fn().mockResolvedValue(null),
      getByName: jest.fn().mockResolvedValue(null),
      search: jest.fn().mockResolvedValue([
        { id: 'e1', name: 'myFunc', type: 'function', qualifiedName: 'src/a.ts::myFunc', summary: 'A function' },
      ]),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(5),
      listPaginated: jest.fn().mockReturnValue({ [Symbol.iterator]: () => ({ next: () => ({ done: true, value: undefined }) }) }),
      getByFile: jest.fn().mockResolvedValue([]),
    }),
    getEmbeddingManager: jest.fn().mockResolvedValue({
      embed: jest.fn().mockResolvedValue(undefined),
      embedBatch: jest.fn().mockResolvedValue(undefined),
    }),
    clearProjectCache: jest.fn(),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
}

describe('MCP Tool Consolidation (F10i.9)', () => {
  let registry: ToolRegistry;
  let tools: Tool[];

  beforeEach(() => {
    registry = new ToolRegistry(mockContext());
    tools = registry.getToolDefinitions();
  });

  // ── Structure Tests ────────────────────────────────────

  describe('tool structure', () => {
    it('should register exactly 12 tools', () => {
      expect(tools.length).toBe(12);
    });

    it('should have the correct 12 tool names', () => {
      const names = tools.map(t => t.name).sort();
      expect(names).toEqual([
        'checkpoint', 'context_query', 'decision', 'entity',
        'graph', 'hooks', 'index', 'memory',
        'message', 'project', 'reflection', 'session',
      ]);
    });

    it('should have action enum on all action-based tools (not context_query)', () => {
      const actionTools = tools.filter(t => t.name !== 'context_query');
      expect(actionTools.length).toBe(11);

      for (const tool of actionTools) {
        const actionProp = tool.inputSchema.properties.action as any;
        expect(actionProp).toBeDefined();
        expect(actionProp.type).toBe('string');
        expect(actionProp.enum).toBeDefined();
        expect(Array.isArray(actionProp.enum)).toBe(true);
        expect(actionProp.enum.length).toBeGreaterThan(0);
      }
    });

    it('should have action as required for action-based tools', () => {
      const actionTools = tools.filter(t => t.name !== 'context_query');
      for (const tool of actionTools) {
        expect(tool.inputSchema.required).toContain('action');
      }
    });

    it('context_query should require query, not action', () => {
      const cq = tools.find(t => t.name === 'context_query')!;
      expect(cq.inputSchema.required).toContain('query');
      expect(cq.inputSchema.properties.action).toBeUndefined();
    });
  });

  // ── Action Counts ──────────────────────────────────────

  describe('action counts per tool', () => {
    const expectedActions: Record<string, string[]> = {
      project: ['create', 'list', 'set_active', 'delete'],
      entity: ['add', 'get', 'search', 'delete'],
      index: ['codebase', 'document', 'sync', 'status'],
      session: ['create', 'list', 'archive', 'summarize'],
      message: ['store', 'history'],
      decision: ['search', 'create'],
      graph: ['link', 'query', 'stats'],
      checkpoint: ['save', 'load', 'list', 'delete'],
      memory: ['spill', 'recall', 'status'],
      reflection: ['store', 'query'],
      hooks: ['install', 'impact_report'],
    };

    for (const [toolName, actions] of Object.entries(expectedActions)) {
      it(`${toolName} should have actions: ${actions.join(', ')}`, () => {
        const tool = tools.find(t => t.name === toolName)!;
        const actionProp = tool.inputSchema.properties.action as any;
        expect(actionProp.enum.sort()).toEqual(actions.sort());
      });
    }
  });

  // ── Execution Tests ────────────────────────────────────

  describe('project tool', () => {
    it('should list projects', async () => {
      const result = await registry.execute('project', { action: 'list' }) as any;
      expect(result.projects).toBeDefined();
      expect(result.activeProject).toBeDefined();
    });

    it('should create a project', async () => {
      const result = await registry.execute('project', {
        action: 'create', name: 'new-proj', path: '/tmp/proj',
      }) as any;
      expect(result.success).toBe(true);
      expect(result.project).toBeDefined();
      expect(result.project.id).toBe('p1');
    });

    it('should reject create without required params', async () => {
      await expect(
        registry.execute('project', { action: 'create' })
      ).rejects.toThrow('Missing required parameter(s) for action "create": name, path');
    });

    it('should reject unknown action', async () => {
      await expect(
        registry.execute('project', { action: 'explode' })
      ).rejects.toThrow('Unknown action: explode');
    });
  });

  describe('entity tool', () => {
    it('should add an entity', async () => {
      const result = await registry.execute('entity', {
        action: 'add', type: 'function', name: 'myFunc',
        content: 'function myFunc() {}', project: 'test',
      }) as any;
      expect(result.success).toBe(true);
      expect(result.entity.name).toBe('myFunc');
    });

    it('should search entities', async () => {
      const result = await registry.execute('entity', {
        action: 'search', query: 'myFunc', project: 'test',
      }) as any;
      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.entities[0].name).toBe('myFunc');
    });

    it('should get entity by id', async () => {
      const result = await registry.execute('entity', {
        action: 'get', id: 'e1', project: 'test',
      }) as any;
      expect(result.success).toBe(true);
      expect(result.entity.id).toBe('e1');
    });

    it('should reject add without name', async () => {
      await expect(
        registry.execute('entity', { action: 'add', type: 'function', project: 'test' })
      ).rejects.toThrow('Missing required parameter(s) for action "add": name');
    });
  });

  describe('checkpoint tool', () => {
    it('should reject save without session', async () => {
      await expect(
        registry.execute('checkpoint', { action: 'save', state: {}, project: 'test' })
      ).rejects.toThrow('Missing required parameter(s) for action "save": session');
    });
  });

  describe('memory tool', () => {
    it('should reject recall without query', async () => {
      await expect(
        registry.execute('memory', { action: 'recall', session: 's1', project: 'test' })
      ).rejects.toThrow('Missing required parameter(s) for action "recall": query');
    });
  });

  // ── Utility Tests ──────────────────────────────────────

  describe('utility methods', () => {
    it('hasTool should return true for registered tools', () => {
      expect(registry.hasTool('project')).toBe(true);
      expect(registry.hasTool('entity')).toBe(true);
      expect(registry.hasTool('context_query')).toBe(true);
    });

    it('hasTool should return false for unregistered tools', () => {
      expect(registry.hasTool('create_project')).toBe(false);
      expect(registry.hasTool('add_entity')).toBe(false);
      expect(registry.hasTool('index_codebase')).toBe(false);
    });

    it('execute should throw for unknown tool', async () => {
      await expect(
        registry.execute('nonexistent', {})
      ).rejects.toThrow('Unknown tool: nonexistent');
    });

    it('getCoreService should return the CoreService', () => {
      expect(registry.getCoreService()).toBeDefined();
    });
  });

  // ── Description quality ────────────────────────────────

  describe('tool descriptions', () => {
    it('should list available actions in each description', () => {
      const actionTools = tools.filter(t => t.name !== 'context_query');
      for (const tool of actionTools) {
        const actionProp = tool.inputSchema.properties.action as any;
        for (const action of actionProp.enum) {
          expect(tool.description.toLowerCase()).toContain(action.replace('_', '_'));
        }
      }
    });
  });
});
