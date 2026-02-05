/**
 * Phase 7: Watch Types
 * Type definitions for file watching
 */

export interface WatchOptions {
  debounce?: number;
  ignored?: string[];
  ignore?: string[];
  onEvent?: (event: FileChangeEvent) => void;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'delete';
  path: string;
  timestamp: Date;
}

export interface FileWatcherState {
  watching: boolean;
  debounce: number;
  running: boolean;
  pendingChanges: Map<string, FileChangeEvent>;
  processedCount: number;
}
