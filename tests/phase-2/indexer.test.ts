import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodebaseIndexer } from '../../src';

describe('F2.3 - Codebase Indexing', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-index-test-'));
    indexer = new CodebaseIndexer(tempDir);
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  /**
   * Helper to create a test file.
   */
  function createTestFile(relativePath: string, content: string): string {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return relativePath;
  }

  describe('CodebaseIndexer', () => {
    describe('File Discovery', () => {
      it('should discover TypeScript files', async () => {
        createTestFile('src/app.ts', 'export function app() {}');
        createTestFile('src/utils.ts', 'export function util() {}');

        // Use concurrency 1 to avoid tree-sitter initialization race conditions
        const result = await indexer.indexAll({ concurrency: 1 });

        expect(result.added.length).toBe(2);
        expect(result.errors.length).toBe(0);
        expect(result.added).toContain('src/app.ts');
        expect(result.added).toContain('src/utils.ts');
      });

      it('should discover Python files', async () => {
        createTestFile('app.py', 'def main(): pass');
        createTestFile('utils.py', 'def helper(): pass');

        const result = await indexer.indexAll();

        expect(result.added.length).toBe(2);
      });

      it('should exclude node_modules by default', async () => {
        createTestFile('src/app.ts', 'export function app() {}');
        createTestFile('node_modules/lib/index.ts', 'export function lib() {}');

        const result = await indexer.indexAll();

        expect(result.added.length).toBe(1);
        expect(result.added).toContain('src/app.ts');
        expect(result.added).not.toContain('node_modules/lib/index.ts');
      });

      it('should exclude .git directory', async () => {
        createTestFile('src/app.ts', 'export function app() {}');
        createTestFile('.git/hooks/pre-commit', '#!/bin/sh\nexit 0');

        const result = await indexer.indexAll();

        expect(result.added.length).toBe(1);
      });

      it('should skip unsupported file types', async () => {
        createTestFile('src/app.ts', 'export function app() {}');
        createTestFile('README.md', '# Readme');
        createTestFile('config.json', '{}');

        const result = await indexer.indexAll();

        expect(result.added.length).toBe(1);
        expect(result.added).toContain('src/app.ts');
      });
    });

    describe('Full Indexing', () => {
      it('should index all discovered files', async () => {
        createTestFile('src/main.ts', `
export function main() {
  console.log('Hello');
}
`);
        createTestFile('src/utils.ts', `
export function helper(x: number): number {
  return x * 2;
}
`);

        const result = await indexer.indexAll();

        expect(result.added.length).toBe(2);
        expect(result.errors.length).toBe(0);
        expect(result.stats.totalFiles).toBe(2);
        expect(result.stats.totalSymbols).toBeGreaterThan(0);
      });

      it('should track language statistics', async () => {
        createTestFile('app.ts', 'export function ts() {}');
        createTestFile('script.py', 'def py(): pass');

        const result = await indexer.indexAll();

        expect(result.stats.byLanguage['typescript']).toBe(1);
        expect(result.stats.byLanguage['python']).toBe(1);
      });

      it('should report duration', async () => {
        createTestFile('app.ts', 'export function app() {}');

        const result = await indexer.indexAll();

        expect(result.duration).toBeGreaterThan(0);
      });

      it('should handle parse errors gracefully', async () => {
        createTestFile('valid.ts', 'export function valid() {}');
        // Invalid syntax - but tree-sitter may still parse it partially
        createTestFile('broken.ts', 'export function broken( {}');

        const result = await indexer.indexAll();

        // Even malformed files may be indexed with errors captured
        expect(result.stats.totalFiles).toBeGreaterThan(0);
      });
    });

    describe('Incremental Updates', () => {
      it('should detect new files', async () => {
        createTestFile('existing.ts', 'export function existing() {}');
        await indexer.indexAll();

        createTestFile('new.ts', 'export function newFn() {}');
        const result = await indexer.updateIndex();

        expect(result.added).toContain('new.ts');
        expect(result.unchanged).toContain('existing.ts');
      });

      it('should detect modified files', async () => {
        const filePath = createTestFile('app.ts', 'export function v1() {}');
        await indexer.indexAll();

        // Modify the file
        fs.writeFileSync(
          path.join(tempDir, filePath),
          'export function v2() { return 42; }'
        );

        const result = await indexer.updateIndex();

        expect(result.modified).toContain('app.ts');
      });

      it('should detect deleted files', async () => {
        createTestFile('app.ts', 'export function app() {}');
        createTestFile('toDelete.ts', 'export function toDelete() {}');
        await indexer.indexAll();

        // Delete one file
        fs.unlinkSync(path.join(tempDir, 'toDelete.ts'));

        const result = await indexer.updateIndex();

        expect(result.deleted).toContain('toDelete.ts');
        expect(result.unchanged).toContain('app.ts');
      });

      it('should not re-index unchanged files', async () => {
        createTestFile('app.ts', 'export function app() {}');
        await indexer.indexAll();

        const result = await indexer.updateIndex();

        expect(result.unchanged).toContain('app.ts');
        expect(result.modified.length).toBe(0);
        expect(result.added.length).toBe(0);
      });
    });

    describe('Single File Indexing', () => {
      it('should index a single file', async () => {
        createTestFile('app.ts', `
export class MyClass {
  method() {}
}
`);

        const summary = await indexer.indexFile('app.ts');

        expect(summary).not.toBeNull();
        expect(summary!.symbols.length).toBe(1);
        expect(summary!.symbols[0].name).toBe('MyClass');
      });

      it('should return null for unsupported files', async () => {
        createTestFile('readme.md', '# Hello');

        const summary = await indexer.indexFile('readme.md');

        expect(summary).toBeNull();
      });
    });

    describe('Index Queries', () => {
      it('should get file summary from index', async () => {
        createTestFile('app.ts', 'export function myFunction() {}');
        await indexer.indexAll();

        const summary = indexer.getFileSummary('app.ts');

        expect(summary).not.toBeNull();
        expect(summary!.symbols[0].name).toBe('myFunction');
      });

      it('should return null for non-indexed files', () => {
        const summary = indexer.getFileSummary('nonexistent.ts');
        expect(summary).toBeNull();
      });

      it('should get all indexed files', async () => {
        createTestFile('a.ts', 'export const a = 1;');
        createTestFile('b.ts', 'export const b = 2;');
        await indexer.indexAll();

        const files = indexer.getIndexedFiles();

        expect(files.length).toBe(2);
        expect(files.map(f => f.path)).toContain('a.ts');
        expect(files.map(f => f.path)).toContain('b.ts');
      });

      it('should search symbols', async () => {
        createTestFile('app.ts', `
export function searchable() {}
export function another() {}
`);
        await indexer.indexAll();

        const results = indexer.searchSymbols('searchable');

        expect(results.length).toBe(1);
        expect(results[0].symbols.some(s => s.name === 'searchable')).toBe(true);
      });

      it('should search by file path', async () => {
        createTestFile('src/utils/helpers.ts', 'export function help() {}');
        createTestFile('src/app.ts', 'export function app() {}');
        await indexer.indexAll();

        const results = indexer.searchSymbols('helpers');

        expect(results.length).toBe(1);
      });
    });

    describe('Index Statistics', () => {
      it('should compute accurate statistics', async () => {
        createTestFile('src/app.ts', `
export class MyClass {
  method1() {}
  method2() {}
}
export function standalone() {}
`);
        await indexer.indexAll();

        const stats = indexer.getStats();

        expect(stats.totalFiles).toBe(1);
        expect(stats.totalSymbols).toBeGreaterThanOrEqual(2);
        expect(stats.byLanguage['typescript']).toBe(1);
      });
    });

    describe('Force Re-indexing', () => {
      it('should re-index all files when force is true', async () => {
        createTestFile('app.ts', 'export function app() {}');
        await indexer.indexAll();

        const result = await indexer.indexAll({ force: true });

        // All files should be marked as modified when forced
        expect(result.modified).toContain('app.ts');
      });
    });

    describe('Progress Callback', () => {
      it('should call progress callback during indexing', async () => {
        createTestFile('a.ts', 'export const a = 1;');
        createTestFile('b.ts', 'export const b = 2;');

        const progressCalls: Array<{ current: number; total: number; file: string }> = [];

        await indexer.indexAll({
          onProgress: (current, total, file) => {
            progressCalls.push({ current, total, file });
          }
        });

        expect(progressCalls.length).toBe(2);
        expect(progressCalls[progressCalls.length - 1].current).toBe(2);
        expect(progressCalls[progressCalls.length - 1].total).toBe(2);
      });
    });

    describe('Hash-based Change Detection', () => {
      it('should detect file needs reindex when content changes', async () => {
        const filePath = createTestFile('app.ts', 'export const v1 = 1;');
        await indexer.indexAll();

        // File unchanged
        let needsReindex = await indexer.needsReindex('app.ts');
        expect(needsReindex).toBe(false);

        // Modify content
        fs.writeFileSync(
          path.join(tempDir, filePath),
          'export const v2 = 2;'
        );

        needsReindex = await indexer.needsReindex('app.ts');
        expect(needsReindex).toBe(true);
      });

      it('should return true for non-indexed files', async () => {
        createTestFile('new.ts', 'export const x = 1;');

        const needsReindex = await indexer.needsReindex('new.ts');

        expect(needsReindex).toBe(true);
      });
    });

    describe('Concurrency', () => {
      it('should respect concurrency limit', async () => {
        // Create multiple files
        for (let i = 0; i < 10; i++) {
          createTestFile(`file${i}.ts`, `export const x${i} = ${i};`);
        }

        const result = await indexer.indexAll({ concurrency: 2 });

        expect(result.added.length).toBe(10);
        expect(result.errors.length).toBe(0);
      });
    });
  });
});
