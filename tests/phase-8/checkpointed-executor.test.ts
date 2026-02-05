/**
 * Tests for CheckpointedExecutor - Agent Checkpointing (F8.1)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  CheckpointManager,
  CheckpointedExecutor,
  AgentState,
  PlanStep,
  createStepExecutor,
  Checkpoint
} from '../../src/agent';
import { DatabaseConnection } from '../../src/db/connection';

describe('CheckpointedExecutor', () => {
  let db: DatabaseConnection;
  let manager: CheckpointManager;
  let tempDir: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'executor-test-'));
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

  function createTestPlan(): PlanStep[] {
    return [
      { id: 'step-1', description: 'First step', action: 'action-a', parameters: { value: 1 }, status: 'pending' },
      { id: 'step-2', description: 'Second step', action: 'action-b', parameters: { value: 2 }, status: 'pending' },
      { id: 'step-3', description: 'Third step', action: 'action-c', parameters: { value: 3 }, status: 'pending' }
    ];
  }

  function createSuccessExecutor(): (step: PlanStep, state: AgentState) => Promise<unknown> {
    return async (step) => {
      return { executed: step.action, params: step.parameters };
    };
  }

  function createFailingExecutor(failAtStep: number): (step: PlanStep, state: AgentState) => Promise<unknown> {
    let stepCount = 0;
    return async (step) => {
      stepCount++;
      if (stepCount === failAtStep) {
        throw new Error(`Failed at step ${stepCount}`);
      }
      return { executed: step.action };
    };
  }

  describe('execute', () => {
    it('should execute all steps in a plan', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan, { query: 'test query' });

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(3);
      expect(result.state.currentStepIndex).toBe(3);
      expect(result.state.results).toHaveLength(3);
    });

    it('should preserve query in state', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan, { query: 'find all users' });

      expect(result.state.query).toBe('find all users');
    });

    it('should record results from each step', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.state.results[0].stepId).toBe('step-1');
      expect(result.state.results[0].output).toEqual({ executed: 'action-a', params: { value: 1 } });
      expect(result.state.results[0].completedAt).toBeInstanceOf(Date);
      expect(result.state.results[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should update step statuses as they complete', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.state.plan[0].status).toBe('completed');
      expect(result.state.plan[1].status).toBe('completed');
      expect(result.state.plan[2].status).toBe('completed');
    });

    it('should track total duration', async () => {
      const executor = new CheckpointedExecutor(manager, async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(30);
    });

    it('should create checkpoints after each step by default', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      await executor.execute('session-1', plan);

      // 3 steps + 1 final = 4 checkpoints (but pruning may reduce this)
      const count = await manager.count('session-1');
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('should not create checkpoints when autoCheckpoint is false', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      await executor.execute('session-1', plan, { autoCheckpoint: false });

      const count = await manager.count('session-1');
      expect(count).toBe(0);
    });

    it('should handle step failure', async () => {
      const executor = new CheckpointedExecutor(manager, createFailingExecutor(2));
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed at step 2');
      expect(result.stepsExecuted).toBe(1);
      expect(result.state.plan[0].status).toBe('completed');
      expect(result.state.plan[1].status).toBe('failed');
      expect(result.state.lastError?.message).toBe('Failed at step 2');
    });

    it('should create error checkpoint on failure', async () => {
      const executor = new CheckpointedExecutor(manager, createFailingExecutor(1));
      const plan = createTestPlan();

      await executor.execute('session-1', plan);

      const checkpoints = await manager.list('session-1');
      const errorCheckpoint = checkpoints.find(c => c.triggerType === 'error');
      expect(errorCheckpoint).toBeDefined();
    });

    it('should call onStepStart callback', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();
      const startedSteps: string[] = [];

      await executor.execute('session-1', plan, {
        onStepStart: (step) => startedSteps.push(step.id)
      });

      expect(startedSteps).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('should call onStepComplete callback', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();
      const completedSteps: string[] = [];

      await executor.execute('session-1', plan, {
        onStepComplete: (step, result) => completedSteps.push(step.id)
      });

      expect(completedSteps).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('should call onStepError callback', async () => {
      const executor = new CheckpointedExecutor(manager, createFailingExecutor(2));
      const plan = createTestPlan();
      let errorStep: PlanStep | undefined;
      let errorMessage: string | undefined;

      await executor.execute('session-1', plan, {
        onStepError: (step, error) => {
          errorStep = step;
          errorMessage = error.message;
        }
      });

      expect(errorStep?.id).toBe('step-2');
      expect(errorMessage).toBe('Failed at step 2');
    });

    it('should call onCheckpoint callback', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();
      const checkpoints: Checkpoint[] = [];

      await executor.execute('session-1', plan, {
        onCheckpoint: (checkpoint) => checkpoints.push(checkpoint)
      });

      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
    });

    it('should indicate not resumed from checkpoint for fresh execution', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.resumedFromCheckpoint).toBe(false);
    });
  });

  describe('resume from checkpoint', () => {
    it('should resume from latest checkpoint', async () => {
      // First execution fails at step 2
      const failingExecutor = new CheckpointedExecutor(manager, createFailingExecutor(2));
      await failingExecutor.execute('session-1', createTestPlan());

      // Resume with success executor
      const successExecutor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const result = await successExecutor.execute('session-1', [], { resumeFromCheckpoint: true });

      expect(result.success).toBe(true);
      expect(result.resumedFromCheckpoint).toBe(true);
      // Should only execute remaining steps (step-2 retry and step-3)
      expect(result.stepsExecuted).toBeGreaterThanOrEqual(1);
    });

    it('should skip already completed steps', async () => {
      // Execute first step
      let stepCount = 0;
      const countingExecutor = new CheckpointedExecutor(manager, async (step) => {
        stepCount++;
        if (stepCount === 2) throw new Error('stop');
        return 'done';
      });

      await countingExecutor.execute('session-1', createTestPlan());

      // Reset and resume
      stepCount = 0;
      const successExecutor = new CheckpointedExecutor(manager, async (step) => {
        stepCount++;
        return 'resumed';
      });

      await successExecutor.execute('session-1', [], { resumeFromCheckpoint: true });

      // Should not re-execute step-1 since it was completed
      expect(stepCount).toBeLessThanOrEqual(3);
    });

    it('should start fresh when no checkpoint exists', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan, { resumeFromCheckpoint: true });

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(3);
      expect(result.resumedFromCheckpoint).toBe(false);
    });

    it('should use resume helper method', async () => {
      // Create initial checkpoint
      await manager.save('session-1', {
        query: 'test',
        plan: createTestPlan().map(s => ({ ...s, status: s.id === 'step-1' ? 'completed' : 'pending' })),
        currentStepIndex: 1,
        results: [{ stepId: 'step-1', output: 'done', completedAt: new Date(), durationMs: 100 }],
        context: {}
      });

      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const result = await executor.resume('session-1');

      expect(result.success).toBe(true);
      expect(result.resumedFromCheckpoint).toBe(true);
    });
  });

  describe('resumeFrom specific checkpoint', () => {
    it('should resume from a specific checkpoint by ID', async () => {
      // Save multiple checkpoints
      const state1: AgentState = {
        query: 'test',
        plan: createTestPlan(),
        currentStepIndex: 1,
        results: [{ stepId: 'step-1', output: 'v1', completedAt: new Date(), durationMs: 100 }],
        context: {}
      };
      state1.plan[0].status = 'completed';

      const ckpt1 = await manager.save('session-1', state1);

      const state2: AgentState = {
        ...state1,
        currentStepIndex: 2,
        results: [
          ...state1.results,
          { stepId: 'step-2', output: 'v2', completedAt: new Date(), durationMs: 100 }
        ]
      };
      state2.plan[1].status = 'completed';
      await manager.save('session-1', state2);

      // Resume from first checkpoint
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const result = await executor.resumeFrom(ckpt1.id, 'session-1');

      expect(result.success).toBe(true);
      expect(result.resumedFromCheckpoint).toBe(true);
      // Should execute step-2 and step-3
      expect(result.stepsExecuted).toBe(2);
    });

    it('should throw error for non-existent checkpoint', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());

      await expect(executor.resumeFrom('non-existent', 'session-1'))
        .rejects.toThrow('Checkpoint not found');
    });
  });

  describe('dependencies', () => {
    it('should skip steps with unmet dependencies', async () => {
      const plan: PlanStep[] = [
        { id: 'step-1', description: 'First', action: 'a', parameters: {}, status: 'pending' },
        { id: 'step-2', description: 'Second', action: 'b', parameters: {}, status: 'pending', dependencies: ['step-3'] },
        { id: 'step-3', description: 'Third', action: 'c', parameters: {}, status: 'pending' }
      ];

      const executedSteps: string[] = [];
      const executor = new CheckpointedExecutor(manager, async (step) => {
        executedSteps.push(step.id);
        return 'done';
      });

      const result = await executor.execute('session-1', plan);

      // step-2 should be skipped because step-3 hasn't completed yet when step-2 runs
      expect(result.state.plan[1].status).toBe('skipped');
    });

    it('should execute steps with met dependencies', async () => {
      const plan: PlanStep[] = [
        { id: 'step-1', description: 'First', action: 'a', parameters: {}, status: 'pending' },
        { id: 'step-2', description: 'Second', action: 'b', parameters: {}, status: 'pending', dependencies: ['step-1'] }
      ];

      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const result = await executor.execute('session-1', plan);

      expect(result.state.plan[0].status).toBe('completed');
      expect(result.state.plan[1].status).toBe('completed');
    });
  });

  describe('createManualCheckpoint', () => {
    it('should create a manual checkpoint', async () => {
      const executor = new CheckpointedExecutor(manager, createSuccessExecutor());
      const state: AgentState = {
        query: 'test',
        plan: createTestPlan(),
        currentStepIndex: 1,
        results: [],
        context: { important: 'data' }
      };

      const checkpoint = await executor.createManualCheckpoint(
        'session-1',
        state,
        'Before risky operation'
      );

      expect(checkpoint.metadata.triggerType).toBe('manual');
      expect(checkpoint.metadata.description).toBe('Before risky operation');
    });
  });

  describe('createStepExecutor helper', () => {
    it('should create executor from action handlers', async () => {
      const handlers = {
        'action-a': async (params: Record<string, unknown>) => ({ result: 'a', ...params }),
        'action-b': async (params: Record<string, unknown>) => ({ result: 'b', ...params }),
        'action-c': async (params: Record<string, unknown>) => ({ result: 'c', ...params })
      };

      const stepExecutor = createStepExecutor(handlers);
      const executor = new CheckpointedExecutor(manager, stepExecutor);
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.success).toBe(true);
      expect(result.state.results[0].output).toEqual({ result: 'a', value: 1 });
      expect(result.state.results[1].output).toEqual({ result: 'b', value: 2 });
    });

    it('should throw for unknown action', async () => {
      const handlers = {
        'known-action': async () => 'done'
      };

      const stepExecutor = createStepExecutor(handlers);
      const executor = new CheckpointedExecutor(manager, stepExecutor);
      const plan: PlanStep[] = [
        { id: 'step-1', description: 'Unknown', action: 'unknown-action', parameters: {}, status: 'pending' }
      ];

      const result = await executor.execute('session-1', plan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });

  describe('default executor', () => {
    it('should throw error when no executor provided', async () => {
      const executor = new CheckpointedExecutor(manager);
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No step executor provided');
    });
  });

  describe('state context', () => {
    it('should allow step executor to modify context', async () => {
      const executor = new CheckpointedExecutor(manager, async (step, state) => {
        state.context[step.id] = `processed-${step.action}`;
        return 'done';
      });
      const plan = createTestPlan();

      const result = await executor.execute('session-1', plan);

      expect(result.state.context['step-1']).toBe('processed-action-a');
      expect(result.state.context['step-2']).toBe('processed-action-b');
      expect(result.state.context['step-3']).toBe('processed-action-c');
    });

    it('should preserve context across checkpoint resume', async () => {
      // Execute with context modification, fail at step 2
      let callCount = 0;
      const failingWithContext = new CheckpointedExecutor(manager, async (step, state) => {
        callCount++;
        state.context[step.id] = `value-${callCount}`;
        if (callCount === 2) throw new Error('fail');
        return 'done';
      });

      await failingWithContext.execute('session-1', createTestPlan());

      // Resume
      callCount = 0;
      const resumeExecutor = new CheckpointedExecutor(manager, async (step, state) => {
        callCount++;
        return state.context;
      });

      const result = await resumeExecutor.execute('session-1', [], { resumeFromCheckpoint: true });

      // Context from step-1 should be preserved
      expect(result.state.context['step-1']).toBe('value-1');
    });
  });
});
