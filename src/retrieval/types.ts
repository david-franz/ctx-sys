/**
 * Retrieval System Types
 *
 * Type definitions for query parsing, search, context assembly, and feedback.
 */

// ============================================================================
// Query Parsing Types
// ============================================================================

export type QueryIntent = 'find' | 'explain' | 'debug' | 'refactor' | 'implement' | 'general';

export interface EntityMention {
  text: string;
  type: 'function' | 'class' | 'file' | 'interface' | 'type';
  startIndex: number;
  endIndex: number;
}

export interface QueryFilters {
  types?: string[];
  files?: string[];
  limit?: number;
  since?: Date;
}

export interface ParsedQuery {
  original: string;
  intent: QueryIntent;
  keywords: string[];
  entityMentions: EntityMention[];
  filters: QueryFilters;
  expanded?: string[];
}

export interface QueryFilter {
  types?: string[];
  files?: string[];
  limit?: number;
  since?: Date;
}

// ============================================================================
// Search Types
// ============================================================================

export interface Entity {
  id: string;
  name: string;
  type: string;
  summary?: string;
  content?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  [key: string]: any;
}

export interface SearchResult {
  entityId: string;
  score: number;
  source?: 'vector' | 'graph' | 'fts';
  entity?: Entity;
  vectorRank?: number;
  graphRank?: number;
  ftsRank?: number;
}

export type SearchStrategy = 'vector' | 'graph' | 'fts';

export interface RRFOptions {
  k?: number;
  weights?: Record<SearchStrategy, number>;
}

export interface Query {
  text: string;
  filters?: QueryFilter;
  limit?: number;
}

// ============================================================================
// Context Assembly Types
// ============================================================================

export interface ContextSource {
  entityId: string;
  name: string;
  type: string;
  file?: string;
  line?: number;
  relevance: number;
}

export interface AssembledContext {
  context: string;
  sources: ContextSource[];
  tokenCount: number;
  truncated: boolean;
  summary?: string;
}

export interface ContextOptions {
  format?: 'markdown' | 'xml' | 'plain';
  maxTokens?: number;
  includeMetadata?: boolean;
  includeSources?: boolean;
  includeCodeContent?: boolean;
  groupByType?: boolean;
}

// ============================================================================
// Relevance Feedback Types
// ============================================================================

export type FeedbackType = 'used' | 'ignored' | 'explicit_positive' | 'explicit_negative';

export interface Feedback {
  id: string;
  queryId: string;
  entityId: string;
  signal: FeedbackType;
  timestamp: Date;
}

export interface FeedbackStats {
  entityId: string;
  totalReturns: number;
  usedCount: number;
  ignoredCount: number;
  positiveCount: number;
  negativeCount: number;
  useRate: number;
}

export interface ScoredResult {
  entityId: string;
  baseScore: number;
  adjustedScore: number;
  boost: number;
}
