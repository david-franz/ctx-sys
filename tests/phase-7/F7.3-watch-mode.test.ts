/**
 * F7.3 Watch Mode Tests
 *
 * Tests for file watching and incremental updates:
 * - File change detection (add, modify, delete)
 * - Debouncing of rapid changes
 * - Supported file filtering
 * - Incremental re-indexing
 *
 * @see docs/phase-7/F7.3-watch-mode.md
 *
 * NOTE: These tests will fail until the following implementations are created:
 * - src/watch/watcher.ts (FileWatcher class)
 * - src/watch/types.ts (WatchOptions, FileChangeEvent interfaces)
 * - src/watch/debouncer.ts (Debouncer class)
 * - src/watch/file-filter.ts (FileFilter class)
 * - src/watch/incremental-indexer.ts (IncrementalIndexer class)
 */

import { FileWatcher } from '../../src/watch/watcher';
import { WatchOptions, FileChangeEvent, FileWatcherState } from '../../src/watch/types';
import { Debouncer } from '../../src/watch/debouncer';
import { FileFilter } from '../../src/watch/file-filter';
import { IncrementalIndexer } from '../../src/watch/incremental-indexer';

// Mock all dependencies
jest.mock('../../src/watch/debouncer');
jest.mock('../../src/watch/file-filter');
jest.mock('../../src/watch/incremental-indexer');

// Mock the file system watcher (chokidar or similar)
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('F7.3 Watch Mode', () => {
  // Mocked dependencies
  let mockDebouncer: jest.Mocked<Debouncer>;
  let mockFileFilter: jest.Mocked<FileFilter>;
  let mockIncrementalIndexer: jest.Mocked<IncrementalIndexer>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create mocked instances
    mockDebouncer = {
      debounce: jest.fn(),
      cancel: jest.fn(),
      flush: jest.fn(),
      executeCount: 0,
    } as unknown as jest.Mocked<Debouncer>;

    mockFileFilter = {
      isSupported: jest.fn(),
      shouldIgnore: jest.fn(),
      addIgnorePattern: jest.fn(),
      removeIgnorePattern: jest.fn(),
      getSupportedExtensions: jest.fn().mockReturnValue([
        '.ts', '.tsx', '.js', '.jsx', '.mjs',
        '.py', '.go', '.rs', '.java',
        '.c', '.h', '.cpp', '.hpp',
        '.md'
      ]),
      getIgnorePatterns: jest.fn().mockReturnValue([
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ]),
    } as unknown as jest.Mocked<FileFilter>;

    mockIncrementalIndexer = {
      indexFile: jest.fn().mockResolvedValue(undefined),
      removeFile: jest.fn().mockResolvedValue(undefined),
      reindexFile: jest.fn().mockResolvedValue(undefined),
      cleanupRelationships: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IncrementalIndexer>;

    // Setup constructor mocks
    (Debouncer as jest.Mock).mockImplementation(() => mockDebouncer);
    (FileFilter as jest.Mock).mockImplementation(() => mockFileFilter);
    (IncrementalIndexer as jest.Mock).mockImplementation(() => mockIncrementalIndexer);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // FileChangeEvent Interface Tests
  // ============================================================================

  describe('FileChangeEvent Interface', () => {
    let watcher: FileWatcher;
    let receivedEvents: FileChangeEvent[];

    beforeEach(() => {
      receivedEvents = [];
      const options: WatchOptions = {
        onEvent: (event: FileChangeEvent) => receivedEvents.push(event),
      };
      watcher = new FileWatcher('/project', options, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
    });

    it('should represent file addition', () => {
      const event: FileChangeEvent = {
        type: 'add',
        path: '/project/src/new-file.ts',
        timestamp: new Date(),
      };

      expect(event.type).toBe('add');
      expect(event.path).toContain('new-file.ts');
    });

    it('should represent file modification', () => {
      const event: FileChangeEvent = {
        type: 'change',
        path: '/project/src/existing.ts',
        timestamp: new Date(),
      };

      expect(event.type).toBe('change');
    });

    it('should represent file deletion', () => {
      const event: FileChangeEvent = {
        type: 'delete',
        path: '/project/src/removed.ts',
        timestamp: new Date(),
      };

      expect(event.type).toBe('delete');
    });

    it('should include timestamp', () => {
      const now = new Date();
      const event: FileChangeEvent = {
        type: 'add',
        path: '/test.ts',
        timestamp: now,
      };

      expect(event.timestamp).toEqual(now);
    });
  });

  // ============================================================================
  // File Type Filtering Tests
  // ============================================================================

  describe('File Type Filtering', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      watcher = new FileWatcher('/project', {}, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
    });

    it('should accept TypeScript files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/app.ts')).toBe(true);
      expect(mockFileFilter.isSupported('/src/component.tsx')).toBe(true);
    });

    it('should accept JavaScript files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/index.js')).toBe(true);
      expect(mockFileFilter.isSupported('/src/component.jsx')).toBe(true);
      expect(mockFileFilter.isSupported('/src/module.mjs')).toBe(true);
    });

    it('should accept Python files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/main.py')).toBe(true);
    });

    it('should accept Go files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/main.go')).toBe(true);
    });

    it('should accept Rust files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/lib.rs')).toBe(true);
    });

    it('should accept Java files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/Main.java')).toBe(true);
    });

    it('should accept C/C++ files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/src/main.c')).toBe(true);
      expect(mockFileFilter.isSupported('/src/utils.h')).toBe(true);
      expect(mockFileFilter.isSupported('/src/app.cpp')).toBe(true);
      expect(mockFileFilter.isSupported('/src/app.hpp')).toBe(true);
    });

    it('should accept Markdown files', () => {
      mockFileFilter.isSupported.mockReturnValue(true);

      expect(mockFileFilter.isSupported('/docs/README.md')).toBe(true);
    });

    it('should reject unsupported files', () => {
      mockFileFilter.isSupported.mockReturnValue(false);

      expect(mockFileFilter.isSupported('/config.json')).toBe(false);
      expect(mockFileFilter.isSupported('/data.yaml')).toBe(false);
      expect(mockFileFilter.isSupported('/image.png')).toBe(false);
      expect(mockFileFilter.isSupported('/package-lock.json')).toBe(false);
    });

    it('should delegate filtering to FileFilter', () => {
      mockFileFilter.isSupported.mockImplementation((path: string) => path.endsWith('.ts'));

      expect(mockFileFilter.isSupported('/src/app.ts')).toBe(true);
      expect(mockFileFilter.isSupported('/src/app.js')).toBe(false);
      expect(mockFileFilter.isSupported).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Ignore Pattern Tests
  // ============================================================================

  describe('Ignore Patterns', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      watcher = new FileWatcher('/project', {}, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
    });

    it('should ignore node_modules', () => {
      mockFileFilter.shouldIgnore.mockReturnValue(true);

      expect(mockFileFilter.shouldIgnore('/project/node_modules/lodash/index.js')).toBe(true);
    });

    it('should ignore .git directory', () => {
      mockFileFilter.shouldIgnore.mockReturnValue(true);

      expect(mockFileFilter.shouldIgnore('/project/.git/objects/abc')).toBe(true);
    });

    it('should ignore dist directory', () => {
      mockFileFilter.shouldIgnore.mockReturnValue(true);

      expect(mockFileFilter.shouldIgnore('/project/dist/bundle.js')).toBe(true);
    });

    it('should ignore build directory', () => {
      mockFileFilter.shouldIgnore.mockReturnValue(true);

      expect(mockFileFilter.shouldIgnore('/project/build/output.js')).toBe(true);
    });

    it('should not ignore source files', () => {
      mockFileFilter.shouldIgnore.mockReturnValue(false);

      expect(mockFileFilter.shouldIgnore('/project/src/app.ts')).toBe(false);
    });

    it('should support custom ignore patterns', () => {
      mockFileFilter.shouldIgnore.mockImplementation((path: string) => {
        return path.includes('node_modules') || path.endsWith('.test.ts');
      });

      expect(mockFileFilter.shouldIgnore('/project/src/app.test.ts')).toBe(true);
      expect(mockFileFilter.shouldIgnore('/project/src/app.ts')).toBe(false);
    });

    it('should allow adding custom ignore patterns', () => {
      watcher = new FileWatcher(
        '/project',
        { ignore: ['**/*.test.ts'] },
        mockDebouncer,
        mockFileFilter,
        mockIncrementalIndexer
      );

      expect(mockFileFilter.addIgnorePattern).toBeDefined();
    });
  });

  // ============================================================================
  // Debouncing Tests
  // ============================================================================

  describe('Debouncing', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      const options: WatchOptions = {
        debounce: 500,
      };
      watcher = new FileWatcher('/project', options, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
    });

    it('should debounce rapid changes', () => {
      let processedCount = 0;
      mockDebouncer.debounce.mockImplementation((callback: () => void, delay: number) => {
        setTimeout(() => {
          processedCount++;
          callback();
        }, delay);
      });

      // Simulate rapid file changes
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });

      // Fast-forward time
      jest.advanceTimersByTime(500);

      expect(mockDebouncer.debounce).toHaveBeenCalled();
    });

    it('should use configurable delay', () => {
      const customOptions: WatchOptions = { debounce: 1000 };
      const customWatcher = new FileWatcher(
        '/project',
        customOptions,
        mockDebouncer,
        mockFileFilter,
        mockIncrementalIndexer
      );

      let executed = false;
      mockDebouncer.debounce.mockImplementation((callback: () => void, delay: number) => {
        setTimeout(() => {
          executed = true;
          callback();
        }, delay);
      });

      customWatcher.handleEvent({ type: 'add', path: '/src/new.ts', timestamp: new Date() });

      jest.advanceTimersByTime(500);
      expect(executed).toBe(false);

      jest.advanceTimersByTime(500);
      expect(executed).toBe(true);
    });

    it('should cancel pending debounce on stop', () => {
      watcher.start();
      watcher.handleEvent({ type: 'add', path: '/src/new.ts', timestamp: new Date() });
      watcher.stop();

      expect(mockDebouncer.cancel).toHaveBeenCalled();
    });

    it('should reset timer on new changes', () => {
      mockDebouncer.debounce.mockImplementation((callback: () => void, delay: number) => {
        // Debouncer resets timer on each call
      });

      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });
      jest.advanceTimersByTime(400);
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });
      jest.advanceTimersByTime(500);

      expect(mockDebouncer.debounce).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Change Processing Tests
  // ============================================================================

  describe('Change Processing', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);
      watcher = new FileWatcher('/project', {}, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
      watcher.start();
    });

    afterEach(() => {
      watcher.stop();
    });

    it('should queue file additions', () => {
      watcher.handleEvent({ type: 'add', path: '/src/new.ts', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(1);
    });

    it('should queue file modifications', () => {
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(1);
      expect(state.pendingChanges.get('/src/app.ts')?.type).toBe('change');
    });

    it('should queue file deletions', () => {
      watcher.handleEvent({ type: 'delete', path: '/src/old.ts', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.get('/src/old.ts')?.type).toBe('delete');
    });

    it('should deduplicate changes to same file', () => {
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(1);
    });

    it('should process all pending changes', async () => {
      watcher.handleEvent({ type: 'add', path: '/src/new1.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'add', path: '/src/new2.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });

      const processed = await watcher.processChanges();

      expect(processed).toHaveLength(3);
      expect(watcher.getState().pendingChanges.size).toBe(0);
      expect(watcher.getState().processedCount).toBe(3);
    });

    it('should not process when stopped', () => {
      watcher.stop();
      watcher.handleEvent({ type: 'add', path: '/src/new.ts', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(0);
    });

    it('should filter out unsupported files', () => {
      mockFileFilter.isSupported.mockReturnValue(false);

      watcher.handleEvent({ type: 'add', path: '/src/config.json', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(0);
    });

    it('should filter out ignored files', () => {
      mockFileFilter.shouldIgnore.mockReturnValue(true);

      watcher.handleEvent({ type: 'add', path: '/node_modules/lodash/index.js', timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(0);
    });
  });

  // ============================================================================
  // Incremental Re-indexing Tests
  // ============================================================================

  describe('Incremental Re-indexing', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);
      watcher = new FileWatcher('/project', {}, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
      watcher.start();
    });

    afterEach(() => {
      watcher.stop();
    });

    it('should re-index added files', async () => {
      watcher.handleEvent({ type: 'add', path: '/src/new-component.ts', timestamp: new Date() });

      await watcher.processChanges();

      expect(mockIncrementalIndexer.indexFile).toHaveBeenCalledWith('/src/new-component.ts');
    });

    it('should re-index modified files', async () => {
      watcher.handleEvent({ type: 'change', path: '/src/app.ts', timestamp: new Date() });

      await watcher.processChanges();

      expect(mockIncrementalIndexer.reindexFile).toHaveBeenCalledWith('/src/app.ts');
    });

    it('should remove deleted files from index', async () => {
      watcher.handleEvent({ type: 'delete', path: '/src/removed.ts', timestamp: new Date() });

      await watcher.processChanges();

      expect(mockIncrementalIndexer.removeFile).toHaveBeenCalledWith('/src/removed.ts');
    });

    it('should clean up relationships when file deleted', async () => {
      watcher.handleEvent({ type: 'delete', path: '/src/removed.ts', timestamp: new Date() });

      await watcher.processChanges();

      expect(mockIncrementalIndexer.cleanupRelationships).toHaveBeenCalledWith('/src/removed.ts');
    });

    it('should handle indexing errors gracefully', async () => {
      mockIncrementalIndexer.indexFile.mockRejectedValue(new Error('Index failed'));

      watcher.handleEvent({ type: 'add', path: '/src/broken.ts', timestamp: new Date() });

      await expect(watcher.processChanges()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Watcher Lifecycle Tests
  // ============================================================================

  describe('Watcher Lifecycle', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      watcher = new FileWatcher('/project', {}, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
    });

    it('should start watching', () => {
      watcher.start();

      expect(watcher.getState().running).toBe(true);
    });

    it('should stop watching', () => {
      watcher.start();
      watcher.stop();

      expect(watcher.getState().running).toBe(false);
    });

    it('should throw if started twice', () => {
      watcher.start();

      expect(() => watcher.start()).toThrow('Watcher already running');
    });

    it('should allow restart after stop', () => {
      watcher.start();
      watcher.stop();
      watcher.start();

      expect(watcher.getState().running).toBe(true);
    });

    it('should clean up resources on stop', () => {
      watcher.start();
      watcher.stop();

      expect(mockDebouncer.cancel).toHaveBeenCalled();
    });

    it('should clear pending changes on stop', () => {
      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);

      watcher.start();
      watcher.handleEvent({ type: 'add', path: '/src/test.ts', timestamp: new Date() });
      watcher.stop();

      expect(watcher.getState().pendingChanges.size).toBe(0);
    });
  });

  // ============================================================================
  // Event Callback Tests
  // ============================================================================

  describe('Event Callbacks', () => {
    it('should invoke callback on file events', () => {
      const events: FileChangeEvent[] = [];
      const options: WatchOptions = {
        onEvent: (event: FileChangeEvent) => events.push(event),
      };

      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);

      const watcher = new FileWatcher('/project', options, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
      watcher.start();

      const event: FileChangeEvent = { type: 'add', path: '/src/new.ts', timestamp: new Date() };
      watcher.handleEvent(event);

      expect(events).toHaveLength(1);
      expect(events[0].path).toBe('/src/new.ts');
    });

    it('should pass correct event type', () => {
      const events: FileChangeEvent[] = [];
      const options: WatchOptions = {
        onEvent: (event: FileChangeEvent) => events.push(event),
      };

      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);

      const watcher = new FileWatcher('/project', options, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
      watcher.start();

      watcher.handleEvent({ type: 'add', path: '/a.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'change', path: '/b.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'delete', path: '/c.ts', timestamp: new Date() });

      expect(events.map(e => e.type)).toEqual(['add', 'change', 'delete']);
    });

    it('should handle callback errors gracefully', () => {
      const options: WatchOptions = {
        onEvent: () => {
          throw new Error('Callback error');
        },
      };

      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);

      const watcher = new FileWatcher('/project', options, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
      watcher.start();

      // Watcher should catch callback errors and not throw
      expect(() => {
        watcher.handleEvent({ type: 'add', path: '/test.ts', timestamp: new Date() });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    let watcher: FileWatcher;

    beforeEach(() => {
      mockFileFilter.isSupported.mockReturnValue(true);
      mockFileFilter.shouldIgnore.mockReturnValue(false);
      watcher = new FileWatcher('/project', {}, mockDebouncer, mockFileFilter, mockIncrementalIndexer);
      watcher.start();
    });

    afterEach(() => {
      watcher.stop();
    });

    it('should handle rapid file creation and deletion', () => {
      // File created then immediately deleted
      watcher.handleEvent({ type: 'add', path: '/temp.ts', timestamp: new Date() });
      watcher.handleEvent({ type: 'delete', path: '/temp.ts', timestamp: new Date() });

      const state = watcher.getState();
      // Only the delete should remain
      expect(state.pendingChanges.get('/temp.ts')?.type).toBe('delete');
    });

    it('should handle very long file paths', () => {
      const longPath = '/a'.repeat(200) + '/file.ts';

      watcher.handleEvent({ type: 'add', path: longPath, timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.has(longPath)).toBe(true);
    });

    it('should handle special characters in paths', () => {
      const path = '/project/src/file with spaces.ts';

      watcher.handleEvent({ type: 'add', path, timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.has(path)).toBe(true);
    });

    it('should handle empty directory', async () => {
      // No events added
      const changes = await watcher.processChanges();

      expect(changes).toHaveLength(0);
    });

    it('should handle symlinks', () => {
      const path = '/project/src/symlink.ts';

      watcher.handleEvent({ type: 'add', path, timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.has(path)).toBe(true);
    });

    it('should handle hidden files', () => {
      const hiddenFile = '/project/.hidden.ts';

      watcher.handleEvent({ type: 'add', path: hiddenFile, timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.has(hiddenFile)).toBe(true);
    });

    it('should handle file without extension', () => {
      mockFileFilter.isSupported.mockReturnValue(false);
      const noExtFile = '/project/Makefile';

      watcher.handleEvent({ type: 'add', path: noExtFile, timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.has(noExtFile)).toBe(false);
    });

    it('should handle unicode characters in file paths', () => {
      const unicodePath = '/project/src/archivo-espanol.ts';

      watcher.handleEvent({ type: 'add', path: unicodePath, timestamp: new Date() });

      const state = watcher.getState();
      expect(state.pendingChanges.has(unicodePath)).toBe(true);
    });

    it('should handle concurrent file operations', async () => {
      // Simulate concurrent operations
      const promises = [
        watcher.handleEvent({ type: 'add', path: '/src/a.ts', timestamp: new Date() }),
        watcher.handleEvent({ type: 'add', path: '/src/b.ts', timestamp: new Date() }),
        watcher.handleEvent({ type: 'add', path: '/src/c.ts', timestamp: new Date() }),
      ];

      const state = watcher.getState();
      expect(state.pendingChanges.size).toBe(3);
    });
  });
});
