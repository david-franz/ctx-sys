/**
 * Entity type definitions.
 * Entities are the core data unit in ctx-sys.
 */

export type EntityType =
  // Code entities
  | 'file'
  | 'module'
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable'
  // Document entities
  | 'document'
  | 'section'
  | 'requirement'
  | 'feature'
  | 'user-story'
  // Conversation entities
  | 'session'
  | 'message'
  | 'decision'
  | 'question'
  // Domain entities
  | 'person'
  | 'concept'
  | 'technology'
  | 'pattern'
  | 'component'
  // Project entities
  | 'ticket'
  | 'bug'
  | 'task'
  | 'milestone';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  qualifiedName?: string;
  content?: string;
  summary?: string;
  metadata: Record<string, unknown>;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  hash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityCreateInput {
  type: EntityType;
  name: string;
  qualifiedName?: string;
  content?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  filePath?: string;
  startLine?: number;
  endLine?: number;
}

export interface EntityUpdateInput {
  name?: string;
  content?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  startLine?: number;
  endLine?: number;
}

export interface EntitySearchOptions {
  type?: EntityType | EntityType[];
  filePath?: string;
  limit?: number;
  offset?: number;
}

export interface EntityRow {
  id: string;
  type: string;
  name: string;
  qualified_name: string | null;
  content: string | null;
  summary: string | null;
  metadata: string;
  file_path: string | null;
  start_line: number | null;
  end_line: number | null;
  hash: string | null;
  created_at: string;
  updated_at: string;
}
