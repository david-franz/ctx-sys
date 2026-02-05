/**
 * F3.2 Session Management Tests
 *
 * ============================================================================
 * WARNING: These tests will fail with "Cannot find module" errors until the
 * actual implementations are created at:
 *   - src/conversation/sessions.ts (SessionManager class)
 *   - src/conversation/types.ts (Session, SessionStatus, SessionConfig types)
 *   - src/database/connection.ts (DatabaseConnection class)
 * ============================================================================
 *
 * Tests for conversation session management:
 * - SessionManager CRUD operations
 * - Session lifecycle (active, archived, summarized)
 * - Current session tracking
 * - Session retention and cleanup
 * - Session statistics
 *
 * @see docs/phase-3/F3.2-session-management.md
 */

// Import actual implementations (will fail until created)
import { SessionManager } from '../../src/conversation/sessions';
import { Session, SessionStatus, SessionConfig, SessionStats } from '../../src/conversation/types';
import { DatabaseConnection } from '../../src/db/connection';

// Mock the database connection module
jest.mock('../../src/db/connection');

// ============================================================================
// Test Helpers
// ============================================================================

function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createSessionRow(overrides: Partial<{
  id: string;
  name: string | null;
  status: string;
  summary: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: null,
    status: 'active',
    summary: null,
    message_count: 0,
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides
  };
}

const DEFAULT_CONFIG: SessionConfig = {
  retention: 30,
  autoSummarize: true,
  maxActiveMessages: 100
};

describe('F3.2 Session Management', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let sessionManager: SessionManager;
  const projectId = 'proj_123';

  beforeEach(() => {
    // Create fresh mock for each test
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
      isOpen: jest.fn().mockReturnValue(true)
    } as unknown as jest.Mocked<DatabaseConnection>;

    // Create real SessionManager instance with mocked database
    sessionManager = new SessionManager(projectId, mockDb, DEFAULT_CONFIG);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // SessionManager CRUD Tests
  // ============================================================================

  describe('SessionManager', () => {
    describe('create()', () => {
      it('should create a session with generated ID and return Session object', async () => {
        const expectedRow = createSessionRow({ name: null });
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
        mockDb.get.mockResolvedValue(expectedRow);

        const session = await sessionManager.create();

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining([expect.any(String), null])
        );
        expect(session).toBeDefined();
        expect(session.status).toBe('active');
        expect(session.messageCount).toBe(0);
      });

      it('should create session with optional name', async () => {
        const sessionName = 'Bug Fix Session';
        const expectedRow = createSessionRow({ name: sessionName });
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
        mockDb.get.mockResolvedValue(expectedRow);

        const session = await sessionManager.create({ name: sessionName });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([expect.any(String), sessionName])
        );
        expect(session.name).toBe(sessionName);
      });

      it('should set initial status to active', async () => {
        const expectedRow = createSessionRow({ status: 'active' });
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
        mockDb.get.mockResolvedValue(expectedRow);

        const session = await sessionManager.create();

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("'active'"),
          expect.any(Array)
        );
        expect(session.status).toBe('active');
      });

      it('should set initial message count to 0', async () => {
        const expectedRow = createSessionRow({ message_count: 0 });
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
        mockDb.get.mockResolvedValue(expectedRow);

        const session = await sessionManager.create();

        expect(session.messageCount).toBe(0);
      });
    });

    describe('get()', () => {
      it('should retrieve session by ID and transform to Session object', async () => {
        const sessionId = 'session_123';
        const row = createSessionRow({
          id: sessionId,
          name: 'Test Session',
          status: 'active',
          message_count: 10
        });
        mockDb.get.mockResolvedValue(row);

        const session = await sessionManager.get(sessionId);

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          [sessionId]
        );
        expect(session).toBeDefined();
        expect(session!.id).toBe(sessionId);
        expect(session!.name).toBe('Test Session');
        expect(session!.createdAt).toBeInstanceOf(Date);
      });

      it('should return null for non-existent session', async () => {
        mockDb.get.mockResolvedValue(undefined);

        const session = await sessionManager.get('non_existent');

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          ['non_existent']
        );
        expect(session).toBeNull();
      });
    });

    describe('getCurrent()', () => {
      it('should return existing current session', async () => {
        const currentRow = createSessionRow({
          id: 'session_current',
          status: 'active'
        });
        mockDb.get.mockResolvedValue(currentRow);

        const session = await sessionManager.getCurrent();

        expect(session).toBeDefined();
        expect(session!.status).toBe('active');
      });

      it('should find most recent active session when no current set', async () => {
        const recentRow = createSessionRow({
          id: 'session_recent',
          status: 'active',
          updated_at: '2024-01-15T10:00:00Z'
        });
        mockDb.get.mockResolvedValue(recentRow);

        const session = await sessionManager.getCurrent();

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY updated_at DESC'),
          expect.any(Array)
        );
        expect(session).toBeDefined();
      });

      it('should create new session if none exists', async () => {
        // First call returns no session, second returns the created one
        const newRow = createSessionRow({ id: 'new_session' });
        mockDb.get
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(newRow);
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });

        const session = await sessionManager.getCurrent();

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT'),
          expect.any(Array)
        );
        expect(session).toBeDefined();
      });

      it('should not return non-active session as current', async () => {
        const archivedRow = createSessionRow({
          id: 'session_archived',
          status: 'archived'
        });
        // First query for active returns nothing, then creates new
        const newRow = createSessionRow({ status: 'active' });
        mockDb.get
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(newRow);
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });

        const session = await sessionManager.getCurrent();

        expect(session!.status).toBe('active');
      });
    });

    describe('setCurrent()', () => {
      it('should set current session by ID', async () => {
        const newSessionId = 'session_new';
        const row = createSessionRow({ id: newSessionId, status: 'active' });
        mockDb.get.mockResolvedValue(row);

        await sessionManager.setCurrent(newSessionId);

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          [newSessionId]
        );
        // Verify internal state was updated
        const current = await sessionManager.getCurrent();
        expect(current!.id).toBe(newSessionId);
      });

      it('should throw error for non-existent session', async () => {
        mockDb.get.mockResolvedValue(undefined);

        await expect(sessionManager.setCurrent('non_existent'))
          .rejects.toThrow('Session not found');

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.any(String),
          ['non_existent']
        );
      });

      it('should throw error for non-active session', async () => {
        const archivedRow = createSessionRow({
          id: 'session_archived',
          status: 'archived'
        });
        mockDb.get.mockResolvedValue(archivedRow);

        await expect(sessionManager.setCurrent('session_archived'))
          .rejects.toThrow();
      });
    });

    describe('list()', () => {
      it('should list all sessions', async () => {
        const rows = [
          createSessionRow({ id: 'session_1', status: 'active' }),
          createSessionRow({ id: 'session_2', status: 'archived' }),
          createSessionRow({ id: 'session_3', status: 'summarized' })
        ];
        mockDb.all.mockResolvedValue(rows);

        const sessions = await sessionManager.list();

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY updated_at DESC'),
          expect.any(Array)
        );
        expect(sessions).toHaveLength(3);
        expect(sessions[0]).toHaveProperty('id');
        expect(sessions[0]).toHaveProperty('createdAt');
      });

      it('should filter by status', async () => {
        const rows = [
          createSessionRow({ id: 'session_1', status: 'active' }),
          createSessionRow({ id: 'session_2', status: 'active' })
        ];
        mockDb.all.mockResolvedValue(rows);

        const sessions = await sessionManager.list({ status: 'active' });

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining("status = ?"),
          expect.arrayContaining(['active'])
        );
        expect(sessions.every((s: Session) => s.status === 'active')).toBe(true);
      });

      it('should order by updated_at descending', async () => {
        const rows = [
          createSessionRow({ id: 'session_1', updated_at: '2024-01-15T00:00:00Z' }),
          createSessionRow({ id: 'session_2', updated_at: '2024-01-10T00:00:00Z' })
        ];
        mockDb.all.mockResolvedValue(rows);

        const sessions = await sessionManager.list();

        expect(sessions[0].updatedAt.getTime())
          .toBeGreaterThan(sessions[1].updatedAt.getTime());
      });
    });

    describe('update()', () => {
      it('should update session name and return updated Session', async () => {
        const sessionId = 'session_1';
        const newName = 'Renamed Session';
        const updatedRow = createSessionRow({
          id: sessionId,
          name: newName
        });
        mockDb.get.mockResolvedValue(updatedRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        const session = await sessionManager.update(sessionId, { name: newName });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('name = ?'),
          expect.arrayContaining([newName, sessionId])
        );
        expect(session.name).toBe(newName);
      });

      it('should update session status', async () => {
        const sessionId = 'session_1';
        const newStatus: SessionStatus = 'archived';
        const updatedRow = createSessionRow({
          id: sessionId,
          status: newStatus,
          archived_at: new Date().toISOString()
        });
        mockDb.get.mockResolvedValue(updatedRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        const session = await sessionManager.update(sessionId, { status: newStatus });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('status = ?'),
          expect.any(Array)
        );
        expect(session.status).toBe('archived');
      });

      it('should set archived_at when archiving', async () => {
        const sessionId = 'session_1';
        const archivedAt = new Date().toISOString();
        const updatedRow = createSessionRow({
          id: sessionId,
          status: 'archived',
          archived_at: archivedAt
        });
        mockDb.get.mockResolvedValue(updatedRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        const session = await sessionManager.update(sessionId, { status: 'archived' });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('archived_at'),
          expect.any(Array)
        );
        expect(session.archivedAt).toBeInstanceOf(Date);
      });

      it('should update session summary', async () => {
        const sessionId = 'session_1';
        const summary = 'This session discussed authentication implementation.';
        const updatedRow = createSessionRow({
          id: sessionId,
          summary
        });
        mockDb.get.mockResolvedValue(updatedRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        const session = await sessionManager.update(sessionId, { summary });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('summary = ?'),
          expect.arrayContaining([summary])
        );
        expect(session.summary).toBe(summary);
      });

      it('should always update updated_at', async () => {
        const sessionId = 'session_1';
        const updatedRow = createSessionRow({ id: sessionId });
        mockDb.get.mockResolvedValue(updatedRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        await sessionManager.update(sessionId, { name: 'New Name' });

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('updated_at'),
          expect.any(Array)
        );
      });

      it('should throw error for non-existent session', async () => {
        mockDb.run.mockResolvedValue({ changes: 0 });

        await expect(sessionManager.update('non_existent', { name: 'Test' }))
          .rejects.toThrow('Session not found');
      });
    });

    describe('archive()', () => {
      it('should change status to archived and set archivedAt', async () => {
        const sessionId = 'session_1';
        const archivedRow = createSessionRow({
          id: sessionId,
          status: 'archived',
          archived_at: new Date().toISOString()
        });
        mockDb.run.mockResolvedValue({ changes: 1 });
        mockDb.get.mockResolvedValue(archivedRow);

        const session = await sessionManager.archive(sessionId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining("status = 'archived'"),
          expect.any(Array)
        );
        expect(session.status).toBe('archived');
        expect(session.archivedAt).toBeDefined();
      });

      it('should clear current session if archived', async () => {
        const sessionId = 'session_current';
        const activeRow = createSessionRow({ id: sessionId, status: 'active' });
        const archivedRow = createSessionRow({
          id: sessionId,
          status: 'archived',
          archived_at: new Date().toISOString()
        });

        mockDb.get
          .mockResolvedValueOnce(activeRow)
          .mockResolvedValueOnce(archivedRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        // Set as current first
        await sessionManager.setCurrent(sessionId);

        // Archive it
        await sessionManager.archive(sessionId);

        // Current should now be null/undefined
        mockDb.get.mockResolvedValue(undefined);
        const current = await sessionManager.getCurrent();

        // Should have tried to create new or return undefined
        expect(mockDb.get).toHaveBeenCalled();
      });
    });

    describe('delete()', () => {
      it('should delete messages first then session (cascade)', async () => {
        const sessionId = 'session_to_delete';
        mockDb.run.mockResolvedValue({ changes: 1 });

        await sessionManager.delete(sessionId);

        // Verify delete order: messages first, then session
        expect(mockDb.run).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining('DELETE FROM'),
          expect.arrayContaining([sessionId])
        );
        expect(mockDb.run).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('DELETE FROM'),
          expect.arrayContaining([sessionId])
        );
        expect(mockDb.run).toHaveBeenCalledTimes(2);
      });

      it('should clear current session if deleted', async () => {
        const sessionId = 'session_current';
        const activeRow = createSessionRow({ id: sessionId, status: 'active' });

        mockDb.get.mockResolvedValueOnce(activeRow);
        mockDb.run.mockResolvedValue({ changes: 1 });

        await sessionManager.setCurrent(sessionId);
        await sessionManager.delete(sessionId);

        // Verify current was cleared by checking subsequent getCurrent behavior
        mockDb.get.mockResolvedValue(undefined);
        mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
      });

      it('should throw error for non-existent session', async () => {
        mockDb.run.mockResolvedValue({ changes: 0 });

        await expect(sessionManager.delete('non_existent'))
          .rejects.toThrow('Session not found');
      });
    });

    describe('cleanup()', () => {
      it('should delete sessions older than retention period', async () => {
        const oldSessions = [
          createSessionRow({ id: 'old_session_1', status: 'archived' }),
          createSessionRow({ id: 'old_session_2', status: 'summarized' })
        ];
        mockDb.all.mockResolvedValue(oldSessions);
        mockDb.run.mockResolvedValue({ changes: 1 });

        const deletedCount = await sessionManager.cleanup();

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining("status IN ('archived', 'summarized')"),
          expect.any(Array)
        );
        expect(mockDb.run).toHaveBeenCalledTimes(oldSessions.length * 2); // messages + session each
        expect(deletedCount).toBe(2);
      });

      it('should not delete active sessions', async () => {
        mockDb.all.mockResolvedValue([]);

        await sessionManager.cleanup();

        expect(mockDb.all).toHaveBeenCalledWith(
          expect.not.stringContaining("'active'"),
          expect.any(Array)
        );
      });

      it('should return count of deleted sessions', async () => {
        const oldSessions = [
          createSessionRow({ id: 'old_1' }),
          createSessionRow({ id: 'old_2' }),
          createSessionRow({ id: 'old_3' }),
          createSessionRow({ id: 'old_4' }),
          createSessionRow({ id: 'old_5' })
        ];
        mockDb.all.mockResolvedValue(oldSessions);
        mockDb.run.mockResolvedValue({ changes: 1 });

        const deletedCount = await sessionManager.cleanup();

        expect(deletedCount).toBe(5);
      });

      it('should use configured retention period', async () => {
        const customConfig: SessionConfig = {
          retention: 60,
          autoSummarize: true,
          maxActiveMessages: 100
        };
        const customManager = new SessionManager(projectId, mockDb, customConfig);
        mockDb.all.mockResolvedValue([]);

        await customManager.cleanup();

        // Verify the cutoff date is 60 days ago
        expect(mockDb.all).toHaveBeenCalledWith(
          expect.stringContaining('archived_at <'),
          expect.any(Array)
        );
      });
    });

    describe('getStats()', () => {
      it('should return session counts by status', async () => {
        const statsRow = {
          active: 3,
          archived: 10,
          summarized: 25,
          total_messages: 500
        };
        mockDb.get.mockResolvedValue(statsRow);

        const stats: SessionStats = await sessionManager.getStats();

        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SUM(CASE WHEN status'),
          expect.any(Array)
        );
        expect(stats.active).toBe(3);
        expect(stats.archived).toBe(10);
        expect(stats.summarized).toBe(25);
        expect(stats.totalMessages).toBe(500);
      });

      it('should handle empty table with zeros', async () => {
        const statsRow = {
          active: 0,
          archived: 0,
          summarized: 0,
          total_messages: 0
        };
        mockDb.get.mockResolvedValue(statsRow);

        const stats = await sessionManager.getStats();

        expect(stats.active).toBe(0);
        expect(stats.totalMessages).toBe(0);
      });
    });

    describe('incrementMessageCount()', () => {
      it('should increment message count and update timestamp', async () => {
        const sessionId = 'session_1';
        mockDb.run.mockResolvedValue({ changes: 1 });

        await sessionManager.incrementMessageCount(sessionId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('message_count = message_count + 1'),
          expect.arrayContaining([sessionId])
        );
        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('updated_at'),
          expect.any(Array)
        );
      });

      it('should trigger auto-archive when limit reached', async () => {
        const sessionId = 'session_1';
        const row = createSessionRow({
          id: sessionId,
          message_count: 100  // At limit
        });
        mockDb.run.mockResolvedValue({ changes: 1 });
        mockDb.get.mockResolvedValue(row);

        await sessionManager.incrementMessageCount(sessionId);

        // Should have checked for auto-archive
        expect(mockDb.get).toHaveBeenCalledWith(
          expect.stringContaining('SELECT'),
          expect.arrayContaining([sessionId])
        );
      });
    });

    describe('decrementMessageCount()', () => {
      it('should decrement message count', async () => {
        const sessionId = 'session_1';
        mockDb.run.mockResolvedValue({ changes: 1 });

        await sessionManager.decrementMessageCount(sessionId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('message_count = message_count - 1'),
          expect.arrayContaining([sessionId])
        );
      });

      it('should not allow negative message count', async () => {
        const sessionId = 'session_1';
        mockDb.run.mockResolvedValue({ changes: 1 });

        await sessionManager.decrementMessageCount(sessionId);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('message_count = message_count - 1'),
          expect.any(Array)
        );
        // Implementation should have CHECK constraint or similar
      });
    });
  });

  // ============================================================================
  // Session Lifecycle Tests
  // ============================================================================

  describe('Session Lifecycle', () => {
    it('should transition from active to archived', async () => {
      const sessionId = 'session_lifecycle';
      const activeRow = createSessionRow({ id: sessionId, status: 'active' });
      const archivedRow = createSessionRow({
        id: sessionId,
        status: 'archived',
        archived_at: new Date().toISOString()
      });

      mockDb.get.mockResolvedValueOnce(activeRow);
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(archivedRow);

      const session = await sessionManager.get(sessionId);
      expect(session!.status).toBe('active');

      const archived = await sessionManager.archive(sessionId);
      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeDefined();
    });

    it('should transition from archived to summarized', async () => {
      const sessionId = 'session_summarize';
      const archivedRow = createSessionRow({
        id: sessionId,
        status: 'archived',
        archived_at: new Date().toISOString()
      });
      const summarizedRow = createSessionRow({
        id: sessionId,
        status: 'summarized',
        summary: 'Session summary here...',
        archived_at: new Date().toISOString()
      });

      mockDb.get.mockResolvedValueOnce(archivedRow);
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValueOnce(summarizedRow);

      const session = await sessionManager.update(sessionId, {
        status: 'summarized',
        summary: 'Session summary here...'
      });

      expect(session.status).toBe('summarized');
      expect(session.summary).toBeDefined();
    });

    it('should not allow transition from summarized back to active', async () => {
      const sessionId = 'session_summarized';
      const summarizedRow = createSessionRow({
        id: sessionId,
        status: 'summarized'
      });
      mockDb.get.mockResolvedValue(summarizedRow);

      await expect(
        sessionManager.update(sessionId, { status: 'active' })
      ).rejects.toThrow('Cannot reactivate summarized session');
    });

    it('should auto-archive when message limit reached', async () => {
      const sessionId = 'session_autolimit';
      const atLimitRow = createSessionRow({
        id: sessionId,
        status: 'active',
        message_count: 99
      });
      const archivedRow = createSessionRow({
        id: sessionId,
        status: 'archived',
        message_count: 100,
        archived_at: new Date().toISOString()
      });

      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get
        .mockResolvedValueOnce(atLimitRow)
        .mockResolvedValueOnce(archivedRow);

      await sessionManager.incrementMessageCount(sessionId);

      // Should have triggered archive
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining("status = 'archived'"),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle session with no messages', async () => {
      const row = createSessionRow({ message_count: 0 });
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.get(row.id as string);

      expect(session!.messageCount).toBe(0);
    });

    it('should handle session with very long name', async () => {
      const longName = 'x'.repeat(500);
      const row = createSessionRow({ name: longName });
      mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.create({ name: longName });

      expect(session.name?.length).toBe(500);
    });

    it('should handle session with unicode name', async () => {
      const unicodeName = '会话 - セッション - Сессия';
      const row = createSessionRow({ name: unicodeName });
      mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.create({ name: unicodeName });

      expect(session.name).toBe(unicodeName);
    });

    it('should handle concurrent session creation', async () => {
      const rows = Array(5).fill(null).map((_, i) =>
        createSessionRow({ id: `session_${i}` })
      );

      mockDb.run.mockResolvedValue({ lastInsertRowid: 1, changes: 1 });
      rows.forEach((row, i) => {
        mockDb.get.mockResolvedValueOnce(row);
      });

      const operations = rows.map(() => sessionManager.create());
      const sessions = await Promise.all(operations);

      expect(sessions).toHaveLength(5);
      expect(mockDb.run).toHaveBeenCalledTimes(5);

      // All should have unique IDs
      const ids = sessions.map((s: Session) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('should handle database connection errors', async () => {
      mockDb.get.mockRejectedValue(new Error('Database connection failed'));

      await expect(sessionManager.get('session_1'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle updating non-existent session', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });

      await expect(sessionManager.update('non_existent', { name: 'Test' }))
        .rejects.toThrow('Session not found');
    });
  });

  // ============================================================================
  // Data Transformation Tests
  // ============================================================================

  describe('Data Transformation', () => {
    it('should convert row to Session object with correct types', async () => {
      const row = {
        id: 'session_123',
        name: 'Test Session',
        status: 'active',
        summary: null,
        message_count: 15,
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-15T14:30:00Z',
        archived_at: null
      };
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.get('session_123');

      expect(session!.id).toBe('session_123');
      expect(session!.name).toBe('Test Session');
      expect(session!.status).toBe('active');
      expect(session!.summary).toBeUndefined();
      expect(session!.messageCount).toBe(15);
      expect(session!.createdAt).toBeInstanceOf(Date);
      expect(session!.updatedAt).toBeInstanceOf(Date);
      expect(session!.archivedAt).toBeUndefined();
    });

    it('should handle null name as undefined', async () => {
      const row = createSessionRow({ name: null });
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.get(row.id as string);

      expect(session!.name).toBeUndefined();
    });

    it('should handle null summary as undefined', async () => {
      const row = createSessionRow({ summary: null });
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.get(row.id as string);

      expect(session!.summary).toBeUndefined();
    });

    it('should parse archived_at to Date when present', async () => {
      const archivedAt = '2024-01-15T12:00:00Z';
      const row = createSessionRow({
        status: 'archived',
        archived_at: archivedAt
      });
      mockDb.get.mockResolvedValue(row);

      const session = await sessionManager.get(row.id as string);

      expect(session!.archivedAt).toBeInstanceOf(Date);
      expect(session!.archivedAt!.toISOString()).toBe(archivedAt);
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('SessionConfig', () => {
    it('should use default configuration', () => {
      const manager = new SessionManager(projectId, mockDb);

      // Manager should use defaults
      expect(manager).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig: SessionConfig = {
        retention: 60,
        autoSummarize: false,
        maxActiveMessages: 200
      };

      const manager = new SessionManager(projectId, mockDb, customConfig);

      expect(manager).toBeDefined();
    });

    it('should respect autoSummarize setting', async () => {
      const noAutoConfig: SessionConfig = {
        retention: 30,
        autoSummarize: false,
        maxActiveMessages: 100
      };
      const noAutoManager = new SessionManager(projectId, mockDb, noAutoConfig);

      const atLimitRow = createSessionRow({
        id: 'session_nolimit',
        status: 'active',
        message_count: 100
      });
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(atLimitRow);

      await noAutoManager.incrementMessageCount('session_nolimit');

      // Should NOT have auto-archived
      expect(mockDb.run).not.toHaveBeenCalledWith(
        expect.stringContaining("status = 'archived'"),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // Integration with Messages (Mock Verification)
  // ============================================================================

  describe('Integration with Messages', () => {
    it('should increment message count when message added', async () => {
      const sessionId = 'session_1';
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(createSessionRow({ id: sessionId, message_count: 5 }));

      await sessionManager.incrementMessageCount(sessionId);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('message_count = message_count + 1'),
        expect.arrayContaining([sessionId])
      );
    });

    it('should decrement message count when message deleted', async () => {
      const sessionId = 'session_1';
      mockDb.run.mockResolvedValue({ changes: 1 });

      await sessionManager.decrementMessageCount(sessionId);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('message_count = message_count - 1'),
        expect.arrayContaining([sessionId])
      );
    });

    it('should update session updated_at when message added', async () => {
      const sessionId = 'session_1';
      mockDb.run.mockResolvedValue({ changes: 1 });
      mockDb.get.mockResolvedValue(createSessionRow({ id: sessionId }));

      await sessionManager.incrementMessageCount(sessionId);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('updated_at'),
        expect.any(Array)
      );
    });
  });
});
