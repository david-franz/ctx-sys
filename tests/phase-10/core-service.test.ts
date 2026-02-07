import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppContext } from '../../src';
import { CoreService } from '../../src/services';

describe('F10.0 CoreService Layer', () => {
  let testDir: string;
  let testDbPath: string;
  let context: AppContext;
  let coreService: CoreService;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    context = new AppContext(testDbPath);
    await context.initialize();
    coreService = new CoreService(context);
  });

  afterEach(async () => {
    await context.close();
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Project Management', () => {
    it('should create a project', async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      const project = await coreService.createProject('test-proj', projectPath);

      expect(project).toBeDefined();
      expect(project.name).toBe('test-proj');
      expect(project.path).toBe(projectPath);
    });

    it('should list projects', async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await coreService.createProject('test-proj', projectPath);
      const projects = await coreService.listProjects();

      expect(projects.length).toBe(1);
      expect(projects[0].name).toBe('test-proj');
    });

    it('should get a project by name', async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await coreService.createProject('test-proj', projectPath);
      const project = await coreService.getProject('test-proj');

      expect(project).toBeDefined();
      expect(project!.name).toBe('test-proj');
    });

    it('should set active project', async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await coreService.createProject('test-proj', projectPath);
      await coreService.setActiveProject('test-proj');

      const active = await coreService.getActiveProject();
      expect(active).toBeDefined();
      expect(active!.name).toBe('test-proj');
    });

    it('should delete a project', async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      await coreService.createProject('test-proj', projectPath);
      await coreService.deleteProject('test-proj');

      const projects = await coreService.listProjects();
      expect(projects.length).toBe(0);
    });
  });

  describe('Entity Management', () => {
    let projectId: string;

    beforeEach(async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });
      const project = await coreService.createProject('test-proj', projectPath);
      projectId = project.id;
    });

    it('should add an entity', async () => {
      const entity = await coreService.addEntity(projectId, {
        type: 'concept',
        name: 'test-concept',
        summary: 'A test concept'
      });

      expect(entity).toBeDefined();
      expect(entity.name).toBe('test-concept');
      expect(entity.type).toBe('concept');
    });

    it('should get an entity by id', async () => {
      const created = await coreService.addEntity(projectId, {
        type: 'concept',
        name: 'test-concept'
      });

      const entity = await coreService.getEntity(projectId, created.id);
      expect(entity).toBeDefined();
      expect(entity!.id).toBe(created.id);
    });

    it('should search entities', async () => {
      await coreService.addEntity(projectId, {
        type: 'concept',
        name: 'authentication-flow',
        summary: 'User authentication flow'
      });

      const results = await coreService.searchEntities(projectId, 'authentication');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should delete an entity', async () => {
      const entity = await coreService.addEntity(projectId, {
        type: 'concept',
        name: 'test-concept'
      });

      await coreService.deleteEntity(projectId, entity.id);
      const deleted = await coreService.getEntity(projectId, entity.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Conversation Memory', () => {
    let projectId: string;

    beforeEach(async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });
      const project = await coreService.createProject('test-proj', projectPath);
      projectId = project.id;
    });

    it('should create a session', async () => {
      const session = await coreService.createSession(projectId, 'Test Session');

      expect(session).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.status).toBe('active');
    });

    it('should store a message', async () => {
      const session = await coreService.createSession(projectId);

      const message = await coreService.storeMessage(projectId, session.id, {
        role: 'user',
        content: 'Hello, this is a test message'
      });

      expect(message).toBeDefined();
      expect(message.content).toBe('Hello, this is a test message');
      expect(message.role).toBe('user');
    });

    it('should get messages from a session', async () => {
      const session = await coreService.createSession(projectId);
      await coreService.storeMessage(projectId, session.id, {
        role: 'user',
        content: 'Message 1'
      });
      await coreService.storeMessage(projectId, session.id, {
        role: 'assistant',
        content: 'Message 2'
      });

      const messages = await coreService.getMessages(projectId, session.id);
      expect(messages.length).toBe(2);
    });

    it('should list sessions', async () => {
      await coreService.createSession(projectId, 'Session 1');
      await coreService.createSession(projectId, 'Session 2');

      const sessions = await coreService.listSessions(projectId);
      expect(sessions.length).toBe(2);
    });

    it('should summarize a session', async () => {
      const session = await coreService.createSession(projectId);
      await coreService.storeMessage(projectId, session.id, {
        role: 'user',
        content: 'What is authentication?'
      });
      await coreService.storeMessage(projectId, session.id, {
        role: 'assistant',
        content: 'Authentication is the process of verifying identity.'
      });

      const summary = await coreService.summarizeSession(projectId, session.id);
      expect(summary).toBeDefined();
      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('Graph RAG', () => {
    let projectId: string;

    beforeEach(async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });
      const project = await coreService.createProject('test-proj', projectPath);
      projectId = project.id;
    });

    it('should add a relationship between entities', async () => {
      const entity1 = await coreService.addEntity(projectId, {
        type: 'function',
        name: 'authenticate'
      });
      const entity2 = await coreService.addEntity(projectId, {
        type: 'function',
        name: 'validateToken'
      });

      const result = await coreService.addRelationship(projectId, {
        sourceId: entity1.id,
        targetId: entity2.id,
        type: 'CALLS'
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should get relationships for an entity', async () => {
      const entity1 = await coreService.addEntity(projectId, {
        type: 'function',
        name: 'authenticate'
      });
      const entity2 = await coreService.addEntity(projectId, {
        type: 'function',
        name: 'validateToken'
      });

      await coreService.addRelationship(projectId, {
        sourceId: entity1.id,
        targetId: entity2.id,
        type: 'CALLS'
      });

      const relationships = await coreService.getRelationships(projectId, entity1.id);
      expect(relationships.length).toBeGreaterThan(0);
    });

    it('should query graph neighborhood', async () => {
      const entity1 = await coreService.addEntity(projectId, {
        type: 'function',
        name: 'main'
      });
      const entity2 = await coreService.addEntity(projectId, {
        type: 'function',
        name: 'helper'
      });

      await coreService.addRelationship(projectId, {
        sourceId: entity1.id,
        targetId: entity2.id,
        type: 'CALLS'
      });

      const result = await coreService.queryGraph(projectId, entity1.id, {
        depth: 2
      });

      expect(result).toBeDefined();
      expect(result.startEntity).toBe(entity1.id);
      expect(result.relationships.length).toBeGreaterThan(0);
    });

    it('should get graph stats', async () => {
      const stats = await coreService.getGraphStats(projectId);

      expect(stats).toBeDefined();
      expect(typeof stats.totalEdges).toBe('number');
      expect(typeof stats.averageDegree).toBe('number');
    });
  });

  describe('Agent Patterns', () => {
    let projectId: string;

    beforeEach(async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });
      const project = await coreService.createProject('test-proj', projectPath);
      projectId = project.id;
    });

    it('should save a checkpoint', async () => {
      const session = await coreService.createSession(projectId);

      const checkpoint = await coreService.saveCheckpoint(
        projectId,
        session.id,
        { step: 1, data: 'test' },
        { description: 'Test checkpoint' }
      );

      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toBeDefined();
    });

    it('should load the latest checkpoint', async () => {
      const session = await coreService.createSession(projectId);

      await coreService.saveCheckpoint(
        projectId,
        session.id,
        { step: 1 }
      );
      await coreService.saveCheckpoint(
        projectId,
        session.id,
        { step: 2 }
      );

      const checkpoint = await coreService.loadCheckpoint(projectId, session.id);
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.state.context.step).toBe(2);
    });

    it('should list checkpoints', async () => {
      const session = await coreService.createSession(projectId);

      await coreService.saveCheckpoint(projectId, session.id, { step: 1 });
      await coreService.saveCheckpoint(projectId, session.id, { step: 2 });

      const checkpoints = await coreService.listCheckpoints(projectId, session.id);
      expect(checkpoints.length).toBe(2);
    });

    it('should store a reflection', async () => {
      const session = await coreService.createSession(projectId);

      const result = await coreService.storeReflection(projectId, session.id, {
        type: 'lesson',
        content: 'Always validate input before processing',
        outcome: 'success'
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should get memory status', async () => {
      const session = await coreService.createSession(projectId);

      const status = await coreService.getMemoryStatus(projectId, session.id);

      expect(status).toBeDefined();
      expect(typeof status.hotCount).toBe('number');
      expect(typeof status.coldCount).toBe('number');
    });
  });

  describe('Utility Methods', () => {
    let projectId: string;

    beforeEach(async () => {
      const projectPath = path.join(testDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });
      const project = await coreService.createProject('test-proj', projectPath);
      projectId = project.id;
    });

    it('should resolve entity ID from name', async () => {
      const entity = await coreService.addEntity(projectId, {
        type: 'concept',
        name: 'my-concept',
        qualifiedName: 'domain::my-concept'
      });

      // Resolve by ID
      const resolvedId = await coreService.resolveEntityId(projectId, entity.id);
      expect(resolvedId).toBe(entity.id);

      // Resolve by qualified name
      const resolvedByName = await coreService.resolveEntityId(projectId, 'domain::my-concept');
      expect(resolvedByName).toBe(entity.id);
    });

    it('should clear project cache', async () => {
      // Should not throw
      coreService.clearProjectCache(projectId);
    });
  });
});
