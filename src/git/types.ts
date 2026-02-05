/**
 * Type of file change in a diff.
 */
export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * A changed line in a diff.
 */
export interface DiffLine {
  /** Line number in old file (null for additions) */
  oldLineNumber: number | null;
  /** Line number in new file (null for deletions) */
  newLineNumber: number | null;
  /** Line content */
  content: string;
  /** Type of change */
  type: 'added' | 'removed' | 'context';
}

/**
 * A hunk (section) of changes in a diff.
 */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Lines in this hunk */
  lines: DiffLine[];
  /** Hunk header (e.g., function context) */
  header?: string;
}

/**
 * A changed file in a diff.
 */
export interface FileDiff {
  /** Path in old version (null for new files) */
  oldPath: string | null;
  /** Path in new version (null for deleted files) */
  newPath: string | null;
  /** Type of change */
  changeType: ChangeType;
  /** Hunks of changes */
  hunks: DiffHunk[];
  /** Binary file flag */
  isBinary?: boolean;
}

/**
 * Complete diff result.
 */
export interface DiffResult {
  /** Changed files */
  files: FileDiff[];
  /** Total lines added */
  additions: number;
  /** Total lines removed */
  deletions: number;
  /** Source of diff (staged, unstaged, commit, etc.) */
  source: string;
}

/**
 * Options for getting diffs.
 */
export interface DiffOptions {
  /** Include staged changes */
  staged?: boolean;
  /** Include unstaged changes */
  unstaged?: boolean;
  /** Compare with specific commit */
  commit?: string;
  /** Compare two commits */
  fromCommit?: string;
  toCommit?: string;
  /** Filter to specific files */
  files?: string[];
  /** Include context lines */
  contextLines?: number;
}

/**
 * Changed symbol information.
 */
export interface ChangedSymbol {
  /** Symbol name */
  name: string;
  /** Symbol type */
  type: string;
  /** File path */
  filePath: string;
  /** Type of change to the symbol */
  changeType: 'added' | 'modified' | 'removed';
  /** Line range affected */
  lineRange: {
    start: number;
    end: number;
  };
}
