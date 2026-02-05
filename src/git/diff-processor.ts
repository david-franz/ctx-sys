import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import {
  DiffResult,
  FileDiff,
  DiffHunk,
  DiffLine,
  DiffOptions,
  ChangeType,
  ChangedSymbol
} from './types';
import { ASTParser, Symbol } from '../ast';

const execAsync = promisify(exec);

/**
 * Processes git diffs and extracts change information.
 */
export class GitDiffProcessor {
  private repoPath: string;
  private parser?: ASTParser;

  constructor(repoPath: string, parser?: ASTParser) {
    this.repoPath = path.resolve(repoPath);
    this.parser = parser;
  }

  /**
   * Get diff based on options.
   */
  async getDiff(options: DiffOptions = {}): Promise<DiffResult> {
    const args = this.buildGitDiffArgs(options);
    const output = await this.runGitCommand(`diff ${args}`);
    return this.parseDiff(output, this.getDiffSource(options));
  }

  /**
   * Get staged changes.
   */
  async getStagedDiff(): Promise<DiffResult> {
    return this.getDiff({ staged: true });
  }

  /**
   * Get unstaged changes.
   */
  async getUnstagedDiff(): Promise<DiffResult> {
    return this.getDiff({ unstaged: true });
  }

  /**
   * Get diff for a specific commit.
   */
  async getCommitDiff(commit: string): Promise<DiffResult> {
    const output = await this.runGitCommand(`show ${commit} --format="" --`);
    return this.parseDiff(output, `commit:${commit}`);
  }

  /**
   * Get diff between two commits.
   */
  async getCommitRangeDiff(fromCommit: string, toCommit: string): Promise<DiffResult> {
    const output = await this.runGitCommand(`diff ${fromCommit}..${toCommit}`);
    return this.parseDiff(output, `${fromCommit}..${toCommit}`);
  }

  /**
   * Parse a raw diff string.
   */
  parseDiff(diffText: string, source: string = 'unknown'): DiffResult {
    const files: FileDiff[] = [];
    let additions = 0;
    let deletions = 0;

    const fileDiffs = this.splitIntoFileDiffs(diffText);

    for (const fileDiff of fileDiffs) {
      const parsed = this.parseFileDiff(fileDiff);
      if (parsed) {
        files.push(parsed);
        for (const hunk of parsed.hunks) {
          for (const line of hunk.lines) {
            if (line.type === 'added') additions++;
            if (line.type === 'removed') deletions++;
          }
        }
      }
    }

    return { files, additions, deletions, source };
  }

  /**
   * Get list of changed files.
   */
  async getChangedFiles(options: DiffOptions = {}): Promise<string[]> {
    const args = this.buildGitDiffArgs(options);
    const output = await this.runGitCommand(`diff --name-only ${args}`);
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  }

  /**
   * Get changed symbols from a diff.
   */
  async getChangedSymbols(diff: DiffResult): Promise<ChangedSymbol[]> {
    if (!this.parser) {
      this.parser = new ASTParser();
    }

    const changedSymbols: ChangedSymbol[] = [];

    for (const fileDiff of diff.files) {
      const filePath = fileDiff.newPath || fileDiff.oldPath;
      if (!filePath || !this.parser.isSupported(filePath)) continue;

      // Get the line ranges that were changed
      const changedRanges = this.extractChangedRanges(fileDiff);

      // For modified files, we need to parse the current file content
      // This would require access to the actual file
      // For now, we report changes based on hunk ranges

      for (const range of changedRanges) {
        changedSymbols.push({
          name: `lines ${range.start}-${range.end}`,
          type: 'change',
          filePath,
          changeType: fileDiff.changeType === 'added' ? 'added' :
                      fileDiff.changeType === 'deleted' ? 'removed' : 'modified',
          lineRange: range
        });
      }
    }

    return changedSymbols;
  }

  /**
   * Check if repository has uncommitted changes.
   */
  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const output = await this.runGitCommand('status --porcelain');
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name.
   */
  async getCurrentBranch(): Promise<string> {
    const output = await this.runGitCommand('branch --show-current');
    return output.trim();
  }

  /**
   * Get list of recent commits.
   */
  async getRecentCommits(count: number = 10): Promise<Array<{ hash: string; message: string; date: string }>> {
    const output = await this.runGitCommand(`log -${count} --pretty=format:"%H|%s|%ai"`);
    return output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, message, date] = line.split('|');
        return { hash, message, date };
      });
  }

  /**
   * Run a git command.
   */
  private async runGitCommand(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git ${command}`, {
        cwd: this.repoPath,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large diffs
      });
      return stdout;
    } catch (error: any) {
      // Check if this is a fatal git error (not a git repository, etc.)
      if (error.stderr && error.stderr.includes('fatal:')) {
        throw new Error(`Git command failed: ${error.stderr.trim()}`);
      }
      // Git commands may exit with non-zero for empty diffs
      if (error.stdout !== undefined) {
        return error.stdout;
      }
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Build git diff command arguments.
   */
  private buildGitDiffArgs(options: DiffOptions): string {
    const args: string[] = [];

    if (options.staged) {
      args.push('--cached');
    }

    if (options.commit) {
      args.push(options.commit);
    }

    if (options.fromCommit && options.toCommit) {
      args.push(`${options.fromCommit}..${options.toCommit}`);
    }

    if (options.contextLines !== undefined) {
      args.push(`-U${options.contextLines}`);
    }

    if (options.files && options.files.length > 0) {
      args.push('--');
      args.push(...options.files);
    }

    return args.join(' ');
  }

  /**
   * Get a descriptive source string for the diff.
   */
  private getDiffSource(options: DiffOptions): string {
    if (options.staged) return 'staged';
    if (options.unstaged) return 'unstaged';
    if (options.commit) return `commit:${options.commit}`;
    if (options.fromCommit && options.toCommit) {
      return `${options.fromCommit}..${options.toCommit}`;
    }
    return 'working-tree';
  }

  /**
   * Split diff text into individual file diffs.
   */
  private splitIntoFileDiffs(diffText: string): string[] {
    const fileDiffs: string[] = [];
    const lines = diffText.split('\n');
    let currentDiff: string[] = [];

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentDiff.length > 0) {
          fileDiffs.push(currentDiff.join('\n'));
        }
        currentDiff = [line];
      } else {
        currentDiff.push(line);
      }
    }

    if (currentDiff.length > 0) {
      fileDiffs.push(currentDiff.join('\n'));
    }

    return fileDiffs;
  }

  /**
   * Parse a single file diff.
   */
  private parseFileDiff(diffText: string): FileDiff | null {
    const lines = diffText.split('\n');
    if (lines.length === 0) return null;

    // Parse header
    const diffLine = lines[0];
    const pathMatch = diffLine.match(/diff --git a\/(.+) b\/(.+)/);
    if (!pathMatch) return null;

    let oldPath: string | null = pathMatch[1];
    let newPath: string | null = pathMatch[2];
    let changeType: ChangeType = 'modified';
    let isBinary = false;

    // Check for file mode changes, renames, etc.
    for (const line of lines.slice(1, 10)) {
      if (line.startsWith('new file mode')) {
        changeType = 'added';
        oldPath = null;
      } else if (line.startsWith('deleted file mode')) {
        changeType = 'deleted';
        newPath = null;
      } else if (line.startsWith('rename from')) {
        changeType = 'renamed';
      } else if (line.includes('Binary files')) {
        isBinary = true;
      }
    }

    // Parse hunks
    const hunks = this.parseHunks(lines);

    return {
      oldPath,
      newPath,
      changeType,
      hunks,
      isBinary
    };
  }

  /**
   * Parse hunks from diff lines.
   */
  private parseHunks(lines: string[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      // Hunk header: @@ -1,5 +1,6 @@
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        oldLineNum = parseInt(hunkMatch[1], 10);
        newLineNum = parseInt(hunkMatch[3], 10);
        currentHunk = {
          oldStart: oldLineNum,
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: newLineNum,
          newLines: parseInt(hunkMatch[4] || '1', 10),
          lines: [],
          header: hunkMatch[5].trim() || undefined
        };
        continue;
      }

      if (!currentHunk) continue;

      // Parse diff lines
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          oldLineNumber: null,
          newLineNumber: newLineNum++,
          content: line.substring(1),
          type: 'added'
        });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
          content: line.substring(1),
          type: 'removed'
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          content: line.substring(1),
          type: 'context'
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Extract changed line ranges from a file diff.
   */
  private extractChangedRanges(fileDiff: FileDiff): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];

    for (const hunk of fileDiff.hunks) {
      // For additions/modifications, use new line numbers
      const changedLines = hunk.lines.filter(l => l.type === 'added' || l.type === 'removed');
      if (changedLines.length === 0) continue;

      const lineNumbers = changedLines
        .map(l => l.newLineNumber || l.oldLineNumber)
        .filter((n): n is number => n !== null);

      if (lineNumbers.length > 0) {
        ranges.push({
          start: Math.min(...lineNumbers),
          end: Math.max(...lineNumbers)
        });
      }
    }

    // Merge overlapping ranges
    return this.mergeRanges(ranges);
  }

  /**
   * Merge overlapping line ranges.
   */
  private mergeRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const current = sorted[i];

      if (current.start <= last.end + 1) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }
}
