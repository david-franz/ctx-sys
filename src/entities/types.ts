/**
 * Entity types and interfaces
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.3-entity-storage.test.ts for expected behavior.
 */

export type EntityType =
  | 'file'
  | 'module'
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable'
  | 'document'
  | 'section'
  | 'requirement'
  | 'session'
  | 'message'
  | 'concept'
  | 'technology'
  | 'pattern'
  | 'decision';

export interface Entity {
  id: string;
  type?: EntityType | string;
  name?: string;
  qualifiedName?: string;
  content?: string;
  summary?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  hash?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Partial entity for use in mocks and tests
export type PartialEntity = Partial<Entity> & { id: string };

export interface CreateEntityInput {
  type: EntityType;
  name: string;
  qualifiedName?: string;
  content?: string;
  summary?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, any>;
  autoEmbed?: boolean;
}

export interface UpdateEntityInput {
  name?: string;
  content?: string;
  summary?: string;
  startLine?: number;
  endLine?: number;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  query: string;
  types?: EntityType[];
  filePath?: string;
  limit?: number;
  offset?: number;
}
