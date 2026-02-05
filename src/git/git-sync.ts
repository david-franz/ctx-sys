/**
 * Git Sync
 *
 * Synchronizes with Git repository changes.
 */

export interface GitDiff {
  modified: string[];
  added: string[];
  deleted: string[];
  renamed: Array<{ oldPath: string; newPath: string }>;
  // Legacy properties for backwards compatibility
  file?: string;
  type?: 'added' | 'modified' | 'deleted';
  additions?: number;
  deletions?: number;
}

export interface SyncResult {
  filesChanged: number;
  filesReindexed: string[];
  filesRemoved: string[];
  entitiesUpdated: number;
  relationshipsUpdated: number;
  indexedUncommitted?: boolean;
  syncCommitUpdated?: boolean;
  usedFullScan?: boolean;
  errors: string[];
}

export interface SyncOptions {
  lastCommit?: string;
  gitDiff?: GitDiff;
  includeUncommitted?: boolean;
}

export class GitSync {
  constructor(config?: { database?: any; codebaseIndexer?: any }) {}

  async sync(repositoryPath: string): Promise<SyncResult> {
    throw new Error('Not implemented');
  }

  async getDiff(fromCommit: string, toCommit: string): Promise<GitDiff[]> {
    throw new Error('Not implemented');
  }

  async processDiff(diff: GitDiff[]): Promise<SyncResult> {
    throw new Error('Not implemented');
  }

  async syncChanges(projectId: string, projectPath: string, options?: SyncOptions): Promise<SyncResult> {
    throw new Error('Not implemented');
  }

  async recordSyncCommit(commitHash: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async deleteEntityByFilePath(projectId: string, filePath: string): Promise<void> {
    throw new Error('Not implemented');
  }
}
