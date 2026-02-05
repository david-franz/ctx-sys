/**
 * Phase 2 Integration Tests
 *
 * ============================================================================
 * IMPORTANT: These tests will FAIL until the actual implementations are created.
 * ============================================================================
 *
 * This test file imports from source paths that do not exist yet:
 * - src/parsers/ASTParser.ts
 * - src/indexers/CodebaseIndexer.ts
 * - src/summarizers/CodeSummarizer.ts
 * - src/extractors/RelationshipExtractor.ts
 * - src/sync/GitSync.ts
 * - src/pipelines/CodeIntelligencePipeline.ts
 *
 * Tests for how Phase 2 features interact with each other:
 * - AST Parsing + Symbol Summarization
 * - Codebase Indexing + AST Parsing
 * - Relationship Extraction + AST Parsing
 * - Git Sync + Codebase Indexing
 * - Full Code Intelligence Pipeline
 *
 * @see docs/IMPLEMENTATION.md Phase 2
 */

// =============================================================================
// Source Imports (implementations do not exist yet - tests will fail until created)
// =============================================================================
import { ASTParser, ParsedSymbol, ParsedImport, ParseResult } from '../../src/ast/ast-parser';
import { CodebaseIndexer, IndexingProgress, IndexingResult } from '../../src/indexing/codebase-indexer';
import { CodeSummarizer, SummaryResult } from '../../src/summarization/code-summarizer';
import { RelationshipExtractor, ExtractedRelationship } from '../../src/relationships/relationship-extractor';
import { GitSync, GitDiff, SyncResult } from '../../src/git/git-sync';
import { CodeIntelligencePipeline, PipelineResult } from '../../src/indexing/code-intelligence-pipeline';
import { Entity, Relationship } from '../../src/models/entity';
import { Database } from '../../src/db/database';
import { EmbeddingProvider } from '../../src/embeddings/provider';
import { SummarizationProvider } from '../../src/summarization/provider';

// =============================================================================
// External Dependency Mocks (only mock external services, not our implementations)
// =============================================================================

// Mock external LLM/embedding provider
const createMockEmbeddingProvider = (): jest.Mocked<EmbeddingProvider> => ({
  embed: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
  embedBatch: jest.fn().mockImplementation((texts: string[]) =>
    Promise.resolve(texts.map(() => new Array(1536).fill(0)))
  ),
  isAvailable: jest.fn().mockResolvedValue(true),
  getModelInfo: jest.fn().mockReturnValue({ name: 'mock-embedding', dimensions: 1536 })
});

// Mock external LLM summarization provider
const createMockSummarizationProvider = (): jest.Mocked<SummarizationProvider> => ({
  summarize: jest.fn().mockResolvedValue('Mock summary for symbol'),
  summarizeBatch: jest.fn().mockImplementation((items: Array<{ content: string }>) =>
    Promise.resolve(items.map(() => 'Mock batch summary'))
  ),
  isAvailable: jest.fn().mockResolvedValue(true),
  getModelInfo: jest.fn().mockReturnValue({ name: 'mock-summarizer' })
});

// Mock file system operations
const createMockFileSystem = () => {
  const files: Map<string, string> = new Map();
  return {
    mockFiles: (fileMap: Record<string, string>) => {
      Object.entries(fileMap).forEach(([path, content]) => files.set(path, content));
    },
    readFile: jest.fn().mockImplementation((path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`File not found: ${path}`);
      return Promise.resolve(content);
    }),
    exists: jest.fn().mockImplementation((path: string) => files.has(path)),
    reset: () => files.clear()
  };
};

// Mock database (external SQLite dependency)
const createMockDatabase = (): jest.Mocked<Database> => {
  let mockGetResult: unknown = undefined;
  let mockAllResult: unknown[] = [];

  return {
    run: jest.fn().mockReturnValue({ changes: 1 }),
    get: jest.fn().mockImplementation(() => mockGetResult),
    all: jest.fn().mockImplementation(() => mockAllResult),
    exec: jest.fn(),
    transaction: jest.fn().mockImplementation((fn: () => void) => fn()),
    mockGet: (result: unknown) => { mockGetResult = result; },
    mockAll: (results: unknown[]) => { mockAllResult = results; },
    reset: () => {
      mockGetResult = undefined;
      mockAllResult = [];
    },
    close: jest.fn()
  } as unknown as jest.Mocked<Database>;
};

// Utility function for content hashing
const hashContent = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

describe('Phase 2 Integration', () => {
  // Real class instances
  let astParser: ASTParser;
  let codebaseIndexer: CodebaseIndexer;
  let codeSummarizer: CodeSummarizer;
  let relationshipExtractor: RelationshipExtractor;
  let gitSync: GitSync;
  let pipeline: CodeIntelligencePipeline;

  // Mocked external dependencies
  let mockDb: jest.Mocked<Database>;
  let mockEmbeddingProvider: jest.Mocked<EmbeddingProvider>;
  let mockSummarizationProvider: jest.Mocked<SummarizationProvider>;
  let mockFs: ReturnType<typeof createMockFileSystem>;

  beforeEach(() => {
    // Initialize mocked external dependencies
    mockDb = createMockDatabase();
    mockEmbeddingProvider = createMockEmbeddingProvider();
    mockSummarizationProvider = createMockSummarizationProvider();
    mockFs = createMockFileSystem();

    // Create REAL instances with mocked external dependencies
    astParser = new ASTParser();
    codeSummarizer = new CodeSummarizer(mockSummarizationProvider);
    relationshipExtractor = new RelationshipExtractor(mockDb);
    codebaseIndexer = new CodebaseIndexer({
      database: mockDb,
      astParser,
      codeSummarizer,
      embeddingProvider: mockEmbeddingProvider
    });
    gitSync = new GitSync({
      database: mockDb,
      codebaseIndexer
    });
    pipeline = new CodeIntelligencePipeline({
      database: mockDb,
      astParser,
      codeSummarizer,
      relationshipExtractor,
      embeddingProvider: mockEmbeddingProvider,
      codebaseIndexer
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
    mockFs.reset();
  });

  // ============================================================================
  // AST Parsing + Symbol Summarization Integration
  // ============================================================================

  describe('AST Parsing + Symbol Summarization', () => {
    it('should parse code and generate summaries for extracted symbols', async () => {
      const code = `
        /**
         * Authenticates a user with username and password.
         */
        export function authenticate(username: string, password: string): Promise<User> {
          return validateCredentials(username, password);
        }
      `;

      // 1. Parse code using real ASTParser to extract symbols
      const parseResult: ParseResult = await astParser.parse(code, 'typescript');

      expect(parseResult.success).toBe(true);
      expect(parseResult.symbols).toHaveLength(1);

      const parsedSymbol = parseResult.symbols[0];
      expect(parsedSymbol.type).toBe('function');
      expect(parsedSymbol.name).toBe('authenticate');

      // 2. Use real CodeSummarizer to determine if docstring is good
      const summary = await codeSummarizer.summarizeSymbol(parsedSymbol);

      // Since docstring is good (>20 chars), should use it directly without LLM
      expect(summary).toBe('Authenticates a user with username and password.');
      expect(mockSummarizationProvider.summarize).not.toHaveBeenCalled();
    });

    it('should generate LLM summary when docstring is poor', async () => {
      const code = `
        // Process data
        function processData(data: any[]): ProcessedResult {
          const validated = data.filter(item => isValid(item));
          const transformed = validated.map(transform);
          return { items: transformed, count: transformed.length };
        }
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');
      const parsedSymbol = parseResult.symbols[0];

      // Docstring is too short/vague
      expect(parsedSymbol.docstring).toBe('Process data');

      // CodeSummarizer should use LLM for poor docstrings
      mockSummarizationProvider.summarize.mockResolvedValueOnce(
        'Filters and transforms an array of data items, returning validated and processed results with count.'
      );

      const summary = await codeSummarizer.summarizeSymbol(parsedSymbol);

      expect(mockSummarizationProvider.summarize).toHaveBeenCalled();
      expect(summary).toContain('filters');
    });

    it('should batch summarize multiple symbols efficiently', async () => {
      const code = `
        function func1() { return 1; }
        function func2() { return 2; }
        function func3() { return 3; }
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');
      expect(parseResult.symbols).toHaveLength(3);

      // Filter symbols needing summarization using real CodeSummarizer
      const symbolsNeedingSummary = parseResult.symbols.filter(
        s => codeSummarizer.needsSummarization(s)
      );
      expect(symbolsNeedingSummary).toHaveLength(3);

      // Batch summarize using real CodeSummarizer
      const summaries = await codeSummarizer.summarizeBatch(symbolsNeedingSummary);

      expect(mockSummarizationProvider.summarizeBatch).toHaveBeenCalled();
      expect(summaries).toHaveLength(3);
    });

    it('should create entities from parsed and summarized symbols', async () => {
      const projectId = 'proj_123';
      const code = `
        /**
         * Service for managing user operations including CRUD and authentication.
         */
        export class UserService {
          async findById(id: string): Promise<User> {
            return this.repository.findById(id);
          }
        }
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');
      expect(parseResult.symbols.length).toBeGreaterThan(0);

      const classSymbol = parseResult.symbols.find(s => s.type === 'class');
      expect(classSymbol).toBeDefined();

      // Summarize with real CodeSummarizer
      const summary = await codeSummarizer.summarizeSymbol(classSymbol!);

      // Create entity through real pipeline/indexer
      const entity = await codebaseIndexer.createEntityFromSymbol(
        projectId,
        classSymbol!,
        summary,
        'src/services/user.ts'
      );

      expect(entity.type).toBe('class');
      expect(entity.name).toBe('UserService');
      expect(entity.summary).toBeDefined();
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Codebase Indexing + AST Parsing Integration
  // ============================================================================

  describe('Codebase Indexing + AST Parsing', () => {
    it('should scan files and parse each for symbols', async () => {
      const projectPath = '/project';

      // Setup mock file system
      mockFs.mockFiles({
        '/project/src/auth.ts': 'export class Auth { login() {} }',
        '/project/src/user.ts': 'export class User { name: string; }',
        '/project/src/utils/helper.ts': 'export function helper() { return true; }'
      });

      // Use real CodebaseIndexer to scan and parse
      const result = await codebaseIndexer.indexDirectory(projectPath, {
        fileSystem: mockFs,
        extensions: ['.ts']
      });

      expect(result.filesProcessed).toBe(3);
      expect(result.entitiesCreated).toBeGreaterThan(0);

      // Verify ASTParser was used internally
      // The indexer should have parsed each file and found classes/functions
    });

    it('should respect gitignore when scanning and skip parsing ignored files', async () => {
      const projectPath = '/project';

      mockFs.mockFiles({
        '/project/.gitignore': 'node_modules/\ndist/\n*.test.ts',
        '/project/src/auth.ts': 'export class Auth {}',
        '/project/src/auth.test.ts': 'test("auth", () => {})',
        '/project/node_modules/dep/index.js': 'module.exports = {}',
        '/project/dist/bundle.js': 'var x = 1;'
      });

      // Real CodebaseIndexer should respect gitignore
      const result = await codebaseIndexer.indexDirectory(projectPath, {
        fileSystem: mockFs,
        respectGitignore: true
      });

      // Only auth.ts should be indexed
      expect(result.filesProcessed).toBe(1);
      expect(result.filesSkipped).toBe(3);
    });

    it('should use AST cache to skip unchanged files', async () => {
      const projectId = 'proj_123';
      const filePath = 'src/auth.ts';
      const content = 'export class Auth {}';
      const contentHash = hashContent(content);

      // Mock cache hit
      (mockDb as any).mockGet({
        file_path: filePath,
        content_hash: contentHash,
        symbols_json: JSON.stringify([{ type: 'class', name: 'Auth' }])
      });

      // Real CodebaseIndexer should check cache
      const shouldParse = await codebaseIndexer.shouldParseFile(projectId, filePath, content);

      expect(shouldParse).toBe(false);
      expect(mockDb.get).toHaveBeenCalled();
    });

    it('should update AST cache when file content changes', async () => {
      const projectId = 'proj_123';
      const filePath = 'src/auth.ts';
      const newContent = 'export class Auth { newMethod() {} }';

      // Mock cache miss (content changed)
      (mockDb as any).mockGet(undefined);

      // Real CodebaseIndexer should detect change and reparse
      const shouldParse = await codebaseIndexer.shouldParseFile(projectId, filePath, newContent);
      expect(shouldParse).toBe(true);

      // Parse and update cache
      const parseResult = await astParser.parse(newContent, 'typescript');
      await codebaseIndexer.updateCache(projectId, filePath, newContent, parseResult.symbols);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE'),
        expect.any(Array)
      );
    });

    it('should track indexing progress and report status', async () => {
      const projectPath = '/project';
      const progressUpdates: IndexingProgress[] = [];

      mockFs.mockFiles({
        '/project/src/a.ts': 'export const a = 1;',
        '/project/src/b.ts': 'export const b = 2;',
        '/project/src/c.ts': 'export const c = 3;'
      });

      // Real CodebaseIndexer with progress callback
      await codebaseIndexer.indexDirectory(projectPath, {
        fileSystem: mockFs,
        onProgress: (progress: IndexingProgress) => {
          progressUpdates.push(progress);
        }
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.processed).toBe(lastUpdate.total);
    });

    it('should create file entities with child symbol entities', async () => {
      const projectId = 'proj_123';
      const filePath = 'src/auth.ts';
      const code = `
        export class AuthService {
          login(username: string, password: string) {
            return this.validate(username, password);
          }
          private validate(u: string, p: string) {
            return true;
          }
        }
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');

      // Real CodebaseIndexer should create hierarchy
      const entities = await codebaseIndexer.createEntitiesWithHierarchy(
        projectId,
        filePath,
        parseResult.symbols
      );

      const fileEntity = entities.find(e => e.type === 'file');
      const classEntity = entities.find(e => e.type === 'class');
      const methodEntities = entities.filter(e => e.type === 'method');

      expect(fileEntity).toBeDefined();
      expect(classEntity?.parentId).toBe(fileEntity?.id);
      expect(methodEntities.every(m => m.parentId === classEntity?.id)).toBe(true);
    });
  });

  // ============================================================================
  // Relationship Extraction + AST Parsing Integration
  // ============================================================================

  describe('Relationship Extraction + AST Parsing', () => {
    it('should extract import relationships from parsed imports', async () => {
      const projectId = 'proj_123';
      const code = `
        import { User, UserRole } from './user';
        import { hashPassword } from '../utils/hash';
        import { sign, verify } from 'jsonwebtoken';

        export class AuthService {}
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');

      expect(parseResult.imports).toHaveLength(3);

      // Extract relationships using real RelationshipExtractor
      const relationships = await relationshipExtractor.extractFromImports(
        projectId,
        'src/auth.ts',
        parseResult.imports
      );

      expect(relationships).toHaveLength(3);
      expect(relationships.every(r => r.type === 'IMPORTS')).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should extract call relationships from parsed function calls', async () => {
      const projectId = 'proj_123';
      const code = `
        class AuthService {
          login(email: string, password: string) {
            const user = UserService.findByEmail(email);
            const hashed = hashPassword(password);
            const token = generateToken(user);
            return { user, token };
          }
        }
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');

      // Extract call relationships using real RelationshipExtractor
      const relationships = await relationshipExtractor.extractCallRelationships(
        projectId,
        parseResult.symbols
      );

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.some(r => r.type === 'CALLS')).toBe(true);
    });

    it('should extract inheritance relationships from parsed class extends', async () => {
      const projectId = 'proj_123';
      const code = `
        interface Serializable {
          serialize(): string;
        }

        interface Auditable {
          getAuditLog(): string[];
        }

        class User {
          name: string;
        }

        class AdminUser extends User implements Serializable, Auditable {
          serialize() { return JSON.stringify(this); }
          getAuditLog() { return []; }
        }
      `;

      // Parse with real ASTParser
      const parseResult = await astParser.parse(code, 'typescript');

      // Extract inheritance using real RelationshipExtractor
      const relationships = await relationshipExtractor.extractInheritanceRelationships(
        projectId,
        parseResult.symbols
      );

      const extendsRel = relationships.find(r => r.type === 'EXTENDS');
      const implementsRels = relationships.filter(r => r.type === 'IMPLEMENTS');

      expect(extendsRel).toBeDefined();
      expect(extendsRel?.targetName).toBe('User');
      expect(implementsRels).toHaveLength(2);
    });

    it('should resolve import paths to entity IDs', async () => {
      const projectId = 'proj_123';
      const sourceFile = 'src/services/auth.ts';
      const importPath = '../models/user';

      // Mock entity lookup
      (mockDb as any).mockGet({ id: 'entity_user_model', file_path: 'src/models/user.ts' });

      // Real RelationshipExtractor should resolve paths
      const resolvedId = await relationshipExtractor.resolveImportPath(
        projectId,
        sourceFile,
        importPath
      );

      expect(resolvedId).toBe('entity_user_model');
    });

    it('should handle circular dependencies gracefully', async () => {
      const projectId = 'proj_123';

      const codeA = `
        import { B } from './b';
        export class A { b: B; }
      `;
      const codeB = `
        import { A } from './a';
        export class B { a: A; }
      `;

      // Parse both files
      const parseResultA = await astParser.parse(codeA, 'typescript');
      const parseResultB = await astParser.parse(codeB, 'typescript');

      // Extract relationships - should handle circular deps
      const relsA = await relationshipExtractor.extractFromImports(
        projectId, 'src/a.ts', parseResultA.imports
      );
      const relsB = await relationshipExtractor.extractFromImports(
        projectId, 'src/b.ts', parseResultB.imports
      );

      // Both relationships should be stored without infinite loops
      expect(relsA).toHaveLength(1);
      expect(relsB).toHaveLength(1);
    });

    it('should traverse relationships using recursive queries', async () => {
      const projectId = 'proj_123';
      const startEntityId = 'entity_auth_service';
      const maxDepth = 3;

      // Mock traversal results
      (mockDb as any).mockAll([
        { entity_id: 'entity_user_service', depth: 1, path: 'auth->user' },
        { entity_id: 'entity_db', depth: 2, path: 'auth->user->db' },
        { entity_id: 'entity_cache', depth: 2, path: 'auth->user->cache' }
      ]);

      // Real RelationshipExtractor traversal
      const traversalResults = await relationshipExtractor.traverseRelationships(
        projectId,
        startEntityId,
        { type: 'CALLS', maxDepth }
      );

      expect(traversalResults).toHaveLength(3);
      expect(traversalResults[0].depth).toBe(1);
    });
  });

  // ============================================================================
  // Git Sync + Codebase Indexing Integration
  // ============================================================================

  describe('Git Sync + Codebase Indexing', () => {
    it('should detect changed files and re-index only those', async () => {
      const projectId = 'proj_123';
      const projectPath = '/project';

      // Mock git diff result
      const mockGitDiff: GitDiff = {
        modified: ['src/auth.ts'],
        added: ['src/new-feature.ts'],
        deleted: ['src/old-code.ts'],
        renamed: []
      };

      // Real GitSync should get diff and coordinate with CodebaseIndexer
      const syncResult = await gitSync.syncChanges(projectId, projectPath, {
        lastCommit: 'abc123',
        gitDiff: mockGitDiff
      });

      expect(syncResult.filesReindexed).toEqual(['src/auth.ts', 'src/new-feature.ts']);
      expect(syncResult.filesRemoved).toEqual(['src/old-code.ts']);
    });

    it('should handle renamed files by updating entity paths', async () => {
      const projectId = 'proj_123';
      const projectPath = '/project';

      const mockGitDiff: GitDiff = {
        modified: [],
        added: [],
        deleted: [],
        renamed: [{ oldPath: 'src/auth.ts', newPath: 'src/authentication.ts' }]
      };

      // Real GitSync should update paths
      await gitSync.syncChanges(projectId, projectPath, {
        lastCommit: 'abc123',
        gitDiff: mockGitDiff
      });

      // Should have updated both entities and cache
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining(['src/authentication.ts', 'src/auth.ts'])
      );
    });

    it('should delete entities for removed files', async () => {
      const projectId = 'proj_123';
      const deletedFile = 'src/deprecated.ts';

      // Mock entities to delete
      (mockDb as any).mockAll([
        { id: 'entity_1', type: 'class', name: 'DeprecatedService' },
        { id: 'entity_2', type: 'function', name: 'oldFunction' }
      ]);

      // Real GitSync/CodebaseIndexer should clean up
      await codebaseIndexer.removeFile(projectId, deletedFile);

      // Should delete relationships, embeddings, entities, and cache
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      );
    });

    it('should track sync commit after successful indexing', async () => {
      const projectId = 'proj_123';
      const newCommitHash = 'def456';

      // Real GitSync should update project record
      await gitSync.recordSyncCommit(projectId, newCommitHash);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('last_sync_commit'),
        expect.arrayContaining([newCommitHash, projectId])
      );
    });

    it('should handle uncommitted changes in sync', async () => {
      const projectId = 'proj_123';
      const projectPath = '/project';

      mockFs.mockFiles({
        '/project/src/wip.ts': 'export const wip = true;'
      });

      // Real GitSync with uncommitted changes
      const result = await gitSync.syncChanges(projectId, projectPath, {
        includeUncommitted: true,
        fileSystem: mockFs
      });

      // Should index but not update sync commit
      expect(result.indexedUncommitted).toBe(true);
      expect(result.syncCommitUpdated).toBe(false);
    });

    it('should generate sync report with statistics', async () => {
      const projectId = 'proj_123';
      const projectPath = '/project';

      mockFs.mockFiles({
        '/project/src/a.ts': 'export const a = 1;',
        '/project/src/b.ts': 'export const b = 2;'
      });

      // Real GitSync should return detailed report
      const report: SyncResult = await gitSync.syncChanges(projectId, projectPath, {
        fileSystem: mockFs,
        generateReport: true
      });

      expect(report).toHaveProperty('filesScanned');
      expect(report).toHaveProperty('filesIndexed');
      expect(report).toHaveProperty('entitiesCreated');
      expect(report).toHaveProperty('relationshipsCreated');
      expect(report).toHaveProperty('duration');
      expect(report).toHaveProperty('errors');
    });
  });

  // ============================================================================
  // Full Code Intelligence Pipeline Integration
  // ============================================================================

  describe('Full Code Intelligence Pipeline', () => {
    it('should process new file through complete pipeline', async () => {
      const projectId = 'proj_123';
      const filePath = 'src/services/payment.ts';
      const fileContent = `
        import { User } from '../models/user';
        import { Logger } from '../utils/logger';

        /**
         * Handles payment processing for users.
         */
        export class PaymentService {
          private logger: Logger;

          constructor() {
            this.logger = new Logger('PaymentService');
          }

          async processPayment(user: User, amount: number): Promise<boolean> {
            this.logger.info('Processing payment', { userId: user.id, amount });
            return true;
          }
        }
      `;

      // Mock cache miss
      (mockDb as any).mockGet(undefined);

      // Process through real pipeline
      const result: PipelineResult = await pipeline.processFile(
        projectId,
        filePath,
        fileContent
      );

      // Verify full pipeline execution
      expect(result.parsed).toBe(true);
      expect(result.summarized).toBe(true);
      expect(result.entitiesCreated).toBeGreaterThan(0);
      expect(result.relationshipsExtracted).toBeGreaterThan(0);
      expect(result.embeddingsGenerated).toBeGreaterThan(0);
      expect(result.cached).toBe(true);

      // Good docstring should not trigger LLM
      expect(mockSummarizationProvider.summarize).toHaveBeenCalledTimes(1); // Only for processPayment method
      expect(mockEmbeddingProvider.embed).toHaveBeenCalled();
    });

    it('should handle file modification through pipeline', async () => {
      const projectId = 'proj_123';
      const filePath = 'src/services/auth.ts';

      // Old version had 2 methods
      (mockDb as any).mockAll([
        { id: 'entity_login', name: 'login' },
        { id: 'entity_logout', name: 'logout' }
      ]);

      const newContent = `
        export class AuthService {
          login() {}
          logout() {}
          refreshToken() {} // New method
        }
      `;

      // Process modification through real pipeline
      const result = await pipeline.processFileModification(
        projectId,
        filePath,
        newContent
      );

      expect(result.entitiesUpdated).toBeGreaterThan(0);
      expect(result.entitiesCreated).toBe(1); // refreshToken
      expect(result.entitiesDeleted).toBe(0);
    });

    it('should process batch of files efficiently', async () => {
      const projectId = 'proj_123';
      const files = [
        { path: 'src/a.ts', content: 'export const a = 1;' },
        { path: 'src/b.ts', content: 'export const b = 2;' },
        { path: 'src/c.ts', content: 'export const c = 3;' },
        { path: 'src/d.ts', content: 'export const d = 4;' },
        { path: 'src/e.ts', content: 'export const e = 5;' }
      ];

      // Real pipeline batch processing
      const results = await pipeline.processFilesBatch(projectId, files, {
        batchSize: 2,
        useTransaction: true
      });

      expect(results.filesProcessed).toBe(5);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockEmbeddingProvider.embedBatch).toHaveBeenCalled();
    });

    it('should rebuild relationships after full reindex', async () => {
      const projectId = 'proj_123';

      // Real pipeline full reindex
      await pipeline.fullReindex(projectId, {
        clearExisting: true,
        rebuildRelationships: true
      });

      // Should clear and rebuild
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle parse errors gracefully', async () => {
      const invalidCode = 'export class { invalid syntax }}}';

      // Real ASTParser should handle gracefully
      const parseResult = await astParser.parse(invalidCode, 'typescript');

      expect(parseResult.success).toBe(false);
      expect(parseResult.error).toBeDefined();
      expect(parseResult.symbols).toHaveLength(0);
    });

    it('should handle summarization provider failure', async () => {
      mockSummarizationProvider.isAvailable.mockResolvedValueOnce(false);
      mockSummarizationProvider.summarize.mockRejectedValueOnce(new Error('Provider unavailable'));

      const symbol: ParsedSymbol = {
        type: 'function',
        name: 'myFunc',
        content: 'function myFunc() {}',
        docstring: null,
        startLine: 1,
        endLine: 1
      };

      // Real CodeSummarizer should handle failure
      const summary = await codeSummarizer.summarizeSymbol(symbol);

      // Should return null or empty when provider fails
      expect(summary).toBeNull();
    });

    it('should handle relationship extraction for unresolved imports', async () => {
      const projectId = 'proj_123';
      const imports: ParsedImport[] = [{
        path: 'non-existent-package',
        symbols: ['Something'],
        isExternal: true
      }];

      // Mock no entity found
      (mockDb as any).mockGet(undefined);

      // Real RelationshipExtractor should mark as external
      const relationships = await relationshipExtractor.extractFromImports(
        projectId,
        'src/app.ts',
        imports
      );

      expect(relationships[0].metadata?.external).toBe(true);
    });

    it('should handle git operations failing', async () => {
      const projectId = 'proj_123';
      const projectPath = '/not-a-git-repo';

      // Real GitSync should handle gracefully
      const result = await gitSync.syncChanges(projectId, projectPath, {
        onGitError: 'fallback-to-full-scan'
      });

      expect(result.usedFullScan).toBe(true);
    });

    it('should handle very large files', async () => {
      const largeContent = 'x'.repeat(1_000_000);

      // Real pipeline should skip large files
      const result = await pipeline.processFile(
        'proj_123',
        'src/huge.ts',
        largeContent,
        { maxFileSize: 500_000 }
      );

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('size');
    });

    it('should handle concurrent file modifications', async () => {
      const projectId = 'proj_123';
      const filePath = 'src/concurrent.ts';

      // Simulate content changing during processing
      let callCount = 0;
      mockFs.readFile.mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? 'version1' : 'version2');
      });

      // Real pipeline should detect and re-queue
      const result = await pipeline.processFile(
        projectId,
        filePath,
        'version1',
        { verifyContentHash: true, fileSystem: mockFs }
      );

      expect(result.needsReprocess).toBe(true);
    });
  });

  // ============================================================================
  // Performance and Optimization
  // ============================================================================

  describe('Performance', () => {
    it('should use prepared statements for repeated queries', async () => {
      const projectId = 'proj_123';

      // Create many entities
      const symbols: ParsedSymbol[] = Array(100).fill(null).map((_, i) => ({
        type: 'function' as const,
        name: `func${i}`,
        content: `function func${i}() {}`,
        docstring: null,
        startLine: i,
        endLine: i
      }));

      // Real CodebaseIndexer should batch efficiently
      await codebaseIndexer.createEntitiesBatch(projectId, symbols, 'src/many.ts');

      // Should use transaction for batch
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should batch embedding generation', async () => {
      const contents = Array(50).fill(null).map((_, i) => `Content ${i}`);

      // Real pipeline batches embeddings
      await pipeline.generateEmbeddingsBatch('proj_123', contents);

      expect(mockEmbeddingProvider.embedBatch).toHaveBeenCalledWith(contents);
    });

    it('should limit relationship traversal depth', async () => {
      const projectId = 'proj_123';
      const maxDepth = 5;

      // Mock deep traversal
      (mockDb as any).mockAll(
        Array(10).fill(null).map((_, i) => ({
          entity_id: `e${i}`,
          depth: i + 1
        }))
      );

      // Real RelationshipExtractor should respect depth limit
      const results = await relationshipExtractor.traverseRelationships(
        projectId,
        'entity_root',
        { type: 'CALLS', maxDepth }
      );

      expect(results.every(r => r.depth <= maxDepth)).toBe(true);
    });

    it('should skip unchanged files using content hash', async () => {
      const projectId = 'proj_123';
      const files = [
        { path: 'src/a.ts', content: 'const a = 1;' },
        { path: 'src/b.ts', content: 'const b = 2;' },
        { path: 'src/c.ts', content: 'const c = 3;' }
      ];

      // Mock cache - only b.ts changed
      (mockDb as any).mockGet.mockImplementation((query: string, params: any[]) => {
        const path = params[0];
        if (path === 'src/b.ts') return undefined; // Cache miss
        return { file_path: path, content_hash: hashContent(files.find(f => f.path === path)!.content) };
      });

      // Real CodebaseIndexer should only process changed files
      const result = await codebaseIndexer.indexFilesBatch(projectId, files);

      expect(result.filesProcessed).toBe(1);
      expect(result.filesSkipped).toBe(2);
    });
  });

  // ============================================================================
  // Multi-Language Support
  // ============================================================================

  describe('Multi-Language Support', () => {
    it('should route files to appropriate language parsers', async () => {
      const files = [
        { path: 'src/app.ts', content: 'export class App {}' },
        { path: 'src/utils.py', content: 'class Utils: pass' },
        { path: 'src/main.go', content: 'type Main struct {}' }
      ];

      // Real ASTParser should detect and parse each language
      for (const file of files) {
        const ext = file.path.split('.').pop()!;
        const language = astParser.detectLanguage(ext);
        const result = await astParser.parse(file.content, language);

        expect(result.success).toBe(true);
        expect(result.symbols.length).toBeGreaterThan(0);
      }
    });

    it('should handle mixed-language projects', async () => {
      const projectPath = '/mixed-project';

      mockFs.mockFiles({
        '/mixed-project/src/app.ts': 'export class App {}',
        '/mixed-project/scripts/build.py': 'def build(): pass',
        '/mixed-project/server/main.go': 'func main() {}'
      });

      // Real CodebaseIndexer should handle all languages
      const result = await codebaseIndexer.indexDirectory(projectPath, {
        fileSystem: mockFs
      });

      expect(result.languageStats).toEqual({
        typescript: 1,
        python: 1,
        go: 1
      });
    });

    it('should skip unsupported file types', async () => {
      const projectPath = '/project';

      mockFs.mockFiles({
        '/project/src/app.ts': 'export class App {}',
        '/project/src/style.css': '.class { color: red; }',
        '/project/src/image.png': 'binary data',
        '/project/src/data.json': '{"key": "value"}'
      });

      // Real CodebaseIndexer should only process supported types
      const result = await codebaseIndexer.indexDirectory(projectPath, {
        fileSystem: mockFs
      });

      expect(result.filesProcessed).toBe(1);
      expect(result.filesSkipped).toBe(3);
    });
  });
});
