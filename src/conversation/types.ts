/**
 * Conversation Types
 *
 * Type definitions for conversation management.
 */

export type SessionStatus = 'active' | 'inactive' | 'archived' | 'summarized';

export interface SessionConfig {
  maxMessages?: number;
  maxActiveMessages?: number;
  summarizeAfter?: number;
  autoArchive?: boolean;
  autoSummarize?: boolean;
  retention?: number;
  name?: string;
}

export interface Session {
  id: string;
  projectId: string;
  status: SessionStatus;
  name?: string;
  summary?: string;
  messageCount?: number;
  config?: SessionConfig;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface SessionStats {
  messageCount: number;
  tokensUsed: number;
  averageResponseTime?: number;
  active?: number;
  archived?: number;
  summarized?: number;
  totalMessages?: number;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  timestamp?: Date;
  metadata?: Record<string, any>;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface MessageQuery {
  sessionId?: string;
  role?: MessageRole;
  limit?: number;
  offset?: number;
  before?: Date;
  after?: Date;
}

export interface Decision {
  id: string;
  sessionId: string;
  messageId: string;
  type: DecisionType;
  description: string;
  context?: string;
  alternatives?: string[];
  relatedEntities: string[];
  createdAt: Date;
}

export enum DecisionType {
  TECHNICAL = 'technical',
  ARCHITECTURAL = 'architectural',
  PROCESS = 'process'
}
