/**
 * Types for conversation memory management.
 */

/**
 * A conversation message.
 */
export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: MessageMetadata;
  createdAt: Date;
}

/**
 * Metadata that can be attached to messages.
 */
export interface MessageMetadata {
  toolCalls?: ToolCall[];
  model?: string;
  tokens?: {
    input?: number;
    output?: number;
  };
  latency?: number;
  [key: string]: unknown;
}

/**
 * A tool call recorded in a message.
 */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

/**
 * Options for querying messages.
 */
export interface MessageQueryOptions {
  sessionId?: string;
  role?: Message['role'];
  before?: Date | string;
  after?: Date | string;
  limit?: number;
  offset?: number;
}

/**
 * A conversation session.
 */
export interface Session {
  id: string;
  name?: string;
  status: 'active' | 'archived' | 'summarized';
  summary?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

/**
 * Configuration for session management.
 */
export interface SessionConfig {
  /** Days to keep archived sessions before cleanup */
  retention: number;
  /** Whether to auto-summarize on archive */
  autoSummarize: boolean;
  /** Max messages before triggering summarization */
  maxActiveMessages: number;
}

/**
 * A conversation summary generated from a session.
 */
export interface ConversationSummary {
  overview: string;
  topics: string[];
  decisions: string[];
  codeReferences: string[];
  keyPoints: string[];
}

/**
 * A decision extracted from a conversation.
 */
export interface Decision {
  id: string;
  sessionId: string;
  messageId: string;
  description: string;
  context?: string;
  alternatives?: string[];
  relatedEntities: string[];
  createdAt: Date;
}

/**
 * Options for creating a decision.
 */
export interface DecisionInput {
  sessionId: string;
  messageId: string;
  description: string;
  context?: string;
  alternatives?: string[];
  relatedEntities?: string[];
}
