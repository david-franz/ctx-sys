/**
 * Hot/Cold Memory Tiering API.
 * Provides explicit control over memory tiers with access-pattern tracking.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';
import { estimateTokens } from '../retrieval/context-assembler';

/**
 * Memory tier levels.
 */
export type MemoryTier = 'hot' | 'warm' | 'cold';

/**
 * Types of memory items.
 */
export type MemoryItemType = 'message' | 'fact' | 'decision' | 'entity' | 'context';

/**
 * A memory item stored in the system.
 */
export interface MemoryItem {
  id: string;
  sessionId: string;
  content: string;
  type: MemoryItemType;
  tier: MemoryTier;
  accessCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  relevanceScore: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

/**
 * Status of memory tiers for a session.
 */
export interface MemoryStatus {
  sessionId: string;
  hot: {
    items: number;
    tokens: number;
    limit: number;
    utilizationPercent: number;
  };
  warm: {
    items: number;
    tokens: number;
  };
  cold: {
    items: number;
    tokens: number;
  };
  suggestions: MemorySuggestion[];
}

/**
 * Suggestion for memory management.
 */
export interface MemorySuggestion {
  type: 'spill' | 'recall' | 'prune';
  reason: string;
  itemIds?: string[];
}

/**
 * Result of a spill operation.
 */
export interface SpillResult {
  spilledCount: number;
  spilledIds: string[];
  targetTier: MemoryTier;
}

/**
 * Result of a recall operation.
 */
export interface RecallResult {
  items: MemoryItem[];
  promoted: string[];
  relevanceScores: Map<string, number>;
}

/**
 * Configuration for memory tier management.
 */
export interface MemoryConfig {
  hotTokenLimit: number;
  warmAccessThreshold: number;
  promoteThreshold: number;
  maxColdItems: number;
  autoSpillEnabled: boolean;
  autoPromoteEnabled: boolean;
}

/**
 * Default memory configuration.
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  hotTokenLimit: 4000,
  warmAccessThreshold: 3,
  promoteThreshold: 0.85,
  maxColdItems: 1000,
  autoSpillEnabled: true,
  autoPromoteEnabled: true
};

/**
 * Options for spilling memory.
 */
export interface SpillOptions {
  itemIds?: string[];
  count?: number;
}

/**
 * Options for recalling memory.
 */
export interface RecallOptions {
  limit?: number;
  autoPromote?: boolean;
  types?: MemoryItemType[];
  minRelevance?: number;
}

/**
 * Options for adding to memory.
 */
export interface AddMemoryOptions {
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Database row for memory item.
 */
interface MemoryRow {
  id: string;
  session_id: string;
  content: string;
  type: string;
  tier: string;
  access_count: number;
  last_accessed_at: string;
  created_at: string;
  relevance_score: number;
  token_count: number;
  metadata_json: string | null;
  embedding_json: string | null;
}

/**
 * Embedding provider interface for semantic recall.
 */
export interface MemoryEmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

/**
 * Manager for hot/cold memory tiering.
 * Provides explicit API for memory tier control with access-pattern tracking.
 */
export class MemoryTierManager {
  private config: MemoryConfig;
  private prefix: string;
  private projectId: string;

  constructor(
    private db: DatabaseConnection,
    projectId: string,
    private embeddingProvider?: MemoryEmbeddingProvider,
    config: Partial<MemoryConfig> = {}
  ) {
    this.projectId = projectId;
    this.prefix = sanitizeProjectId(projectId);
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
  }

  /**
   * Add an item to hot memory.
   */
  async addToHot(
    sessionId: string,
    content: string,
    type: MemoryItemType,
    options: AddMemoryOptions = {}
  ): Promise<MemoryItem> {
    const tokenCount = estimateTokens(content);

    // Auto-spill if enabled and hot memory would exceed limit
    if (this.config.autoSpillEnabled) {
      const status = await this.getStatus(sessionId);
      if (status.hot.tokens + tokenCount > this.config.hotTokenLimit) {
        await this.spillToWarm(sessionId);
      }
    }

    const now = new Date();
    const item: MemoryItem = {
      id: generateId('mem'),
      sessionId,
      content,
      type,
      tier: 'hot',
      accessCount: 0,
      lastAccessedAt: now,
      createdAt: now,
      relevanceScore: options.relevanceScore ?? 1.0,
      tokenCount,
      metadata: options.metadata ?? {}
    };

    // Generate embedding if provider available
    let embedding: number[] | null = null;
    if (this.embeddingProvider) {
      embedding = await this.embeddingProvider.embed(content);
    }

    this.db.run(
      `INSERT INTO ${this.prefix}_memory_items (
        id, session_id, content, type, tier,
        access_count, last_accessed_at, created_at,
        relevance_score, token_count, metadata_json, embedding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.sessionId,
        item.content,
        item.type,
        item.tier,
        item.accessCount,
        item.lastAccessedAt.toISOString(),
        item.createdAt.toISOString(),
        item.relevanceScore,
        item.tokenCount,
        JSON.stringify(item.metadata),
        embedding ? JSON.stringify(embedding) : null
      ]
    );

    return item;
  }

  /**
   * Get all items in hot memory for a session.
   */
  async getHot(sessionId: string): Promise<MemoryItem[]> {
    const rows = this.db.all<MemoryRow>(
      `SELECT * FROM ${this.prefix}_memory_items
       WHERE session_id = ? AND tier = 'hot'
       ORDER BY created_at DESC`,
      [sessionId]
    );

    return rows.map(row => this.rowToItem(row));
  }

  /**
   * Get all items in a specific tier for a session.
   */
  async getByTier(sessionId: string, tier: MemoryTier): Promise<MemoryItem[]> {
    const rows = this.db.all<MemoryRow>(
      `SELECT * FROM ${this.prefix}_memory_items
       WHERE session_id = ? AND tier = ?
       ORDER BY created_at DESC`,
      [sessionId, tier]
    );

    return rows.map(row => this.rowToItem(row));
  }

  /**
   * Get a specific memory item by ID.
   */
  async getItem(itemId: string): Promise<MemoryItem | null> {
    const row = this.db.get<MemoryRow>(
      `SELECT * FROM ${this.prefix}_memory_items WHERE id = ?`,
      [itemId]
    );

    return row ? this.rowToItem(row) : null;
  }

  /**
   * Spill items from hot memory to warm/cold storage.
   */
  async spillToWarm(
    sessionId: string,
    options: SpillOptions = {}
  ): Promise<SpillResult> {
    const itemsToSpill = options.itemIds
      ? await this.getItemsByIds(options.itemIds)
      : await this.selectItemsForSpill(sessionId, options.count || 4);

    const spilled: string[] = [];

    for (const item of itemsToSpill) {
      // Determine target tier based on access count
      const targetTier: MemoryTier =
        item.accessCount >= this.config.warmAccessThreshold ? 'warm' : 'cold';

      this.db.run(
        `UPDATE ${this.prefix}_memory_items SET tier = ? WHERE id = ?`,
        [targetTier, item.id]
      );

      spilled.push(item.id);
    }

    return {
      spilledCount: spilled.length,
      spilledIds: spilled,
      targetTier: 'warm'
    };
  }

  /**
   * Recall items from cold/warm storage by semantic similarity.
   * Requires an embedding provider.
   */
  async recall(
    sessionId: string,
    query: string,
    options: RecallOptions = {}
  ): Promise<RecallResult> {
    const limit = options.limit ?? 3;
    const minRelevance = options.minRelevance ?? 0;

    // Get items from warm/cold storage
    let sql = `
      SELECT * FROM ${this.prefix}_memory_items
      WHERE session_id = ? AND tier IN ('warm', 'cold')
    `;
    const params: unknown[] = [sessionId];

    if (options.types?.length) {
      const placeholders = options.types.map(() => '?').join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...options.types);
    }

    const rows = this.db.all<MemoryRow>(sql, params);
    const items = rows.map(row => this.rowToItem(row));

    // Calculate relevance scores
    const relevanceScores = new Map<string, number>();

    if (this.embeddingProvider && rows.length > 0) {
      // Semantic similarity using embeddings
      const queryEmbedding = await this.embeddingProvider.embed(query);

      for (const row of rows) {
        if (row.embedding_json) {
          const itemEmbedding = JSON.parse(row.embedding_json) as number[];
          const similarity = this.cosineSimilarity(queryEmbedding, itemEmbedding);
          relevanceScores.set(row.id, similarity);
        } else {
          // Fallback to keyword matching
          const keywordScore = this.calculateKeywordRelevance(query, row.content);
          relevanceScores.set(row.id, keywordScore);
        }
      }
    } else {
      // Keyword-based relevance (fallback when no embedding provider)
      for (const item of items) {
        const score = this.calculateKeywordRelevance(query, item.content);
        relevanceScores.set(item.id, score);
      }
    }

    // Sort by relevance and filter
    const sortedItems = items
      .map(item => ({ item, score: relevanceScores.get(item.id) || 0 }))
      .filter(({ score }) => score >= minRelevance)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);

    const promoted: string[] = [];

    // Update access tracking and potentially promote
    for (const item of sortedItems) {
      const relevance = relevanceScores.get(item.id) || 0;

      this.db.run(
        `UPDATE ${this.prefix}_memory_items
         SET access_count = access_count + 1,
             last_accessed_at = ?,
             relevance_score = (relevance_score + ?) / 2
         WHERE id = ?`,
        [new Date().toISOString(), relevance, item.id]
      );

      // Auto-promote if enabled and relevance is high enough
      if (
        (options.autoPromote ?? this.config.autoPromoteEnabled) &&
        relevance >= this.config.promoteThreshold
      ) {
        await this.promoteToHot(item.id);
        promoted.push(item.id);
      }
    }

    return { items: sortedItems, promoted, relevanceScores };
  }

  /**
   * Promote an item from cold/warm to hot memory.
   */
  async promoteToHot(itemId: string): Promise<boolean> {
    const item = await this.getItem(itemId);
    if (!item || item.tier === 'hot') {
      return false;
    }

    // Check hot memory capacity and spill if needed
    if (this.config.autoSpillEnabled) {
      const status = await this.getStatus(item.sessionId);
      if (status.hot.tokens + item.tokenCount > this.config.hotTokenLimit) {
        await this.spillToWarm(item.sessionId, { count: 2 });
      }
    }

    this.db.run(
      `UPDATE ${this.prefix}_memory_items
       SET tier = 'hot', relevance_score = 1.0
       WHERE id = ?`,
      [itemId]
    );

    return true;
  }

  /**
   * Demote an item from hot to warm or cold.
   */
  async demote(itemId: string, targetTier: 'warm' | 'cold' = 'warm'): Promise<boolean> {
    const item = await this.getItem(itemId);
    if (!item) {
      return false;
    }

    this.db.run(
      `UPDATE ${this.prefix}_memory_items SET tier = ? WHERE id = ?`,
      [targetTier, itemId]
    );

    return true;
  }

  /**
   * Get memory status for a session.
   */
  async getStatus(sessionId: string): Promise<MemoryStatus> {
    const rows = this.db.all<{ tier: string; count: number; tokens: number }>(
      `SELECT tier, COUNT(*) as count, COALESCE(SUM(token_count), 0) as tokens
       FROM ${this.prefix}_memory_items
       WHERE session_id = ?
       GROUP BY tier`,
      [sessionId]
    );

    const tierStats: Record<MemoryTier, { items: number; tokens: number }> = {
      hot: { items: 0, tokens: 0 },
      warm: { items: 0, tokens: 0 },
      cold: { items: 0, tokens: 0 }
    };

    for (const row of rows) {
      const tier = row.tier as MemoryTier;
      tierStats[tier] = {
        items: row.count,
        tokens: row.tokens
      };
    }

    const suggestions = this.generateSuggestions(tierStats);

    return {
      sessionId,
      hot: {
        ...tierStats.hot,
        limit: this.config.hotTokenLimit,
        utilizationPercent:
          (tierStats.hot.tokens / this.config.hotTokenLimit) * 100
      },
      warm: tierStats.warm,
      cold: tierStats.cold,
      suggestions
    };
  }

  /**
   * Delete a memory item.
   */
  async delete(itemId: string): Promise<boolean> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_memory_items WHERE id = ?`,
      [itemId]
    );
    return result.changes > 0;
  }

  /**
   * Clear all memory for a session.
   */
  async clearSession(sessionId: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_memory_items WHERE session_id = ?`,
      [sessionId]
    );
    return result.changes;
  }

  /**
   * Prune cold storage items exceeding the limit.
   */
  async pruneCold(sessionId: string): Promise<number> {
    const coldItems = await this.getByTier(sessionId, 'cold');
    if (coldItems.length <= this.config.maxColdItems) {
      return 0;
    }

    // Sort by relevance score and access count, delete lowest
    const sortedItems = coldItems.sort((a, b) => {
      const scoreA = a.relevanceScore + a.accessCount * 0.1;
      const scoreB = b.relevanceScore + b.accessCount * 0.1;
      return scoreA - scoreB;
    });

    const toDelete = sortedItems.slice(0, coldItems.length - this.config.maxColdItems);
    const placeholders = toDelete.map(() => '?').join(',');

    const result = this.db.run(
      `DELETE FROM ${this.prefix}_memory_items WHERE id IN (${placeholders})`,
      toDelete.map(item => item.id)
    );

    return result.changes;
  }

  /**
   * Select items for spilling based on relevance and recency.
   */
  private async selectItemsForSpill(
    sessionId: string,
    count: number
  ): Promise<MemoryItem[]> {
    const rows = this.db.all<MemoryRow>(
      `SELECT * FROM ${this.prefix}_memory_items
       WHERE session_id = ? AND tier = 'hot'
       ORDER BY relevance_score ASC, created_at ASC
       LIMIT ?`,
      [sessionId, count]
    );

    return rows.map(row => this.rowToItem(row));
  }

  /**
   * Get items by their IDs.
   */
  private async getItemsByIds(ids: string[]): Promise<MemoryItem[]> {
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const rows = this.db.all<MemoryRow>(
      `SELECT * FROM ${this.prefix}_memory_items WHERE id IN (${placeholders})`,
      ids
    );

    return rows.map(row => this.rowToItem(row));
  }

  /**
   * Generate suggestions based on memory status.
   */
  private generateSuggestions(
    stats: Record<MemoryTier, { items: number; tokens: number }>
  ): MemorySuggestion[] {
    const suggestions: MemorySuggestion[] = [];

    // Suggest spill if hot is near capacity
    if (stats.hot.tokens > this.config.hotTokenLimit * 0.9) {
      suggestions.push({
        type: 'spill',
        reason: 'Hot memory near capacity (>90%)'
      });
    }

    // Suggest pruning cold if very large
    if (stats.cold.items > this.config.maxColdItems) {
      suggestions.push({
        type: 'prune',
        reason: `Cold storage exceeds ${this.config.maxColdItems} items`
      });
    }

    return suggestions;
  }

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

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

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate keyword-based relevance score.
   * Fallback when embeddings are not available.
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
   * Convert a database row to a MemoryItem.
   */
  private rowToItem(row: MemoryRow): MemoryItem {
    return {
      id: row.id,
      sessionId: row.session_id,
      content: row.content,
      type: row.type as MemoryItemType,
      tier: row.tier as MemoryTier,
      accessCount: row.access_count,
      lastAccessedAt: new Date(row.last_accessed_at),
      createdAt: new Date(row.created_at),
      relevanceScore: row.relevance_score,
      tokenCount: row.token_count,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {}
    };
  }
}
