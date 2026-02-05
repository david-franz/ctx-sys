/**
 * Shared types for the retrieval module.
 */

import { Entity } from '../entities';

/**
 * A search result with relevance score.
 */
export interface SearchResult {
  /** The matched entity */
  entity: Entity;
  /** Relevance score (0-1) */
  score: number;
  /** Which strategy found this result */
  source: SearchStrategy;
  /** Additional match metadata */
  matchInfo?: {
    /** Matched text snippet */
    snippet?: string;
    /** Matched field (name, content, summary) */
    field?: string;
    /** Highlight positions */
    highlights?: Array<{ start: number; end: number }>;
  };
}

/**
 * Search strategy types.
 */
export type SearchStrategy =
  | 'keyword'     // Exact/fuzzy keyword matching
  | 'semantic'    // Embedding-based similarity
  | 'graph'       // Graph traversal
  | 'structural'  // Code structure matching
  | 'hybrid';     // Combined strategies

/**
 * Configuration for search behavior.
 */
export interface SearchConfig {
  /** Maximum results to return */
  limit?: number;
  /** Minimum relevance threshold */
  minScore?: number;
  /** Entity types to include */
  entityTypes?: string[];
  /** Search strategies to use */
  strategies?: SearchStrategy[];
  /** Whether to include graph context */
  includeGraphContext?: boolean;
  /** Maximum depth for graph expansion */
  graphDepth?: number;
}

/**
 * Assembled context for LLM consumption.
 */
export interface AssembledContext {
  /** Primary relevant entities */
  primary: Entity[];
  /** Supporting context entities */
  supporting: Entity[];
  /** Formatted context string */
  formatted: string;
  /** Token count estimate */
  estimatedTokens: number;
  /** Sources used */
  sources: Array<{
    entityId: string;
    entityName: string;
    relevance: number;
  }>;
}

/**
 * Feedback for a search result.
 */
export interface RelevanceFeedbackInput {
  /** Query that produced the result */
  queryId: string;
  /** Entity that was rated */
  entityId: string;
  /** Relevance rating */
  rating: 'relevant' | 'partial' | 'irrelevant';
  /** Optional user comment */
  comment?: string;
}

/**
 * Stored feedback record.
 */
export interface StoredFeedback extends RelevanceFeedbackInput {
  /** Unique ID */
  id: string;
  /** Timestamp */
  createdAt: Date;
  /** Original query text */
  queryText: string;
}

/**
 * HyDE (Hypothetical Document Embeddings) result.
 */
export interface HyDEResult {
  /** Original query */
  originalQuery: string;
  /** Generated hypothetical document */
  hypotheticalDoc: string;
  /** Expanded search queries */
  expandedQueries: string[];
}

/**
 * Retrieval gate decision.
 */
export interface GateDecision {
  /** Whether retrieval is needed */
  shouldRetrieve: boolean;
  /** Confidence in the decision */
  confidence: number;
  /** Reason for the decision */
  reason: string;
  /** Suggested search strategies if retrieval is needed */
  suggestedStrategies?: SearchStrategy[];
}

/**
 * Draft critique result.
 */
export interface CritiqueResult {
  /** Whether the draft passed critique */
  passed: boolean;
  /** Issues found */
  issues: CritiqueIssue[];
  /** Suggested improvements */
  suggestions: string[];
  /** Missing information that could be retrieved */
  missingInfo?: string[];
}

/**
 * A critique issue found in a draft.
 */
export interface CritiqueIssue {
  /** Issue type */
  type: 'hallucination' | 'unsupported' | 'incomplete' | 'inconsistent';
  /** Description of the issue */
  description: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high';
  /** Location in draft (if applicable) */
  location?: string;
}
