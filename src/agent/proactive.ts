/**
 * Proactive Context Provider.
 * Push-based context suggestions that surface relevant information based on current activity.
 */

import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { generateId } from '../utils/id';

/**
 * Types of triggers that can cause suggestions.
 */
export type TriggerType = 'file_change' | 'symbol_focus' | 'activity' | 'time';

/**
 * Types of suggestions that can be provided.
 */
export type SuggestionType = 'decision' | 'change' | 'doc' | 'related_code' | 'warning';

/**
 * Status of a suggestion.
 */
export type SuggestionStatus = 'pending' | 'shown' | 'used' | 'dismissed';

/**
 * Types of watch patterns.
 */
export type WatchPatternType = 'file' | 'symbol' | 'topic' | 'entity';

/**
 * Callback types for subscriptions.
 */
export type CallbackType = 'poll' | 'webhook' | 'sse';

/**
 * Pattern to watch for context triggers.
 */
export interface WatchPattern {
  type: WatchPatternType;
  pattern: string;
  priority: number;
}

/**
 * Subscription for proactive suggestions.
 */
export interface ContextSubscription {
  id: string;
  sessionId: string;
  projectId: string;
  watchPatterns: WatchPattern[];
  callbackType: CallbackType;
  callbackUrl?: string;
  minRelevanceScore: number;
  maxSuggestionsPerTrigger: number;
  cooldownMs: number;
  lastTriggeredAt?: Date;
  enabled: boolean;
}

/**
 * Input for creating a subscription.
 */
export interface SubscriptionInput {
  sessionId: string;
  watchPatterns: WatchPattern[];
  callbackType?: CallbackType;
  callbackUrl?: string;
  minRelevanceScore?: number;
  maxSuggestionsPerTrigger?: number;
  cooldownMs?: number;
}

/**
 * A single suggestion item.
 */
export interface SuggestionItem {
  type: SuggestionType;
  title: string;
  summary: string;
  relevanceScore: number;
  entityId?: string;
  actionUrl?: string;
  reason: string;
}

/**
 * A context suggestion with its trigger and items.
 */
export interface ContextSuggestion {
  id: string;
  sessionId: string;
  createdAt: Date;
  trigger: {
    type: TriggerType;
    source: string;
  };
  suggestions: SuggestionItem[];
  status: SuggestionStatus;
  usedItemIndex?: number;
}

/**
 * Query for proactive suggestions.
 */
export interface ProactiveQuery {
  sessionId: string;
  currentFile?: string;
  cursorPosition?: { line: number; column: number };
  recentFiles?: string[];
  currentSymbol?: string;
}

/**
 * Configuration for proactive context.
 */
export interface ProactiveConfig {
  maxSuggestions: number;
  minRelevanceScore: number;
  recentChangeDays: number;
  enableDecisions: boolean;
  enableRecentChanges: boolean;
  enableDocs: boolean;
  enableRelatedCode: boolean;
  enableWarnings: boolean;
}

/**
 * Default proactive configuration.
 */
export const DEFAULT_PROACTIVE_CONFIG: ProactiveConfig = {
  maxSuggestions: 5,
  minRelevanceScore: 0.5,
  recentChangeDays: 7,
  enableDecisions: true,
  enableRecentChanges: true,
  enableDocs: true,
  enableRelatedCode: true,
  enableWarnings: true
};

/**
 * Source of context for generating suggestions.
 */
export interface ProactiveContextSource {
  findRelated(query: string, options?: { limit?: number; types?: string[] }): Promise<Array<{
    id: string;
    name: string;
    type: string;
    content: string;
    summary?: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>>;
}

/**
 * Database row for suggestion.
 */
interface SuggestionRow {
  id: string;
  session_id: string;
  created_at: string;
  trigger_json: string;
  suggestions_json: string;
  status: string;
  used_item_index: number | null;
}

/**
 * Database row for subscription.
 */
interface SubscriptionRow {
  id: string;
  session_id: string;
  watch_patterns_json: string;
  callback_type: string;
  callback_url: string | null;
  min_relevance_score: number;
  max_suggestions: number;
  cooldown_ms: number;
  last_triggered_at: string | null;
  enabled: number;
}

/**
 * Provider for proactive context suggestions.
 * Surfaces relevant information based on current activity before it's explicitly requested.
 */
export class ProactiveContextProvider {
  private projectId: string;
  private prefix: string;
  private config: ProactiveConfig;
  private subscriptions: Map<string, ContextSubscription> = new Map();

  constructor(
    private db: DatabaseConnection,
    projectId: string,
    private contextSource?: ProactiveContextSource,
    config: Partial<ProactiveConfig> = {}
  ) {
    this.projectId = projectId;
    this.prefix = sanitizeProjectId(projectId);
    this.config = { ...DEFAULT_PROACTIVE_CONFIG, ...config };
  }

  /**
   * Get proactive suggestions for current context.
   */
  async suggest(query: ProactiveQuery): Promise<ContextSuggestion> {
    const suggestions: SuggestionItem[] = [];

    // Determine the trigger
    const triggerSource = query.currentFile || query.currentSymbol || 'session';
    const triggerType: TriggerType = query.currentFile ? 'file_change' : 'activity';

    // Generate suggestions based on context
    if (this.contextSource) {
      // Find related decisions
      if (this.config.enableDecisions) {
        const decisions = await this.findRelatedDecisions(query);
        suggestions.push(...decisions);
      }

      // Find recent changes
      if (this.config.enableRecentChanges && query.currentFile) {
        const changes = await this.findRecentChanges(query);
        suggestions.push(...changes);
      }

      // Find related documentation
      if (this.config.enableDocs) {
        const docs = await this.findRelatedDocs(query);
        suggestions.push(...docs);
      }

      // Find related code
      if (this.config.enableRelatedCode && query.currentFile) {
        const relatedCode = await this.findRelatedCode(query);
        suggestions.push(...relatedCode);
      }
    }

    // Check for warnings
    if (this.config.enableWarnings) {
      const warnings = await this.checkForWarnings(query);
      suggestions.push(...warnings);
    }

    // Filter, rank and dedupe
    const finalSuggestions = this.rankAndDedupe(suggestions)
      .filter(s => s.relevanceScore >= this.config.minRelevanceScore)
      .slice(0, this.config.maxSuggestions);

    // Create suggestion record
    const suggestion: ContextSuggestion = {
      id: generateId('sug'),
      sessionId: query.sessionId,
      createdAt: new Date(),
      trigger: {
        type: triggerType,
        source: triggerSource
      },
      suggestions: finalSuggestions,
      status: 'pending'
    };

    // Store for tracking
    await this.storeSuggestion(suggestion);

    return suggestion;
  }

  /**
   * Get a suggestion by ID.
   */
  async getSuggestion(suggestionId: string): Promise<ContextSuggestion | null> {
    const row = this.db.get<SuggestionRow>(
      `SELECT * FROM ${this.prefix}_context_suggestions WHERE id = ?`,
      [suggestionId]
    );

    return row ? this.rowToSuggestion(row) : null;
  }

  /**
   * Get recent suggestions for a session.
   */
  async getRecentSuggestions(sessionId: string, limit: number = 10): Promise<ContextSuggestion[]> {
    const rows = this.db.all<SuggestionRow>(
      `SELECT * FROM ${this.prefix}_context_suggestions
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [sessionId, limit]
    );

    return rows.map(row => this.rowToSuggestion(row));
  }

  /**
   * Mark a suggestion as shown.
   */
  async markShown(suggestionId: string): Promise<boolean> {
    const result = this.db.run(
      `UPDATE ${this.prefix}_context_suggestions SET status = 'shown' WHERE id = ?`,
      [suggestionId]
    );
    return result.changes > 0;
  }

  /**
   * Mark a suggestion as used.
   */
  async markUsed(suggestionId: string, itemIndex?: number): Promise<boolean> {
    const result = this.db.run(
      `UPDATE ${this.prefix}_context_suggestions
       SET status = 'used', used_item_index = ?
       WHERE id = ?`,
      [itemIndex ?? null, suggestionId]
    );
    return result.changes > 0;
  }

  /**
   * Dismiss a suggestion.
   */
  async dismiss(suggestionId: string): Promise<boolean> {
    const result = this.db.run(
      `UPDATE ${this.prefix}_context_suggestions SET status = 'dismissed' WHERE id = ?`,
      [suggestionId]
    );
    return result.changes > 0;
  }

  /**
   * Subscribe to proactive suggestions.
   */
  async subscribe(input: SubscriptionInput): Promise<ContextSubscription> {
    const subscription: ContextSubscription = {
      id: generateId('sub'),
      sessionId: input.sessionId,
      projectId: this.projectId,
      watchPatterns: input.watchPatterns,
      callbackType: input.callbackType ?? 'poll',
      callbackUrl: input.callbackUrl,
      minRelevanceScore: input.minRelevanceScore ?? this.config.minRelevanceScore,
      maxSuggestionsPerTrigger: input.maxSuggestionsPerTrigger ?? this.config.maxSuggestions,
      cooldownMs: input.cooldownMs ?? 5000,
      enabled: true
    };

    this.subscriptions.set(subscription.id, subscription);

    this.db.run(
      `INSERT INTO ${this.prefix}_context_subscriptions (
        id, session_id, watch_patterns_json, callback_type, callback_url,
        min_relevance_score, max_suggestions, cooldown_ms, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscription.id,
        subscription.sessionId,
        JSON.stringify(subscription.watchPatterns),
        subscription.callbackType,
        subscription.callbackUrl ?? null,
        subscription.minRelevanceScore,
        subscription.maxSuggestionsPerTrigger,
        subscription.cooldownMs,
        1
      ]
    );

    return subscription;
  }

  /**
   * Get a subscription by ID.
   */
  async getSubscription(subscriptionId: string): Promise<ContextSubscription | null> {
    // Check in-memory cache first
    if (this.subscriptions.has(subscriptionId)) {
      return this.subscriptions.get(subscriptionId)!;
    }

    const row = this.db.get<SubscriptionRow>(
      `SELECT * FROM ${this.prefix}_context_subscriptions WHERE id = ?`,
      [subscriptionId]
    );

    if (!row) return null;

    const subscription = this.rowToSubscription(row);
    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  /**
   * Get subscriptions for a session.
   */
  async getSessionSubscriptions(sessionId: string): Promise<ContextSubscription[]> {
    const rows = this.db.all<SubscriptionRow>(
      `SELECT * FROM ${this.prefix}_context_subscriptions
       WHERE session_id = ? AND enabled = 1`,
      [sessionId]
    );

    return rows.map(row => {
      const subscription = this.rowToSubscription(row);
      this.subscriptions.set(subscription.id, subscription);
      return subscription;
    });
  }

  /**
   * Update a subscription.
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Partial<Pick<ContextSubscription, 'enabled' | 'minRelevanceScore' | 'maxSuggestionsPerTrigger' | 'cooldownMs'>>
  ): Promise<boolean> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) return false;

    const updated = { ...subscription, ...updates };
    this.subscriptions.set(subscriptionId, updated);

    this.db.run(
      `UPDATE ${this.prefix}_context_subscriptions
       SET enabled = ?, min_relevance_score = ?, max_suggestions = ?, cooldown_ms = ?
       WHERE id = ?`,
      [
        updated.enabled ? 1 : 0,
        updated.minRelevanceScore,
        updated.maxSuggestionsPerTrigger,
        updated.cooldownMs,
        subscriptionId
      ]
    );

    return true;
  }

  /**
   * Unsubscribe from proactive suggestions.
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    this.subscriptions.delete(subscriptionId);
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_context_subscriptions WHERE id = ?`,
      [subscriptionId]
    );
    return result.changes > 0;
  }

  /**
   * Check if a trigger matches any subscription patterns.
   */
  async checkTrigger(
    sessionId: string,
    trigger: { type: WatchPatternType; value: string }
  ): Promise<ContextSubscription[]> {
    const subscriptions = await this.getSessionSubscriptions(sessionId);
    const now = Date.now();

    return subscriptions.filter(sub => {
      // Check cooldown
      if (sub.lastTriggeredAt) {
        const elapsed = now - sub.lastTriggeredAt.getTime();
        if (elapsed < sub.cooldownMs) return false;
      }

      // Check pattern match
      return sub.watchPatterns.some(pattern => {
        if (pattern.type !== trigger.type) return false;
        return this.matchPattern(trigger.value, pattern.pattern);
      });
    });
  }

  /**
   * Get suggestion statistics for a session.
   */
  async getStats(sessionId: string): Promise<{
    total: number;
    pending: number;
    shown: number;
    used: number;
    dismissed: number;
    useRate: number;
  }> {
    const rows = this.db.all<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count
       FROM ${this.prefix}_context_suggestions
       WHERE session_id = ?
       GROUP BY status`,
      [sessionId]
    );

    const stats = {
      total: 0,
      pending: 0,
      shown: 0,
      used: 0,
      dismissed: 0,
      useRate: 0
    };

    for (const row of rows) {
      stats.total += row.count;
      switch (row.status) {
        case 'pending': stats.pending = row.count; break;
        case 'shown': stats.shown = row.count; break;
        case 'used': stats.used = row.count; break;
        case 'dismissed': stats.dismissed = row.count; break;
      }
    }

    const interacted = stats.shown + stats.used + stats.dismissed;
    stats.useRate = interacted > 0 ? stats.used / interacted : 0;

    return stats;
  }

  /**
   * Clear suggestions for a session.
   */
  async clearSuggestions(sessionId: string): Promise<number> {
    const result = this.db.run(
      `DELETE FROM ${this.prefix}_context_suggestions WHERE session_id = ?`,
      [sessionId]
    );
    return result.changes;
  }

  /**
   * Find decisions related to current context.
   */
  private async findRelatedDecisions(query: ProactiveQuery): Promise<SuggestionItem[]> {
    if (!this.contextSource) return [];

    const searchTerms: string[] = [];

    if (query.currentFile) {
      const parts = query.currentFile.split('/').filter(p =>
        !['src', 'lib', 'index', 'node_modules'].includes(p) && p.length > 2
      );
      searchTerms.push(...parts);
    }

    if (query.currentSymbol) {
      searchTerms.push(query.currentSymbol);
    }

    if (searchTerms.length === 0) return [];

    const results = await this.contextSource.findRelated(searchTerms.join(' '), {
      limit: 5,
      types: ['decision']
    });

    return results
      .filter(r => r.score > 0.6)
      .map(r => ({
        type: 'decision' as const,
        title: `Decision: ${r.name}`,
        summary: r.summary || r.content.slice(0, 200),
        relevanceScore: r.score,
        entityId: r.id,
        reason: `Related to ${query.currentSymbol || query.currentFile}`
      }));
  }

  /**
   * Find recent changes that might affect current work.
   */
  private async findRecentChanges(query: ProactiveQuery): Promise<SuggestionItem[]> {
    if (!this.contextSource || !query.currentFile) return [];

    const results = await this.contextSource.findRelated(query.currentFile, {
      limit: 5,
      types: ['file', 'function', 'class']
    });

    return results
      .filter(r => r.score > 0.5 && r.metadata?.updatedAt)
      .slice(0, 3)
      .map(r => ({
        type: 'change' as const,
        title: `Recent change: ${r.name}`,
        summary: `Modified recently`,
        relevanceScore: r.score,
        entityId: r.id,
        reason: 'Related to current file'
      }));
  }

  /**
   * Find documentation related to current context.
   */
  private async findRelatedDocs(query: ProactiveQuery): Promise<SuggestionItem[]> {
    if (!this.contextSource) return [];

    const searchTerm = query.currentSymbol || query.currentFile;
    if (!searchTerm) return [];

    const results = await this.contextSource.findRelated(searchTerm, {
      limit: 3,
      types: ['document', 'section']
    });

    return results
      .filter(r => r.score > 0.65)
      .map(r => ({
        type: 'doc' as const,
        title: `Doc: ${r.name}`,
        summary: r.summary || r.content.slice(0, 150),
        relevanceScore: r.score,
        entityId: r.id,
        reason: `Documentation mentions ${query.currentSymbol || 'related topic'}`
      }));
  }

  /**
   * Find related code.
   */
  private async findRelatedCode(query: ProactiveQuery): Promise<SuggestionItem[]> {
    if (!this.contextSource || !query.currentFile) return [];

    const results = await this.contextSource.findRelated(query.currentFile, {
      limit: 5,
      types: ['function', 'class', 'method']
    });

    return results
      .filter(r => r.score > 0.5)
      .slice(0, 3)
      .map(r => ({
        type: 'related_code' as const,
        title: `Related: ${r.name}`,
        summary: r.type,
        relevanceScore: r.score,
        entityId: r.id,
        reason: 'Changes here may affect this code'
      }));
  }

  /**
   * Check for potential warnings.
   */
  private async checkForWarnings(_query: ProactiveQuery): Promise<SuggestionItem[]> {
    // This would check for failing tests, deprecated APIs, etc.
    // Simplified for now - can be extended with actual checks
    return [];
  }

  /**
   * Rank and dedupe suggestions.
   */
  private rankAndDedupe(suggestions: SuggestionItem[]): SuggestionItem[] {
    const seen = new Set<string>();
    const unique = suggestions.filter(s => {
      if (s.entityId && seen.has(s.entityId)) return false;
      if (s.entityId) seen.add(s.entityId);
      return true;
    });

    return unique.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Match a value against a pattern (glob-like).
   */
  private matchPattern(value: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' +
      pattern
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
        .replace(/{{GLOBSTAR}}/g, '.*') +
      '$'
    );
    return regex.test(value);
  }

  /**
   * Store a suggestion in the database.
   */
  private async storeSuggestion(suggestion: ContextSuggestion): Promise<void> {
    this.db.run(
      `INSERT INTO ${this.prefix}_context_suggestions (
        id, session_id, created_at, trigger_json, suggestions_json, status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        suggestion.id,
        suggestion.sessionId,
        suggestion.createdAt.toISOString(),
        JSON.stringify(suggestion.trigger),
        JSON.stringify(suggestion.suggestions),
        suggestion.status
      ]
    );
  }

  /**
   * Convert a database row to a suggestion.
   */
  private rowToSuggestion(row: SuggestionRow): ContextSuggestion {
    return {
      id: row.id,
      sessionId: row.session_id,
      createdAt: new Date(row.created_at),
      trigger: JSON.parse(row.trigger_json),
      suggestions: JSON.parse(row.suggestions_json),
      status: row.status as SuggestionStatus,
      usedItemIndex: row.used_item_index ?? undefined
    };
  }

  /**
   * Convert a database row to a subscription.
   */
  private rowToSubscription(row: SubscriptionRow): ContextSubscription {
    return {
      id: row.id,
      sessionId: row.session_id,
      projectId: this.projectId,
      watchPatterns: JSON.parse(row.watch_patterns_json),
      callbackType: row.callback_type as CallbackType,
      callbackUrl: row.callback_url ?? undefined,
      minRelevanceScore: row.min_relevance_score,
      maxSuggestionsPerTrigger: row.max_suggestions,
      cooldownMs: row.cooldown_ms,
      lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : undefined,
      enabled: row.enabled === 1
    };
  }
}
