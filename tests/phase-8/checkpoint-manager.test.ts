/**
 * Tests for CheckpointManager - Agent Checkpointing (F8.1)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  CheckpointManager,
  AgentState,
  PlanStep,
  Checkpoint
} from '../../src/agent';
import { DatabaseConnection } from '../../src/db/connection';

describe('CheckpointManager', () => {
  let db: DatabaseConnection;
  let manager: CheckpointManager;
  let tempDir: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject(projectId);
    manager = new CheckpointManager(db, projectId);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTestState(stepIndex: number = 0): AgentState {
    return {
      query: 'test query',
      plan: [
        { id: 'step-1', description: 'Step 1', action: 'test', parameters: {}, status: 'completed' },
        { id: 'step-2', description: 'Step 2', action: 'test', parameters: {}, status: 'pending' },
        { id: 'step-3', description: 'Step 3', action: 'test', parameters: {}, status: 'pending' }
      ],
      currentStepIndex: stepIndex,
      results: stepIndex > 0
        ? [{ stepId: 'step-1', output: 'result-1', completedAt: new Date(), durationMs: 100 }]
        : [],
      context: { key: 'value' }
    };
  }

  describe('save', () => {
    it('should save a checkpoint', async () => {
      const state = createTestState(1);
      const checkpoint = await manager.save('session-1', state);

      expect(checkpoint.id).toMatch(/^ckpt_/);
      expect(checkpoint.sessionId).toBe('session-1');
      expect(checkpoint.projectId).toBe(projectId);
      expect(checkpoint.stepNumber).toBe(1);
      expect(checkpoint.state.query).toBe('test query');
      expect(checkpoint.metadata.triggerType).toBe('auto');
    });

    it('should save checkpoint with description', async () => {
      const state = createTestState(1);
      const checkpoint = await manager.save('session-1', state, {
        description: 'Manual save before risky operation',
        triggerType: 'manual'
      });

      expect(checkpoint.metadata.description).toBe('Manual save before risky operation');
      expect(checkpoint.metadata.triggerType).toBe('manual');
    });

    it('should save checkpoint with duration and token usage', async () => {
      const state = createTestState(1);
      const checkpoint = await manager.save('session-1', state, {
        durationMs: 5000,
        tokenUsage: 1500
      });

      expect(checkpoint.metadata.durationMs).toBe(5000);
      expect(checkpoint.metadata.tokenUsage).toBe(1500);
    });

    it('should save checkpoint with error trigger type', async () => {
      const state = createTestState(1);
      state.lastError = {
        stepIndex: 1,
        message: 'Something failed',
        timestamp: new Date()
      };

      const checkpoint = await manager.save('session-1', state, {
        triggerType: 'error',
        description: 'Failed at step 1'
      });

      expect(checkpoint.metadata.triggerType).toBe('error');
      expect(checkpoint.state.lastError?.message).toBe('Something failed');
    });

    it('should save multiple checkpoints for same session', async () => {
      const state1 = createTestState(1);
      const state2 = createTestState(2);

      await manager.save('session-1', state1);
      await manager.save('session-1', state2);

      const count = await manager.count('session-1');
      expect(count).toBe(2);
    });

    it('should preserve complex state in checkpoint', async () => {
      const state = createTestState(1);
      state.context = {
        nested: { deep: { value: [1, 2, 3] } },
        array: ['a', 'b'],
        boolean: true,
        number: 42
      };
      state.plan[1].parameters = { param1: 'value1', param2: 123 };

      const checkpoint = await manager.save('session-1', state);
      const loaded = await manager.load(checkpoint.id);

      expect(loaded?.state.context).toEqual(state.context);
      expect(loaded?.state.plan[1].parameters).toEqual({ param1: 'value1', param2: 123 });
    });
  });

  describe('loadLatest', () => {
    it('should return null for non-existent session', async () => {
      const checkpoint = await manager.loadLatest('non-existent');
      expect(checkpoint).toBeNull();
    });

    it('should load the latest checkpoint by step number', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(2));
      await manager.save('session-1', createTestState(3));

      const latest = await manager.loadLatest('session-1');

      expect(latest).not.toBeNull();
      expect(latest!.stepNumber).toBe(3);
    });

    it('should prefer higher step number over creation time', async () => {
      await manager.save('session-1', createTestState(3));
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(2));

      const latest = await manager.loadLatest('session-1');
      expect(latest!.stepNumber).toBe(3);
    });

    it('should restore Date objects in loaded state', async () => {
      const state = createTestState(1);
      const originalDate = new Date('2024-01-15T10:30:00Z');
      state.results[0].completedAt = originalDate;

      await manager.save('session-1', state);
      const loaded = await manager.loadLatest('session-1');

      expect(loaded!.state.results[0].completedAt).toBeInstanceOf(Date);
      expect(loaded!.state.results[0].completedAt.toISOString()).toBe(originalDate.toISOString());
    });

    it('should restore lastError timestamp as Date', async () => {
      const state = createTestState(1);
      const errorTime = new Date('2024-01-15T11:00:00Z');
      state.lastError = {
        stepIndex: 1,
        message: 'Test error',
        timestamp: errorTime
      };

      await manager.save('session-1', state);
      const loaded = await manager.loadLatest('session-1');

      expect(loaded!.state.lastError?.timestamp).toBeInstanceOf(Date);
      expect(loaded!.state.lastError?.timestamp.toISOString()).toBe(errorTime.toISOString());
    });
  });

  describe('load', () => {
    it('should return null for non-existent checkpoint ID', async () => {
      const checkpoint = await manager.load('non-existent-id');
      expect(checkpoint).toBeNull();
    });

    it('should load checkpoint by ID', async () => {
      const saved = await manager.save('session-1', createTestState(2));
      const loaded = await manager.load(saved.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(saved.id);
      expect(loaded!.stepNumber).toBe(2);
    });
  });

  describe('loadAtStep', () => {
    it('should return null if no checkpoint at step', async () => {
      await manager.save('session-1', createTestState(1));
      const checkpoint = await manager.loadAtStep('session-1', 5);
      expect(checkpoint).toBeNull();
    });

    it('should load checkpoint at specific step number', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(2));
      await manager.save('session-1', createTestState(3));

      const checkpoint = await manager.loadAtStep('session-1', 2);
      expect(checkpoint).not.toBeNull();
      expect(checkpoint!.stepNumber).toBe(2);
    });

    it('should load most recent checkpoint at step if multiple exist', async () => {
      const state1 = createTestState(2);
      state1.context = { version: 1 };
      await manager.save('session-1', state1);

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const state2 = createTestState(2);
      state2.context = { version: 2 };
      await manager.save('session-1', state2);

      const checkpoint = await manager.loadAtStep('session-1', 2);
      expect(checkpoint!.state.context).toEqual({ version: 2 });
    });
  });

  describe('list', () => {
    it('should return empty array for session with no checkpoints', async () => {
      const checkpoints = await manager.list('non-existent');
      expect(checkpoints).toEqual([]);
    });

    it('should list all checkpoints for session', async () => {
      await manager.save('session-1', createTestState(1), { description: 'First' });
      await manager.save('session-1', createTestState(2), { description: 'Second' });

      const checkpoints = await manager.list('session-1');

      expect(checkpoints).toHaveLength(2);
    });

    it('should return checkpoints ordered by step number descending', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(3));
      await manager.save('session-1', createTestState(2));

      const checkpoints = await manager.list('session-1');

      expect(checkpoints[0].stepNumber).toBe(3);
      expect(checkpoints[1].stepNumber).toBe(2);
      expect(checkpoints[2].stepNumber).toBe(1);
    });

    it('should include summary fields', async () => {
      await manager.save('session-1', createTestState(1), {
        description: 'Test checkpoint',
        triggerType: 'manual',
        durationMs: 1000
      });

      const checkpoints = await manager.list('session-1');

      expect(checkpoints[0].description).toBe('Test checkpoint');
      expect(checkpoints[0].triggerType).toBe('manual');
      expect(checkpoints[0].durationMs).toBe(1000);
      expect(checkpoints[0].createdAt).toBeInstanceOf(Date);
    });

    it('should not include full state in list', async () => {
      await manager.save('session-1', createTestState(1));

      const checkpoints = await manager.list('session-1');

      expect((checkpoints[0] as any).state).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should return false for non-existent checkpoint', async () => {
      const result = await manager.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should delete checkpoint by ID', async () => {
      const saved = await manager.save('session-1', createTestState(1));
      const result = await manager.delete(saved.id);

      expect(result).toBe(true);

      const loaded = await manager.load(saved.id);
      expect(loaded).toBeNull();
    });

    it('should only delete specified checkpoint', async () => {
      const saved1 = await manager.save('session-1', createTestState(1));
      const saved2 = await manager.save('session-1', createTestState(2));

      await manager.delete(saved1.id);

      const remaining = await manager.list('session-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(saved2.id);
    });
  });

  describe('clearSession', () => {
    it('should return 0 for session with no checkpoints', async () => {
      const count = await manager.clearSession('non-existent');
      expect(count).toBe(0);
    });

    it('should delete all checkpoints for session', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(2));
      await manager.save('session-1', createTestState(3));

      const deleted = await manager.clearSession('session-1');

      expect(deleted).toBe(3);
      expect(await manager.count('session-1')).toBe(0);
    });

    it('should not affect other sessions', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-2', createTestState(1));

      await manager.clearSession('session-1');

      expect(await manager.count('session-1')).toBe(0);
      expect(await manager.count('session-2')).toBe(1);
    });
  });

  describe('count', () => {
    it('should return 0 for session with no checkpoints', async () => {
      const count = await manager.count('non-existent');
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(2));

      const count = await manager.count('session-1');
      expect(count).toBe(2);
    });
  });

  describe('automatic pruning', () => {
    it('should prune old checkpoints when exceeding limit', async () => {
      const limitedManager = new CheckpointManager(db, projectId, { maxCheckpoints: 3 });

      // Save 5 checkpoints
      for (let i = 0; i < 5; i++) {
        await limitedManager.save('session-1', createTestState(i));
      }

      const count = await limitedManager.count('session-1');
      expect(count).toBe(3);
    });

    it('should keep most recent checkpoints when pruning', async () => {
      const limitedManager = new CheckpointManager(db, projectId, { maxCheckpoints: 2 });

      await limitedManager.save('session-1', createTestState(1));
      await limitedManager.save('session-1', createTestState(2));
      await limitedManager.save('session-1', createTestState(3));

      const checkpoints = await limitedManager.list('session-1');

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].stepNumber).toBe(3);
      expect(checkpoints[1].stepNumber).toBe(2);
    });

    it('should prune per-session independently', async () => {
      const limitedManager = new CheckpointManager(db, projectId, { maxCheckpoints: 2 });

      await limitedManager.save('session-1', createTestState(1));
      await limitedManager.save('session-1', createTestState(2));
      await limitedManager.save('session-1', createTestState(3));

      await limitedManager.save('session-2', createTestState(1));

      expect(await limitedManager.count('session-1')).toBe(2);
      expect(await limitedManager.count('session-2')).toBe(1);
    });
  });

  describe('pruneByAge', () => {
    it('should prune checkpoints older than specified days', async () => {
      // Create a checkpoint with old date
      const state = createTestState(1);
      const checkpoint = await manager.save('session-1', state);

      // Manually update the created_at to be old
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      db.run(
        `UPDATE p_test_project_checkpoints SET created_at = ? WHERE id = ?`,
        [oldDate.toISOString(), checkpoint.id]
      );

      // Save a recent checkpoint
      await manager.save('session-1', createTestState(2));

      // Prune checkpoints older than 5 days
      const pruned = await manager.pruneByAge(5);

      expect(pruned).toBe(1);
      expect(await manager.count('session-1')).toBe(1);
    });

    it('should not prune recent checkpoints', async () => {
      await manager.save('session-1', createTestState(1));
      await manager.save('session-1', createTestState(2));

      const pruned = await manager.pruneByAge(30);

      expect(pruned).toBe(0);
      expect(await manager.count('session-1')).toBe(2);
    });
  });

  describe('multiple projects', () => {
    it('should isolate checkpoints between projects', async () => {
      const project2 = 'test-project-2';
      db.createProject(project2);
      const manager2 = new CheckpointManager(db, project2);

      await manager.save('session-1', createTestState(1));
      await manager2.save('session-1', createTestState(1));

      expect(await manager.count('session-1')).toBe(1);
      expect(await manager2.count('session-1')).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty plan', async () => {
      const state: AgentState = {
        query: 'empty plan',
        plan: [],
        currentStepIndex: 0,
        results: [],
        context: {}
      };

      const checkpoint = await manager.save('session-1', state);
      const loaded = await manager.loadLatest('session-1');

      expect(loaded!.state.plan).toEqual([]);
    });

    it('should handle large context objects', async () => {
      const state = createTestState(1);
      state.context = {
        largeArray: Array(1000).fill({ key: 'value', nested: { data: [1, 2, 3] } })
      };

      const checkpoint = await manager.save('session-1', state);
      const loaded = await manager.load(checkpoint.id);

      expect(loaded!.state.context.largeArray).toHaveLength(1000);
    });

    it('should handle special characters in state', async () => {
      const state = createTestState(1);
      state.query = 'Query with "quotes" and \'apostrophes\' and \n newlines';
      state.context = {
        unicode: '日本語 中文 한국어',
        emoji: '🚀 💻 🎉'
      };

      const checkpoint = await manager.save('session-1', state);
      const loaded = await manager.load(checkpoint.id);

      expect(loaded!.state.query).toBe(state.query);
      expect(loaded!.state.context).toEqual(state.context);
    });
  });
});
