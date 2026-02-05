/**
 * Root types file for Phase 3 integration
 * Shared types across conversation memory and decision extraction
 */

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  toolCalls?: ToolCall[];
  createdAt: Date;
}

export interface Session {
  id: string;
  projectId: string;
  status: 'active' | 'archived' | 'summarized';
  messageCount: number;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface ConversationSummary {
  overview: string;
  topics: string[];
  decisions: string[];
  codeReferences: string[];
  keyPoints: string[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}
