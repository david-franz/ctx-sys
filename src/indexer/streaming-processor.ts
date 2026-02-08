/**
 * F10.3: Streaming file processor with checkpointing.
 * Enables indexing of large codebases without OOM.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ASTParser, ParseResult } from '../ast';
import { SymbolSummarizer, FileSummary } from '../summarization';
import { IgnoreResolver } from './ignore-resolver';

/**
 * State for resumable indexing.
 */
export interface IndexingState {
  totalFiles: number;
  processedFiles: number;
  currentBatch: number;
  failedFiles: string[];
  skippedFiles: string[];
  lastProcessedPath: string;
  startedAt: string;
  checkpointAt: string;
}

/**
 * Result of processing a single file.
 */
export interface FileProcessResult {
  filePath: string;
  summary: FileSummary;
  sourceCode: string;
  fileSize: number;
}

/**
 * Options for streaming processor.
 */
export interface StreamingOptions {
  fileBatchSize?: number;
  maxFileSizeKb?: number;
  maxEntitiesPerFile?: number;
  checkpointInterval?: number;
  exclude?: string[];
  onProgress?: (processed: number, total: number, filePath: string) => void;
  onBatchComplete?: (batch: FileProcessResult[]) => Promise<void>;
}


/**
 * Streaming file processor that handles large codebases without OOM.
 */
export class StreamingFileProcessor {
  private state: IndexingState;
  private stateFile: string;
  private parser: ASTParser;
  private summarizer: SymbolSummarizer;
  private projectRoot: string;
  private files: string[] = [];

  constructor(
    projectRoot: string,
    private options: StreamingOptions = {}
  ) {
    this.projectRoot = path.resolve(projectRoot);
    this.stateFile = path.join(this.projectRoot, '.ctx-sys', 'indexing-state.json');
    this.parser = new ASTParser();
    this.summarizer = new SymbolSummarizer();
    this.state = this.createInitialState();
  }

  /**
   * Process all files in streaming batches with checkpointing.
   */
  async *processFiles(): AsyncGenerator<FileProcessResult[], void, unknown> {
    // Try to resume from checkpoint first
    const startIndex = await this.loadCheckpoint();

    // Discover files (after loading checkpoint to preserve failed/skipped lists if resuming)
    this.files = await this.discoverFiles();

    // Update state with discovered files count
    this.state.totalFiles = this.files.length;

    const batchSize = this.options.fileBatchSize || 100;
    const checkpointInterval = this.options.checkpointInterval || 50;

    let processedSinceCheckpoint = 0;

    for (let i = startIndex; i < this.files.length; i += batchSize) {
      const batch = this.files.slice(i, i + batchSize);
      const results: FileProcessResult[] = [];

      for (const filePath of batch) {
        try {
          const result = await this.processFile(filePath);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          this.state.failedFiles.push(filePath);
          // Continue processing - don't fail the entire batch
        }

        this.state.processedFiles++;
        processedSinceCheckpoint++;

        this.options.onProgress?.(
          this.state.processedFiles,
          this.state.totalFiles,
          filePath
        );
      }

      // Yield batch results
      if (results.length > 0) {
        yield results;

        // Call batch complete callback if provided
        if (this.options.onBatchComplete) {
          await this.options.onBatchComplete(results);
        }
      }

      // Checkpoint periodically
      if (processedSinceCheckpoint >= checkpointInterval) {
        this.state.lastProcessedPath = batch[batch.length - 1];
        this.state.currentBatch++;
        await this.saveCheckpoint();
        processedSinceCheckpoint = 0;
      }
    }

    // Final checkpoint
    await this.saveCheckpoint();

    // Clear checkpoint after successful completion
    await this.clearCheckpoint();
  }

  /**
   * Process a single file with size and entity limits.
   */
  private async processFile(relativePath: string): Promise<FileProcessResult | null> {
    const absolutePath = path.join(this.projectRoot, relativePath);

    // Check if parser supports this file
    if (!this.parser.isSupported(absolutePath)) {
      return null;
    }

    // Check file size
    const stats = await fs.promises.stat(absolutePath);
    const maxSizeKb = this.options.maxFileSizeKb || 500;

    if (stats.size > maxSizeKb * 1024) {
      this.state.skippedFiles.push(relativePath);
      return null;
    }

    // Read and parse
    const sourceCode = await fs.promises.readFile(absolutePath, 'utf-8');
    const parseResult = await this.parser.parseFile(absolutePath);
    const summary = await this.summarizer.summarizeFile(parseResult);

    // Limit entities per file
    const maxEntities = this.options.maxEntitiesPerFile || 100;
    if (summary.symbols.length > maxEntities) {
      summary.symbols = summary.symbols.slice(0, maxEntities);
    }

    return {
      filePath: relativePath,
      summary,
      sourceCode,
      fileSize: stats.size
    };
  }

  /**
   * Discover all files to index.
   */
  private async discoverFiles(): Promise<string[]> {
    const resolver = new IgnoreResolver(this.projectRoot, {
      extraExclude: this.options.exclude,
    });
    const files: string[] = [];

    await this.walkDirectory(this.projectRoot, files, resolver);

    return files;
  }

  /**
   * Walk directory recursively.
   */
  private async walkDirectory(
    dir: string,
    files: string[],
    resolver: IgnoreResolver
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Skip directories we can't read
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.projectRoot, fullPath);

      if (resolver.isIgnored(relativePath) || resolver.isIgnored(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, files, resolver);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  /**
   * Create initial state.
   */
  private createInitialState(): IndexingState {
    return {
      totalFiles: 0,
      processedFiles: 0,
      currentBatch: 0,
      failedFiles: [],
      skippedFiles: [],
      lastProcessedPath: '',
      startedAt: new Date().toISOString(),
      checkpointAt: new Date().toISOString()
    };
  }

  /**
   * Load checkpoint and return start index.
   */
  private async loadCheckpoint(): Promise<number> {
    try {
      const data = await fs.promises.readFile(this.stateFile, 'utf-8');
      this.state = JSON.parse(data);
      return this.state.processedFiles;
    } catch {
      this.state = this.createInitialState();
      return 0;
    }
  }

  /**
   * Save checkpoint to disk.
   */
  private async saveCheckpoint(): Promise<void> {
    this.state.checkpointAt = new Date().toISOString();

    // Ensure directory exists
    const dir = path.dirname(this.stateFile);
    await fs.promises.mkdir(dir, { recursive: true });

    await fs.promises.writeFile(
      this.stateFile,
      JSON.stringify(this.state, null, 2)
    );
  }

  /**
   * Clear checkpoint after successful completion.
   */
  private async clearCheckpoint(): Promise<void> {
    try {
      await fs.promises.unlink(this.stateFile);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Get current indexing state.
   */
  getState(): IndexingState {
    return { ...this.state };
  }

  /**
   * Check if there's a checkpoint to resume from.
   */
  async hasCheckpoint(): Promise<boolean> {
    try {
      await fs.promises.access(this.stateFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Manually clear checkpoint.
   */
  async resetCheckpoint(): Promise<void> {
    await this.clearCheckpoint();
    this.state = this.createInitialState();
  }
}
