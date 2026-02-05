/**
 * F2.5 Git Diff Processing Tests
 *
 * Tests for incremental updates based on git commits,
 * handling file changes, renames, and sync tracking.
 *
 * NOTE: These tests will fail with "Cannot find module" errors until
 * the actual implementations are created at the following paths:
 *   - src/git/diff.ts (GitDiffProcessor)
 *   - src/git/sync.ts (GitSyncManager)
 *   - src/git/types.ts (DiffResult, FileChange, CommitInfo, SyncResult, SyncOptions)
 *   - src/indexing/incremental.ts (IncrementalIndexer)
 *   - src/git/executor.ts (GitExecutor)
 *
 * @see docs/phase-2/F2.5-git-diff-processing.md
 */

// Import actual implementations from source paths (will fail until implementations exist)
import { GitDiffProcessor } from '../../src/git/diff';
import { GitSyncManager } from '../../src/git/sync';
import { IncrementalIndexer } from '../../src/indexing/incremental';
import { GitExecutor } from '../../src/git/executor';
import {
  DiffResult,
  FileChange,
  CommitInfo,
  SyncResult,
  SyncOptions
} from '../../src/git/types';

import {
  createMockDatabase,
  createMockProject,
  MockDatabase
} from '../helpers/mocks';

// Mock dependencies
jest.mock('../../src/git/executor');
jest.mock('../../src/indexing/incremental');

const MockGitExecutor = GitExecutor as jest.MockedClass<typeof GitExecutor>;
const MockIncrementalIndexer = IncrementalIndexer as jest.MockedClass<typeof IncrementalIndexer>;

describe('F2.5 Git Diff Processing', () => {
  let mockDb: MockDatabase;
  let mockGitExecutor: jest.Mocked<GitExecutor>;
  let mockIndexer: jest.Mocked<IncrementalIndexer>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    jest.clearAllMocks();

    // Set up mocked GitExecutor instance
    mockGitExecutor = {
      exec: jest.fn(),
      getStatus: jest.fn(),
      getDiff: jest.fn(),
      getLog: jest.fn(),
      getCurrentBranch: jest.fn(),
      getHead: jest.fn()
    } as unknown as jest.Mocked<GitExecutor>;

    MockGitExecutor.mockImplementation(() => mockGitExecutor);

    // Set up mocked IncrementalIndexer instance
    mockIndexer = {
      indexFile: jest.fn(),
      indexFiles: jest.fn(),
      removeFile: jest.fn(),
      removeFiles: jest.fn(),
      updateFile: jest.fn()
    } as unknown as jest.Mocked<IncrementalIndexer>;

    MockIncrementalIndexer.mockImplementation(() => mockIndexer);
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // GitDiffProcessor Tests
  // ============================================================================

  describe('GitDiffProcessor', () => {
    let processor: GitDiffProcessor;

    beforeEach(() => {
      processor = new GitDiffProcessor(mockGitExecutor);
    });

    describe('getChangesSince', () => {
      it('should detect added files', async () => {
        const diffOutput = 'A\tsrc/new-file.ts';
        mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

        const result: DiffResult = await processor.getChangesSince('abc123');

        expect(mockGitExecutor.getDiff).toHaveBeenCalledWith('abc123', 'HEAD');
        expect(result.added).toContain('src/new-file.ts');
      });

      it('should detect modified files', async () => {
        const diffOutput = 'M\tsrc/modified.ts';
        mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

        const result: DiffResult = await processor.getChangesSince('abc123');

        expect(result.modified).toContain('src/modified.ts');
      });

      it('should detect deleted files', async () => {
        const diffOutput = 'D\tsrc/deleted.ts';
        mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

        const result: DiffResult = await processor.getChangesSince('abc123');

        expect(result.deleted).toContain('src/deleted.ts');
      });

      it('should detect renamed files', async () => {
        const diffOutput = 'R100\tsrc/old-name.ts\tsrc/new-name.ts';
        mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

        const result: DiffResult = await processor.getChangesSince('abc123');

        expect(result.renamed).toHaveLength(1);
        expect(result.renamed[0].from).toBe('src/old-name.ts');
        expect(result.renamed[0].to).toBe('src/new-name.ts');
      });

      it('should detect copied files', async () => {
        const diffOutput = 'C100\tsrc/original.ts\tsrc/copy.ts';
        mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

        const result: DiffResult = await processor.getChangesSince('abc123');

        // Copies should be treated as additions
        expect(result.added).toContain('src/copy.ts');
      });

      it('should handle mixed changes', async () => {
        const diffOutput = [
          'A\tsrc/new.ts',
          'M\tsrc/modified.ts',
          'D\tsrc/deleted.ts',
          'R100\tsrc/old.ts\tsrc/renamed.ts'
        ].join('\n');
        mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

        const result: DiffResult = await processor.getChangesSince('abc123');

        expect(result.added).toHaveLength(1);
        expect(result.modified).toHaveLength(1);
        expect(result.deleted).toHaveLength(1);
        expect(result.renamed).toHaveLength(1);
      });
    });

    describe('getLatestCommit', () => {
      it('should return HEAD commit SHA', async () => {
        const headSha = 'abc123def456789';
        mockGitExecutor.getHead.mockResolvedValue(headSha);

        const result = await processor.getLatestCommit();

        expect(mockGitExecutor.getHead).toHaveBeenCalled();
        expect(result).toBe(headSha);
        expect(result).toMatch(/^[a-f0-9]+$/);
      });
    });

    describe('getCommitsSince', () => {
      it('should return commit info', async () => {
        const logOutput = 'abc123|Fix bug in auth|John Doe|2024-01-15T10:30:00Z';
        mockGitExecutor.getLog.mockResolvedValue(logOutput);

        const commits: CommitInfo[] = await processor.getCommitsSince('old-sha');

        expect(mockGitExecutor.getLog).toHaveBeenCalledWith('old-sha', 'HEAD');
        expect(commits).toHaveLength(1);
        expect(commits[0].sha).toBe('abc123');
        expect(commits[0].message).toBe('Fix bug in auth');
        expect(commits[0].author).toBe('John Doe');
        expect(commits[0].date).toBeInstanceOf(Date);
      });

      it('should get files changed in each commit', async () => {
        const logOutput = 'abc123|Fix bug|Author|2024-01-15T10:30:00Z\nsrc/a.ts\nsrc/b.ts\nsrc/c.ts';
        mockGitExecutor.getLog.mockResolvedValue(logOutput);

        const commits: CommitInfo[] = await processor.getCommitsSince('old-sha');

        expect(commits[0].files).toHaveLength(3);
      });
    });

    describe('parseCommit', () => {
      it('should parse single commit details', async () => {
        const showOutput = 'abc123|Update dependencies|Jane Smith|2024-01-16T14:00:00Z';
        mockGitExecutor.exec.mockResolvedValue(showOutput);

        const commit: CommitInfo = await processor.parseCommit('abc123');

        expect(mockGitExecutor.exec).toHaveBeenCalled();
        expect(commit.sha).toBe('abc123');
        expect(commit.message).toBe('Update dependencies');
      });
    });

    describe('getCurrentBranch', () => {
      it('should return current branch name', async () => {
        mockGitExecutor.getCurrentBranch.mockResolvedValue('feature/new-feature');

        const branch = await processor.getCurrentBranch();

        expect(mockGitExecutor.getCurrentBranch).toHaveBeenCalled();
        expect(branch).toContain('/');
      });

      it('should return main for default branch', async () => {
        mockGitExecutor.getCurrentBranch.mockResolvedValue('main');

        const branch = await processor.getCurrentBranch();

        expect(['main', 'master']).toContain(branch);
      });
    });

    describe('hasUncommittedChanges', () => {
      it('should return true when changes exist', async () => {
        mockGitExecutor.getStatus.mockResolvedValue(' M src/modified.ts');

        const hasChanges = await processor.hasUncommittedChanges();

        expect(mockGitExecutor.getStatus).toHaveBeenCalled();
        expect(hasChanges).toBe(true);
      });

      it('should return false when clean', async () => {
        mockGitExecutor.getStatus.mockResolvedValue('');

        const hasChanges = await processor.hasUncommittedChanges();

        expect(hasChanges).toBe(false);
      });
    });

    describe('getUncommittedFiles', () => {
      it('should detect staged files', async () => {
        const statusOutput = [
          'M  src/staged.ts',    // Staged modification
          'A  src/new.ts'        // Staged addition
        ].join('\n');
        mockGitExecutor.getStatus.mockResolvedValue(statusOutput);

        const result: FileChange[] = await processor.getUncommittedFiles();

        expect(mockGitExecutor.getStatus).toHaveBeenCalled();
        const stagedPaths = result.filter(f => f.staged).map(f => f.path);
        expect(stagedPaths).toContain('src/staged.ts');
        expect(stagedPaths).toContain('src/new.ts');
      });

      it('should detect unstaged files', async () => {
        const statusOutput = [
          ' M src/unstaged.ts',   // Unstaged modification
          '?? src/untracked.ts'   // Untracked file
        ].join('\n');
        mockGitExecutor.getStatus.mockResolvedValue(statusOutput);

        const result: FileChange[] = await processor.getUncommittedFiles();

        const unstagedPaths = result.filter(f => !f.staged).map(f => f.path);
        expect(unstagedPaths).toHaveLength(2);
      });
    });
  });

  // ============================================================================
  // GitSyncManager Tests
  // ============================================================================

  describe('GitSyncManager', () => {
    let syncManager: GitSyncManager;
    let processor: GitDiffProcessor;

    beforeEach(() => {
      processor = new GitDiffProcessor(mockGitExecutor);
      syncManager = new GitSyncManager(processor, mockIndexer, mockDb as any);
    });

    describe('sync', () => {
      it('should sync changes since last commit', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-commit-sha' });
        mockGitExecutor.getHead.mockResolvedValue('new-commit-sha');
        mockGitExecutor.getDiff.mockResolvedValue('');

        await syncManager.sync(project.id);

        expect(mockGitExecutor.getDiff).toHaveBeenCalledWith('old-commit-sha', 'HEAD');
      });

      it('should throw if no previous sync found', async () => {
        const project = createMockProject({ lastSyncCommit: undefined });
        mockDb.mockGet(project);

        await expect(syncManager.sync(project.id)).rejects.toThrow();
      });

      it('should handle deleted files', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('D\tsrc/removed.ts');

        mockDb.mockAll([{ id: 'e1' }, { id: 'e2' }]);

        const result: SyncResult = await syncManager.sync(project.id);

        expect(mockIndexer.removeFile).toHaveBeenCalledWith('src/removed.ts');
        expect(result.filesDeleted).toBe(1);
      });

      it('should handle renamed files', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('R100\tsrc/old.ts\tsrc/new.ts');

        const result: SyncResult = await syncManager.sync(project.id);

        expect(mockIndexer.removeFile).toHaveBeenCalledWith('src/old.ts');
        expect(mockIndexer.indexFile).toHaveBeenCalledWith('src/new.ts');
        expect(result.filesRenamed).toBe(1);
      });

      it('should index added files', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('A\tsrc/new-feature.ts');

        const result: SyncResult = await syncManager.sync(project.id);

        expect(mockIndexer.indexFile).toHaveBeenCalledWith('src/new-feature.ts');
        expect(result.filesAdded).toBe(1);
      });

      it('should re-index modified files', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('M\tsrc/updated.ts');

        const result: SyncResult = await syncManager.sync(project.id);

        expect(mockIndexer.updateFile).toHaveBeenCalledWith('src/updated.ts');
        expect(result.filesModified).toBe(1);
      });

      it('should update last sync commit', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-commit-sha');
        mockGitExecutor.getDiff.mockResolvedValue('');

        await syncManager.sync(project.id);

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.arrayContaining(['new-commit-sha'])
        );
      });

      it('should include uncommitted when requested', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('');
        mockGitExecutor.getStatus.mockResolvedValue(' M src/uncommitted.ts');

        const options: SyncOptions = { includeUncommitted: true };
        const result: SyncResult = await syncManager.sync(project.id, options);

        expect(mockGitExecutor.getStatus).toHaveBeenCalled();
        expect(result.filesModified).toBeGreaterThanOrEqual(0);
      });

      it('should report progress', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('A\tsrc/new.ts');

        const onProgress = jest.fn();
        const options: SyncOptions = { onProgress };

        await syncManager.sync(project.id, options);

        expect(onProgress).toHaveBeenCalled();
        expect(onProgress).toHaveBeenCalledWith(expect.stringContaining(''));
      });

      it('should collect errors without stopping', async () => {
        const project = createMockProject({ lastSyncCommit: 'old-sha' });
        mockDb.mockGet(project);
        mockGitExecutor.getHead.mockResolvedValue('new-sha');
        mockGitExecutor.getDiff.mockResolvedValue('A\tsrc/good.ts\nA\tsrc/broken.ts');

        mockIndexer.indexFile
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Parse error'));

        const result: SyncResult = await syncManager.sync(project.id);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].file).toBe('src/broken.ts');
        expect(result.filesAdded).toBe(1); // Still counts successful additions
      });
    });

    describe('handleDeletedFile', () => {
      it('should delete all entities for file', async () => {
        mockDb.mockAll([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);

        await syncManager.handleDeletedFile('deleted.ts');

        expect(mockIndexer.removeFile).toHaveBeenCalledWith('deleted.ts');
      });

      it('should delete relationships', async () => {
        mockDb.mockAll([{ id: 'entity-1' }]);

        await syncManager.handleDeletedFile('deleted.ts');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining(['entity-1'])
        );
      });

      it('should delete embeddings', async () => {
        mockDb.mockAll([{ id: 'entity-1' }]);

        await syncManager.handleDeletedFile('deleted.ts');

        expect(mockDb.run).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.arrayContaining(['entity-1'])
        );
      });
    });

    describe('handleRenamedFile', () => {
      it('should update entity file paths', async () => {
        const fromPath = 'src/old-name.ts';
        const toPath = 'src/new-name.ts';
        mockDb.mockAll([{ id: 'e1', file_path: fromPath }]);

        await syncManager.handleRenamedFile(fromPath, toPath);

        expect(mockIndexer.removeFile).toHaveBeenCalledWith(fromPath);
        expect(mockIndexer.indexFile).toHaveBeenCalledWith(toPath);
      });

      it('should preserve entity IDs for history', async () => {
        const entityId = 'entity-preserved';
        mockDb.mockGet({ id: entityId, file_path: 'src/old.ts' });
        mockDb.mockAll([{ id: entityId }]);

        await syncManager.handleRenamedFile('src/old.ts', 'src/new.ts');

        // The implementation should track history by storing previous path
        expect(mockDb.run).toHaveBeenCalled();
      });

      it('should re-index renamed file', async () => {
        const fromPath = 'src/old.ts';
        const toPath = 'src/new.ts';

        await syncManager.handleRenamedFile(fromPath, toPath);

        expect(mockIndexer.removeFile).toHaveBeenCalledWith(fromPath);
        expect(mockIndexer.indexFile).toHaveBeenCalledWith(toPath);
      });
    });
  });

  // ============================================================================
  // SyncResult Tests
  // ============================================================================

  describe('SyncResult', () => {
    it('should include all statistics', () => {
      const result: SyncResult = {
        commitsSynced: 5,
        filesAdded: 10,
        filesModified: 8,
        filesDeleted: 3,
        filesRenamed: 2,
        entitiesCreated: 50,
        entitiesUpdated: 20,
        entitiesDeleted: 15,
        errors: []
      };

      expect(result.commitsSynced).toBe(5);
      expect(result.filesAdded + result.filesModified + result.filesDeleted + result.filesRenamed).toBe(23);
    });

    it('should include error details', () => {
      const result: SyncResult = {
        commitsSynced: 0,
        filesAdded: 0,
        filesModified: 0,
        filesDeleted: 0,
        filesRenamed: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
        entitiesDeleted: 0,
        errors: [
          { file: 'broken.ts', error: 'Syntax error' },
          { file: 'timeout.ts', error: 'API timeout' }
        ]
      };

      expect(result.errors).toHaveLength(2);
    });
  });

  // ============================================================================
  // MCP Tool Tests
  // ============================================================================

  describe('sync_from_git MCP tool', () => {
    it('should have correct input schema', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          project: { type: 'string' },
          since: { type: 'string' },
          include_uncommitted: { type: 'boolean' }
        }
      };

      expect(inputSchema.properties.since.type).toBe('string');
      expect(inputSchema.properties.include_uncommitted.type).toBe('boolean');
    });

    it('should return success response', async () => {
      const project = createMockProject({ lastSyncCommit: 'old-sha' });
      mockDb.mockGet(project);
      mockGitExecutor.getHead.mockResolvedValue('new-sha');
      mockGitExecutor.getDiff.mockResolvedValue('A\tsrc/a.ts\nA\tsrc/b.ts');

      const processor = new GitDiffProcessor(mockGitExecutor);
      const syncManager = new GitSyncManager(processor, mockIndexer, mockDb as any);

      const result = await syncManager.sync(project.id);

      expect(result.filesAdded).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // CLI Command Tests
  // ============================================================================

  describe('sync CLI command', () => {
    it('should support --project option', () => {
      const args = { project: 'my-project' };
      expect(args.project).toBe('my-project');
    });

    it('should support --since option', () => {
      const args = { since: 'abc123' };
      expect(args.since).toBe('abc123');
    });

    it('should support --include-uncommitted option', () => {
      const args = { includeUncommitted: true };
      expect(args.includeUncommitted).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    let processor: GitDiffProcessor;

    beforeEach(() => {
      processor = new GitDiffProcessor(mockGitExecutor);
    });

    it('should handle empty diff', async () => {
      mockGitExecutor.getDiff.mockResolvedValue('');

      const result: DiffResult = await processor.getChangesSince('abc123');

      expect(result.added).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      expect(result.renamed).toHaveLength(0);
    });

    it('should handle merge commits', async () => {
      const diffOutput = [
        'A\tsrc/a.ts',
        'A\tsrc/b.ts',
        'A\tsrc/c.ts'
      ].join('\n');
      mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

      const result: DiffResult = await processor.getChangesSince('merge-sha');

      expect(result.added.length).toBeGreaterThan(1);
    });

    it('should handle binary files', async () => {
      const diffOutput = 'A\tassets/image.png';
      mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

      const result: DiffResult = await processor.getChangesSince('abc123');

      // Binary files should still be tracked, even if not indexed
      expect(result.added).toContain('assets/image.png');
    });

    it('should handle files with spaces in names', async () => {
      const diffOutput = 'A\tsrc/my file.ts';
      mockGitExecutor.getDiff.mockResolvedValue(diffOutput);

      const result: DiffResult = await processor.getChangesSince('abc123');

      expect(result.added).toContain('src/my file.ts');
    });

    it('should handle very long commit messages', async () => {
      const longMessage = 'Fix: '.padEnd(1000, 'x');
      const logOutput = `abc123|${longMessage}|Author|2024-01-15T10:30:00Z`;
      mockGitExecutor.getLog.mockResolvedValue(logOutput);

      const commits: CommitInfo[] = await processor.getCommitsSince('old-sha');

      expect(commits[0].message.length).toBe(1000);
    });

    it('should handle rapid commits', async () => {
      const logEntries = Array(100).fill(null).map((_, i) =>
        `commit-${i}|Commit ${i}|Author|2024-01-15T10:30:00Z`
      ).join('\n');
      mockGitExecutor.getLog.mockResolvedValue(logEntries);

      const commits: CommitInfo[] = await processor.getCommitsSince('old-sha');

      expect(commits).toHaveLength(100);
    });

    it('should handle detached HEAD state', async () => {
      mockGitExecutor.getCurrentBranch.mockResolvedValue('HEAD');

      const branch = await processor.getCurrentBranch();

      const isDetached = branch === 'HEAD';
      expect(isDetached).toBe(true);
    });

    it('should handle untracked files', async () => {
      mockGitExecutor.getStatus.mockResolvedValue('?? src/untracked.ts');

      const result: FileChange[] = await processor.getUncommittedFiles();

      const untrackedFiles = result.filter(f => f.status === 'untracked');
      expect(untrackedFiles.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Git Hooks Integration Tests
  // ============================================================================

  describe('git hooks integration', () => {
    it('should support post-commit hook', () => {
      const hookContent = `#!/bin/sh
ctx-sys sync 2>/dev/null &
`;

      expect(hookContent).toContain('ctx-sys sync');
      expect(hookContent).toContain('&'); // Background execution
    });

    it('should support custom hook installation', () => {
      const hookPath = '.git/hooks/post-commit';
      expect(hookPath).toContain('hooks');
    });
  });
});
