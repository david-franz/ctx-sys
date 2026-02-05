/**
 * Indexing types and interfaces
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-2/F2.3-codebase-indexing.test.ts for expected behavior.
 */

export interface IndexOptions {
  depth?: 'full' | 'signatures' | 'selective';
  summarize?: boolean;
  embeddings?: boolean;
  useCache?: boolean;
  languages?: string[];
  ignore?: string[];
  include?: string[];
  batchSize?: number;
  parallelism?: number;
  onProgress?: (progress: IndexProgress) => void;
}

export interface IndexResult {
  filesScanned: number;
  filesIndexed: number;
  filesSkipped: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  embeddingsGenerated: number;
  relationshipsCreated: number;
  errors: IndexError[];
  duration: number;
}

export interface IndexProgress {
  phase: 'scanning' | 'parsing' | 'summarizing' | 'embedding' | 'linking';
  current: number;
  total: number;
  currentFile?: string;
  message?: string;
}

export interface ScanResult {
  files: string[];
  skipped: string[];
}

export interface FileEntity {
  type: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content?: string;
  contentHash?: string;
}

export interface Symbol {
  type: string;
  name: string;
  qualifiedName: string;
  signature?: string;
  docstring?: string;
  children?: Symbol[];
  startLine: number;
  endLine: number;
}

export interface IndexError {
  file: string;
  error: string;
  phase: string;
}
