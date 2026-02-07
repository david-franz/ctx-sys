/**
 * File system watcher for automatic re-indexing.
 * Uses Node.js native fs.watch with debouncing and filtering.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import picomatch from 'picomatch';
import { CodebaseIndexer, IndexResult } from '../indexer';

/**
 * Watch event types.
 */
export type WatchEventType = 'add' | 'change' | 'unlink';

/**
 * Watch event data.
 */
export interface WatchEvent {
  type: WatchEventType;
  path: string;
  timestamp: Date;
}

/**
 * Configuration for the file watcher.
 */
export interface WatchConfig {
  /** Root directory to watch */
  root: string;
  /** Patterns to include (glob-style) */
  include?: string[];
  /** Patterns to exclude (glob-style) */
  exclude?: string[];
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Recursively watch directories (default: true) */
  recursive?: boolean;
  /** Automatically re-index on changes (default: true) */
  autoReindex?: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_WATCH_CONFIG: Required<Omit<WatchConfig, 'root'>> = {
  include: ['**/*'],
  exclude: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '__pycache__/**',
    '*.min.js',
    '*.bundle.js',
    '.env*'
  ],
  debounceMs: 300,
  recursive: true,
  autoReindex: true
};

/**
 * Watch statistics.
 */
export interface WatchStats {
  isWatching: boolean;
  startedAt?: Date;
  eventsReceived: number;
  filesReindexed: number;
  errors: number;
  watchedDirectories: number;
  lastEvent?: WatchEvent;
}

/**
 * File watcher for automatic re-indexing.
 * Emits events: 'change', 'reindex', 'error', 'ready'
 */
export class FileWatcher extends EventEmitter {
  private config: Required<WatchConfig>;
  private indexer?: CodebaseIndexer;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private pendingChanges: Map<string, WatchEventType> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private stats: WatchStats = {
    isWatching: false,
    eventsReceived: 0,
    filesReindexed: 0,
    errors: 0,
    watchedDirectories: 0
  };
  private isReindexing = false;

  constructor(config: WatchConfig, indexer?: CodebaseIndexer) {
    super();
    this.config = {
      ...DEFAULT_WATCH_CONFIG,
      ...config,
      include: config.include ?? DEFAULT_WATCH_CONFIG.include,
      exclude: config.exclude ?? DEFAULT_WATCH_CONFIG.exclude
    };
    this.indexer = indexer;
  }

  /**
   * Start watching for file changes.
   */
  async start(): Promise<void> {
    if (this.stats.isWatching) {
      return;
    }

    try {
      await this.setupWatchers(this.config.root);
      this.stats.isWatching = true;
      this.stats.startedAt = new Date();
      this.emit('ready', { root: this.config.root, config: this.config });
    } catch (error) {
      this.stats.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop watching for file changes.
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.pendingChanges.clear();

    this.stats.isWatching = false;
    this.stats.watchedDirectories = 0;
    this.emit('stop');
  }

  /**
   * Get current watch statistics.
   */
  getStats(): WatchStats {
    return { ...this.stats };
  }

  /**
   * Get current configuration.
   */
  getConfig(): Required<WatchConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart to take effect).
   */
  updateConfig(updates: Partial<WatchConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Manually trigger a reindex for specified files.
   */
  async triggerReindex(files?: string[]): Promise<IndexResult | null> {
    if (!this.indexer) {
      return null;
    }

    if (files && files.length > 0) {
      // Index specific files
      for (const file of files) {
        await this.indexer.indexFile(file);
      }
      this.stats.filesReindexed += files.length;
      return null;
    }

    // Full incremental update
    const result = await this.indexer.updateIndex();
    this.stats.filesReindexed += result.added.length + result.modified.length;
    return result;
  }

  /**
   * Check if a file path should be watched.
   * Uses picomatch for robust glob matching.
   */
  shouldWatch(filePath: string): boolean {
    const relativePath = path.relative(this.config.root, filePath);

    const isExcluded = picomatch(this.config.exclude, { dot: true });
    if (isExcluded(relativePath)) {
      return false;
    }

    const isIncluded = picomatch(this.config.include, { dot: true });
    return isIncluded(relativePath);
  }

  /**
   * Set up watchers for a directory and its subdirectories.
   */
  private async setupWatchers(dir: string): Promise<void> {
    // Check if directory exists first
    try {
      await fs.promises.access(dir, fs.constants.R_OK);
    } catch (error) {
      this.stats.errors++;
      this.emit('error', { directory: dir, error });
      throw new Error(`Cannot watch directory: ${dir}`);
    }

    // Watch the directory itself
    if (!this.watchers.has(dir)) {
      try {
        const watcher = fs.watch(
          dir,
          { recursive: this.config.recursive },
          (eventType, filename) => {
            if (filename) {
              this.handleWatchEvent(eventType, path.join(dir, filename));
            }
          }
        );

        watcher.on('error', (error) => {
          this.stats.errors++;
          this.emit('error', { directory: dir, error });
        });

        this.watchers.set(dir, watcher);
        this.stats.watchedDirectories++;
      } catch (error) {
        // Directory might not exist or not be accessible
        this.stats.errors++;
        this.emit('error', { directory: dir, error });
        throw error;
      }
    }
  }

  /**
   * Handle a watch event from the file system.
   */
  private handleWatchEvent(eventType: string, filePath: string): void {
    // Normalize path
    const normalizedPath = path.normalize(filePath);
    const relativePath = path.relative(this.config.root, normalizedPath);

    // Check if we should watch this file
    if (!this.shouldWatch(normalizedPath)) {
      return;
    }

    // Determine event type
    let watchEventType: WatchEventType;
    if (eventType === 'rename') {
      // Could be add or unlink - check if file exists
      try {
        fs.accessSync(normalizedPath);
        watchEventType = this.pendingChanges.has(relativePath) ? 'change' : 'add';
      } catch {
        watchEventType = 'unlink';
      }
    } else {
      watchEventType = 'change';
    }

    // Record the event
    const event: WatchEvent = {
      type: watchEventType,
      path: relativePath,
      timestamp: new Date()
    };

    this.stats.eventsReceived++;
    this.stats.lastEvent = event;
    this.pendingChanges.set(relativePath, watchEventType);

    // Emit change event
    this.emit('change', event);

    // Debounce reindexing
    if (this.config.autoReindex && this.indexer) {
      this.scheduleReindex();
    }
  }

  /**
   * Schedule a debounced reindex.
   */
  private scheduleReindex(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      await this.performReindex();
    }, this.config.debounceMs);
  }

  /**
   * Perform the actual reindex operation.
   */
  private async performReindex(): Promise<void> {
    if (this.isReindexing || !this.indexer) {
      return;
    }

    this.isReindexing = true;
    const changedFiles = Array.from(this.pendingChanges.entries());
    this.pendingChanges.clear();

    try {
      // Group by event type for efficient processing
      const additions: string[] = [];
      const modifications: string[] = [];
      const deletions: string[] = [];

      for (const [filePath, eventType] of changedFiles) {
        switch (eventType) {
          case 'add':
            additions.push(filePath);
            break;
          case 'change':
            modifications.push(filePath);
            break;
          case 'unlink':
            deletions.push(filePath);
            break;
        }
      }

      // Index new and modified files
      const filesToIndex = [...additions, ...modifications];
      for (const file of filesToIndex) {
        try {
          await this.indexer.indexFile(file);
          this.stats.filesReindexed++;
        } catch (error) {
          this.stats.errors++;
          this.emit('error', { file, error });
        }
      }

      // Emit reindex event with results
      this.emit('reindex', {
        added: additions,
        modified: modifications,
        deleted: deletions,
        timestamp: new Date()
      });
    } catch (error) {
      this.stats.errors++;
      this.emit('error', error);
    } finally {
      this.isReindexing = false;
    }
  }

}

/**
 * Create a file watcher with default configuration.
 */
export function createFileWatcher(
  root: string,
  indexer?: CodebaseIndexer,
  options?: Partial<WatchConfig>
): FileWatcher {
  return new FileWatcher(
    { root, ...options },
    indexer
  );
}
