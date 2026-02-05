import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitDiffProcessor } from '../../src';

describe('F2.5 - Git Diff Processing', () => {
  // Use the actual project repo for some tests
  const projectRoot = path.resolve(__dirname, '../..');

  describe('GitDiffProcessor - Diff Parsing', () => {
    let processor: GitDiffProcessor;

    beforeEach(() => {
      processor = new GitDiffProcessor(projectRoot);
    });

    describe('parseDiff', () => {
      it('should parse a simple file modification diff', () => {
        const diff = `diff --git a/file.ts b/file.ts
index abc123..def456 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line 1
-old line 2
+new line 2
+added line
 line 3`;

        const result = processor.parseDiff(diff, 'test');

        expect(result.files.length).toBe(1);
        expect(result.files[0].oldPath).toBe('file.ts');
        expect(result.files[0].newPath).toBe('file.ts');
        expect(result.files[0].changeType).toBe('modified');
        expect(result.additions).toBe(2);
        expect(result.deletions).toBe(1);
      });

      it('should parse a new file diff', () => {
        const diff = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

        const result = processor.parseDiff(diff, 'test');

        expect(result.files.length).toBe(1);
        expect(result.files[0].changeType).toBe('added');
        expect(result.files[0].oldPath).toBeNull();
        expect(result.files[0].newPath).toBe('newfile.ts');
        expect(result.additions).toBe(3);
        expect(result.deletions).toBe(0);
      });

      it('should parse a deleted file diff', () => {
        const diff = `diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
index abc123..0000000
--- a/deleted.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line 1
-line 2
-line 3`;

        const result = processor.parseDiff(diff, 'test');

        expect(result.files.length).toBe(1);
        expect(result.files[0].changeType).toBe('deleted');
        expect(result.files[0].oldPath).toBe('deleted.ts');
        expect(result.files[0].newPath).toBeNull();
        expect(result.additions).toBe(0);
        expect(result.deletions).toBe(3);
      });

      it('should parse multiple files in a diff', () => {
        const diff = `diff --git a/file1.ts b/file1.ts
index abc..def 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,2 @@
-old
+new
 same
diff --git a/file2.ts b/file2.ts
index ghi..jkl 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,2 @@
-old2
+new2
 same2`;

        const result = processor.parseDiff(diff, 'test');

        expect(result.files.length).toBe(2);
        expect(result.files[0].newPath).toBe('file1.ts');
        expect(result.files[1].newPath).toBe('file2.ts');
      });

      it('should parse multiple hunks in a file', () => {
        const diff = `diff --git a/file.ts b/file.ts
index abc..def 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-old line 1
+new line 1
 unchanged
 more unchanged
@@ -10,3 +10,3 @@
-old line 10
+new line 10
 still unchanged`;

        const result = processor.parseDiff(diff, 'test');

        expect(result.files[0].hunks.length).toBe(2);
        expect(result.files[0].hunks[0].oldStart).toBe(1);
        expect(result.files[0].hunks[1].oldStart).toBe(10);
      });

      it('should parse hunk headers with function context', () => {
        const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,4 @@ function myFunction() {
 existing line
+new line
 another line`;

        const result = processor.parseDiff(diff, 'test');

        expect(result.files[0].hunks[0].header).toBe('function myFunction() {');
      });

      it('should handle empty diff', () => {
        const result = processor.parseDiff('', 'test');

        expect(result.files.length).toBe(0);
        expect(result.additions).toBe(0);
        expect(result.deletions).toBe(0);
      });

      it('should track line numbers correctly', () => {
        const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,4 +1,5 @@
 line 1
+added line
 line 2
-removed line
+replacement line
 line 3`;

        const result = processor.parseDiff(diff, 'test');
        const lines = result.files[0].hunks[0].lines;

        // Context line
        expect(lines[0].oldLineNumber).toBe(1);
        expect(lines[0].newLineNumber).toBe(1);
        expect(lines[0].type).toBe('context');

        // Added line
        expect(lines[1].oldLineNumber).toBeNull();
        expect(lines[1].newLineNumber).toBe(2);
        expect(lines[1].type).toBe('added');

        // Another context
        expect(lines[2].oldLineNumber).toBe(2);
        expect(lines[2].newLineNumber).toBe(3);

        // Removed line
        expect(lines[3].oldLineNumber).toBe(3);
        expect(lines[3].newLineNumber).toBeNull();
        expect(lines[3].type).toBe('removed');
      });
    });

    describe('DiffResult properties', () => {
      it('should track source of diff', () => {
        const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1 @@
-old
+new`;

        const result = processor.parseDiff(diff, 'staged');
        expect(result.source).toBe('staged');
      });
    });
  });

  describe('GitDiffProcessor - Git Operations', () => {
    let processor: GitDiffProcessor;

    beforeEach(() => {
      processor = new GitDiffProcessor(projectRoot);
    });

    it('should get current branch', async () => {
      const branch = await processor.getCurrentBranch();
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });

    it('should get recent commits', async () => {
      const commits = await processor.getRecentCommits(5);
      expect(Array.isArray(commits)).toBe(true);
      expect(commits.length).toBeGreaterThan(0);
      expect(commits[0]).toHaveProperty('hash');
      expect(commits[0]).toHaveProperty('message');
      expect(commits[0]).toHaveProperty('date');
    });

    it('should check for uncommitted changes', async () => {
      const hasChanges = await processor.hasUncommittedChanges();
      expect(typeof hasChanges).toBe('boolean');
    });

    it('should get staged diff (may be empty)', async () => {
      const diff = await processor.getStagedDiff();
      expect(diff).toHaveProperty('files');
      expect(diff).toHaveProperty('additions');
      expect(diff).toHaveProperty('deletions');
      expect(diff.source).toBe('staged');
    });

    it('should get unstaged diff (may be empty)', async () => {
      const diff = await processor.getUnstagedDiff();
      expect(diff).toHaveProperty('files');
      expect(diff.source).toBe('unstaged');
    });

    it('should get commit diff', async () => {
      const commits = await processor.getRecentCommits(1);
      if (commits.length > 0) {
        const diff = await processor.getCommitDiff(commits[0].hash);
        expect(diff).toHaveProperty('files');
        expect(diff.source).toContain('commit:');
      }
    });

    it('should get changed files list', async () => {
      const files = await processor.getChangedFiles({ staged: true });
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('GitDiffProcessor - Changed Symbols', () => {
    let processor: GitDiffProcessor;

    beforeEach(() => {
      processor = new GitDiffProcessor(projectRoot);
    });

    it('should extract changed symbols from diff', async () => {
      const diff = `diff --git a/src/test.ts b/src/test.ts
--- a/src/test.ts
+++ b/src/test.ts
@@ -10,3 +10,5 @@ function existingFunction() {
 existing line
+new line 1
+new line 2
 another line`;

      const diffResult = processor.parseDiff(diff, 'test');
      const changedSymbols = await processor.getChangedSymbols(diffResult);

      expect(Array.isArray(changedSymbols)).toBe(true);
    });

    it('should identify change types correctly', async () => {
      const addedDiff = `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1 @@
+content`;

      const deletedDiff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
--- a/old.ts
+++ /dev/null
@@ -1 +0,0 @@
-content`;

      const addedResult = processor.parseDiff(addedDiff, 'test');
      const deletedResult = processor.parseDiff(deletedDiff, 'test');

      const addedSymbols = await processor.getChangedSymbols(addedResult);
      const deletedSymbols = await processor.getChangedSymbols(deletedResult);

      expect(addedSymbols[0]?.changeType).toBe('added');
      expect(deletedSymbols[0]?.changeType).toBe('removed');
    });
  });

  describe('GitDiffProcessor - Error Handling', () => {
    it('should handle non-git directory gracefully', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
      const processor = new GitDiffProcessor(tempDir);

      try {
        await expect(processor.getCurrentBranch()).rejects.toThrow();
      } finally {
        fs.rmSync(tempDir, { recursive: true });
      }
    });
  });
});
