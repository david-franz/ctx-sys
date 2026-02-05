/**
 * Entity Model
 *
 * Core entity and relationship models.
 */

export interface Entity {
  id: string;
  projectId: string;
  type: string;
  name: string;
  qualifiedName?: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  content?: string;
  summary?: string;
  embedding?: Float32Array;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Relationship {
  id: string;
  projectId: string;
  type: string;
  sourceId: string;
  targetId: string;
  weight?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}
