/**
 * F1.2 Project Management Tests
 *
 * Tests for ProjectManager class covering CRUD operations,
 * configuration management, and active project handling.
 *
 * These tests will FAIL until the actual implementation is created.
 * Implement the classes in src/project/ to make them pass.
 *
 * @see docs/phase-1/F1.2-project-management.md
 */

// Import actual implementations - these will fail until implemented
import { ProjectManager } from '../../src/project/manager';
import { Project, ProjectConfig } from '../../src/project/types';
import { DatabaseConnection } from '../../src/db/connection';

// Import mocks for dependencies
import {
  createMockDatabase,
  createMockProjectConfig,
  MockDatabase
} from '../helpers/mocks';

// Mock the database connection
jest.mock('../../src/db/connection');

describe('F1.2 Project Management', () => {
  let mockDb: MockDatabase;
  let projectManager: ProjectManager;

  beforeEach(() => {
    mockDb = createMockDatabase();
    (DatabaseConnection as jest.Mock).mockImplementation(() => ({
      db: mockDb,
      run: mockDb.run,
      get: mockDb.get,
      all: mockDb.all,
      exec: mockDb.exec,
      transaction: mockDb.transaction
    }));

    const connection = new DatabaseConnection(':memory:');
    projectManager = new ProjectManager(connection);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // Project CRUD Operations
  // ============================================================================

  describe('ProjectManager', () => {
    describe('create', () => {
      it('should create a project with default config', async () => {
        const project = await projectManager.create('test-project', '/home/user/test-project');

        expect(project).toBeDefined();
        expect(project.name).toBe('test-project');
        expect(project.path).toBe('/home/user/test-project');
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO projects'),
          expect.any(Array)
        );
      });

      it('should create a project with custom config', async () => {
        const customConfig: Partial<ProjectConfig> = {
          indexing: { mode: 'full', watch: true, ignore: [] },
          summarization: { enabled: false, provider: 'openai', model: 'gpt-4o-mini' }
        };

        const project = await projectManager.create(
          'custom-project',
          '/home/user/custom',
          customConfig
        );

        expect(project.config.indexing.mode).toBe('full');
        expect(project.config.summarization.enabled).toBe(false);
      });

      it('should reject duplicate project names', async () => {
        mockDb.get.mockReturnValueOnce({ id: 'existing', name: 'my-project' });

        await expect(
          projectManager.create('my-project', '/some/path')
        ).rejects.toThrow(/already exists/i);
      });

      it('should reject invalid paths', async () => {
        const invalidPath = '/nonexistent/path/to/project';

        await expect(
          projectManager.create('test', invalidPath)
        ).rejects.toThrow(/path/i);
      });

      it('should generate unique UUID for project ID', async () => {
        const project1 = await projectManager.create('proj1', '/path1');
        const project2 = await projectManager.create('proj2', '/path2');

        expect(project1.id).not.toBe(project2.id);
        expect(project1.id).toMatch(/^proj[-_][a-zA-Z0-9]+$/);
      });

      it('should create project-specific database tables', async () => {
        const project = await projectManager.create('test', '/path');

        expect(mockDb.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${project.id}_entities`)
        );
        expect(mockDb.exec).toHaveBeenCalledWith(
          expect.stringContaining(`${project.id}_vectors`)
        );
      });

      it('should set timestamps on creation', async () => {
        const before = new Date();
        const project = await projectManager.create('test', '/path');
        const after = new Date();

        expect(project.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(project.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
        expect(project.updatedAt.getTime()).toEqual(project.createdAt.getTime());
      });
    });

    describe('get', () => {
      it('should retrieve project by ID', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test-project',
          path: '/home/user/test',
          config: JSON.stringify(createMockProjectConfig()),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const project = await projectManager.get('proj_123');

        expect(project).toBeDefined();
        expect(project?.id).toBe('proj_123');
        expect(project?.name).toBe('test-project');
      });

      it('should return null for non-existent project', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        const project = await projectManager.get('nonexistent');

        expect(project).toBeNull();
      });

      it('should parse JSON config', async () => {
        const config = createMockProjectConfig();
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: JSON.stringify(config),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const project = await projectManager.get('proj_123');

        expect(project?.config.indexing.mode).toBe(config.indexing.mode);
      });
    });

    describe('getByName', () => {
      it('should retrieve project by name', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'my-project',
          path: '/path',
          config: JSON.stringify(createMockProjectConfig()),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const project = await projectManager.getByName('my-project');

        expect(project?.name).toBe('my-project');
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('WHERE name = ?'),
          ['my-project']
        );
      });

      it('should return null for non-existent name', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        const project = await projectManager.getByName('nonexistent');

        expect(project).toBeNull();
      });
    });

    describe('list', () => {
      it('should return all projects', async () => {
        mockDb.all.mockReturnValueOnce([
          { id: 'p1', name: 'proj1', path: '/p1', config: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          { id: 'p2', name: 'proj2', path: '/p2', config: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        ]);

        const projects = await projectManager.list();

        expect(projects).toHaveLength(2);
        expect(projects[0].name).toBe('proj1');
      });

      it('should return empty array when no projects', async () => {
        mockDb.all.mockReturnValueOnce([]);

        const projects = await projectManager.list();

        expect(projects).toEqual([]);
      });

      it('should order by created_at descending', async () => {
        const projects = await projectManager.list();

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.any(Array)
        );
      });
    });

    describe('update', () => {
      it('should update project name', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'old-name',
          path: '/path',
          config: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const updated = await projectManager.update('proj_123', { name: 'new-name' });

        expect(updated.name).toBe('new-name');
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE projects'),
          expect.arrayContaining(['new-name'])
        );
      });

      it('should update project config', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: JSON.stringify(createMockProjectConfig()),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const updated = await projectManager.update('proj_123', {
          config: { indexing: { mode: 'manual', watch: false, ignore: [] } }
        });

        expect(updated.config.indexing.mode).toBe('manual');
      });

      it('should update updatedAt timestamp', async () => {
        const oldDate = new Date('2024-01-01');
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: '{}',
          created_at: oldDate.toISOString(),
          updated_at: oldDate.toISOString()
        });

        const updated = await projectManager.update('proj_123', { name: 'new' });

        expect(updated.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
      });

      it('should throw for non-existent project', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        await expect(
          projectManager.update('nonexistent', { name: 'new' })
        ).rejects.toThrow();
      });
    });

    describe('delete', () => {
      it('should delete project and tables', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await projectManager.delete('proj_123');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM projects'),
          ['proj_123']
        );
        expect(mockDb.exec).toHaveBeenCalledWith(
          expect.stringContaining('DROP TABLE')
        );
      });

      it('should keep data when keepData option is true', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await projectManager.delete('proj_123', { keepData: true });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM projects'),
          ['proj_123']
        );
        // Should NOT drop tables
        expect(mockDb.exec).not.toHaveBeenCalledWith(
          expect.stringContaining('DROP TABLE')
        );
      });

      it('should throw for non-existent project', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        await expect(projectManager.delete('nonexistent')).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // Active Project Management
  // ============================================================================

  describe('Active Project', () => {
    describe('setActive', () => {
      it('should set the active project', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await projectManager.setActive('proj_123');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('config'),
          expect.arrayContaining(['activeProject', 'proj_123'])
        );
      });

      it('should throw for non-existent project', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        await expect(projectManager.setActive('nonexistent')).rejects.toThrow();
      });
    });

    describe('getActive', () => {
      it('should return the active project', async () => {
        mockDb.get
          .mockReturnValueOnce({ value: '"proj_123"' }) // Config lookup
          .mockReturnValueOnce({
            id: 'proj_123',
            name: 'test',
            path: '/path',
            config: '{}',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        const active = await projectManager.getActive();

        expect(active?.id).toBe('proj_123');
      });

      it('should return null when no active project', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        const active = await projectManager.getActive();

        expect(active).toBeNull();
      });
    });

    describe('clearActive', () => {
      it('should clear the active project', async () => {
        await projectManager.clearActive();

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining(['activeProject'])
        );
      });
    });
  });

  // ============================================================================
  // Project Configuration
  // ============================================================================

  describe('Configuration', () => {
    describe('updateConfig', () => {
      it('should merge config updates', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: JSON.stringify(createMockProjectConfig()),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const updated = await projectManager.updateConfig('proj_123', {
          indexing: { watch: true }
        });

        expect(updated.config.indexing.watch).toBe(true);
        // Other config should be preserved
        expect(updated.config.summarization).toBeDefined();
      });

      it('should validate config updates', async () => {
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: '{}',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        await expect(
          projectManager.updateConfig('proj_123', {
            indexing: { mode: 'invalid' as any }
          })
        ).rejects.toThrow();
      });
    });

    describe('getConfig', () => {
      it('should return project config', async () => {
        const expectedConfig = createMockProjectConfig();
        mockDb.get.mockReturnValueOnce({
          id: 'proj_123',
          name: 'test',
          path: '/path',
          config: JSON.stringify(expectedConfig),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        const config = await projectManager.getConfig('proj_123');

        expect(config.indexing.mode).toBe(expectedConfig.indexing.mode);
      });

      it('should throw for non-existent project', async () => {
        mockDb.get.mockReturnValueOnce(undefined);

        await expect(projectManager.getConfig('nonexistent')).rejects.toThrow();
      });
    });
  });

  // ============================================================================
  // Index Status
  // ============================================================================

  describe('Index Status', () => {
    describe('updateLastIndexed', () => {
      it('should update last_indexed_at timestamp', async () => {
        await projectManager.updateLastIndexed('proj_123');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('last_indexed_at'),
          expect.any(Array)
        );
      });

      it('should update last_sync_commit when provided', async () => {
        await projectManager.updateLastIndexed('proj_123', 'abc123');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('last_sync_commit'),
          expect.arrayContaining(['abc123'])
        );
      });
    });

    describe('getIndexStatus', () => {
      it('should return index status', async () => {
        mockDb.get.mockReturnValueOnce({
          last_indexed_at: new Date().toISOString(),
          last_sync_commit: 'abc123'
        });

        const status = await projectManager.getIndexStatus('proj_123');

        expect(status.lastIndexedAt).toBeInstanceOf(Date);
        expect(status.lastSyncCommit).toBe('abc123');
      });

      it('should return null dates when never indexed', async () => {
        mockDb.get.mockReturnValueOnce({
          last_indexed_at: null,
          last_sync_commit: null
        });

        const status = await projectManager.getIndexStatus('proj_123');

        expect(status.lastIndexedAt).toBeNull();
        expect(status.lastSyncCommit).toBeNull();
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle project names with special characters', async () => {
      const name = 'my-project_v2.0';
      mockDb.get.mockReturnValueOnce(undefined); // No existing

      const project = await projectManager.create(name, '/path');

      expect(project.name).toBe(name);
    });

    it('should handle very long project paths', async () => {
      const longPath = '/home/user/' + 'a'.repeat(200) + '/project';
      mockDb.get.mockReturnValueOnce(undefined);

      const project = await projectManager.create('test', longPath);

      expect(project.path).toBe(longPath);
    });

    it('should handle concurrent project creation', async () => {
      mockDb.get.mockReturnValue(undefined);

      const creates = Promise.all([
        projectManager.create('proj1', '/path1'),
        projectManager.create('proj2', '/path2'),
        projectManager.create('proj3', '/path3')
      ]);

      await expect(creates).resolves.toHaveLength(3);
    });
  });
});
