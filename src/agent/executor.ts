/**
 * Agent executor with automatic checkpointing.
 * Enables resumable execution of multi-step agent plans.
 */

import {
  CheckpointManager,
  AgentState,
  PlanStep,
  StepResult,
  Checkpoint
} from './checkpoints';

/**
 * Options for executing a plan.
 */
export interface ExecuteOptions {
  query?: string;
  resumeFromCheckpoint?: boolean;
  autoCheckpoint?: boolean;
  onStepStart?: (step: PlanStep, index: number) => void;
  onStepComplete?: (step: PlanStep, result: StepResult) => void;
  onStepError?: (step: PlanStep, error: Error) => void;
  onCheckpoint?: (checkpoint: Checkpoint) => void;
}

/**
 * Result of plan execution.
 */
export interface ExecutionResult {
  success: boolean;
  state: AgentState;
  error?: string;
  totalDurationMs: number;
  stepsExecuted: number;
  resumedFromCheckpoint: boolean;
}

/**
 * Step executor function type.
 */
export type StepExecutor = (
  step: PlanStep,
  state: AgentState
) => Promise<unknown>;

/**
 * Executor with automatic checkpointing for agent plans.
 */
export class CheckpointedExecutor {
  private stepExecutor: StepExecutor;

  constructor(
    private checkpointManager: CheckpointManager,
    stepExecutor?: StepExecutor
  ) {
    this.stepExecutor = stepExecutor ?? this.defaultStepExecutor;
  }

  /**
   * Execute a plan with automatic checkpointing.
   */
  async execute(
    sessionId: string,
    plan: PlanStep[],
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let resumedFromCheckpoint = false;

    // Check for existing checkpoint to resume from
    let state: AgentState;
    if (options.resumeFromCheckpoint) {
      const existingCheckpoint = await this.checkpointManager.loadLatest(sessionId);
      if (existingCheckpoint) {
        state = existingCheckpoint.state;
        resumedFromCheckpoint = true;
      } else {
        state = this.initializeState(plan, options.query || '');
      }
    } else {
      state = this.initializeState(plan, options.query || '');
    }

    let stepsExecuted = 0;

    try {
      // Execute remaining steps
      while (state.currentStepIndex < state.plan.length) {
        const step = state.plan[state.currentStepIndex];

        // Skip completed steps
        if (step.status === 'completed') {
          state.currentStepIndex++;
          continue;
        }

        // Skip steps with unmet dependencies
        if (!this.areDependenciesMet(step, state)) {
          step.status = 'skipped';
          state.currentStepIndex++;
          continue;
        }

        // Execute step
        step.status = 'running';
        const stepStartTime = Date.now();
        options.onStepStart?.(step, state.currentStepIndex);

        try {
          const result = await this.stepExecutor(step, state);

          // Record result
          step.status = 'completed';
          const stepResult: StepResult = {
            stepId: step.id,
            output: result,
            completedAt: new Date(),
            durationMs: Date.now() - stepStartTime
          };
          state.results.push(stepResult);
          stepsExecuted++;

          options.onStepComplete?.(step, stepResult);

          state.currentStepIndex++;

          // Auto-checkpoint after each step
          if (options.autoCheckpoint !== false) {
            const checkpoint = await this.checkpointManager.save(sessionId, state, {
              triggerType: 'auto',
              durationMs: Date.now() - startTime
            });
            options.onCheckpoint?.(checkpoint);
          }
        } catch (stepError) {
          step.status = 'failed';
          state.lastError = {
            stepIndex: state.currentStepIndex,
            message: (stepError as Error).message,
            timestamp: new Date()
          };

          options.onStepError?.(step, stepError as Error);

          // Checkpoint on error for recovery
          const errorCheckpoint = await this.checkpointManager.save(sessionId, state, {
            triggerType: 'error',
            description: `Failed at step ${state.currentStepIndex}: ${step.description}`,
            durationMs: Date.now() - startTime
          });
          options.onCheckpoint?.(errorCheckpoint);

          throw stepError;
        }
      }

      // Final checkpoint
      if (options.autoCheckpoint !== false) {
        const finalCheckpoint = await this.checkpointManager.save(sessionId, state, {
          triggerType: 'auto',
          description: 'Execution complete',
          durationMs: Date.now() - startTime
        });
        options.onCheckpoint?.(finalCheckpoint);
      }

      return {
        success: true,
        state,
        totalDurationMs: Date.now() - startTime,
        stepsExecuted,
        resumedFromCheckpoint
      };
    } catch (error) {
      return {
        success: false,
        state,
        error: (error as Error).message,
        totalDurationMs: Date.now() - startTime,
        stepsExecuted,
        resumedFromCheckpoint
      };
    }
  }

  /**
   * Resume execution from the latest checkpoint.
   */
  async resume(
    sessionId: string,
    options: Omit<ExecuteOptions, 'resumeFromCheckpoint'> = {}
  ): Promise<ExecutionResult> {
    return this.execute(sessionId, [], {
      ...options,
      resumeFromCheckpoint: true
    });
  }

  /**
   * Resume execution from a specific checkpoint.
   */
  async resumeFrom(
    checkpointId: string,
    sessionId: string,
    options: Omit<ExecuteOptions, 'resumeFromCheckpoint'> = {}
  ): Promise<ExecutionResult> {
    const checkpoint = await this.checkpointManager.load(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const startTime = Date.now();
    const state = checkpoint.state;
    let stepsExecuted = 0;

    try {
      while (state.currentStepIndex < state.plan.length) {
        const step = state.plan[state.currentStepIndex];

        if (step.status === 'completed') {
          state.currentStepIndex++;
          continue;
        }

        if (!this.areDependenciesMet(step, state)) {
          step.status = 'skipped';
          state.currentStepIndex++;
          continue;
        }

        step.status = 'running';
        const stepStartTime = Date.now();
        options.onStepStart?.(step, state.currentStepIndex);

        try {
          const result = await this.stepExecutor(step, state);
          step.status = 'completed';
          const stepResult: StepResult = {
            stepId: step.id,
            output: result,
            completedAt: new Date(),
            durationMs: Date.now() - stepStartTime
          };
          state.results.push(stepResult);
          stepsExecuted++;

          options.onStepComplete?.(step, stepResult);
          state.currentStepIndex++;

          if (options.autoCheckpoint !== false) {
            const ckpt = await this.checkpointManager.save(sessionId, state, {
              triggerType: 'auto',
              durationMs: Date.now() - startTime
            });
            options.onCheckpoint?.(ckpt);
          }
        } catch (stepError) {
          step.status = 'failed';
          state.lastError = {
            stepIndex: state.currentStepIndex,
            message: (stepError as Error).message,
            timestamp: new Date()
          };
          options.onStepError?.(step, stepError as Error);

          await this.checkpointManager.save(sessionId, state, {
            triggerType: 'error',
            description: `Failed at step ${state.currentStepIndex}: ${step.description}`,
            durationMs: Date.now() - startTime
          });

          throw stepError;
        }
      }

      await this.checkpointManager.save(sessionId, state, {
        triggerType: 'auto',
        description: 'Execution complete',
        durationMs: Date.now() - startTime
      });

      return {
        success: true,
        state,
        totalDurationMs: Date.now() - startTime,
        stepsExecuted,
        resumedFromCheckpoint: true
      };
    } catch (error) {
      return {
        success: false,
        state,
        error: (error as Error).message,
        totalDurationMs: Date.now() - startTime,
        stepsExecuted,
        resumedFromCheckpoint: true
      };
    }
  }

  /**
   * Create a manual checkpoint at the current state.
   */
  async createManualCheckpoint(
    sessionId: string,
    state: AgentState,
    description?: string
  ): Promise<Checkpoint> {
    return this.checkpointManager.save(sessionId, state, {
      triggerType: 'manual',
      description
    });
  }

  /**
   * Initialize a fresh agent state.
   */
  private initializeState(plan: PlanStep[], query: string): AgentState {
    return {
      query,
      plan: plan.map(step => ({ ...step, status: step.status || 'pending' })),
      currentStepIndex: 0,
      results: [],
      context: {}
    };
  }

  /**
   * Check if all dependencies for a step are met.
   */
  private areDependenciesMet(step: PlanStep, state: AgentState): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }

    const completedStepIds = new Set(state.results.map(r => r.stepId));
    return step.dependencies.every(depId => completedStepIds.has(depId));
  }

  /**
   * Default step executor that throws an error.
   * Users should provide their own executor.
   */
  private async defaultStepExecutor(step: PlanStep): Promise<unknown> {
    throw new Error(
      `No step executor provided. Cannot execute step: ${step.action}`
    );
  }
}

/**
 * Create a simple step executor from a map of action handlers.
 */
export function createStepExecutor(
  handlers: Record<string, (params: Record<string, unknown>, state: AgentState) => Promise<unknown>>
): StepExecutor {
  return async (step: PlanStep, state: AgentState): Promise<unknown> => {
    const handler = handlers[step.action];
    if (!handler) {
      throw new Error(`Unknown action: ${step.action}`);
    }
    return handler(step.parameters, state);
  };
}
