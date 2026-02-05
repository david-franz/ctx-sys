/**
 * Phase 2: Git Types
 * Type definitions for git operations
 */

export interface DiffResult {
  files: FileChange[];
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ oldPath: string; newPath: string; from: string; to: string }>;
  commit?: CommitInfo;
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  staged?: boolean;
  status?: string;
  file?: string;
}

export interface CommitInfo {
  hash: string;
  sha?: string;
  message: string;
  author: string;
  timestamp: Date;
  date?: Date;
  files?: string[];
  from?: string;
  to?: string;
}

export interface SyncResult {
  filesProcessed: number;
  entitiesUpdated: number;
  entitiesCreated: number;
  entitiesDeleted: number;
  commitsSynced: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  filesRenamed: number;
  errors: Array<string | { file: string; error: string }>;
}

export interface SyncOptions {
  fromCommit?: string;
  toCommit?: string;
  force?: boolean;
  includeUncommitted?: boolean;
  onProgress?: (progress: any) => void;
}
