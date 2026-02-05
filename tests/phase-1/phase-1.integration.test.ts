/**
 * Phase 1 Integration Tests
 *
 * ============================================================================
 * WARNING: These tests will FAIL until the actual implementations are created.
 * ============================================================================
 *
 * This test file imports from source paths that don't exist yet. The imports
 * will cause compilation errors until the following modules are implemented:
 *
 * - src/database/DatabaseConnection.ts
 * - src/project/ProjectManager.ts
 * - src/entities/EntityStore.ts
 * - src/embeddings/EmbeddingManager.ts
 * - src/mcp/McpServer.ts
 *
 * Tests for how Phase 1 features interact with each other:
 * - Database + Project Management
 * - Project + Entity Storage
 * - Entity + Embedding Pipeline
 * - All components through MCP Server
 *
 * @see docs/IMPLEMENTATION.md Phase 1
 */

// ============================================================================
// ACTUAL IMPLEMENTATION IMPORTS (will fail until implementations exist)
// ============================================================================

import { DatabaseConnection } from '../../src/db/database-connection';
import { ProjectManager } from '../../src/project/project-manager';
import { Project, ProjectConfig } from '../../src/project/types';
import { EntityStore } from '../../src/entities/entity-store';
import { Entity, EntityType } from '../../src/entities/types';
import { EmbeddingManager } from '../../src/embeddings/embedding-manager';
import { EmbeddingProvider } from '../../src/embeddings/provider';
import { McpServer } from '../../src/mcp/mcp-server';
import { RelationshipStore } from '../../src/relationships/relationship-store';
import { Relationship } from '../../src/relationships/types';

// ============================================================================
// EXTERNAL DEPENDENCY MOCKS (only mock what we can't control)
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock file system operations for test isolation
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
}));

// Mock fetch for external embedding API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Phase 1 Integration', () => {
  // Real instances - these are the actual implementations being tested
  let db: DatabaseConnection;
  let projectManager: ProjectManager;
  let entityStore: EntityStore;
  let embeddingManager: EmbeddingManager;
  let relationshipStore: RelationshipStore;
  let mcpServer: McpServer;

  // Test database path (use temp directory)
  let testDbPath: string;
  let testProjectPath: string;

  beforeAll(() => {
    // Create unique test paths
    testDbPath = path.join(os.tmpdir(), `ctx-sys-test-${Date.now()}.db`);
    testProjectPath = path.join(os.tmpdir(), `ctx-sys-test-project-${Date.now()}`);

    // Mock file system to report test directory exists
    (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
      return p === testProjectPath || p.endsWith('.db');
    });
  });

  beforeEach(async () => {
    // Create REAL instances with test database
    db = new DatabaseConnection(testDbPath);
    await db.initialize();

    projectManager = new ProjectManager(db);
    entityStore = new EntityStore(db);
    embeddingManager = new EmbeddingManager(db);
    relationshipStore = new RelationshipStore(db);
    mcpServer = new McpServer({
      db,
      projectManager,
      entityStore,
      embeddingManager,
      relationshipStore,
    });

    // Reset external mocks
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up real database connection
    await db.close();
  });

  afterAll(() => {
    // Clean up test files
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  // ============================================================================
  // Database + Project Management Integration
  // ============================================================================

  describe('Database + Project Management', () => {
    it('should create global tables before project creation', async () => {
      // Verify global tables exist after initialization
      const tables = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('embedding_models');
      expect(tableNames).toContain('config');
    });

    it('should create project with project-specific tables', async () => {
      const project = await projectManager.createProject({
        name: 'test-project',
        path: testProjectPath,
      });

      // Verify project record exists
      const projectRecord = await db.get<Project>(
        'SELECT * FROM projects WHERE id = ?',
        [project.id]
      );
      expect(projectRecord).toBeDefined();
      expect(projectRecord!.name).toBe('test-project');

      // Verify project-specific tables were created
      const tables = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?",
        [`${project.id}_%`]
      );
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain(`${project.id}_entities`);
      expect(tableNames).toContain(`${project.id}_vectors`);
      expect(tableNames).toContain(`${project.id}_relationships`);
      expect(tableNames).toContain(`${project.id}_sessions`);
      expect(tableNames).toContain(`${project.id}_messages`);
      expect(tableNames).toContain(`${project.id}_fts`);
    });

    it('should drop project tables when project is deleted', async () => {
      // Create project
      const project = await projectManager.createProject({
        name: 'delete-test',
        path: testProjectPath,
      });

      // Verify tables exist
      let tables = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?",
        [`${project.id}_%`]
      );
      expect(tables.length).toBeGreaterThan(0);

      // Delete project
      await projectManager.deleteProject(project.id);

      // Verify tables are dropped
      tables = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?",
        [`${project.id}_%`]
      );
      expect(tables.length).toBe(0);

      // Verify project record is deleted
      const projectRecord = await db.get<Project>(
        'SELECT * FROM projects WHERE id = ?',
        [project.id]
      );
      expect(projectRecord).toBeUndefined();
    });

    it('should persist active project across restarts', async () => {
      const project = await projectManager.createProject({
        name: 'active-project',
        path: testProjectPath,
      });

      // Set as active
      await projectManager.setActiveProject(project.id);

      // Simulate restart by creating new manager with same db
      const newProjectManager = new ProjectManager(db);
      const activeProject = await newProjectManager.getActiveProject();

      expect(activeProject).toBeDefined();
      expect(activeProject!.id).toBe(project.id);
    });

    it('should update project timestamp after indexing', async () => {
      const project = await projectManager.createProject({
        name: 'index-test',
        path: testProjectPath,
      });

      const beforeUpdate = project.lastIndexedAt;

      // Simulate indexing completion
      await projectManager.updateLastIndexedAt(project.id);

      const updatedProject = await projectManager.getProject(project.id);
      expect(updatedProject!.lastIndexedAt).not.toEqual(beforeUpdate);
      expect(updatedProject!.lastIndexedAt).toBeDefined();
    });

    it('should use transactions for atomic project creation', async () => {
      // Force a failure during project creation to verify rollback
      const originalExec = db.exec.bind(db);
      let callCount = 0;
      jest.spyOn(db, 'exec').mockImplementation((sql: string) => {
        callCount++;
        // Fail on third call (during table creation)
        if (callCount === 3) {
          throw new Error('Simulated failure');
        }
        return originalExec(sql);
      });

      await expect(
        projectManager.createProject({
          name: 'fail-project',
          path: testProjectPath,
        })
      ).rejects.toThrow('Simulated failure');

      // Verify no partial project was created
      const projects = await projectManager.listProjects();
      const failedProject = projects.find((p) => p.name === 'fail-project');
      expect(failedProject).toBeUndefined();
    });
  });

  // ============================================================================
  // Project + Entity Storage Integration
  // ============================================================================

  describe('Project + Entity Storage', () => {
    let project: Project;

    beforeEach(async () => {
      project = await projectManager.createProject({
        name: 'entity-test-project',
        path: testProjectPath,
      });
      await projectManager.setActiveProject(project.id);
    });

    it('should store entities in project-specific table', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'AuthService',
        content: 'class AuthService { login() {} }',
        filePath: 'src/auth/service.ts',
      });

      // Verify entity is in project-specific table
      const storedEntity = await db.get<Entity>(
        `SELECT * FROM ${project.id}_entities WHERE id = ?`,
        [entity.id]
      );

      expect(storedEntity).toBeDefined();
      expect(storedEntity!.name).toBe('AuthService');
    });

    it('should isolate entities between projects', async () => {
      const project2 = await projectManager.createProject({
        name: 'project-2',
        path: testProjectPath + '-2',
      });

      // Create same-named entity in both projects
      const entity1 = await entityStore.createEntity(project.id, {
        type: 'class' as EntityType,
        name: 'AuthService',
        content: 'version 1',
      });

      const entity2 = await entityStore.createEntity(project2.id, {
        type: 'class' as EntityType,
        name: 'AuthService',
        content: 'version 2',
      });

      // Verify different IDs
      expect(entity1.id).not.toBe(entity2.id);

      // Verify isolation - entity1 not in project2's table
      const crossCheck = await db.get<Entity>(
        `SELECT * FROM ${project2.id}_entities WHERE id = ?`,
        [entity1.id]
      );
      expect(crossCheck).toBeUndefined();
    });

    it('should use project config for entity processing', async () => {
      // Create project with custom config
      const configuredProject = await projectManager.createProject({
        name: 'configured-project',
        path: testProjectPath + '-config',
        config: {
          summarization: {
            enabled: true,
            provider: 'ollama',
            model: 'qwen2.5-coder:7b',
          },
        } as Partial<ProjectConfig>,
      });

      const projectConfig = await projectManager.getProjectConfig(
        configuredProject.id
      );
      expect(projectConfig.summarization.enabled).toBe(true);
      expect(projectConfig.summarization.model).toBe('qwen2.5-coder:7b');
    });

    it('should track file entities with correct paths', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'file' as EntityType,
        name: 'service.ts',
        filePath: 'src/auth/service.ts',
        content: 'export class AuthService {}',
      });

      // File path should be relative, not absolute
      expect(entity.filePath).not.toContain(testProjectPath);
      expect(entity.filePath).toBe('src/auth/service.ts');
    });

    it('should cascade delete entities when project is deleted', async () => {
      // Create entities
      await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'Entity1',
      });
      await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'Entity2',
      });

      // Verify entities exist
      let entities = await entityStore.listEntities(project.id);
      expect(entities.length).toBe(2);

      // Delete project (should cascade to entities via table drop)
      await projectManager.deleteProject(project.id);

      // Table no longer exists, so this should fail or return empty
      await expect(entityStore.listEntities(project.id)).rejects.toThrow();
    });
  });

  // ============================================================================
  // Entity + Embedding Pipeline Integration
  // ============================================================================

  describe('Entity + Embedding Pipeline', () => {
    let project: Project;

    beforeEach(async () => {
      project = await projectManager.createProject({
        name: 'embedding-test-project',
        path: testProjectPath,
      });

      // Mock embedding API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: Array(768).fill(0).map(() => Math.random()),
        }),
      });
    });

    it('should generate embedding when entity is created with content', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'AuthService',
        content: 'export class AuthService { async login() {} }',
      });

      // Generate embedding for entity
      const embedding = await embeddingManager.generateEmbedding(
        project.id,
        entity.id,
        entity.content!
      );

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);

      // Verify embedding is stored
      const storedEmbedding = await db.get<{ embedding: string }>(
        `SELECT embedding FROM ${project.id}_vectors WHERE entity_id = ?`,
        [entity.id]
      );
      expect(storedEmbedding).toBeDefined();
    });

    it('should update embedding when entity content changes', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'TestEntity',
        content: 'original content',
      });

      await embeddingManager.generateEmbedding(
        project.id,
        entity.id,
        entity.content!
      );

      // Update entity content
      const newContent = 'updated content with more details';
      await entityStore.updateEntity(project.id, entity.id, {
        content: newContent,
      });

      // Regenerate embedding
      await embeddingManager.updateEmbedding(project.id, entity.id, newContent);

      // Verify embedding was updated (check call count)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should delete embedding when entity is deleted', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'ToDelete',
        content: 'some content',
      });

      await embeddingManager.generateEmbedding(
        project.id,
        entity.id,
        entity.content!
      );

      // Delete entity
      await entityStore.deleteEntity(project.id, entity.id);

      // Embedding should be deleted
      const embedding = await db.get(
        `SELECT * FROM ${project.id}_vectors WHERE entity_id = ?`,
        [entity.id]
      );
      expect(embedding).toBeUndefined();
    });

    it('should find related entities via embedding similarity', async () => {
      // Create entities with related content
      const authEntity = await entityStore.createEntity(project.id, {
        type: 'class' as EntityType,
        name: 'AuthService',
        content: 'Handles user authentication and login',
      });

      const loginEntity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'loginHandler',
        content: 'Processes user login requests',
      });

      const unrelatedEntity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'calculateTax',
        content: 'Computes tax amounts for purchases',
      });

      // Generate embeddings
      await embeddingManager.generateEmbedding(
        project.id,
        authEntity.id,
        authEntity.content!
      );
      await embeddingManager.generateEmbedding(
        project.id,
        loginEntity.id,
        loginEntity.content!
      );
      await embeddingManager.generateEmbedding(
        project.id,
        unrelatedEntity.id,
        unrelatedEntity.content!
      );

      // Search for authentication-related entities
      const results = await embeddingManager.findSimilar(
        project.id,
        'authentication and user login',
        { limit: 10 }
      );

      expect(results.length).toBeGreaterThan(0);
      // Auth-related entities should rank higher than tax calculation
      const authIndex = results.findIndex((r) => r.entityId === authEntity.id);
      const taxIndex = results.findIndex(
        (r) => r.entityId === unrelatedEntity.id
      );

      if (authIndex !== -1 && taxIndex !== -1) {
        expect(authIndex).toBeLessThan(taxIndex);
      }
    });

    it('should batch embed multiple entities efficiently', async () => {
      const entities = await Promise.all([
        entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: 'Entity1',
          content: 'content 1',
        }),
        entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: 'Entity2',
          content: 'content 2',
        }),
        entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: 'Entity3',
          content: 'content 3',
        }),
      ]);

      // Mock batch embedding response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: entities.map(() =>
            Array(768)
              .fill(0)
              .map(() => Math.random())
          ),
        }),
      });

      // Batch embed
      await embeddingManager.batchGenerateEmbeddings(
        project.id,
        entities.map((e) => ({ entityId: e.id, content: e.content! }))
      );

      // Verify all embeddings exist
      for (const entity of entities) {
        const embedding = await db.get(
          `SELECT * FROM ${project.id}_vectors WHERE entity_id = ?`,
          [entity.id]
        );
        expect(embedding).toBeDefined();
      }
    });
  });

  // ============================================================================
  // Full Stack Integration (MCP -> All Components)
  // ============================================================================

  describe('Full Stack Integration', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: Array(768).fill(0).map(() => Math.random()),
        }),
      });
    });

    it('should handle create_project -> add_entity flow', async () => {
      // 1. Create project via MCP tool
      const createProjectResult = await mcpServer.handleToolCall(
        'create_project',
        {
          name: 'mcp-test-project',
          path: testProjectPath,
        }
      );
      expect(createProjectResult.success).toBe(true);
      const projectId = createProjectResult.projectId;

      // 2. Set as active via MCP
      await mcpServer.handleToolCall('set_active_project', {
        projectId,
      });

      // 3. Add entity via MCP
      const addEntityResult = await mcpServer.handleToolCall('add_entity', {
        type: 'concept',
        name: 'caching',
        content: 'Caching strategy for improved performance',
      });
      expect(addEntityResult.success).toBe(true);

      // 4. Verify entity was created with embedding
      const entity = await entityStore.getEntity(
        projectId,
        addEntityResult.entityId
      );
      expect(entity).toBeDefined();
      expect(entity!.name).toBe('caching');

      const embedding = await db.get(
        `SELECT * FROM ${projectId}_vectors WHERE entity_id = ?`,
        [addEntityResult.entityId]
      );
      expect(embedding).toBeDefined();
    });

    it('should handle list_projects with entity counts', async () => {
      // Create projects with different entity counts
      const project1 = await projectManager.createProject({
        name: 'project-with-entities',
        path: testProjectPath,
      });

      const project2 = await projectManager.createProject({
        name: 'project-empty',
        path: testProjectPath + '-empty',
      });

      // Add entities to project1
      for (let i = 0; i < 5; i++) {
        await entityStore.createEntity(project1.id, {
          type: 'function' as EntityType,
          name: `Entity${i}`,
        });
      }

      // List projects via MCP
      const listResult = await mcpServer.handleToolCall('list_projects', {});

      expect(listResult.projects.length).toBe(2);

      const proj1Result = listResult.projects.find(
        (p: { id: string }) => p.id === project1.id
      );
      const proj2Result = listResult.projects.find(
        (p: { id: string }) => p.id === project2.id
      );

      expect(proj1Result.entityCount).toBe(5);
      expect(proj2Result.entityCount).toBe(0);
    });

    it('should handle project deletion with cascading cleanup', async () => {
      const project = await projectManager.createProject({
        name: 'cleanup-test',
        path: testProjectPath,
      });

      // Add entities with embeddings
      for (let i = 0; i < 3; i++) {
        const entity = await entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: `Entity${i}`,
          content: `content ${i}`,
        });
        await embeddingManager.generateEmbedding(
          project.id,
          entity.id,
          entity.content!
        );
      }

      // Delete project via MCP
      const deleteResult = await mcpServer.handleToolCall('delete_project', {
        projectId: project.id,
      });
      expect(deleteResult.success).toBe(true);

      // Verify complete cleanup
      const tables = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?",
        [`${project.id}_%`]
      );
      expect(tables.length).toBe(0);
    });

    it('should support multi-project entity search', async () => {
      const project1 = await projectManager.createProject({
        name: 'search-project-1',
        path: testProjectPath,
      });

      const project2 = await projectManager.createProject({
        name: 'search-project-2',
        path: testProjectPath + '-2',
      });

      // Add entities to both projects
      const entity1 = await entityStore.createEntity(project1.id, {
        type: 'class' as EntityType,
        name: 'AuthService',
        content: 'Authentication service implementation',
      });
      await embeddingManager.generateEmbedding(
        project1.id,
        entity1.id,
        entity1.content!
      );

      const entity2 = await entityStore.createEntity(project2.id, {
        type: 'class' as EntityType,
        name: 'AuthProvider',
        content: 'Authentication provider for OAuth',
      });
      await embeddingManager.generateEmbedding(
        project2.id,
        entity2.id,
        entity2.content!
      );

      // Search across projects via MCP
      const searchResult = await mcpServer.handleToolCall(
        'query_cross_project',
        {
          query: 'authentication',
          projects: [project1.id, project2.id],
        }
      );

      expect(searchResult.results.length).toBe(2);
      expect(
        searchResult.results.some(
          (r: { projectId: string }) => r.projectId === project1.id
        )
      ).toBe(true);
      expect(
        searchResult.results.some(
          (r: { projectId: string }) => r.projectId === project2.id
        )
      ).toBe(true);
    });
  });

  // ============================================================================
  // FTS + Entity Integration
  // ============================================================================

  describe('FTS + Entity Integration', () => {
    let project: Project;

    beforeEach(async () => {
      project = await projectManager.createProject({
        name: 'fts-test-project',
        path: testProjectPath,
      });
    });

    it('should populate FTS when entity is inserted', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'class' as EntityType,
        name: 'UserAuthService',
        content: 'Handles user authentication and session management',
        summary: 'Authentication service for users',
      });

      // FTS should be searchable
      const results = await entityStore.searchFTS(
        project.id,
        'authentication'
      );

      expect(results.length).toBe(1);
      expect(results[0].id).toBe(entity.id);
    });

    it('should update FTS when entity is updated', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'class' as EntityType,
        name: 'AuthService',
        content: 'Initial content',
      });

      // Update content
      await entityStore.updateEntity(project.id, entity.id, {
        content: 'New content about authorization and permissions',
      });

      // Should find with new term
      const results = await entityStore.searchFTS(project.id, 'authorization');
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(entity.id);
    });

    it('should remove from FTS when entity is deleted', async () => {
      const entity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'DeleteMe',
        content: 'Unique searchable content xyz123',
      });

      // Verify searchable
      let results = await entityStore.searchFTS(project.id, 'xyz123');
      expect(results.length).toBe(1);

      // Delete entity
      await entityStore.deleteEntity(project.id, entity.id);

      // Should not be found
      results = await entityStore.searchFTS(project.id, 'xyz123');
      expect(results.length).toBe(0);
    });
  });

  // ============================================================================
  // Error Recovery and Edge Cases
  // ============================================================================

  describe('Error Recovery', () => {
    let project: Project;

    beforeEach(async () => {
      project = await projectManager.createProject({
        name: 'error-test-project',
        path: testProjectPath,
      });
    });

    it('should rollback on entity creation failure', async () => {
      // Force embedding generation to fail
      mockFetch.mockRejectedValueOnce(new Error('Embedding API unavailable'));

      // Create entity with auto-embedding should fail
      await expect(
        entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: 'FailEntity',
          content: 'content',
          autoEmbed: true,
        })
      ).rejects.toThrow();

      // Entity should not exist
      const entities = await entityStore.listEntities(project.id);
      const failedEntity = entities.find((e) => e.name === 'FailEntity');
      expect(failedEntity).toBeUndefined();
    });

    it('should handle missing embedding provider gracefully', async () => {
      // Mock provider unavailable
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const isAvailable = await embeddingManager.checkProviderAvailable();
      expect(isAvailable).toBe(false);

      // Should still create entity without embedding
      const entity = await entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'NoEmbeddingEntity',
        content: 'some content',
        autoEmbed: false,
      });

      expect(entity).toBeDefined();
      expect(entity.name).toBe('NoEmbeddingEntity');
    });

    it('should handle database lock gracefully', async () => {
      // Simulate database lock by starting long transaction
      const lockPromise = db.transaction(async () => {
        // Hold lock
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Concurrent operation should queue or fail gracefully
      const entityPromise = entityStore.createEntity(project.id, {
        type: 'function' as EntityType,
        name: 'ConcurrentEntity',
      });

      // Both should eventually complete
      await Promise.all([lockPromise, entityPromise]);
    });

    it('should handle concurrent operations', async () => {
      // Create multiple entities concurrently
      const operations = Array(10)
        .fill(null)
        .map((_, i) =>
          entityStore.createEntity(project.id, {
            type: 'function' as EntityType,
            name: `ConcurrentEntity${i}`,
          })
        );

      const results = await Promise.all(operations);

      expect(results.length).toBe(10);
      expect(new Set(results.map((r) => r.id)).size).toBe(10); // All unique IDs
    });
  });

  // ============================================================================
  // Configuration Integration
  // ============================================================================

  describe('Configuration Integration', () => {
    it('should apply project config to entity processing', async () => {
      const project = await projectManager.createProject({
        name: 'config-test',
        path: testProjectPath,
        config: {
          indexing: {
            mode: 'full',
            watch: false,
            ignore: ['*.test.ts', '__mocks__'],
            languages: ['typescript'],
          },
        } as Partial<ProjectConfig>,
      });

      const config = await projectManager.getProjectConfig(project.id);

      expect(config.indexing.ignore).toContain('*.test.ts');
      expect(config.indexing.ignore).toContain('__mocks__');
    });

    it('should use project embedding config', async () => {
      const project = await projectManager.createProject({
        name: 'embedding-config-test',
        path: testProjectPath,
        config: {
          embeddings: {
            provider: 'openai',
            model: 'text-embedding-3-small',
          },
        } as Partial<ProjectConfig>,
      });

      const config = await projectManager.getProjectConfig(project.id);

      expect(config.embeddings.provider).toBe('openai');
      expect(config.embeddings.model).toBe('text-embedding-3-small');
    });

    it('should respect project summarization config', async () => {
      const project = await projectManager.createProject({
        name: 'summarization-config-test',
        path: testProjectPath,
        config: {
          summarization: {
            enabled: false,
            provider: 'ollama',
            model: 'qwen2.5-coder:7b',
          },
        } as Partial<ProjectConfig>,
      });

      const config = await projectManager.getProjectConfig(project.id);

      expect(config.summarization.enabled).toBe(false);
    });
  });

  // ============================================================================
  // Performance Considerations
  // ============================================================================

  describe('Performance', () => {
    let project: Project;

    beforeEach(async () => {
      project = await projectManager.createProject({
        name: 'performance-test',
        path: testProjectPath,
      });
    });

    it('should use transactions for batch operations', async () => {
      const entities = Array(100)
        .fill(null)
        .map((_, i) => ({
          type: 'function' as EntityType,
          name: `BatchEntity${i}`,
        }));

      // Batch insert should use transaction
      await entityStore.batchCreateEntities(project.id, entities);

      // Verify all created
      const storedEntities = await entityStore.listEntities(project.id);
      expect(storedEntities.length).toBe(100);
    });

    it('should limit similarity search results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: Array(768).fill(0).map(() => Math.random()),
        }),
      });

      // Create many entities
      for (let i = 0; i < 50; i++) {
        const entity = await entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: `Entity${i}`,
          content: `content ${i}`,
        });
        await embeddingManager.generateEmbedding(
          project.id,
          entity.id,
          entity.content!
        );
      }

      // Search with limit
      const results = await embeddingManager.findSimilar(
        project.id,
        'content',
        { limit: 20 }
      );

      expect(results.length).toBeLessThanOrEqual(20);
    });

    it('should use indexed columns for queries', async () => {
      // Create entities
      for (let i = 0; i < 10; i++) {
        await entityStore.createEntity(project.id, {
          type: 'function' as EntityType,
          name: `IndexedEntity${i}`,
          filePath: `src/module${i}/file.ts`,
          qualifiedName: `module${i}::IndexedEntity${i}`,
        });
      }

      // These queries should use indexes (verify via EXPLAIN QUERY PLAN in real tests)
      const byId = await entityStore.getEntity(
        project.id,
        'some-id'
      );
      const byType = await entityStore.findByType(
        project.id,
        'function' as EntityType
      );
      const byPath = await entityStore.findByFilePath(
        project.id,
        'src/module0/file.ts'
      );
      const byQualifiedName = await entityStore.findByQualifiedName(
        project.id,
        'module0::IndexedEntity0'
      );

      // Just verify queries execute (index usage would be verified separately)
      expect(byType.length).toBe(10);
      expect(byPath.length).toBe(1);
      expect(byQualifiedName).toBeDefined();
    });
  });
});
