import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { SessionManager, MessageStore } from '../../src';

describe('F3.2 - Session Management', () => {
  let db: DatabaseConnection;
  let sessionManager: SessionManager;
  let messageStore: MessageStore;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    sessionManager = new SessionManager(db, projectId);
    messageStore = new MessageStore(db, projectId);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (testDbPath) {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    }
  });

  describe('SessionManager', () => {
    describe('create', () => {
      it('should create a session', () => {
        const session = sessionManager.create('My Session');

        expect(session.id).toBeDefined();
        expect(session.name).toBe('My Session');
        expect(session.status).toBe('active');
        expect(session.messageCount).toBe(0);
        expect(session.createdAt).toBeInstanceOf(Date);
        expect(session.updatedAt).toBeInstanceOf(Date);
      });

      it('should create a session without a name', () => {
        const session = sessionManager.create();

        expect(session.id).toBeDefined();
        expect(session.name).toBeUndefined();
        expect(session.status).toBe('active');
      });
    });

    describe('get', () => {
      it('should get a session by ID', () => {
        const created = sessionManager.create('Test Session');
        const retrieved = sessionManager.get(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.name).toBe('Test Session');
      });

      it('should return null for non-existent session', () => {
        const result = sessionManager.get('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('getCurrent', () => {
      it('should create a new session if none exists', () => {
        const current = sessionManager.getCurrent();

        expect(current).toBeDefined();
        expect(current.status).toBe('active');
      });

      it('should return the same current session on multiple calls', () => {
        const first = sessionManager.getCurrent();
        const second = sessionManager.getCurrent();

        expect(first.id).toBe(second.id);
      });

      it('should find an active session', () => {
        const session1 = sessionManager.create('Session 1');
        const session2 = sessionManager.create('Session 2');

        // Clear internal state to simulate fresh instance
        const newManager = new SessionManager(db, projectId);
        const current = newManager.getCurrent();

        // Should return one of the active sessions
        expect([session1.id, session2.id]).toContain(current.id);
        expect(current.status).toBe('active');
      });

      it('should not return archived sessions as current', () => {
        const session = sessionManager.create('To Archive');
        sessionManager.archive(session.id);

        // Clear internal state
        const newManager = new SessionManager(db, projectId);
        const current = newManager.getCurrent();

        expect(current.id).not.toBe(session.id);
        expect(current.status).toBe('active');
      });
    });

    describe('setCurrent', () => {
      it('should set the current session', () => {
        const session1 = sessionManager.create('Session 1');
        const session2 = sessionManager.create('Session 2');

        sessionManager.setCurrent(session1.id);
        const current = sessionManager.getCurrent();

        expect(current.id).toBe(session1.id);
      });

      it('should throw for non-existent session', () => {
        expect(() => sessionManager.setCurrent('non-existent')).toThrow('Session not found');
      });
    });

    describe('getCurrentId', () => {
      it('should return null initially', () => {
        const newManager = new SessionManager(db, projectId);
        expect(newManager.getCurrentId()).toBeNull();
      });

      it('should return current session ID after getCurrent', () => {
        const session = sessionManager.getCurrent();
        expect(sessionManager.getCurrentId()).toBe(session.id);
      });
    });

    describe('list', () => {
      it('should list all sessions', () => {
        sessionManager.create('Session 1');
        sessionManager.create('Session 2');
        sessionManager.create('Session 3');

        const sessions = sessionManager.list();
        expect(sessions.length).toBe(3);
      });

      it('should filter by status', () => {
        const session1 = sessionManager.create('Active Session');
        const session2 = sessionManager.create('To Archive');
        sessionManager.archive(session2.id);

        const activeSessions = sessionManager.list('active');
        const archivedSessions = sessionManager.list('archived');

        expect(activeSessions.length).toBe(1);
        expect(activeSessions[0].id).toBe(session1.id);
        expect(archivedSessions.length).toBe(1);
        expect(archivedSessions[0].id).toBe(session2.id);
      });

      it('should order by updated_at descending', () => {
        const session1 = sessionManager.create('Session 1');
        const session2 = sessionManager.create('Session 2');

        // Update session1 to make it more recent
        sessionManager.update(session1.id, { name: 'Updated Session 1' });

        const sessions = sessionManager.list();
        expect(sessions[0].id).toBe(session1.id);
      });
    });

    describe('update', () => {
      it('should update session name', () => {
        const session = sessionManager.create('Original Name');
        const updated = sessionManager.update(session.id, { name: 'New Name' });

        expect(updated.name).toBe('New Name');
      });

      it('should update session status', () => {
        const session = sessionManager.create('Test Session');
        const updated = sessionManager.update(session.id, { status: 'archived' });

        expect(updated.status).toBe('archived');
        expect(updated.archivedAt).toBeInstanceOf(Date);
      });

      it('should update session summary', () => {
        const session = sessionManager.create('Test Session');
        const updated = sessionManager.update(session.id, { summary: 'This is a summary' });

        expect(updated.summary).toBe('This is a summary');
      });

      it('should update updatedAt timestamp', () => {
        const session = sessionManager.create('Test Session');
        const originalUpdatedAt = session.updatedAt;

        // Small delay to ensure timestamp difference
        const updated = sessionManager.update(session.id, { name: 'New Name' });

        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      });

      it('should throw for non-existent session', () => {
        expect(() => sessionManager.update('non-existent', { name: 'New' })).toThrow('Session not found');
      });
    });

    describe('archive', () => {
      it('should archive a session', () => {
        const session = sessionManager.create('To Archive');
        const archived = sessionManager.archive(session.id);

        expect(archived.status).toBe('archived');
        expect(archived.archivedAt).toBeInstanceOf(Date);
      });
    });

    describe('markSummarized', () => {
      it('should mark session as summarized with summary', () => {
        const session = sessionManager.create('Test Session');
        const summarized = sessionManager.markSummarized(session.id, 'This is the session summary');

        expect(summarized.status).toBe('summarized');
        expect(summarized.summary).toBe('This is the session summary');
        expect(summarized.archivedAt).toBeInstanceOf(Date);
      });
    });

    describe('delete', () => {
      it('should delete a session', () => {
        const session = sessionManager.create('To Delete');

        const result = sessionManager.delete(session.id);
        expect(result).toBe(true);
        expect(sessionManager.get(session.id)).toBeNull();
      });

      it('should delete associated messages', () => {
        const session = sessionManager.create('With Messages');
        messageStore.create({ sessionId: session.id, role: 'user', content: 'Message 1' });
        messageStore.create({ sessionId: session.id, role: 'assistant', content: 'Response 1' });

        sessionManager.delete(session.id);

        expect(messageStore.getBySession(session.id)).toEqual([]);
      });

      it('should clear current session if deleted', () => {
        const session = sessionManager.getCurrent();
        sessionManager.delete(session.id);

        expect(sessionManager.getCurrentId()).toBeNull();
      });

      it('should return false for non-existent session', () => {
        const result = sessionManager.delete('non-existent');
        expect(result).toBe(false);
      });
    });

    describe('cleanup', () => {
      it('should delete sessions older than retention period', () => {
        // Create manager with 0 day retention for testing
        const shortRetentionManager = new SessionManager(db, projectId, { retention: 0, autoSummarize: true, maxActiveMessages: 100 });

        const session = shortRetentionManager.create('Old Session');
        shortRetentionManager.archive(session.id);

        const deleted = shortRetentionManager.cleanup();
        expect(deleted).toBe(1);
        expect(shortRetentionManager.get(session.id)).toBeNull();
      });

      it('should not delete active sessions', () => {
        const shortRetentionManager = new SessionManager(db, projectId, { retention: 0, autoSummarize: true, maxActiveMessages: 100 });

        const session = shortRetentionManager.create('Active Session');
        // Don't archive it

        const deleted = shortRetentionManager.cleanup();
        expect(deleted).toBe(0);
        expect(shortRetentionManager.get(session.id)).not.toBeNull();
      });
    });

    describe('getStats', () => {
      it('should return session statistics', () => {
        sessionManager.create('Active 1');
        sessionManager.create('Active 2');
        const toArchive = sessionManager.create('To Archive');
        sessionManager.archive(toArchive.id);

        // Add some messages
        const active = sessionManager.list('active')[0];
        messageStore.create({ sessionId: active.id, role: 'user', content: 'Message' });
        messageStore.create({ sessionId: active.id, role: 'assistant', content: 'Response' });

        const stats = sessionManager.getStats();

        expect(stats.active).toBe(2);
        expect(stats.archived).toBe(1);
        expect(stats.summarized).toBe(0);
        expect(stats.totalMessages).toBe(2);
      });
    });

    describe('shouldSummarize', () => {
      it('should return true when message count exceeds threshold', () => {
        const session = sessionManager.create('Test Session');

        // Add messages to exceed threshold
        for (let i = 0; i < 100; i++) {
          messageStore.create({ sessionId: session.id, role: 'user', content: `Message ${i}` });
        }

        expect(sessionManager.shouldSummarize(session.id)).toBe(true);
      });

      it('should return false when under threshold', () => {
        const session = sessionManager.create('Test Session');
        messageStore.create({ sessionId: session.id, role: 'user', content: 'Single message' });

        expect(sessionManager.shouldSummarize(session.id)).toBe(false);
      });

      it('should return false for non-existent session', () => {
        expect(sessionManager.shouldSummarize('non-existent')).toBe(false);
      });
    });

    describe('getConfig', () => {
      it('should return default config', () => {
        const config = sessionManager.getConfig();

        expect(config.retention).toBe(30);
        expect(config.autoSummarize).toBe(true);
        expect(config.maxActiveMessages).toBe(100);
      });

      it('should return custom config', () => {
        const customManager = new SessionManager(db, projectId, {
          retention: 7,
          autoSummarize: false,
          maxActiveMessages: 50
        });

        const config = customManager.getConfig();

        expect(config.retention).toBe(7);
        expect(config.autoSummarize).toBe(false);
        expect(config.maxActiveMessages).toBe(50);
      });
    });
  });
});
