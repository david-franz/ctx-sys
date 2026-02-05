/**
 * Agent checkpoint management for resumable execution.
 * Enables saving and restoring agent state for failure recovery and resumption.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';

/**
 * Checkpoint trigger types.
 */
export type TriggerType = 'auto' | 'manual' | 'error';

/**
 * Step status in a plan.
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * A step in the agent's plan.
 */
export interface PlanStep {
  id: string;
  description: string;
  action: string;
  parameters: Record<string, unknown>;
  status: StepStatus;
  dependencies?: string[];
}

/**
 * Result from executing a step.
 */
export interface StepResult {
  stepId: string;
  output: unknown;
  completedAt: Date;
  durationMs: number;
  tokenUsage?: number;
}

/**
 * Agent execution state that can be checkpointed.
 */
export interface AgentState {
  query: string;
  plan: PlanStep[];
  currentStepIndex: number;
  results: StepResult[];
  context: Record<string, unknown>;
  lastError?: {
    stepIndex: number;
    message: string;
    timestamp: Date;
  };
}

/**
 * Checkpoint metadata.
 */
export interface CheckpointMetadata {
  description?: string;
  triggerType: TriggerType;
  durationMs: number;
  tokenUsage?: number;
}

/**
 * Full checkpoint record.
 */
export interface Checkpoint {
  id: string;
  sessionId: string;
  projectId: string;
  stepNumber: number;
  createdAt: Date;
  state: AgentState;
  metadata: CheckpointMetadata;
}

/**
 * Summary of a checkpoint for listing.
 */
export interface CheckpointSummary {
  id: string;
  stepNumber: number;
  createdAt: Date;
  description?: string;
  triggerType: TriggerType;
  durationMs: number;
}

/**
 * Options for saving a checkpoint.
 */
export interface SaveOptions {
  description?: string;
  triggerType?: TriggerType;
  durationMs?: number;
  tokenUsage?: number;
}

/**
 * Database row for checkpoint.
 */
interface CheckpointRow {
  id: string;
  session_id: string;
  step_number: number;
  created_at: string;
  state_json: string;
  description: string | null;
  trigger_type: string;
  duration_ms: number | null;
  token_usage: number | null;
}

/**
 * Manager for agent checkpoints.
 * Handles saving, loading, listing, and pruning checkpoints.
 */
export class CheckpointManager {
  private projectId: string;
  private prefix: string;
  private maxCheckpoints: number;

  constructor(
    private db: DatabaseConnection,
    projectId: string,
    options: { maxCheckpoints?: number } = {}
  ) {
    this.projectId = projectId;
    this.prefix = sanitizeProjectId(projectId);
    this.maxCheckpoints = options.maxCheckpoints ?? 10;
  }

  /**
   * Save a checkpoint of the current agent state.
   */
  async save(
    sessionId: string,
    state: AgentState,
    options: SaveOptions = {}
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: generateId('ckpt'),
      sessionId,
      projectId: this.projectId,
      stepNumber: state.currentStepIndex,
      createdAt: new Date(),
      state,
      metadata: {
        description: options.description,
        triggerType: options.triggerType || 'auto',
        durationMs: options.durationMs || 0,
        tokenUsage: options.tokenUsage
      }
    };

    this.db.run(
      `INSERT INTO ${this.prefix}_checkpoints (
        id, session_id, step_number, created_at,
        state_json, description, trigger_type, duration_ms, token_usage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checkpoint.id,
        checkpoint.sessionId,
        checkpoint.stepNumber,
        checkpoint.createdAt.toISOString(),
        JSON.stringify(checkpoint.state),
        checkpoint.metadata.description ?? null,
        checkpoint.metadata.triggerType,
        checkpoint.metadata.durationMs,
        checkpoint.metadata.tokenUsage ?? null
      ]
    );

    // Prune old checkpoints if exceeding limit
    await this.pruneOldCheckpoints(sessionId);

    return checkpoint;
  }

  /**
   * Load the latest checkpoint for a session.
   */
  async loadLatest(sessionId: string): Promise<Checkpoint | null> {
    const row = this.db.get<CheckpointRow>(
      `SELECT * FROM ${this.prefix}_checkpoints
       WHERE session_id = ?
       ORDER BY step_number DESC, created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    return row ? this.rowToCheckpoint(row) : null;
  }

  /**
   * Load a specific checkpoint by ID.
   */
  async load(checkpointId: string): Promise<Checkpoint | null> {
    const row = this.db.get<CheckpointRow>(
      `SELECT * FROM ${this.prefix}_checkpoints WHERE id = ?`,
      [checkpointId]
    );

    return row ? this.rowToCheckpoint(row) : null;
  }

  /**
   * Load checkpoint at a specific step number for a session.
   */
  async loadAtStep(sessionId: string, stepNumber: number): Promise<Checkpoint | null> {
    const row = this.db.get<CheckpointRow>(
      `SELECT * FROM ${this.prefix}_checkpoints
       WHERE session_id = ? AND step_number = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId, stepNumber]
    );

    return row ? this.rowToCheckpoint(row) : null;
  }

  /**
   * List all checkpoints for a session.
   */
  async list(sessionId: string): Promise<CheckpointSummary[]> {
    const rows = this.db.all<CheckpointRow>(
      `SELECT id, step_number, created_at, description, trigger_type, duration_ms
       FROM ${this.prefix}_checkpoints
       WHERE session_id = ?
       ORDER BY step_number DESC`,
      [sessionId]
    );

    return rows.map(row => ({
      id: row.id,
      stepNumber: row.step_number,
      createdAt: new Date(row.created_at),
      description: row.description ?? undefined,
      triggerType: row.trigger_type as TriggerType,
      durationMs: row.duration_ms ?? 0
    }));
  }

  /**
   * Delete a checkpoint by ID.
   */
  async delete(checkpointId: string): Promise<boolean> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_checkpoints WHERE id = ?`,
      [checkpointId]
    );
    return result.changes > 0;
  }

  /**
   * Delete all checkpoints for a session.
   */
  async clearSession(sessionId: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_checkpoints WHERE session_id = ?`,
      [sessionId]
    );
    return result.changes;
  }

  /**
   * Get the count of checkpoints for a session.
   */
  async count(sessionId: string): Promise<number> {
    const row = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${this.prefix}_checkpoints WHERE session_id = ?`,
      [sessionId]
    );
    return row?.count ?? 0;
  }

  /**
   * Prune old checkpoints to stay under the configured limit.
   */
  private async pruneOldCheckpoints(sessionId: string): Promise<number> {
    // Get IDs to keep (most recent by step number and creation time)
    const keepRows = this.db.all<{ id: string }>(
      `SELECT id FROM ${this.prefix}_checkpoints
       WHERE session_id = ?
       ORDER BY step_number DESC, created_at DESC
       LIMIT ?`,
      [sessionId, this.maxCheckpoints]
    );

    const keepIds = keepRows.map(r => r.id);

    if (keepIds.length === 0) {
      return 0;
    }

    // Delete all others
    const placeholders = keepIds.map(() => '?').join(',');
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_checkpoints
       WHERE session_id = ? AND id NOT IN (${placeholders})`,
      [sessionId, ...keepIds]
    );

    return result.changes;
  }

  /**
   * Prune checkpoints older than a specified number of days.
   */
  async pruneByAge(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = this.db.run(
      `DELETE FROM ${this.prefix}_checkpoints
       WHERE created_at < ?`,
      [cutoff.toISOString()]
    );

    return result.changes;
  }

  /**
   * Convert a database row to a Checkpoint object.
   */
  private rowToCheckpoint(row: CheckpointRow): Checkpoint {
    const state = JSON.parse(row.state_json) as AgentState;

    // Restore Date objects in state
    if (state.lastError?.timestamp) {
      state.lastError.timestamp = new Date(state.lastError.timestamp);
    }
    for (const result of state.results) {
      result.completedAt = new Date(result.completedAt);
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      projectId: this.projectId,
      stepNumber: row.step_number,
      createdAt: new Date(row.created_at),
      state,
      metadata: {
        description: row.description ?? undefined,
        triggerType: row.trigger_type as TriggerType,
        durationMs: row.duration_ms ?? 0,
        tokenUsage: row.token_usage ?? undefined
      }
    };
  }
}
