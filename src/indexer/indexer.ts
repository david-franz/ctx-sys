import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ASTParser, ParseResult, defaultRegistry as relationshipRegistry } from '../ast';
import { GraphRelationshipType } from '../graph/types';
import { SymbolSummarizer, FileSummary } from '../summarization';
import { EntityStore, Entity } from '../entities';
import { RelationshipStore } from '../graph/relationship-store';
import {
  IndexedFile,
  IndexStats,
  IndexResult,
  IndexOptions,
  IndexEntry,
  FileStatus
} from './types';
import { IgnoreResolver } from './ignore-resolver';

/**
 * F10g.3: Map AST relationship types to graph relationship types.
 */
function mapAstRelToGraph(astType: string): GraphRelationshipType | null {
  const map: Record<string, GraphRelationshipType> = {
    'calls': 'CALLS',
    'extends': 'EXTENDS',
    'implements': 'IMPLEMENTS',
    'uses_type': 'USES',
    'instantiates': 'USES',
    'references': 'REFERENCES',
  };
  return map[astType] || null;
}

/**
 * Indexes a codebase for symbol extraction and search.
 */
export class CodebaseIndexer {
  private parser: ASTParser;
  private summarizer: SymbolSummarizer;
  private entityStore?: EntityStore;
  private relationshipStore?: RelationshipStore;
  private projectRoot: string;
  private indexMap: Map<string, IndexEntry> = new Map();

  constructor(
    projectRoot: string,
    entityStore?: EntityStore,
    parser?: ASTParser,
    summarizer?: SymbolSummarizer,
    relationshipStore?: RelationshipStore
  ) {
    this.projectRoot = path.resolve(projectRoot);
    this.entityStore = entityStore;
    this.relationshipStore = relationshipStore;
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
      // Use AST import data to determine where imports end
      const importEndLine = parseResult.imports.length > 0
        ? Math.max(...parseResult.imports.map(i => i.startLine))
        : 0;
      await this.storeFileSummary(relativePath, summary, content, importEndLine);

      // F10g.3: Extract and store rich relationships from AST
      await this.storeRichRelationships(relativePath, parseResult);
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
    const resolver = new IgnoreResolver(this.projectRoot, {
      extraExclude: options.exclude,
    });

    const files: string[] = [];
    await this.walkDirectory(this.projectRoot, files, resolver);

    // Filter to supported files only
    return files.filter(f => this.parser.isSupported(f));
  }

  /**
   * Walk a directory recursively.
   */
  private async walkDirectory(
    dir: string,
    files: string[],
    resolver: IgnoreResolver
  ): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.projectRoot, fullPath);

      if (resolver.isIgnored(relativePath)) {
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
   * F10.1: Now stores actual source code in content field, description in summary field.
   */
  private async storeFileSummary(
    filePath: string,
    summary: FileSummary,
    sourceCode: string,
    importEndLine: number = 0
  ): Promise<void> {
    if (!this.entityStore) return;

    // Upsert file entity (keeps same ID if it already exists, preserving embeddings)
    await this.entityStore.upsert({
      type: 'file',
      name: path.basename(filePath),
      qualifiedName: filePath,
      content: this.extractFileOverview(sourceCode, summary, importEndLine),
      summary: summary.description,
      metadata: {
        language: summary.language,
        exports: summary.exports,
        dependencies: summary.dependencies,
        metrics: summary.metrics
      }
    });

    // Upsert symbol entities and build contains/exports relationships
    const fileEntity = await this.entityStore.getByQualifiedName(filePath);
    const exportSet = new Set(summary.exports);

    for (const symbol of summary.symbols) {
      const code = this.extractSymbolCode(sourceCode, symbol);
      const symbolEntity = await this.entityStore.upsert({
        type: symbol.type as any,
        name: symbol.name,
        qualifiedName: symbol.qualifiedName,
        content: code,
        summary: symbol.description,
        filePath,
        startLine: symbol.location.startLine,
        endLine: symbol.location.endLine,
        metadata: {
          signature: symbol.signature,
          parameters: symbol.parameters,
          returnType: symbol.returnType,
          visibility: symbol.visibility
        }
      });

      // Build file → symbol relationships
      if (this.relationshipStore && fileEntity) {
        await this.relationshipStore.upsert({
          sourceId: fileEntity.id,
          targetId: symbolEntity.id,
          relationship: 'CONTAINS'
        });
      }
    }

    // Build file → file import relationships
    if (this.relationshipStore && fileEntity && summary.dependencies.length > 0) {
      await this.buildImportRelationships(fileEntity, filePath, summary.dependencies);
    }
  }

  /**
   * Build import relationships from a file to its dependencies.
   */
  private async buildImportRelationships(
    sourceEntity: Entity,
    filePath: string,
    dependencies: string[]
  ): Promise<void> {
    if (!this.entityStore || !this.relationshipStore) return;

    const fileDir = path.dirname(filePath);

    for (const dep of dependencies) {
      // Skip external packages (no relative path)
      if (!dep.startsWith('.') && !dep.startsWith('/')) continue;

      // Resolve to relative path from project root
      const resolved = path.normalize(path.join(fileDir, dep));

      // Try common extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
      for (const ext of extensions) {
        const targetPath = resolved + ext;
        const targetEntity = await this.entityStore.getByQualifiedName(targetPath);
        if (targetEntity) {
          await this.relationshipStore.upsert({
            sourceId: sourceEntity.id,
            targetId: targetEntity.id,
            relationship: 'IMPORTS'
          });
          break;
        }
      }
    }
  }

  /**
   * F10g.3: Extract and store rich relationships from AST extractors.
   * Stores CALLS, EXTENDS, IMPLEMENTS, USES relationships.
   */
  private async storeRichRelationships(
    filePath: string,
    parseResult: ParseResult
  ): Promise<void> {
    if (!this.entityStore || !this.relationshipStore) return;

    const extractor = relationshipRegistry.getExtractorForFile(filePath);
    if (!extractor) return;

    const extracted = extractor.extract(parseResult as any);

    for (const rel of extracted) {
      // Skip imports and contains — already handled by storeFileSummary
      if (rel.type === 'imports' || rel.type === 'contains') continue;

      const graphType = mapAstRelToGraph(rel.type);
      if (!graphType) continue;

      // Resolve source entity
      const sourceEntity = await this.resolveRelationshipTarget(
        rel.source, filePath
      );
      if (!sourceEntity) continue;

      // Resolve target entity
      const targetEntity = await this.resolveRelationshipTarget(
        rel.target, filePath
      );
      if (!targetEntity) continue;

      await this.relationshipStore.upsert({
        sourceId: sourceEntity.id,
        targetId: targetEntity.id,
        relationship: graphType,
        weight: rel.weight || 0.8,
        metadata: { line: rel.metadata?.line, file: filePath }
      });
    }
  }

  /**
   * F10g.3: Resolve a symbol name to an entity.
   * Tries qualified name in same file, then name match, then search.
   */
  private async resolveRelationshipTarget(
    targetName: string,
    sourceFile: string
  ): Promise<Entity | null> {
    if (!this.entityStore) return null;

    // 1. Try qualified name in same file
    const inFile = await this.entityStore.getByQualifiedName(
      `${sourceFile}::${targetName}`
    );
    if (inFile) return inFile;

    // 2. Already a qualified name?
    if (targetName.includes('::')) {
      const byQN = await this.entityStore.getByQualifiedName(targetName);
      if (byQN) return byQN;
    }

    // 3. Try by exact name
    const byName = await this.entityStore.getByName(targetName);
    if (byName) return byName;

    return null;
  }

  /**
   * Extract actual source code for a symbol.
   * F10.1: Uses line numbers to extract code from source.
   */
  private extractSymbolCode(source: string, symbol: { location: { startLine: number; endLine: number }; type: string }): string {
    const lines = source.split('\n');
    const start = symbol.location.startLine - 1; // Convert to 0-indexed
    const maxLines = this.getMaxLines(symbol.type);
    const end = Math.min(symbol.location.endLine, start + maxLines);

    let code = lines.slice(start, end).join('\n');

    // Add truncation indicator if needed
    if (symbol.location.endLine > end) {
      code += '\n  // ... (truncated)';
    }

    return code;
  }

  /**
   * Get maximum lines to store for an entity type.
   * F10.1: Prevents storing excessively large code blocks.
   */
  private getMaxLines(type: string): number {
    switch (type) {
      case 'function': return 500;
      case 'method': return 300;
      case 'class': return 1000;
      case 'interface': return 200;
      case 'type': return 100;
      default: return 200;
    }
  }

  /**
   * Extract a file overview including imports and export signatures.
   * Uses AST-derived import end line instead of regex scanning.
   */
  private extractFileOverview(source: string, summary: FileSummary, importEndLine: number = 0): string {
    const lines = source.split('\n');
    const parts: string[] = [];

    // Include imports using AST-derived end line
    if (importEndLine > 0) {
      parts.push(lines.slice(0, importEndLine).join('\n'));
      parts.push('');
    }

    // Include exports summary
    if (summary.exports.length > 0) {
      parts.push(`// Exports: ${summary.exports.join(', ')}`);
    }

    // Include top-level signatures (not full bodies)
    for (const symbol of summary.symbols.slice(0, 10)) {
      if (symbol.signature) {
        parts.push(symbol.signature);
      }
    }

    return parts.join('\n');
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
