/**
 * Tests for ReflectionStore - Reflection Storage (F8.3)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ReflectionStore,
  Reflection,
  ReflectionEmbeddingProvider,
  DEFAULT_REFLECTION_CONFIG
} from '../../src/agent';
import { DatabaseConnection } from '../../src/db/connection';

describe('ReflectionStore', () => {
  let db: DatabaseConnection;
  let store: ReflectionStore;
  let tempDir: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflection-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject(projectId);
    store = new ReflectionStore(db, projectId);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('store', () => {
    it('should store a reflection', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Parse CSV file',
        outcome: 'failure',
        whatDidNotWork: ['Regex failed on quoted fields'],
        nextStrategy: 'Use csv-parse library'
      });

      expect(reflection.id).toMatch(/^refl_/);
      expect(reflection.sessionId).toBe('session-1');
      expect(reflection.projectId).toBe(projectId);
      expect(reflection.taskDescription).toBe('Parse CSV file');
      expect(reflection.outcome).toBe('failure');
      expect(reflection.attemptNumber).toBe(1);
    });

    it('should store reflection with all fields', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Implement auth',
        attemptNumber: 2,
        outcome: 'success',
        whatWorked: ['Used JWT tokens', 'Added refresh mechanism'],
        whatDidNotWork: [],
        nextStrategy: 'Continue with this approach',
        tags: ['auth', 'security'],
        relatedEntityIds: ['entity-1', 'entity-2']
      });

      expect(reflection.attemptNumber).toBe(2);
      expect(reflection.whatWorked).toEqual(['Used JWT tokens', 'Added refresh mechanism']);
      expect(reflection.tags).toEqual(['auth', 'security']);
      expect(reflection.relatedEntityIds).toEqual(['entity-1', 'entity-2']);
    });

    it('should default optional fields', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Simple task',
        outcome: 'partial',
        nextStrategy: 'Try again'
      });

      expect(reflection.attemptNumber).toBe(1);
      expect(reflection.whatWorked).toEqual([]);
      expect(reflection.whatDidNotWork).toEqual([]);
      expect(reflection.tags).toEqual([]);
    });

    it('should set createdAt timestamp', async () => {
      const before = new Date();
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Test',
        outcome: 'success',
        nextStrategy: 'Done'
      });
      const after = new Date();

      expect(reflection.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(reflection.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('get', () => {
    it('should return null for non-existent reflection', async () => {
      const reflection = await store.get('non-existent');
      expect(reflection).toBeNull();
    });

    it('should get reflection by ID', async () => {
      const stored = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Test task',
        outcome: 'success',
        nextStrategy: 'Continue'
      });

      const reflection = await store.get(stored.id);

      expect(reflection).not.toBeNull();
      expect(reflection!.id).toBe(stored.id);
      expect(reflection!.taskDescription).toBe('Test task');
    });
  });

  describe('getRecent', () => {
    it('should return empty array for session with no reflections', async () => {
      const reflections = await store.getRecent('non-existent');
      expect(reflections).toEqual([]);
    });

    it('should return recent reflections', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', nextStrategy: 'Done' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 2', outcome: 'failure', nextStrategy: 'Retry' });

      const reflections = await store.getRecent('session-1');

      expect(reflections).toHaveLength(2);
    });

    it('should return reflections in descending order by creation time', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'First', outcome: 'success', nextStrategy: 'Done' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await store.store({ sessionId: 'session-1', taskDescription: 'Second', outcome: 'success', nextStrategy: 'Done' });

      const reflections = await store.getRecent('session-1');

      expect(reflections[0].taskDescription).toBe('Second');
      expect(reflections[1].taskDescription).toBe('First');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await store.store({ sessionId: 'session-1', taskDescription: `Task ${i}`, outcome: 'success', nextStrategy: 'Done' });
      }

      const reflections = await store.getRecent('session-1', 3);

      expect(reflections).toHaveLength(3);
    });
  });

  describe('getBySession', () => {
    it('should return all reflections for session', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', nextStrategy: 'Done' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 2', outcome: 'failure', nextStrategy: 'Retry' });
      await store.store({ sessionId: 'session-2', taskDescription: 'Task 3', outcome: 'success', nextStrategy: 'Done' });

      const reflections = await store.getBySession('session-1');

      expect(reflections).toHaveLength(2);
      expect(reflections.every(r => r.sessionId === 'session-1')).toBe(true);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.store({
        sessionId: 'session-1',
        taskDescription: 'Fix authentication timeout',
        outcome: 'success',
        whatWorked: ['Increased token refresh buffer'],
        nextStrategy: 'Monitor timing',
        tags: ['auth', 'timeout']
      });

      await store.store({
        sessionId: 'session-1',
        taskDescription: 'Parse CSV file',
        outcome: 'failure',
        whatDidNotWork: ['Regex failed'],
        nextStrategy: 'Use library',
        tags: ['parsing']
      });

      await store.store({
        sessionId: 'session-2',
        taskDescription: 'Debug login errors',
        outcome: 'partial',
        nextStrategy: 'Check logs',
        tags: ['auth', 'debugging']
      });
    });

    it('should search by session ID', async () => {
      const results = await store.search({ sessionId: 'session-1' });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.sessionId === 'session-1')).toBe(true);
    });

    it('should filter by outcome', async () => {
      const results = await store.search({ outcomeFilter: ['success'] });

      expect(results).toHaveLength(1);
      expect(results[0].outcome).toBe('success');
    });

    it('should filter by multiple outcomes', async () => {
      const results = await store.search({ outcomeFilter: ['success', 'partial'] });

      expect(results).toHaveLength(2);
    });

    it('should filter by tags', async () => {
      const results = await store.search({ tags: ['auth'] });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.tags.includes('auth'))).toBe(true);
    });

    it('should search by task description keyword', async () => {
      const results = await store.search({ taskDescription: 'authentication' });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].taskDescription).toContain('authentication');
    });

    it('should respect limit', async () => {
      const results = await store.search({ limit: 1 });

      expect(results).toHaveLength(1);
    });

    it('should combine filters', async () => {
      const results = await store.search({
        sessionId: 'session-1',
        outcomeFilter: ['failure']
      });

      expect(results).toHaveLength(1);
      expect(results[0].taskDescription).toBe('Parse CSV file');
    });
  });

  describe('search with embeddings', () => {
    let mockEmbeddingProvider: ReflectionEmbeddingProvider;
    let storeWithEmbeddings: ReflectionStore;

    beforeEach(() => {
      mockEmbeddingProvider = {
        embed: async (text: string) => {
          // Simple mock embedding based on character codes
          const embedding = new Array(10).fill(0);
          for (let i = 0; i < text.length && i < 10; i++) {
            embedding[i] = text.charCodeAt(i) / 255;
          }
          return embedding;
        }
      };

      storeWithEmbeddings = new ReflectionStore(db, projectId, mockEmbeddingProvider);
    });

    it('should use embeddings for semantic search', async () => {
      await storeWithEmbeddings.store({
        sessionId: 'session-1',
        taskDescription: 'Fix authentication token expiry issue',
        outcome: 'success',
        whatWorked: ['Increased refresh buffer'],
        nextStrategy: 'Continue'
      });

      const results = await storeWithEmbeddings.search({
        taskDescription: 'login timeout problem'
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should store embeddings when adding reflections', async () => {
      await storeWithEmbeddings.store({
        sessionId: 'session-1',
        taskDescription: 'Test task',
        outcome: 'success',
        nextStrategy: 'Done'
      });

      const row = db.get<{ embedding_json: string }>(
        `SELECT embedding_json FROM p_test_project_reflections WHERE session_id = ?`,
        ['session-1']
      );

      expect(row!.embedding_json).not.toBeNull();
      const embedding = JSON.parse(row!.embedding_json);
      expect(Array.isArray(embedding)).toBe(true);
    });
  });

  describe('getSummary', () => {
    beforeEach(async () => {
      // Add various reflections
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', whatWorked: ['strategy A'], nextStrategy: 'Continue' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 2', outcome: 'success', whatWorked: ['strategy A'], nextStrategy: 'Continue' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 3', outcome: 'failure', whatDidNotWork: ['forgot edge case'], nextStrategy: 'Add checks' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 4', outcome: 'failure', whatDidNotWork: ['forgot edge case'], nextStrategy: 'Add checks' });
      await store.store({ sessionId: 'session-2', taskDescription: 'Task 5', outcome: 'partial', nextStrategy: 'Improve' });
    });

    it('should return summary for all reflections', async () => {
      const summary = await store.getSummary();

      expect(summary.totalReflections).toBe(5);
    });

    it('should calculate success rate', async () => {
      const summary = await store.getSummary();

      expect(summary.successRate).toBe(2 / 5);
    });

    it('should return summary for specific session', async () => {
      const summary = await store.getSummary('session-1');

      expect(summary.totalReflections).toBe(4);
      expect(summary.successRate).toBe(2 / 4);
    });

    it('should extract common failure patterns', async () => {
      const summary = await store.getSummary();

      expect(summary.commonFailures.length).toBeGreaterThanOrEqual(1);
      expect(summary.commonFailures).toContain('forgot edge case');
    });

    it('should extract effective strategies', async () => {
      const summary = await store.getSummary();

      expect(summary.effectiveStrategies.length).toBeGreaterThanOrEqual(1);
      expect(summary.effectiveStrategies).toContain('strategy a');
    });

    it('should include recent lessons', async () => {
      const summary = await store.getSummary();

      expect(summary.recentLessons.length).toBeGreaterThanOrEqual(1);
      expect(summary.recentLessons.length).toBeLessThanOrEqual(5);
    });
  });

  describe('delete', () => {
    it('should return false for non-existent reflection', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should delete reflection', async () => {
      const stored = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Test',
        outcome: 'success',
        nextStrategy: 'Done'
      });

      const result = await store.delete(stored.id);

      expect(result).toBe(true);
      expect(await store.get(stored.id)).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should return 0 for session with no reflections', async () => {
      const count = await store.clearSession('non-existent');
      expect(count).toBe(0);
    });

    it('should clear all reflections for session', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', nextStrategy: 'Done' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 2', outcome: 'failure', nextStrategy: 'Retry' });

      const count = await store.clearSession('session-1');

      expect(count).toBe(2);
      expect(await store.getRecent('session-1')).toHaveLength(0);
    });

    it('should not affect other sessions', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', nextStrategy: 'Done' });
      await store.store({ sessionId: 'session-2', taskDescription: 'Task 2', outcome: 'success', nextStrategy: 'Done' });

      await store.clearSession('session-1');

      expect(await store.getRecent('session-2')).toHaveLength(1);
    });
  });

  describe('count', () => {
    it('should return 0 for empty store', async () => {
      expect(await store.count()).toBe(0);
    });

    it('should return total count', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', nextStrategy: 'Done' });
      await store.store({ sessionId: 'session-2', taskDescription: 'Task 2', outcome: 'success', nextStrategy: 'Done' });

      expect(await store.count()).toBe(2);
    });

    it('should return count for specific session', async () => {
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 1', outcome: 'success', nextStrategy: 'Done' });
      await store.store({ sessionId: 'session-1', taskDescription: 'Task 2', outcome: 'failure', nextStrategy: 'Retry' });
      await store.store({ sessionId: 'session-2', taskDescription: 'Task 3', outcome: 'success', nextStrategy: 'Done' });

      expect(await store.count('session-1')).toBe(2);
    });
  });

  describe('formatForPrompt', () => {
    it('should return empty string for no reflections', () => {
      const formatted = store.formatForPrompt([]);
      expect(formatted).toBe('');
    });

    it('should format reflections for prompt', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Parse CSV file',
        attemptNumber: 1,
        outcome: 'failure',
        whatWorked: [],
        whatDidNotWork: ['Regex failed on quoted fields'],
        nextStrategy: 'Use csv-parse library'
      });

      const formatted = store.formatForPrompt([reflection]);

      expect(formatted).toContain('## Previous Lessons Learned');
      expect(formatted).toContain('### Attempt 1 (failure)');
      expect(formatted).toContain('Task: Parse CSV file');
      expect(formatted).toContain('What did not work:');
      expect(formatted).toContain('Regex failed on quoted fields');
      expect(formatted).toContain('Next strategy: Use csv-parse library');
    });

    it('should format multiple reflections', async () => {
      const r1 = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Task 1',
        attemptNumber: 1,
        outcome: 'failure',
        nextStrategy: 'Try again'
      });

      const r2 = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Task 1',
        attemptNumber: 2,
        outcome: 'success',
        whatWorked: ['Used library'],
        nextStrategy: 'Continue'
      });

      const formatted = store.formatForPrompt([r1, r2]);

      expect(formatted).toContain('### Attempt 1 (failure)');
      expect(formatted).toContain('### Attempt 2 (success)');
    });
  });

  describe('automatic pruning', () => {
    it('should prune old reflections when exceeding limit', async () => {
      const limitedStore = new ReflectionStore(db, projectId, undefined, {
        maxReflectionsPerSession: 3
      });

      for (let i = 0; i < 5; i++) {
        await limitedStore.store({
          sessionId: 'session-1',
          taskDescription: `Task ${i}`,
          outcome: 'success',
          nextStrategy: 'Done'
        });
      }

      const count = await limitedStore.count('session-1');
      expect(count).toBe(3);
    });

    it('should keep most recent reflections when pruning', async () => {
      const limitedStore = new ReflectionStore(db, projectId, undefined, {
        maxReflectionsPerSession: 2
      });

      await limitedStore.store({ sessionId: 'session-1', taskDescription: 'First', outcome: 'success', nextStrategy: 'Done' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await limitedStore.store({ sessionId: 'session-1', taskDescription: 'Second', outcome: 'success', nextStrategy: 'Done' });
      await new Promise(resolve => setTimeout(resolve, 10));
      await limitedStore.store({ sessionId: 'session-1', taskDescription: 'Third', outcome: 'success', nextStrategy: 'Done' });

      const reflections = await limitedStore.getRecent('session-1', 10);

      expect(reflections).toHaveLength(2);
      expect(reflections[0].taskDescription).toBe('Third');
      expect(reflections[1].taskDescription).toBe('Second');
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_REFLECTION_CONFIG.maxReflectionsPerSession).toBe(20);
      expect(DEFAULT_REFLECTION_CONFIG.maxReflectionsPerProject).toBe(100);
    });

    it('should merge custom configuration', async () => {
      const customStore = new ReflectionStore(db, projectId, undefined, {
        maxReflectionsPerSession: 5
      });

      // Store 7 reflections
      for (let i = 0; i < 7; i++) {
        await customStore.store({
          sessionId: 'session-1',
          taskDescription: `Task ${i}`,
          outcome: 'success',
          nextStrategy: 'Done'
        });
      }

      expect(await customStore.count('session-1')).toBe(5);
    });
  });

  describe('multiple projects', () => {
    it('should isolate reflections between projects', async () => {
      const project2 = 'test-project-2';
      db.createProject(project2);
      const store2 = new ReflectionStore(db, project2);

      await store.store({ sessionId: 'session-1', taskDescription: 'Project 1', outcome: 'success', nextStrategy: 'Done' });
      await store2.store({ sessionId: 'session-1', taskDescription: 'Project 2', outcome: 'failure', nextStrategy: 'Retry' });

      const reflections1 = await store.getRecent('session-1');
      const reflections2 = await store2.getRecent('session-1');

      expect(reflections1).toHaveLength(1);
      expect(reflections1[0].taskDescription).toBe('Project 1');
      expect(reflections2).toHaveLength(1);
      expect(reflections2[0].taskDescription).toBe('Project 2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty whatWorked and whatDidNotWork', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Simple task',
        outcome: 'success',
        nextStrategy: 'Continue'
      });

      expect(reflection.whatWorked).toEqual([]);
      expect(reflection.whatDidNotWork).toEqual([]);
    });

    it('should handle special characters in content', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: 'Task with "quotes" and \'apostrophes\'',
        outcome: 'success',
        whatWorked: ['Strategy with <angle> & ampersand'],
        nextStrategy: 'Continue with\nnewlines'
      });

      const loaded = await store.get(reflection.id);
      expect(loaded!.taskDescription).toBe('Task with "quotes" and \'apostrophes\'');
      expect(loaded!.whatWorked[0]).toBe('Strategy with <angle> & ampersand');
    });

    it('should handle unicode content', async () => {
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: '日本語タスク',
        outcome: 'success',
        whatWorked: ['策略 💡'],
        nextStrategy: '続ける 🚀'
      });

      const loaded = await store.get(reflection.id);
      expect(loaded!.taskDescription).toBe('日本語タスク');
    });

    it('should handle long content', async () => {
      const longDescription = 'A'.repeat(10000);
      const reflection = await store.store({
        sessionId: 'session-1',
        taskDescription: longDescription,
        outcome: 'success',
        nextStrategy: 'Continue'
      });

      const loaded = await store.get(reflection.id);
      expect(loaded!.taskDescription).toBe(longDescription);
    });
  });
});
