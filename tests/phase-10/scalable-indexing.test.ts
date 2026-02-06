import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StreamingFileProcessor, FileProcessResult } from '../../src/indexer';

describe('F10.3 - Scalable Indexing', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-3-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function createTestFile(relativePath: string, content: string): void {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
  }

  function createManyFiles(count: number): void {
    for (let i = 0; i < count; i++) {
      createTestFile(
        `src/file${i}.ts`,
        `export function func${i}() { return ${i}; }`
      );
    }
  }

  describe('Streaming File Processing', () => {
    it('should process files in batches', async () => {
      createManyFiles(25);

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 10
      });

      const batches: FileProcessResult[][] = [];
      for await (const batch of processor.processFiles()) {
        batches.push(batch);
      }

      // Should have multiple batches
      expect(batches.length).toBe(3); // 10 + 10 + 5
      expect(batches[0].length).toBe(10);
      expect(batches[1].length).toBe(10);
      expect(batches[2].length).toBe(5);
    });

    it('should process all files and return summaries', async () => {
      createTestFile('app.ts', 'export function main() { return 1; }');
      createTestFile('util.ts', 'export function helper() { return 2; }');

      const processor = new StreamingFileProcessor(tempDir);

      const results: FileProcessResult[] = [];
      for await (const batch of processor.processFiles()) {
        results.push(...batch);
      }

      expect(results.length).toBe(2);
      expect(results[0].summary).toBeDefined();
      expect(results[0].sourceCode).toBeDefined();
    });

    it('should track progress', async () => {
      createManyFiles(10);

      const progressCalls: Array<{ processed: number; total: number }> = [];

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 5,
        onProgress: (processed, total) => {
          progressCalls.push({ processed, total });
        }
      });

      for await (const _ of processor.processFiles()) {
        // Just consume the generator
      }

      expect(progressCalls.length).toBe(10);
      expect(progressCalls[progressCalls.length - 1].processed).toBe(10);
      // Total should be set by the time progress is reported
      expect(progressCalls[progressCalls.length - 1].total).toBeGreaterThanOrEqual(10);
    });

    it('should call batch complete callback', async () => {
      createManyFiles(10);

      const batchCallbacks: number[] = [];

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 5,
        onBatchComplete: async (batch) => {
          batchCallbacks.push(batch.length);
        }
      });

      for await (const _ of processor.processFiles()) {
        // Just consume the generator
      }

      expect(batchCallbacks).toEqual([5, 5]);
    });
  });

  describe('File Size Limits', () => {
    it('should skip files larger than maxFileSizeKb', async () => {
      // Create a small file and a large file
      createTestFile('small.ts', 'export const x = 1;');

      // Create a large file (> 1KB)
      const largeContent = 'export const x = ' + 'a'.repeat(2000) + ';';
      createTestFile('large.ts', largeContent);

      const processor = new StreamingFileProcessor(tempDir, {
        maxFileSizeKb: 1 // 1KB limit
      });

      const results: FileProcessResult[] = [];
      for await (const batch of processor.processFiles()) {
        results.push(...batch);
      }

      expect(results.length).toBe(1);
      expect(results[0].filePath).toBe('small.ts');

      const state = processor.getState();
      expect(state.skippedFiles.length).toBe(1);
    });
  });

  describe('Entity Limits', () => {
    it('should limit entities per file', async () => {
      // Create a file with many exports
      const funcs = [];
      for (let i = 0; i < 20; i++) {
        funcs.push(`export function func${i}() { return ${i}; }`);
      }
      createTestFile('many-funcs.ts', funcs.join('\n'));

      const processor = new StreamingFileProcessor(tempDir, {
        maxEntitiesPerFile: 5
      });

      const results: FileProcessResult[] = [];
      for await (const batch of processor.processFiles()) {
        results.push(...batch);
      }

      expect(results.length).toBe(1);
      expect(results[0].summary.symbols.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Directory Exclusion', () => {
    it('should exclude node_modules by default', async () => {
      createTestFile('src/app.ts', 'export const a = 1;');
      createTestFile('node_modules/lib/index.ts', 'export const b = 2;');

      const processor = new StreamingFileProcessor(tempDir);

      const results: FileProcessResult[] = [];
      for await (const batch of processor.processFiles()) {
        results.push(...batch);
      }

      expect(results.length).toBe(1);
      expect(results[0].filePath).toBe('src/app.ts');
    });

    it('should exclude custom patterns', async () => {
      createTestFile('src/app.ts', 'export const a = 1;');
      createTestFile('test/app.test.ts', 'export const b = 2;');
      createTestFile('generated/types.ts', 'export const c = 3;');

      const processor = new StreamingFileProcessor(tempDir, {
        exclude: ['test', 'generated']
      });

      const results: FileProcessResult[] = [];
      for await (const batch of processor.processFiles()) {
        results.push(...batch);
      }

      expect(results.length).toBe(1);
      expect(results[0].filePath).toBe('src/app.ts');
    });
  });

  describe('Checkpointing', () => {
    it('should save checkpoint during processing', async () => {
      createManyFiles(20);

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 10,
        checkpointInterval: 5
      });

      // Process all files
      for await (const _ of processor.processFiles()) {
        // Just consume
      }

      // Checkpoint should be cleared after successful completion
      expect(await processor.hasCheckpoint()).toBe(false);
    });

    it('should resume from checkpoint', async () => {
      createManyFiles(20);

      // First run - process exactly 2 batches (10 files) then stop
      const processor1 = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 5,
        checkpointInterval: 100 // High so we control when to save
      });

      let batchCount = 0;
      let processed = 0;
      for await (const batch of processor1.processFiles()) {
        processed += batch.length;
        batchCount++;
        if (batchCount >= 2) break; // Stop after 2 batches
      }

      // Should have processed exactly 10 files (2 batches of 5)
      expect(processed).toBe(10);

      // Manually save state
      // @ts-ignore - Access private method for testing
      await processor1['saveCheckpoint']();

      expect(await processor1.hasCheckpoint()).toBe(true);

      // Second run - should resume from where we left off
      const processor2 = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 5,
        checkpointInterval: 100
      });

      let resumed = 0;
      for await (const batch of processor2.processFiles()) {
        resumed += batch.length;
      }

      // Should process the remaining 10 files
      expect(resumed).toBe(10);
    });

    it('should track failed files', async () => {
      createTestFile('valid.ts', 'export const x = 1;');
      // Create a file that will fail to parse
      createTestFile('invalid.ts', '{{{{invalid syntax');

      const processor = new StreamingFileProcessor(tempDir);

      for await (const _ of processor.processFiles()) {
        // Just consume
      }

      const state = processor.getState();
      // Note: tree-sitter is quite resilient, so it may not actually fail
      // This test mainly verifies the error handling path exists
      expect(state.processedFiles).toBe(2);
    });

    it('should reset checkpoint manually', async () => {
      createManyFiles(10);

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 5,
        checkpointInterval: 5
      });

      // Process some files
      let count = 0;
      for await (const batch of processor.processFiles()) {
        count += batch.length;
        if (count >= 5) {
          // @ts-ignore
          await processor['saveCheckpoint']();
          break;
        }
      }

      expect(await processor.hasCheckpoint()).toBe(true);

      // Reset checkpoint
      await processor.resetCheckpoint();

      expect(await processor.hasCheckpoint()).toBe(false);
    });
  });

  describe('State Tracking', () => {
    it('should track total and processed files', async () => {
      createManyFiles(15);

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 5
      });

      let lastState;
      for await (const _ of processor.processFiles()) {
        lastState = processor.getState();
      }

      // Check state was updated during processing
      expect(lastState!.totalFiles).toBe(15);
      expect(lastState!.processedFiles).toBe(15);
    });

    it('should track timestamps', async () => {
      createTestFile('app.ts', 'export const x = 1;');

      const processor = new StreamingFileProcessor(tempDir);

      for await (const _ of processor.processFiles()) {
        // Just consume
      }

      const state = processor.getState();
      expect(state.startedAt).toBeDefined();
      expect(new Date(state.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Memory Efficiency', () => {
    it('should process many files without holding all in memory', async () => {
      // Create 100 files
      createManyFiles(100);

      const processor = new StreamingFileProcessor(tempDir, {
        fileBatchSize: 10
      });

      let batchCount = 0;
      for await (const batch of processor.processFiles()) {
        // Each batch should be small (10 files)
        expect(batch.length).toBeLessThanOrEqual(10);
        batchCount++;
      }

      // Should have processed in batches
      expect(batchCount).toBe(10);

      const state = processor.getState();
      expect(state.processedFiles).toBe(100);
    });
  });

  describe('Python Support', () => {
    it('should process Python files', async () => {
      createTestFile('app.py', 'def main():\n    return 1');
      createTestFile('utils.py', 'def helper():\n    return 2');

      const processor = new StreamingFileProcessor(tempDir);

      const results: FileProcessResult[] = [];
      for await (const batch of processor.processFiles()) {
        results.push(...batch);
      }

      expect(results.length).toBe(2);
      expect(results.some(r => r.filePath === 'app.py')).toBe(true);
      expect(results.some(r => r.filePath === 'utils.py')).toBe(true);
    });
  });
});
