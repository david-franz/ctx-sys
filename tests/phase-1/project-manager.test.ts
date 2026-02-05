import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { ProjectManager } from '../../src/project/manager';
import { DEFAULT_PROJECT_CONFIG } from '../../src/project/types';

describe('F1.2 Project Management', () => {
  let db: DatabaseConnection;
  let projectManager: ProjectManager;
  let testDbPath: string;
  let testProjectDir: string;

  beforeEach(async () => {
    // Create temporary directories
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    testProjectDir = path.join(testDir, 'test-project');
    fs.mkdirSync(testProjectDir);

    // Initialize database and project manager
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    projectManager = new ProjectManager(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test directory
    if (testDbPath) {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    }
  });

  describe('create', () => {
    it('should create a project with default config', async () => {
      const project = await projectManager.create('my-project', testProjectDir);

      expect(project.name).toBe('my-project');
      expect(project.path).toBe(testProjectDir);
      expect(project.config).toEqual(DEFAULT_PROJECT_CONFIG);
      expect(project.id).toBeDefined();
      expect(project.createdAt).toBeInstanceOf(Date);
    });

    it('should create a project with custom config', async () => {
      const customConfig = {
        indexing: {
          mode: 'full' as const,
          watch: true,
          ignore: ['custom-ignore']
        }
      };

      const project = await projectManager.create('custom-project', testProjectDir, customConfig);

      expect(project.config.indexing.mode).toBe('full');
      expect(project.config.indexing.watch).toBe(true);
      expect(project.config.indexing.ignore).toEqual(['custom-ignore']);
      // Default values should be preserved for unspecified fields
      expect(project.config.summarization).toEqual(DEFAULT_PROJECT_CONFIG.summarization);
    });

    it('should reject duplicate project names', async () => {
      await projectManager.create('duplicate-test', testProjectDir);

      await expect(
        projectManager.create('duplicate-test', testProjectDir)
      ).rejects.toThrow('already exists');
    });

    it('should reject invalid paths', async () => {
      await expect(
        projectManager.create('invalid-path', '/nonexistent/path/12345')
      ).rejects.toThrow('does not exist');
    });

    it('should reject invalid project names', async () => {
      await expect(
        projectManager.create('Invalid Name!', testProjectDir)
      ).rejects.toThrow('Invalid project name');

      await expect(
        projectManager.create('UPPERCASE', testProjectDir)
      ).rejects.toThrow('Invalid project name');

      await expect(
        projectManager.create('-starts-with-hyphen', testProjectDir)
      ).rejects.toThrow('Invalid project name');
    });

    it('should accept valid project names', async () => {
      const validNames = ['a', 'ab', 'my-project', 'project-123', 'a1b2c3'];

      for (const name of validNames) {
        const project = await projectManager.create(name, testProjectDir);
        expect(project.name).toBe(name);
        await projectManager.delete(name);
      }
    });

    it('should create project-specific tables', async () => {
      const project = await projectManager.create('table-test', testProjectDir);

      // Check that entities table was created
      const tables = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?`,
        [`%_entities`]
      );
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  describe('get', () => {
    it('should retrieve project by ID', async () => {
      const created = await projectManager.create('get-by-id', testProjectDir);
      const retrieved = await projectManager.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('get-by-id');
    });

    it('should retrieve project by name', async () => {
      await projectManager.create('get-by-name', testProjectDir);
      const retrieved = await projectManager.get('get-by-name');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('get-by-name');
    });

    it('should return null for non-existent project', async () => {
      const retrieved = await projectManager.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all projects', async () => {
      await projectManager.create('project-a', testProjectDir);
      await projectManager.create('project-b', testProjectDir);
      await projectManager.create('project-c', testProjectDir);

      const projects = await projectManager.list();

      expect(projects).toHaveLength(3);
      expect(projects.map(p => p.name)).toEqual(['project-a', 'project-b', 'project-c']);
    });

    it('should return empty array when no projects exist', async () => {
      const projects = await projectManager.list();
      expect(projects).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update project name', async () => {
      await projectManager.create('old-name', testProjectDir);
      const updated = await projectManager.update('old-name', { name: 'new-name' });

      expect(updated.name).toBe('new-name');

      // Old name should no longer exist
      const oldProject = await projectManager.getByName('old-name');
      expect(oldProject).toBeNull();
    });

    it('should update project config', async () => {
      await projectManager.create('config-update', testProjectDir);
      const updated = await projectManager.update('config-update', {
        config: {
          indexing: { mode: 'manual', watch: false, ignore: [] }
        } as any
      });

      expect(updated.config.indexing.mode).toBe('manual');
    });

    it('should merge config deeply', async () => {
      await projectManager.create('deep-merge', testProjectDir);
      const updated = await projectManager.update('deep-merge', {
        config: {
          indexing: { watch: true }
        } as any
      });

      // Should preserve other indexing options
      expect(updated.config.indexing.watch).toBe(true);
      expect(updated.config.indexing.mode).toBe('incremental');
    });

    it('should update timestamp', async () => {
      const created = await projectManager.create('timestamp-test', testProjectDir);

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await projectManager.update('timestamp-test', { name: 'timestamp-test-2' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('should reject update for non-existent project', async () => {
      await expect(
        projectManager.update('non-existent', { name: 'new-name' })
      ).rejects.toThrow('not found');
    });

    it('should reject duplicate name on update', async () => {
      await projectManager.create('existing-name', testProjectDir);
      await projectManager.create('to-rename', testProjectDir);

      await expect(
        projectManager.update('to-rename', { name: 'existing-name' })
      ).rejects.toThrow('already exists');
    });
  });

  describe('delete', () => {
    it('should delete project and tables', async () => {
      const project = await projectManager.create('to-delete', testProjectDir);
      await projectManager.delete('to-delete');

      const retrieved = await projectManager.get('to-delete');
      expect(retrieved).toBeNull();

      // Tables should be dropped (prefixed with p_)
      const tables = db.all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?`,
        [`p_${project.id.replace(/-/g, '_')}_%`]
      );
      expect(tables).toHaveLength(0);
    });

    it('should keep data when keepData=true', async () => {
      const project = await projectManager.create('keep-data', testProjectDir);

      // Insert some data (table name prefixed with p_)
      const prefix = `p_${project.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      db.run(
        `INSERT INTO ${prefix}_entities (id, type, name) VALUES (?, ?, ?)`,
        ['e1', 'function', 'test']
      );

      await projectManager.delete('keep-data', true);

      // Project record should be deleted
      const retrieved = await projectManager.get('keep-data');
      expect(retrieved).toBeNull();

      // But data should remain
      const entity = db.get<{ name: string }>(
        `SELECT name FROM ${prefix}_entities WHERE id = ?`,
        ['e1']
      );
      expect(entity).toBeDefined();
    });

    it('should clear active project if deleted', async () => {
      await projectManager.create('active-delete', testProjectDir);
      await projectManager.setActive('active-delete');
      await projectManager.delete('active-delete');

      const active = await projectManager.getActive();
      expect(active).toBeNull();
    });

    it('should reject delete for non-existent project', async () => {
      await expect(
        projectManager.delete('non-existent')
      ).rejects.toThrow('not found');
    });
  });

  describe('active project', () => {
    it('should set and get active project', async () => {
      await projectManager.create('active-test', testProjectDir);
      await projectManager.setActive('active-test');

      const active = await projectManager.getActive();
      expect(active).not.toBeNull();
      expect(active!.name).toBe('active-test');
    });

    it('should persist active project across instances', async () => {
      await projectManager.create('persist-active', testProjectDir);
      await projectManager.setActive('persist-active');

      // Create new project manager instance
      const newManager = new ProjectManager(db);
      const active = await newManager.getActive();

      expect(active).not.toBeNull();
      expect(active!.name).toBe('persist-active');
    });

    it('should return null when no active project', async () => {
      const active = await projectManager.getActive();
      expect(active).toBeNull();
    });

    it('should clear active project', async () => {
      await projectManager.create('to-clear', testProjectDir);
      await projectManager.setActive('to-clear');
      await projectManager.clearActive();

      const active = await projectManager.getActive();
      expect(active).toBeNull();
    });

    it('should reject setting non-existent project as active', async () => {
      await expect(
        projectManager.setActive('non-existent')
      ).rejects.toThrow('not found');
    });
  });

  describe('utility methods', () => {
    it('should check if project exists', async () => {
      await projectManager.create('exists-test', testProjectDir);

      expect(await projectManager.exists('exists-test')).toBe(true);
      expect(await projectManager.exists('non-existent')).toBe(false);
    });

    it('should count projects', async () => {
      expect(await projectManager.count()).toBe(0);

      await projectManager.create('count-1', testProjectDir);
      expect(await projectManager.count()).toBe(1);

      await projectManager.create('count-2', testProjectDir);
      expect(await projectManager.count()).toBe(2);

      await projectManager.delete('count-1');
      expect(await projectManager.count()).toBe(1);
    });
  });
});
