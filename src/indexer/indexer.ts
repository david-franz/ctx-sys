import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ASTParser, ParseResult } from '../ast';
import { SymbolSummarizer, FileSummary } from '../summarization';
import { EntityStore, Entity } from '../entities';
import {
  IndexedFile,
  IndexStats,
  IndexResult,
  IndexOptions,
  IndexEntry,
  FileStatus
} from './types';

/**
 * Default patterns to exclude from indexing.
 */
const DEFAULT_EXCLUDE = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '__pycache__/**',
  '*.min.js',
  '*.bundle.js',
  '.env*',
  '*.lock',
  'package-lock.json'
];

/**
 * Indexes a codebase for symbol extraction and search.
 */
export class CodebaseIndexer {
  private parser: ASTParser;
  private summarizer: SymbolSummarizer;
  private entityStore?: EntityStore;
  private projectRoot: string;
  private indexMap: Map<string, IndexEntry> = new Map();

  constructor(
    projectRoot: string,
    entityStore?: EntityStore,
    parser?: ASTParser,
    summarizer?: SymbolSummarizer
  ) {
    this.projectRoot = path.resolve(projectRoot);
    this.entityStore = entityStore;
    this.parser = parser || new ASTParser();
    this.summarizer = summarizer || new SymbolSummarizer();
  }

  /**
   * Index the entire codebase.
   */
  async indexAll(options: IndexOptions = {}): Promise<IndexResult> {
    const startTime = Date.now();
    const result: IndexResult = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
      errors: [],
      duration: 0,
      stats: this.getStats()
    };

    const files = await this.discoverFiles(options);
    const existingPaths = new Set(this.indexMap.keys());

    // Process files with optional concurrency limit
    const concurrency = options.concurrency || 5;
    const chunks = this.chunkArray(files, concurrency);

    let processed = 0;
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (filePath) => {
          try {
            const status = await this.processFile(filePath, options.force);
            existingPaths.delete(filePath);

            switch (status) {
              case 'added':
                result.added.push(filePath);
                break;
              case 'modified':
                result.modified.push(filePath);
                break;
              case 'unchanged':
                result.unchanged.push(filePath);
                break;
            }
          } catch (error) {
            result.errors.push({
              path: filePath,
              error: error instanceof Error ? error.message : String(error)
            });
          }

          processed++;
          if (options.onProgress) {
            options.onProgress(processed, files.length, filePath);
          }
        })
      );
    }

    // Handle deleted files
    for (const deletedPath of existingPaths) {
      await this.removeFile(deletedPath);
      result.deleted.push(deletedPath);
    }

    result.duration = Date.now() - startTime;
    result.stats = this.getStats();
    result.stats.lastFullIndex = new Date().toISOString();

    return result;
  }

  /**
   * Update the index incrementally.
   */
  async updateIndex(options: IndexOptions = {}): Promise<IndexResult> {
    const startTime = Date.now();
    const result: IndexResult = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
      errors: [],
      duration: 0,
      stats: this.getStats()
    };

    const files = await this.discoverFiles(options);
    const existingPaths = new Set(this.indexMap.keys());

    for (const filePath of files) {
      try {
        const status = await this.processFile(filePath, false);
        existingPaths.delete(filePath);

        switch (status) {
          case 'added':
            result.added.push(filePath);
            break;
          case 'modified':
            result.modified.push(filePath);
            break;
          case 'unchanged':
            result.unchanged.push(filePath);
            break;
        }
      } catch (error) {
        result.errors.push({
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Handle deleted files
    for (const deletedPath of existingPaths) {
      await this.removeFile(deletedPath);
      result.deleted.push(deletedPath);
    }

    result.duration = Date.now() - startTime;
    result.stats = this.getStats();
    result.stats.lastUpdate = new Date().toISOString();

    return result;
  }

  /**
   * Index a single file.
   */
  async indexFile(filePath: string): Promise<FileSummary | null> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);
    const relativePath = path.relative(this.projectRoot, absolutePath);

    if (!this.parser.isSupported(absolutePath)) {
      return null;
    }

    const parseResult = await this.parser.parseFile(absolutePath);
    const summary = await this.summarizer.summarizeFile(parseResult);

    // Update index map
    const content = await fs.promises.readFile(absolutePath, 'utf-8');
    const hash = this.hashContent(content);
    const stats = await fs.promises.stat(absolutePath);

    this.indexMap.set(relativePath, {
      path: relativePath,
      hash,
      modifiedAt: stats.mtime.toISOString(),
      language: parseResult.language,
      summary: JSON.stringify(summary)
    });

    // Store in entity store if available
    if (this.entityStore) {
      await this.storeFileSummary(relativePath, summary);
    }

    return summary;
  }

  /**
   * Get a file's summary from the index.
   */
  getFileSummary(filePath: string): FileSummary | null {
    const entry = this.indexMap.get(filePath);
    if (!entry) return null;

    try {
      return JSON.parse(entry.summary);
    } catch {
      return null;
    }
  }

  /**
   * Get all indexed files.
   */
  getIndexedFiles(): IndexedFile[] {
    return Array.from(this.indexMap.entries()).map(([filePath, entry]) => {
      const summary = this.getFileSummary(filePath);
      return {
        path: filePath,
        modifiedAt: entry.modifiedAt,
        hash: entry.hash,
        language: entry.language,
        symbolCount: summary?.symbols.length || 0,
        status: 'unchanged' as FileStatus
      };
    });
  }

  /**
   * Get index statistics.
   */
  getStats(): IndexStats {
    const files = this.getIndexedFiles();
    const byLanguage: Record<string, number> = {};
    let totalSymbols = 0;

    for (const file of files) {
      byLanguage[file.language] = (byLanguage[file.language] || 0) + 1;
      totalSymbols += file.symbolCount;
    }

    return {
      totalFiles: files.length,
      totalSymbols,
      byLanguage
    };
  }

  /**
   * Check if a file needs reindexing.
   */
  async needsReindex(filePath: string): Promise<boolean> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.projectRoot, filePath);
    const relativePath = path.relative(this.projectRoot, absolutePath);

    const entry = this.indexMap.get(relativePath);
    if (!entry) return true;

    try {
      const content = await fs.promises.readFile(absolutePath, 'utf-8');
      const hash = this.hashContent(content);
      return hash !== entry.hash;
    } catch {
      return true;
    }
  }

  /**
   * Clear the index.
   */
  async clear(): Promise<void> {
    this.indexMap.clear();

    if (this.entityStore) {
      // Remove all file entities from store
      // This would require the entity store to support bulk operations
    }
  }

  /**
   * Search indexed symbols.
   */
  searchSymbols(query: string): FileSummary[] {
    const results: FileSummary[] = [];
    const lowerQuery = query.toLowerCase();

    for (const entry of this.indexMap.values()) {
      const summary = JSON.parse(entry.summary) as FileSummary;

      // Search in file path
      if (entry.path.toLowerCase().includes(lowerQuery)) {
        results.push(summary);
        continue;
      }

      // Search in symbols
      const hasMatch = summary.symbols.some(
        s =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.description.toLowerCase().includes(lowerQuery)
      );

      if (hasMatch) {
        results.push(summary);
      }
    }

    return results;
  }

  /**
   * Discover files to index.
   */
  private async discoverFiles(options: IndexOptions): Promise<string[]> {
    const include = options.include || ['**/*'];
    const exclude = [...DEFAULT_EXCLUDE, ...(options.exclude || [])];

    const files: string[] = [];
    await this.walkDirectory(this.projectRoot, files, exclude);

    // Filter to supported files only
    return files.filter(f => this.parser.isSupported(f));
  }

  /**
   * Walk a directory recursively.
   */
  private async walkDirectory(
    dir: string,
    files: string[],
    exclude: string[]
  ): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.projectRoot, fullPath);

      // Check exclusions
      if (this.matchesPattern(relativePath, exclude)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, files, exclude);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  /**
   * Check if a path matches any of the patterns.
   */
  private matchesPattern(filePath: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (this.simpleGlobMatch(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Simple glob matching (supports * and **).
   */
  private simpleGlobMatch(filePath: string, pattern: string): boolean {
    // Convert glob to regex
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLESTAR}}/g, '.*');

    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(filePath);
  }

  /**
   * Process a single file.
   */
  private async processFile(
    relativePath: string,
    force?: boolean
  ): Promise<FileStatus> {
    const absolutePath = path.join(this.projectRoot, relativePath);

    // Check if file exists
    try {
      await fs.promises.access(absolutePath);
    } catch {
      return 'deleted';
    }

    // Check if needs reindexing
    if (!force && !(await this.needsReindex(relativePath))) {
      return 'unchanged';
    }

    const existing = this.indexMap.has(relativePath);

    // Index the file
    await this.indexFile(relativePath);

    return existing ? 'modified' : 'added';
  }

  /**
   * Remove a file from the index.
   */
  private async removeFile(relativePath: string): Promise<void> {
    this.indexMap.delete(relativePath);

    if (this.entityStore) {
      // Remove from entity store
      // Would need to track entity IDs for this
    }
  }

  /**
   * Store a file summary in the entity store.
   */
  private async storeFileSummary(
    filePath: string,
    summary: FileSummary
  ): Promise<void> {
    if (!this.entityStore) return;

    // Store file as an entity
    await this.entityStore.create({
      type: 'file',
      name: path.basename(filePath),
      qualifiedName: filePath,
      content: summary.description,
      metadata: {
        language: summary.language,
        exports: summary.exports,
        dependencies: summary.dependencies,
        metrics: summary.metrics
      }
    });

    // Store symbols as entities
    for (const symbol of summary.symbols) {
      await this.entityStore.create({
        type: symbol.type as any,
        name: symbol.name,
        qualifiedName: symbol.qualifiedName,
        content: symbol.description,
        metadata: {
          signature: symbol.signature,
          parameters: symbol.parameters,
          returnType: symbol.returnType,
          visibility: symbol.visibility,
          filePath,
          startLine: symbol.location.startLine,
          endLine: symbol.location.endLine
        }
      });
    }
  }

  /**
   * Hash content for change detection.
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Split array into chunks.
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
