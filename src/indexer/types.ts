import { FileSummary } from '../summarization';

/**
 * File status in the index.
 */
export type FileStatus = 'added' | 'modified' | 'deleted' | 'unchanged';

/**
 * Information about an indexed file.
 */
export interface IndexedFile {
  /** Relative path from project root */
  path: string;
  /** Last modification time (ISO string) */
  modifiedAt: string;
  /** File content hash for change detection */
  hash: string;
  /** Programming language */
  language: string;
  /** Number of symbols in the file */
  symbolCount: number;
  /** Index status */
  status: FileStatus;
}

/**
 * Index statistics.
 */
export interface IndexStats {
  /** Total files indexed */
  totalFiles: number;
  /** Total symbols indexed */
  totalSymbols: number;
  /** Files by language */
  byLanguage: Record<string, number>;
  /** Last full index time */
  lastFullIndex?: string;
  /** Last incremental update time */
  lastUpdate?: string;
}

/**
 * Result of an indexing operation.
 */
export interface IndexResult {
  /** Files that were added */
  added: string[];
  /** Files that were modified */
  modified: string[];
  /** Files that were deleted */
  deleted: string[];
  /** Files that were unchanged */
  unchanged: string[];
  /** Files that failed to parse */
  errors: Array<{ path: string; error: string }>;
  /** Duration in milliseconds */
  duration: number;
  /** Index statistics after operation */
  stats: IndexStats;
}

/**
 * Options for indexing.
 */
export interface IndexOptions {
  /** File patterns to include (glob) */
  include?: string[];
  /** File patterns to exclude (glob) */
  exclude?: string[];
  /** Whether to generate embeddings during indexing */
  generateEmbeddings?: boolean;
  /** Force re-index all files */
  force?: boolean;
  /** Maximum concurrent file operations */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void;
}

/**
 * Index entry for storage.
 */
export interface IndexEntry {
  /** File path */
  path: string;
  /** Content hash */
  hash: string;
  /** Modification time */
  modifiedAt: string;
  /** Language */
  language: string;
  /** Serialized file summary */
  summary: string;
}
