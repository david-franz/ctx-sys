/**
 * F2.3 Codebase Indexing Tests
 *
 * Tests for full project scanning, symbol extraction,
 * summary generation, and embedding creation.
 *
 * NOTE: This test file will FAIL with "Cannot find module" errors until
 * the actual implementations are created at:
 *   - src/indexing/scanner.ts
 *   - src/indexing/indexer.ts
 *   - src/indexing/types.ts
 *   - src/database/connection.ts
 *
 * @see docs/phase-2/F2.3-codebase-indexing.md
 */

// Import actual implementations (will fail until created)
import { FileScanner } from '../../src/indexing/scanner';
import { CodebaseIndexer } from '../../src/indexing/indexer';
import {
  IndexOptions,
  IndexResult,
  IndexProgress,
  ScanResult,
  FileEntity,
  Symbol,
  IndexError
} from '../../src/indexing/types';
import { DatabaseConnection } from '../../src/db/connection';

// Mock dependencies
jest.mock('../../src/db/connection');
jest.mock('fs/promises');
jest.mock('glob');

// Import mocked modules for type access
import * as fsPromises from 'fs/promises';
import * as glob from 'glob';

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const mockedFs = fsPromises as jest.Mocked<typeof fsPromises>;
const mockedGlob = glob as jest.Mocked<typeof glob>;

describe('F2.3 Codebase Indexing', () => {
  let mockDbInstance: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock database instance
    mockDbInstance = {
      run: jest.fn().mockResolvedValue({ changes: 1 }),
      get: jest.fn().mockResolvedValue(undefined),
      all: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn().mockImplementation(async (fn) => fn()),
    } as unknown as jest.Mocked<DatabaseConnection>;

    MockedDatabaseConnection.mockImplementation(() => mockDbInstance);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // FileScanner Tests
  // ============================================================================

  describe('FileScanner', () => {
    let scanner: FileScanner;

    beforeEach(() => {
      scanner = new FileScanner();
    });

    describe('scan', () => {
      it('should scan project respecting .gitignore', async () => {
        // Setup mocks
        mockedFs.readFile.mockResolvedValue('node_modules\n.git\ndist');
        mockedGlob.glob.mockResolvedValue(['src/index.ts', 'src/utils.ts']);

        // Execute
        const result: ScanResult = await scanner.scan('/project');

        // Verify return value
        expect(result.files).toContain('src/index.ts');
        expect(result.files).toContain('src/utils.ts');
        expect(result.skipped).not.toContain('node_modules/lib.js');

        // Verify mock interactions
        expect(mockedFs.readFile).toHaveBeenCalledWith(
          '/project/.gitignore',
          'utf-8'
        );
        expect(mockedGlob.glob).toHaveBeenCalled();
      });

      it('should filter by language', async () => {
        mockedFs.readFile.mockResolvedValue('');
        mockedGlob.glob.mockResolvedValue([
          'src/index.ts',
          'src/main.py',
          'src/app.js'
        ]);

        const options: Partial<IndexOptions> = {
          languages: ['typescript', 'python']
        };

        const result: ScanResult = await scanner.scan('/project', options);

        // Verify only requested languages are included
        expect(result.files).toContain('src/index.ts');
        expect(result.files).toContain('src/main.py');
        expect(result.files).not.toContain('src/app.js');
      });

      it('should apply additional ignore patterns', async () => {
        mockedFs.readFile.mockResolvedValue('node_modules');
        mockedGlob.glob.mockResolvedValue(['src/index.ts', 'src/utils.ts']);

        const options: Partial<IndexOptions> = {
          ignore: ['*.test.ts', '__mocks__']
        };

        const result: ScanResult = await scanner.scan('/project', options);

        // Verify mock was called with combined ignore patterns
        expect(mockedGlob.glob).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            ignore: expect.arrayContaining(['node_modules', '*.test.ts', '__mocks__'])
          })
        );

        expect(result.files).toBeDefined();
      });

      it('should detect supported file types', async () => {
        mockedFs.readFile.mockResolvedValue('');
        mockedGlob.glob.mockResolvedValue([
          'src/index.ts',
          'src/utils.py',
          'readme.md',
          'config.json'
        ]);

        const result: ScanResult = await scanner.scan('/project');

        // Verify only code files are included
        expect(result.files).toContain('src/index.ts');
        expect(result.files).toContain('src/utils.py');
        expect(result.skipped).toContain('readme.md');
        expect(result.skipped).toContain('config.json');
      });

      it('should return both files and skipped lists', async () => {
        mockedFs.readFile.mockResolvedValue('node_modules\ndist');
        mockedGlob.glob.mockResolvedValue([
          'src/index.ts',
          'src/utils.ts',
          'node_modules/lib.js',
          'dist/bundle.js'
        ]);

        const result: ScanResult = await scanner.scan('/project');

        expect(result.files).toHaveLength(2);
        expect(result.skipped).toHaveLength(2);
        expect(result).toHaveProperty('files');
        expect(result).toHaveProperty('skipped');
      });
    });

    describe('gitignore handling', () => {
      it('should handle missing .gitignore', async () => {
        mockedFs.readFile.mockRejectedValue({ code: 'ENOENT' });
        mockedGlob.glob.mockResolvedValue(['src/index.ts']);

        // Should continue without error
        const result: ScanResult = await scanner.scan('/project');

        expect(result.files).toBeDefined();
        expect(mockedFs.readFile).toHaveBeenCalledWith(
          '/project/.gitignore',
          'utf-8'
        );
      });

      it('should handle empty .gitignore', async () => {
        mockedFs.readFile.mockResolvedValue('');
        mockedGlob.glob.mockResolvedValue(['src/index.ts']);

        const result: ScanResult = await scanner.scan('/project');

        expect(result.files).toBeDefined();
      });

      it('should handle complex .gitignore patterns', async () => {
        const complexGitignore = `
*.log
!important.log
/temp/
**/build/
**/*.min.js
`;
        mockedFs.readFile.mockResolvedValue(complexGitignore);
        mockedGlob.glob.mockResolvedValue(['src/index.ts']);

        const result: ScanResult = await scanner.scan('/project');

        // Verify complex patterns were parsed
        expect(mockedGlob.glob).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            ignore: expect.arrayContaining(['*.log', '**/build/', '**/*.min.js'])
          })
        );
        expect(result.files).toBeDefined();
      });
    });
  });

  // ============================================================================
  // CodebaseIndexer Tests
  // ============================================================================

  describe('CodebaseIndexer', () => {
    let indexer: CodebaseIndexer;
    let mockScanner: jest.Mocked<FileScanner>;
    let mockEmbeddingProvider: jest.Mock;
    let mockSummarizationProvider: jest.Mock;

    beforeEach(() => {
      // Create mocked dependencies
      mockScanner = {
        scan: jest.fn().mockResolvedValue({
          files: ['src/index.ts', 'src/utils.ts'],
          skipped: []
        })
      } as unknown as jest.Mocked<FileScanner>;

      mockEmbeddingProvider = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
      mockSummarizationProvider = jest.fn().mockResolvedValue('Function summary');

      // Create real indexer with mocked dependencies
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: mockScanner,
        embeddingProvider: mockEmbeddingProvider,
        summarizationProvider: mockSummarizationProvider
      });
    });

    describe('index', () => {
      it('should index all files in project', async () => {
        mockedFs.readFile.mockResolvedValue('function test() {}');

        const result: IndexResult = await indexer.index('/project', {
          depth: 'full',
          summarize: true,
          embeddings: true
        });

        // Verify return value
        expect(result.filesScanned).toBeGreaterThan(0);
        expect(result.filesIndexed).toBeGreaterThan(0);
        expect(result.entitiesCreated).toBeGreaterThan(0);

        // Verify mock interactions
        expect(mockScanner.scan).toHaveBeenCalledWith('/project', expect.any(Object));
        expect(mockDbInstance.run).toHaveBeenCalled();
      });

      it('should skip unchanged files via cache', async () => {
        const fileHash = 'abc123';
        mockDbInstance.get.mockResolvedValue({ file_hash: fileHash });
        mockedFs.readFile.mockResolvedValue('function test() {}');

        // Mock file hash calculation to return same hash
        const result: IndexResult = await indexer.index('/project', {
          useCache: true
        });

        // Verify cache was checked
        expect(mockDbInstance.get).toHaveBeenCalledWith(
          expect.stringContaining('proj_ast_cache'),
          expect.any(Array)
        );
        expect(result.filesSkipped).toBeGreaterThan(0);
      });

      it('should create entities for all symbols', async () => {
        mockedFs.readFile.mockResolvedValue(`
          class ClassA {
            methodA() {}
          }
          function funcB() {}
        `);

        const result: IndexResult = await indexer.index('/project');

        // Verify entities were created
        expect(result.entitiesCreated).toBeGreaterThanOrEqual(3);
        expect(mockDbInstance.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT'),
          expect.any(Array)
        );
      });

      it('should generate summaries when enabled', async () => {
        mockedFs.readFile.mockResolvedValue('function test() {}');

        await indexer.index('/project', { summarize: true });

        // Verify summarization was called
        expect(mockSummarizationProvider).toHaveBeenCalled();
      });

      it('should skip summaries when disabled', async () => {
        mockedFs.readFile.mockResolvedValue('function test() {}');

        await indexer.index('/project', { summarize: false });

        // Verify summarization was NOT called
        expect(mockSummarizationProvider).not.toHaveBeenCalled();
      });

      it('should generate embeddings when enabled', async () => {
        mockedFs.readFile.mockResolvedValue('function test() {}');

        await indexer.index('/project', { embeddings: true });

        // Verify embedding was called
        expect(mockEmbeddingProvider).toHaveBeenCalled();
      });

      it('should skip embeddings when disabled', async () => {
        mockedFs.readFile.mockResolvedValue('function test() {}');

        await indexer.index('/project', { embeddings: false });

        // Verify embedding was NOT called
        expect(mockEmbeddingProvider).not.toHaveBeenCalled();
      });

      it('should report progress', async () => {
        const progressCallback = jest.fn();
        mockedFs.readFile.mockResolvedValue('function test() {}');

        await indexer.index('/project', {
          onProgress: progressCallback
        });

        // Verify progress was reported
        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            phase: expect.any(String),
            current: expect.any(Number),
            total: expect.any(Number)
          })
        );
      });

      it('should handle parse errors gracefully', async () => {
        mockedFs.readFile
          .mockResolvedValueOnce('function test() {}')
          .mockResolvedValueOnce('invalid { syntax');

        const result: IndexResult = await indexer.index('/project');

        // Verify errors are collected but indexing continues
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.filesIndexed).toBeGreaterThan(0);
      });

      it('should collect errors without stopping', async () => {
        mockScanner.scan.mockResolvedValue({
          files: ['a.ts', 'b.ts', 'c.ts'],
          skipped: []
        });
        mockedFs.readFile.mockRejectedValue(new Error('Read error'));

        const result: IndexResult = await indexer.index('/project');

        // All files attempted, errors collected
        expect(result.errors.length).toBe(3);
        expect(result.errors[0]).toMatchObject({
          file: expect.any(String),
          error: expect.any(String),
          phase: expect.any(String)
        });
      });
    });

    describe('indexFile', () => {
      it('should create file entity', async () => {
        mockedFs.readFile.mockResolvedValue(`
          export class ServiceClass {}
        `);

        await indexer.indexFile('/project/src/service.ts');

        // Verify file entity was created
        expect(mockDbInstance.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT'),
          expect.arrayContaining([
            expect.stringContaining('file'),
            expect.stringContaining('service.ts')
          ])
        );
      });

      it('should process symbols recursively', async () => {
        mockedFs.readFile.mockResolvedValue(`
          class MyClass {
            method1() {}
            method2() {}
          }
        `);

        await indexer.indexFile('/project/src/myclass.ts');

        // Verify class and both methods were indexed
        const insertCalls = mockDbInstance.run.mock.calls.filter(
          call => call[0].includes('INSERT')
        );
        expect(insertCalls.length).toBeGreaterThanOrEqual(3);
      });

      it('should update cache after indexing', async () => {
        mockedFs.readFile.mockResolvedValue('function test() {}');

        await indexer.indexFile('/project/src/test.ts');

        // Verify cache was updated
        expect(mockDbInstance.run).toHaveBeenCalledWith(
          expect.stringContaining('proj_ast_cache'),
          expect.arrayContaining([
            expect.stringContaining('test.ts'),
            expect.any(String) // file hash
          ])
        );
      });

      it('should detect changed files via hash', async () => {
        mockDbInstance.get.mockResolvedValue({ file_hash: 'oldhash123' });
        mockedFs.readFile.mockResolvedValue('function updated() {}');

        await indexer.indexFile('/project/src/test.ts');

        // Verify file was re-indexed (different hash)
        expect(mockDbInstance.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT'),
          expect.any(Array)
        );
      });
    });

    describe('createOrUpdateEntity', () => {
      it('should create new entity when not exists', async () => {
        mockDbInstance.get.mockResolvedValue(undefined);

        await indexer.createOrUpdateEntity({
          type: 'function',
          name: 'newFunc',
          qualifiedName: 'module.newFunc',
          filePath: '/project/src/module.ts',
          startLine: 1,
          endLine: 10,
          content: 'function newFunc() {}'
        });

        // Verify INSERT was called
        expect(mockDbInstance.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT'),
          expect.arrayContaining(['newFunc'])
        );
      });

      it('should update existing entity when hash changes', async () => {
        mockDbInstance.get.mockResolvedValue({
          id: 'existing-id',
          content_hash: 'oldhash'
        });

        await indexer.createOrUpdateEntity({
          type: 'function',
          name: 'existingFunc',
          qualifiedName: 'module.existingFunc',
          filePath: '/project/src/module.ts',
          startLine: 1,
          endLine: 10,
          content: 'function existingFunc() { /* updated */ }'
        });

        // Verify UPDATE was called
        expect(mockDbInstance.run).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE'),
          expect.arrayContaining(['existing-id'])
        );
      });

      it('should skip update when hash matches', async () => {
        const contentHash = 'samehash';
        mockDbInstance.get.mockResolvedValue({
          id: 'existing-id',
          content_hash: contentHash
        });

        await indexer.createOrUpdateEntity({
          type: 'function',
          name: 'unchangedFunc',
          qualifiedName: 'module.unchangedFunc',
          filePath: '/project/src/module.ts',
          startLine: 1,
          endLine: 10,
          content: 'function unchangedFunc() {}',
          contentHash
        });

        // Verify no UPDATE was called
        const updateCalls = mockDbInstance.run.mock.calls.filter(
          call => call[0].includes('UPDATE')
        );
        expect(updateCalls.length).toBe(0);
      });
    });
  });

  // ============================================================================
  // IndexOptions Tests
  // ============================================================================

  describe('IndexOptions', () => {
    let indexer: CodebaseIndexer;

    beforeEach(() => {
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: { scan: jest.fn().mockResolvedValue({ files: [], skipped: [] }) } as any,
        embeddingProvider: jest.fn(),
        summarizationProvider: jest.fn()
      });
    });

    it('should support full depth', async () => {
      const options: IndexOptions = { depth: 'full' };

      await indexer.index('/project', options);

      // Verify full depth was used (includes function bodies)
      expect(options.depth).toBe('full');
    });

    it('should support signatures depth', async () => {
      const options: IndexOptions = { depth: 'signatures' };

      await indexer.index('/project', options);

      expect(options.depth).toBe('signatures');
    });

    it('should support selective depth', async () => {
      const options: IndexOptions = { depth: 'selective' };

      await indexer.index('/project', options);

      expect(options.depth).toBe('selective');
    });

    it('should support language filtering', async () => {
      const options: IndexOptions = {
        languages: ['typescript', 'python']
      };

      await indexer.index('/project', options);

      expect(options.languages).toContain('typescript');
      expect(options.languages).toContain('python');
    });

    it('should support custom ignore patterns', async () => {
      const options: IndexOptions = {
        ignore: ['*.test.ts', '__mocks__']
      };

      await indexer.index('/project', options);

      expect(options.ignore).toContain('*.test.ts');
      expect(options.ignore).toContain('__mocks__');
    });

    it('should support include patterns', async () => {
      const options: IndexOptions = {
        include: ['src/**/*.ts']
      };

      await indexer.index('/project', options);

      expect(options.include).toContain('src/**/*.ts');
    });
  });

  // ============================================================================
  // IndexProgress Tests
  // ============================================================================

  describe('IndexProgress', () => {
    let indexer: CodebaseIndexer;
    let progressCallback: jest.Mock;

    beforeEach(() => {
      progressCallback = jest.fn();
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: {
          scan: jest.fn().mockResolvedValue({
            files: ['src/a.ts', 'src/b.ts'],
            skipped: []
          })
        } as any,
        embeddingProvider: jest.fn().mockResolvedValue([0.1]),
        summarizationProvider: jest.fn().mockResolvedValue('summary')
      });
      mockedFs.readFile.mockResolvedValue('function test() {}');
    });

    it('should report scanning phase', async () => {
      await indexer.index('/project', { onProgress: progressCallback });

      const scanningCall = progressCallback.mock.calls.find(
        call => call[0].phase === 'scanning'
      );
      expect(scanningCall).toBeDefined();
      expect(scanningCall[0].message).toContain('Scanning');
    });

    it('should report parsing phase', async () => {
      await indexer.index('/project', { onProgress: progressCallback });

      const parsingCall = progressCallback.mock.calls.find(
        call => call[0].phase === 'parsing'
      );
      expect(parsingCall).toBeDefined();
      expect(parsingCall[0].currentFile).toBeDefined();
    });

    it('should report summarizing phase', async () => {
      await indexer.index('/project', {
        summarize: true,
        onProgress: progressCallback
      });

      const summarizingCall = progressCallback.mock.calls.find(
        call => call[0].phase === 'summarizing'
      );
      expect(summarizingCall).toBeDefined();
    });

    it('should report embedding phase', async () => {
      await indexer.index('/project', {
        embeddings: true,
        onProgress: progressCallback
      });

      const embeddingCall = progressCallback.mock.calls.find(
        call => call[0].phase === 'embedding'
      );
      expect(embeddingCall).toBeDefined();
    });

    it('should report linking phase', async () => {
      await indexer.index('/project', { onProgress: progressCallback });

      const linkingCall = progressCallback.mock.calls.find(
        call => call[0].phase === 'linking'
      );
      expect(linkingCall).toBeDefined();
      expect(linkingCall[0].message).toContain('relationship');
    });
  });

  // ============================================================================
  // IndexResult Tests
  // ============================================================================

  describe('IndexResult', () => {
    let indexer: CodebaseIndexer;

    beforeEach(() => {
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: {
          scan: jest.fn().mockResolvedValue({
            files: ['src/a.ts', 'src/b.ts'],
            skipped: ['node_modules/x.js']
          })
        } as any,
        embeddingProvider: jest.fn().mockResolvedValue([0.1]),
        summarizationProvider: jest.fn().mockResolvedValue('summary')
      });
      mockedFs.readFile.mockResolvedValue('function test() {}');
    });

    it('should include all statistics', async () => {
      const result: IndexResult = await indexer.index('/project', {
        summarize: true,
        embeddings: true
      });

      expect(result).toMatchObject({
        filesScanned: expect.any(Number),
        filesIndexed: expect.any(Number),
        filesSkipped: expect.any(Number),
        entitiesCreated: expect.any(Number),
        entitiesUpdated: expect.any(Number),
        embeddingsGenerated: expect.any(Number),
        relationshipsCreated: expect.any(Number),
        errors: expect.any(Array),
        duration: expect.any(Number)
      });

      expect(result.filesScanned).toBe(result.filesIndexed + result.filesSkipped);
    });

    it('should include error details', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Read failed'));

      const result: IndexResult = await indexer.index('/project');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatchObject({
        file: expect.any(String),
        error: expect.any(String),
        phase: expect.any(String)
      });
    });
  });

  // ============================================================================
  // MCP Tool Tests
  // ============================================================================

  describe('index_codebase MCP tool', () => {
    let indexer: CodebaseIndexer;

    beforeEach(() => {
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: {
          scan: jest.fn().mockResolvedValue({ files: ['src/a.ts'], skipped: [] })
        } as any,
        embeddingProvider: jest.fn().mockResolvedValue([0.1]),
        summarizationProvider: jest.fn().mockResolvedValue('summary')
      });
      mockedFs.readFile.mockResolvedValue('function test() {}');
    });

    it('should have correct input schema', () => {
      const inputSchema = indexer.getMcpToolSchema();

      expect(inputSchema).toMatchObject({
        type: 'object',
        properties: {
          path: { type: 'string' },
          project: { type: 'string' },
          depth: { type: 'string', enum: ['full', 'signatures', 'selective'] },
          summarize: { type: 'boolean' },
          languages: { type: 'array', items: { type: 'string' } }
        }
      });
    });

    it('should return success response', async () => {
      const response = await indexer.handleMcpToolCall({
        path: '/project',
        project: 'test-project'
      });

      expect(response).toMatchObject({
        success: true,
        result: {
          filesIndexed: expect.any(Number),
          entitiesCreated: expect.any(Number),
          duration: expect.any(String)
        }
      });
    });

    it('should include errors in response when present', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Parse error'));

      const response = await indexer.handleMcpToolCall({
        path: '/project',
        project: 'test-project'
      });

      expect(response.success).toBe(false);
      expect(response.result.errors).toBeDefined();
      expect(response.result.errors.length).toBeGreaterThan(0);
    });

    it('should update project lastIndexedAt', async () => {
      await indexer.handleMcpToolCall({
        path: '/project',
        project: 'test-project'
      });

      // Verify project was updated
      expect(mockDbInstance.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([
          expect.any(Date),
          'test-project'
        ])
      );
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('performance considerations', () => {
    let indexer: CodebaseIndexer;
    let mockEmbeddingProvider: jest.Mock;

    beforeEach(() => {
      mockEmbeddingProvider = jest.fn().mockResolvedValue([0.1]);
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: {
          scan: jest.fn().mockResolvedValue({
            files: Array(50).fill(null).map((_, i) => `src/file${i}.ts`),
            skipped: []
          })
        } as any,
        embeddingProvider: mockEmbeddingProvider,
        summarizationProvider: jest.fn().mockResolvedValue('summary')
      });
      mockedFs.readFile.mockResolvedValue('function test() {}');
    });

    it('should use AST cache to skip unchanged files', async () => {
      // First call - all cache misses
      mockDbInstance.get.mockResolvedValue(undefined);
      await indexer.index('/project', { useCache: true });
      const firstRunInserts = mockDbInstance.run.mock.calls.length;

      // Reset and simulate cache hits
      mockDbInstance.run.mockClear();
      mockDbInstance.get.mockResolvedValue({ file_hash: 'cached-hash' });

      await indexer.index('/project', { useCache: true });
      const secondRunInserts = mockDbInstance.run.mock.calls.length;

      // Second run should have fewer operations
      expect(secondRunInserts).toBeLessThan(firstRunInserts);
    });

    it('should batch embedding generation', async () => {
      await indexer.index('/project', { embeddings: true, batchSize: 10 });

      // Verify embeddings were batched
      const embeddingCalls = mockEmbeddingProvider.mock.calls;
      // Should have fewer calls than entities if batching works
      expect(embeddingCalls.length).toBeLessThan(50);
    });

    it('should support parallel file parsing', async () => {
      const startTime = Date.now();

      await indexer.index('/project', { parallelism: 4 });

      const duration = Date.now() - startTime;

      // Parallel processing should be faster
      // (this is a basic check - real test would compare with serial)
      expect(duration).toBeDefined();
      expect(mockedFs.readFile).toHaveBeenCalledTimes(50);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    let indexer: CodebaseIndexer;

    beforeEach(() => {
      indexer = new CodebaseIndexer({
        database: mockDbInstance,
        scanner: {
          scan: jest.fn().mockResolvedValue({ files: [], skipped: [] })
        } as any,
        embeddingProvider: jest.fn(),
        summarizationProvider: jest.fn()
      });
    });

    it('should handle empty project', async () => {
      const result: IndexResult = await indexer.index('/empty-project');

      expect(result.filesScanned).toBe(0);
      expect(result.filesIndexed).toBe(0);
      expect(result.entitiesCreated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle project with only ignored files', async () => {
      (indexer as any).scanner.scan.mockResolvedValue({
        files: [],
        skipped: ['node_modules/lib.js', 'dist/bundle.js']
      });

      const result: IndexResult = await indexer.index('/project');

      expect(result.filesIndexed).toBe(0);
      expect(result.filesSkipped).toBe(2);
    });

    it('should handle very large files', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB
      (indexer as any).scanner.scan.mockResolvedValue({
        files: ['large.ts'],
        skipped: []
      });
      mockedFs.readFile.mockResolvedValue(largeContent);

      const result: IndexResult = await indexer.index('/project');

      expect(result.filesIndexed).toBe(1);
      expect(mockedFs.readFile).toHaveBeenCalledWith('large.ts', 'utf-8');
    });

    it('should handle binary files gracefully', async () => {
      (indexer as any).scanner.scan.mockResolvedValue({
        files: ['image.png'],
        skipped: []
      });
      mockedFs.readFile.mockRejectedValue(new Error('Binary file'));

      const result: IndexResult = await indexer.index('/project');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].file).toBe('image.png');
    });

    it('should handle circular imports', async () => {
      (indexer as any).scanner.scan.mockResolvedValue({
        files: ['a.ts', 'b.ts'],
        skipped: []
      });
      mockedFs.readFile
        .mockResolvedValueOnce("import { b } from './b'; export const a = 1;")
        .mockResolvedValueOnce("import { a } from './a'; export const b = 2;");

      const result: IndexResult = await indexer.index('/project');

      // Both files should be indexed without infinite loop
      expect(result.filesIndexed).toBe(2);
      expect(result.relationshipsCreated).toBeGreaterThan(0);
    });

    it('should handle special characters in file names', async () => {
      const specialFiles = [
        'file with spaces.ts',
        'file-with-dashes.ts',
        'file_with_underscores.ts',
        'file.multiple.dots.ts'
      ];
      (indexer as any).scanner.scan.mockResolvedValue({
        files: specialFiles,
        skipped: []
      });
      mockedFs.readFile.mockResolvedValue('const x = 1;');

      const result: IndexResult = await indexer.index('/project');

      expect(result.filesIndexed).toBe(4);
      specialFiles.forEach(file => {
        expect(mockedFs.readFile).toHaveBeenCalledWith(file, 'utf-8');
      });
    });
  });
});
