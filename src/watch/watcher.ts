/**
 * Phase 7: File Watcher
 * Watches for file system changes
 */

import { WatchOptions, FileChangeEvent, FileWatcherState } from './types';
import { Debouncer } from './debouncer';
import { FileFilter } from './file-filter';
import { IncrementalIndexer } from './incremental-indexer';

export class FileWatcher {
  private rootPath: string;
  private options: WatchOptions;
  private debouncer: Debouncer;
  private fileFilter: FileFilter;
  private incrementalIndexer: IncrementalIndexer;
  private running: boolean = false;
  private pendingChanges: Map<string, FileChangeEvent> = new Map();
  private processedCount: number = 0;

  constructor(
    rootPath: string,
    options: WatchOptions,
    debouncer: Debouncer,
    fileFilter: FileFilter,
    incrementalIndexer: IncrementalIndexer
  ) {
    this.rootPath = rootPath;
    this.options = options;
    this.debouncer = debouncer;
    this.fileFilter = fileFilter;
    this.incrementalIndexer = incrementalIndexer;
  }

  start(): void {
    if (this.running) {
      throw new Error('Watcher already running');
    }
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.debouncer.cancel();
    this.pendingChanges.clear();
  }

  handleEvent(event: FileChangeEvent): void {
    if (!this.running) {
      return;
    }

    // Filter out unsupported and ignored files
    if (!this.fileFilter.isSupported(event.path) || this.fileFilter.shouldIgnore(event.path)) {
      return;
    }

    // Store the event (deduplicates by path)
    this.pendingChanges.set(event.path, event);

    // Call onEvent callback if provided
    if (this.options.onEvent) {
      try {
        this.options.onEvent(event);
      } catch (_error) {
        // Handle callback errors gracefully
      }
    }

    // Trigger debounced processing
    this.debouncer.debounce(() => {
      this.processChanges();
    }, this.options.debounce || 100);
  }

  async processChanges(): Promise<FileChangeEvent[]> {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    for (const change of changes) {
      try {
        if (change.type === 'add') {
          await this.incrementalIndexer.indexFile(change.path);
        } else if (change.type === 'change') {
          await this.incrementalIndexer.reindexFile(change.path);
        } else if (change.type === 'delete' || change.type === 'unlink') {
          await this.incrementalIndexer.removeFile(change.path);
          await this.incrementalIndexer.cleanupRelationships(change.path);
        }
      } catch (_error) {
        // Handle indexing errors gracefully
      }
    }

    this.processedCount += changes.length;
    return changes;
  }

  getState(): FileWatcherState {
    return {
      watching: this.running,
      debounce: this.options.debounce || 100,
      running: this.running,
      pendingChanges: this.pendingChanges,
      processedCount: this.processedCount,
    };
  }
}
