/**
 * Reflection Storage for agent self-improvement.
 * Enables learning from past attempts within and across sessions.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';

/**
 * Outcome of an attempt.
 */
export type ReflectionOutcome = 'success' | 'partial' | 'failure';

/**
 * A reflection capturing lessons learned from an attempt.
 */
export interface Reflection {
  id: string;
  sessionId: string;
  projectId: string;
  createdAt: Date;
  taskDescription: string;
  attemptNumber: number;
  outcome: ReflectionOutcome;
  whatWorked: string[];
  whatDidNotWork: string[];
  nextStrategy: string;
  tags: string[];
  relatedEntityIds?: string[];
}

/**
 * Input for creating a reflection (without generated fields).
 */
export interface ReflectionInput {
  sessionId: string;
  taskDescription: string;
  attemptNumber?: number;
  outcome: ReflectionOutcome;
  whatWorked?: string[];
  whatDidNotWork?: string[];
  nextStrategy: string;
  tags?: string[];
  relatedEntityIds?: string[];
}

/**
 * Query options for searching reflections.
 */
export interface ReflectionQuery {
  sessionId?: string;
  taskDescription?: string;
  tags?: string[];
  outcomeFilter?: ReflectionOutcome[];
  limit?: number;
}

/**
 * Summary of reflections for a project/session.
 */
export interface ReflectionSummary {
  totalReflections: number;
  successRate: number;
  commonFailures: string[];
  effectiveStrategies: string[];
  recentLessons: Reflection[];
}

/**
 * Configuration for reflection storage.
 */
export interface ReflectionConfig {
  maxReflectionsPerSession: number;
  maxReflectionsPerProject: number;
}

/**
 * Default reflection configuration.
 */
export const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  maxReflectionsPerSession: 20,
  maxReflectionsPerProject: 100
};

/**
 * Database row for reflection.
 */
interface ReflectionRow {
  id: string;
  session_id: string;
  created_at: string;
  task_description: string;
  attempt_number: number;
  outcome: string;
  what_worked_json: string | null;
  what_did_not_work_json: string | null;
  next_strategy: string;
  tags_json: string | null;
  related_entity_ids_json: string | null;
  embedding_json: string | null;
}

/**
 * Embedding provider interface for semantic search.
 */
export interface ReflectionEmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

/**
 * Store for reflection data enabling agent self-improvement.
 */
export class ReflectionStore {
  private projectId: string;
  private prefix: string;
  private config: ReflectionConfig;

  constructor(
    private db: DatabaseConnection,
    projectId: string,
    private embeddingProvider?: ReflectionEmbeddingProvider,
    config: Partial<ReflectionConfig> = {}
  ) {
    this.projectId = projectId;
    this.prefix = sanitizeProjectId(projectId);
    this.config = { ...DEFAULT_REFLECTION_CONFIG, ...config };
  }

  /**
   * Store a reflection after an attempt.
   */
  async store(input: ReflectionInput): Promise<Reflection> {
    const reflection: Reflection = {
      id: generateId('refl'),
      sessionId: input.sessionId,
      projectId: this.projectId,
      createdAt: new Date(),
      taskDescription: input.taskDescription,
      attemptNumber: input.attemptNumber ?? 1,
      outcome: input.outcome,
      whatWorked: input.whatWorked ?? [],
      whatDidNotWork: input.whatDidNotWork ?? [],
      nextStrategy: input.nextStrategy,
      tags: input.tags ?? [],
      relatedEntityIds: input.relatedEntityIds
    };

    // Generate embedding for semantic search if provider available
    let embedding: number[] | null = null;
    if (this.embeddingProvider) {
      const embeddingText = [
        reflection.taskDescription,
        ...reflection.whatWorked,
        ...reflection.whatDidNotWork,
        reflection.nextStrategy
      ].join(' ');
      embedding = await this.embeddingProvider.embed(embeddingText);
    }

    this.db.run(
      `INSERT INTO ${this.prefix}_reflections (
        id, session_id, created_at, task_description, attempt_number,
        outcome, what_worked_json, what_did_not_work_json, next_strategy,
        tags_json, related_entity_ids_json, embedding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reflection.id,
        reflection.sessionId,
        reflection.createdAt.toISOString(),
        reflection.taskDescription,
        reflection.attemptNumber,
        reflection.outcome,
        JSON.stringify(reflection.whatWorked),
        JSON.stringify(reflection.whatDidNotWork),
        reflection.nextStrategy,
        JSON.stringify(reflection.tags),
        JSON.stringify(reflection.relatedEntityIds ?? []),
        embedding ? JSON.stringify(embedding) : null
      ]
    );

    // Prune old reflections if needed
    await this.pruneOldReflections(reflection.sessionId);

    return reflection;
  }

  /**
   * Get a reflection by ID.
   */
  async get(reflectionId: string): Promise<Reflection | null> {
    const row = this.db.get<ReflectionRow>(
      `SELECT * FROM ${this.prefix}_reflections WHERE id = ?`,
      [reflectionId]
    );

    return row ? this.rowToReflection(row) : null;
  }

  /**
   * Get recent reflections for a session.
   */
  async getRecent(sessionId: string, limit: number = 5): Promise<Reflection[]> {
    const rows = this.db.all<ReflectionRow>(
      `SELECT * FROM ${this.prefix}_reflections
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [sessionId, limit]
    );

    return rows.map(row => this.rowToReflection(row));
  }

  /**
   * Get all reflections for a session.
   */
  async getBySession(sessionId: string): Promise<Reflection[]> {
    const rows = this.db.all<ReflectionRow>(
      `SELECT * FROM ${this.prefix}_reflections
       WHERE session_id = ?
       ORDER BY created_at DESC`,
      [sessionId]
    );

    return rows.map(row => this.rowToReflection(row));
  }

  /**
   * Search for relevant reflections.
   */
  async search(query: ReflectionQuery): Promise<Reflection[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.sessionId) {
      conditions.push('session_id = ?');
      params.push(query.sessionId);
    }

    if (query.outcomeFilter?.length) {
      const placeholders = query.outcomeFilter.map(() => '?').join(',');
      conditions.push(`outcome IN (${placeholders})`);
      params.push(...query.outcomeFilter);
    }

    if (query.tags?.length) {
      // Search for any matching tag
      const tagConditions = query.tags.map(() => `tags_json LIKE ?`);
      conditions.push(`(${tagConditions.join(' OR ')})`);
      query.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    const limit = query.limit ?? 5;

    // Semantic search if task description provided and embedding provider available
    if (query.taskDescription && this.embeddingProvider) {
      const queryEmbedding = await this.embeddingProvider.embed(query.taskDescription);

      // Get all matching rows and calculate similarity in code
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = this.db.all<ReflectionRow>(
        `SELECT * FROM ${this.prefix}_reflections ${whereClause}`,
        params
      );

      // Calculate similarity and sort
      const withSimilarity = rows
        .map(row => ({
          row,
          similarity: row.embedding_json
            ? this.cosineSimilarity(queryEmbedding, JSON.parse(row.embedding_json))
            : this.calculateKeywordRelevance(query.taskDescription!, row.task_description)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return withSimilarity.map(({ row }) => this.rowToReflection(row));
    }

    // Keyword-based search
    if (query.taskDescription) {
      conditions.push('task_description LIKE ?');
      params.push(`%${query.taskDescription}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db.all<ReflectionRow>(
      `SELECT * FROM ${this.prefix}_reflections
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, limit]
    );

    return rows.map(row => this.rowToReflection(row));
  }

  /**
   * Get summary of reflections for the project or a session.
   */
  async getSummary(sessionId?: string): Promise<ReflectionSummary> {
    const whereClause = sessionId ? 'WHERE session_id = ?' : '';
    const params = sessionId ? [sessionId] : [];

    // Count by outcome
    const outcomes = this.db.all<{ outcome: string; count: number }>(
      `SELECT outcome, COUNT(*) as count
       FROM ${this.prefix}_reflections
       ${whereClause}
       GROUP BY outcome`,
      params
    );

    const total = outcomes.reduce((sum, o) => sum + o.count, 0);
    const successes = outcomes.find(o => o.outcome === 'success')?.count ?? 0;

    // Get common failure patterns
    const failureWhereClause = sessionId
      ? 'WHERE session_id = ? AND outcome = ?'
      : 'WHERE outcome = ?';
    const failureParams = sessionId ? [sessionId, 'failure'] : ['failure'];

    const failures = this.db.all<{ what_did_not_work_json: string }>(
      `SELECT what_did_not_work_json
       FROM ${this.prefix}_reflections
       ${failureWhereClause}
       ORDER BY created_at DESC
       LIMIT 20`,
      failureParams
    );

    const failurePatterns = this.extractCommonPatterns(
      failures.flatMap(f => {
        try {
          return JSON.parse(f.what_did_not_work_json || '[]') as string[];
        } catch {
          return [];
        }
      })
    );

    // Get effective strategies
    const successWhereClause = sessionId
      ? 'WHERE session_id = ? AND outcome = ?'
      : 'WHERE outcome = ?';
    const successParams = sessionId ? [sessionId, 'success'] : ['success'];

    const successes_data = this.db.all<{ what_worked_json: string }>(
      `SELECT what_worked_json
       FROM ${this.prefix}_reflections
       ${successWhereClause}
       ORDER BY created_at DESC
       LIMIT 20`,
      successParams
    );

    const effectiveStrategies = this.extractCommonPatterns(
      successes_data.flatMap(s => {
        try {
          return JSON.parse(s.what_worked_json || '[]') as string[];
        } catch {
          return [];
        }
      })
    );

    // Recent lessons
    const recent = this.db.all<ReflectionRow>(
      `SELECT * FROM ${this.prefix}_reflections
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 5`,
      params
    );

    return {
      totalReflections: total,
      successRate: total > 0 ? successes / total : 0,
      commonFailures: failurePatterns,
      effectiveStrategies,
      recentLessons: recent.map(row => this.rowToReflection(row))
    };
  }

  /**
   * Delete a reflection by ID.
   */
  async delete(reflectionId: string): Promise<boolean> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_reflections WHERE id = ?`,
      [reflectionId]
    );
    return result.changes > 0;
  }

  /**
   * Clear all reflections for a session.
   */
  async clearSession(sessionId: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_reflections WHERE session_id = ?`,
      [sessionId]
    );
    return result.changes;
  }

  /**
   * Get count of reflections for a session.
   */
  async count(sessionId?: string): Promise<number> {
    const sql = sessionId
      ? `SELECT COUNT(*) as count FROM ${this.prefix}_reflections WHERE session_id = ?`
      : `SELECT COUNT(*) as count FROM ${this.prefix}_reflections`;
    const params = sessionId ? [sessionId] : [];

    const row = this.db.get<{ count: number }>(sql, params);
    return row?.count ?? 0;
  }

  /**
   * Format reflections for inclusion in a prompt.
   */
  formatForPrompt(reflections: Reflection[]): string {
    if (reflections.length === 0) return '';

    const lines = ['## Previous Lessons Learned\n'];

    for (const r of reflections) {
      lines.push(`### Attempt ${r.attemptNumber} (${r.outcome})`);
      lines.push(`Task: ${r.taskDescription}`);

      if (r.whatWorked.length > 0) {
        lines.push('What worked:');
        r.whatWorked.forEach(w => lines.push(`  - ${w}`));
      }

      if (r.whatDidNotWork.length > 0) {
        lines.push('What did not work:');
        r.whatDidNotWork.forEach(w => lines.push(`  - ${w}`));
      }

      lines.push(`Next strategy: ${r.nextStrategy}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Extract common patterns from a list of strings.
   */
  private extractCommonPatterns(items: string[]): string[] {
    const counts = new Map<string, number>();

    for (const item of items) {
      if (!item) continue;
      const normalized = item.toLowerCase().trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  /**
   * Prune old reflections to stay under limit.
   */
  private async pruneOldReflections(sessionId: string): Promise<number> {
    // Get IDs to keep
    const keepRows = this.db.all<{ id: string }>(
      `SELECT id FROM ${this.prefix}_reflections
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [sessionId, this.config.maxReflectionsPerSession]
    );

    const keepIds = keepRows.map(r => r.id);
    if (keepIds.length === 0) return 0;

    // Delete all others
    const placeholders = keepIds.map(() => '?').join(',');
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_reflections
       WHERE session_id = ? AND id NOT IN (${placeholders})`,
      [sessionId, ...keepIds]
    );

    return result.changes;
  }

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate keyword-based relevance score.
   */
  private calculateKeywordRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let matchCount = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentLower.includes(word)) {
        matchCount++;
      }
    }

    return queryWords.length > 0 ? matchCount / queryWords.length : 0;
  }

  /**
   * Convert a database row to a Reflection.
   */
  private rowToReflection(row: ReflectionRow): Reflection {
    return {
      id: row.id,
      sessionId: row.session_id,
      projectId: this.projectId,
      createdAt: new Date(row.created_at),
      taskDescription: row.task_description,
      attemptNumber: row.attempt_number,
      outcome: row.outcome as ReflectionOutcome,
      whatWorked: row.what_worked_json ? JSON.parse(row.what_worked_json) : [],
      whatDidNotWork: row.what_did_not_work_json ? JSON.parse(row.what_did_not_work_json) : [],
      nextStrategy: row.next_strategy,
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
      relatedEntityIds: row.related_entity_ids_json ? JSON.parse(row.related_entity_ids_json) : undefined
    };
  }
}
