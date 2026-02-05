/**
 * F7.4 CLI Interface Tests
 *
 * NOTE: These tests will fail until the actual implementations are created.
 * The imports reference source files that do not exist yet:
 * - src/cli/cli.ts (CLI, CommandHandler classes)
 * - src/cli/types.ts (Command, CommandResult, CommandOptions interfaces)
 * - src/cli/commands/index.ts (command implementations)
 * - src/services/project-service.ts (ProjectService)
 * - src/services/indexer-service.ts (IndexerService)
 * - src/services/search-service.ts (SearchService)
 * - src/services/mcp-server.ts (MCPServer)
 * - src/services/health-service.ts (HealthService)
 *
 * Tests for the command-line interface:
 * - Command parsing
 * - Init command
 * - Project management commands
 * - Index command
 * - Query command
 * - Serve command
 * - Stats command
 * - Doctor command
 *
 * @see docs/phase-7/F7.4-cli-interface.md
 */

// Import actual implementations from source paths
import { CLI, CommandHandler } from '../../src/cli/cli';
import { Command, CommandResult, CommandOptions, HealthCheck, ServerState } from '../../src/cli/types';
import { InitCommand } from '../../src/cli/commands/init';
import { ProjectCommand } from '../../src/cli/commands/project';
import { IndexCommand } from '../../src/cli/commands/index';
import { QueryCommand } from '../../src/cli/commands/query';
import { ServeCommand } from '../../src/cli/commands/serve';
import { StatsCommand } from '../../src/cli/commands/stats';
import { DoctorCommand } from '../../src/cli/commands/doctor';
import { SearchCommand } from '../../src/cli/commands/search';
import { SyncCommand } from '../../src/cli/commands/sync';
import { WatchCommand } from '../../src/cli/commands/watch';

// Import services to be mocked
import { ProjectService } from '../../src/project/project-service';
import { IndexerService } from '../../src/indexing/indexer-service';
import { SearchService } from '../../src/retrieval/search-service';
import { MCPServer } from '../../src/mcp/mcp-server-service';
import { HealthService } from '../../src/models/health-service';
import { Database } from '../../src/db/database';
import { FileWatcher } from '../../src/watch/file-watcher-service';
import { GitService } from '../../src/git/git-service';

// Mock all dependencies
jest.mock('../../src/services/project-service');
jest.mock('../../src/services/indexer-service');
jest.mock('../../src/services/search-service');
jest.mock('../../src/services/mcp-server');
jest.mock('../../src/services/health-service');
jest.mock('../../src/db/database');
jest.mock('../../src/services/file-watcher');
jest.mock('../../src/services/git-service');

describe('F7.4 CLI Interface', () => {
  // Mocked dependencies
  let mockDatabase: jest.Mocked<Database>;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockIndexerService: jest.Mocked<IndexerService>;
  let mockSearchService: jest.Mocked<SearchService>;
  let mockMCPServer: jest.Mocked<MCPServer>;
  let mockHealthService: jest.Mocked<HealthService>;
  let mockFileWatcher: jest.Mocked<FileWatcher>;
  let mockGitService: jest.Mocked<GitService>;

  // Real instances under test
  let cli: CLI;
  let commandHandler: CommandHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockDatabase = new Database() as jest.Mocked<Database>;
    mockProjectService = new ProjectService(mockDatabase) as jest.Mocked<ProjectService>;
    mockIndexerService = new IndexerService(mockDatabase) as jest.Mocked<IndexerService>;
    mockSearchService = new SearchService(mockDatabase) as jest.Mocked<SearchService>;
    mockMCPServer = new MCPServer() as jest.Mocked<MCPServer>;
    mockHealthService = new HealthService(mockDatabase) as jest.Mocked<HealthService>;
    mockFileWatcher = new FileWatcher() as jest.Mocked<FileWatcher>;
    mockGitService = new GitService() as jest.Mocked<GitService>;

    // Create real CLI instance with mocked dependencies
    cli = new CLI({
      database: mockDatabase,
      projectService: mockProjectService,
      indexerService: mockIndexerService,
      searchService: mockSearchService,
      mcpServer: mockMCPServer,
      healthService: mockHealthService,
      fileWatcher: mockFileWatcher,
      gitService: mockGitService
    });

    commandHandler = new CommandHandler(cli);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Init Command Tests
  // ============================================================================

  describe('init Command', () => {
    let initCommand: InitCommand;

    beforeEach(() => {
      initCommand = new InitCommand(mockProjectService);
    });

    it('should initialize a new project', async () => {
      const projectData = {
        id: 'proj-123',
        name: 'my-app',
        path: '/my-project'
      };

      mockProjectService.createProject.mockResolvedValue(projectData);

      const result = await initCommand.execute({
        path: '/my-project',
        name: 'my-app'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('my-app');
      expect(mockProjectService.createProject).toHaveBeenCalledWith({
        name: 'my-app',
        path: '/my-project'
      });
    });

    it('should use directory name as default project name', async () => {
      const projectData = {
        id: 'proj-456',
        name: 'awesome-project',
        path: '/path/to/awesome-project'
      };

      mockProjectService.createProject.mockResolvedValue(projectData);

      const result = await initCommand.execute({
        path: '/path/to/awesome-project'
      });

      expect(result.success).toBe(true);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'awesome-project'
        })
      );
    });

    it('should use current directory if no path specified', async () => {
      const cwd = process.cwd();
      const projectData = {
        id: 'proj-789',
        name: cwd.split('/').pop() || 'unnamed',
        path: cwd
      };

      mockProjectService.createProject.mockResolvedValue(projectData);

      const result = await initCommand.execute({});

      expect(result.success).toBe(true);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          path: cwd
        })
      );
    });
  });

  // ============================================================================
  // Project Management Commands Tests
  // ============================================================================

  describe('project Commands', () => {
    let projectCommand: ProjectCommand;

    beforeEach(() => {
      projectCommand = new ProjectCommand(mockProjectService);
    });

    describe('project list', () => {
      it('should list all projects', async () => {
        const projects = [
          { id: 'p1', name: 'project-a', path: '/projects/a' },
          { id: 'p2', name: 'project-b', path: '/projects/b' }
        ];

        mockProjectService.listProjects.mockResolvedValue(projects);

        const result = await projectCommand.list({});

        expect(result.success).toBe(true);
        expect(result.message).toContain('project-a');
        expect(result.message).toContain('project-b');
        expect(mockProjectService.listProjects).toHaveBeenCalled();
      });

      it('should output JSON when flag set', async () => {
        const projects = [
          { id: 'p1', name: 'project-a', path: '/projects/a' },
          { id: 'p2', name: 'project-b', path: '/projects/b' }
        ];

        mockProjectService.listProjects.mockResolvedValue(projects);

        const result = await projectCommand.list({ json: true });

        expect(result.data).toBeInstanceOf(Array);
        expect((result.data as any[])).toHaveLength(2);
      });
    });

    describe('project switch', () => {
      it('should switch to existing project', async () => {
        const project = { id: 'p1', name: 'my-project', path: '/projects/my-project' };

        mockProjectService.getProjectByName.mockResolvedValue(project);
        mockProjectService.setActiveProject.mockResolvedValue(undefined);

        const result = await projectCommand.switch('my-project');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Switched to');
        expect(mockProjectService.setActiveProject).toHaveBeenCalledWith('p1');
      });

      it('should fail for non-existent project', async () => {
        mockProjectService.getProjectByName.mockResolvedValue(null);

        const result = await projectCommand.switch('nonexistent');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('project delete', () => {
      it('should delete project and data', async () => {
        const project = { id: 'p1', name: 'old-project', path: '/projects/old-project' };

        mockProjectService.getProjectByName.mockResolvedValue(project);
        mockProjectService.deleteProject.mockResolvedValue(undefined);

        const result = await projectCommand.delete('old-project', {});

        expect(result.success).toBe(true);
        expect(result.message).toContain('Deleted');
        expect(mockProjectService.deleteProject).toHaveBeenCalledWith('p1', { keepData: false });
      });

      it('should preserve data with --keep-data flag', async () => {
        const project = { id: 'p1', name: 'old-project', path: '/projects/old-project' };

        mockProjectService.getProjectByName.mockResolvedValue(project);
        mockProjectService.deleteProject.mockResolvedValue(undefined);

        const result = await projectCommand.delete('old-project', { keepData: true });

        expect(result.success).toBe(true);
        expect(result.message).toContain('data preserved');
        expect(mockProjectService.deleteProject).toHaveBeenCalledWith('p1', { keepData: true });
      });
    });
  });

  // ============================================================================
  // Index Command Tests
  // ============================================================================

  describe('index Command', () => {
    let indexCommand: IndexCommand;

    beforeEach(() => {
      indexCommand = new IndexCommand(mockIndexerService, mockProjectService);
    });

    it('should index codebase', async () => {
      const indexResult = {
        files: 50,
        entities: 150,
        depth: 'full',
        summarized: true,
        embedded: true
      };

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockIndexerService.indexProject.mockResolvedValue(indexResult);

      const result = await indexCommand.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Indexed');
      expect(mockIndexerService.indexProject).toHaveBeenCalled();
    });

    it('should respect depth option', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockIndexerService.indexProject.mockResolvedValue({
        files: 50,
        entities: 100,
        depth: 'signatures',
        summarized: true,
        embedded: true
      });

      const result = await indexCommand.execute({ depth: 'signatures' });

      expect((result.data as any).depth).toBe('signatures');
      expect(mockIndexerService.indexProject).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ depth: 'signatures' })
      );
    });

    it('should skip summarization with flag', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockIndexerService.indexProject.mockResolvedValue({
        files: 50,
        entities: 150,
        depth: 'full',
        summarized: false,
        embedded: true
      });

      const result = await indexCommand.execute({ noSummarize: true });

      expect((result.data as any).summarized).toBe(false);
    });

    it('should skip embeddings with flag', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockIndexerService.indexProject.mockResolvedValue({
        files: 50,
        entities: 150,
        depth: 'full',
        summarized: true,
        embedded: false
      });

      const result = await indexCommand.execute({ noEmbeddings: true });

      expect((result.data as any).embedded).toBe(false);
    });

    it('should filter by languages', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockIndexerService.indexProject.mockResolvedValue({
        files: 30,
        entities: 80,
        depth: 'full',
        summarized: true,
        embedded: true
      });

      const result = await indexCommand.execute({ languages: 'typescript,python' });

      expect(result.success).toBe(true);
      expect(mockIndexerService.indexProject).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ languages: ['typescript', 'python'] })
      );
    });
  });

  // ============================================================================
  // Query Command Tests
  // ============================================================================

  describe('query Command', () => {
    let queryCommand: QueryCommand;

    beforeEach(() => {
      queryCommand = new QueryCommand(mockSearchService, mockProjectService);
    });

    it('should query and return context', async () => {
      const searchResults = [
        { entity_id: 'e1', name: 'AuthService', type: 'class', score: 0.95 },
        { entity_id: 'e2', name: 'login', type: 'function', score: 0.85 }
      ];

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.search.mockResolvedValue(searchResults);
      mockSearchService.assembleContext.mockResolvedValue({
        context: '### AuthService\nType: class',
        tokenCount: 50,
        sourceCount: 2,
        truncated: false
      });

      const result = await queryCommand.execute('authentication flow', {});

      expect(result.success).toBe(true);
      expect((result.data as any).context).toContain('AuthService');
      expect(mockSearchService.search).toHaveBeenCalledWith(
        'p1',
        'authentication flow',
        expect.anything()
      );
    });

    it('should respect max tokens', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.search.mockResolvedValue([]);
      mockSearchService.assembleContext.mockResolvedValue({
        context: '',
        tokenCount: 0,
        sourceCount: 0,
        truncated: false
      });

      const result = await queryCommand.execute('test', { maxTokens: '100' });

      expect(result.success).toBe(true);
      expect(mockSearchService.assembleContext).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ maxTokens: 100 })
      );
    });

    it('should use specified format', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.search.mockResolvedValue([]);
      mockSearchService.assembleContext.mockResolvedValue({
        context: '<context></context>',
        tokenCount: 10,
        sourceCount: 0,
        truncated: false,
        format: 'xml'
      });

      const result = await queryCommand.execute('test', { format: 'xml' });

      expect((result.data as any).format).toBe('xml');
    });

    it('should use specified strategies', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.search.mockResolvedValue([]);
      mockSearchService.assembleContext.mockResolvedValue({
        context: '',
        tokenCount: 0,
        sourceCount: 0,
        truncated: false
      });

      const result = await queryCommand.execute('test', { strategies: 'vector,fts' });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'p1',
        'test',
        expect.objectContaining({ strategies: ['vector', 'fts'] })
      );
      expect((result.data as any).strategies).toContain('vector');
      expect((result.data as any).strategies).toContain('fts');
      expect((result.data as any).strategies).not.toContain('graph');
    });
  });

  // ============================================================================
  // Serve Command Tests
  // ============================================================================

  describe('serve Command', () => {
    let serveCommand: ServeCommand;

    beforeEach(() => {
      serveCommand = new ServeCommand(mockMCPServer);
    });

    it('should start server in stdio mode', async () => {
      mockMCPServer.start.mockResolvedValue({
        running: true,
        mode: 'stdio'
      });

      const result = await serveCommand.execute({ stdio: true });

      expect(result.success).toBe(true);
      expect((result.data as ServerState).mode).toBe('stdio');
      expect(mockMCPServer.start).toHaveBeenCalledWith({ mode: 'stdio' });
    });

    it('should start server on specified port', async () => {
      mockMCPServer.start.mockResolvedValue({
        running: true,
        mode: 'http',
        port: 8080
      });

      const result = await serveCommand.execute({ port: '8080' });

      expect((result.data as ServerState).mode).toBe('http');
      expect((result.data as ServerState).port).toBe(8080);
      expect(mockMCPServer.start).toHaveBeenCalledWith({ mode: 'http', port: 8080 });
    });

    it('should use default port 3000', async () => {
      mockMCPServer.start.mockResolvedValue({
        running: true,
        mode: 'http',
        port: 3000
      });

      const result = await serveCommand.execute({});

      expect((result.data as ServerState).port).toBe(3000);
    });
  });

  // ============================================================================
  // Stats Command Tests
  // ============================================================================

  describe('stats Command', () => {
    let statsCommand: StatsCommand;

    beforeEach(() => {
      statsCommand = new StatsCommand(mockProjectService, mockDatabase);
    });

    it('should return project statistics', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockProjectService.getProjectStats.mockResolvedValue({
        entities: 500,
        relationships: 1200,
        files: 75,
        sessions: 10,
        databaseSize: '50.0MB'
      });

      const result = await statsCommand.execute({});

      expect(result.success).toBe(true);
      expect((result.data as any).entities).toBe(500);
      expect((result.data as any).relationships).toBe(1200);
    });

    it('should format database size', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockProjectService.getProjectStats.mockResolvedValue({
        entities: 500,
        relationships: 1200,
        files: 75,
        sessions: 10,
        databaseSize: '50.0MB'
      });

      const result = await statsCommand.execute({});

      expect((result.data as any).databaseSize).toBe('50.0MB');
    });
  });

  // ============================================================================
  // Doctor Command Tests
  // ============================================================================

  describe('doctor Command', () => {
    let doctorCommand: DoctorCommand;

    beforeEach(() => {
      doctorCommand = new DoctorCommand(mockHealthService);
    });

    it('should run health checks', async () => {
      const healthChecks: HealthCheck[] = [
        { name: 'Database', status: 'ok', message: 'SQLite connection OK' },
        { name: 'Ollama', status: 'ok', message: 'Available at localhost:11434' },
        { name: 'Config', status: 'ok', message: 'Configuration valid' }
      ];

      mockHealthService.runChecks.mockResolvedValue(healthChecks);

      const result = await doctorCommand.execute();

      expect(result.success).toBe(true);
      expect((result.data as HealthCheck[])).toBeInstanceOf(Array);
      expect(mockHealthService.runChecks).toHaveBeenCalled();
    });

    it('should check database connectivity', async () => {
      const healthChecks: HealthCheck[] = [
        { name: 'Database', status: 'ok', message: 'SQLite connection OK' },
        { name: 'Ollama', status: 'ok', message: 'Available' },
        { name: 'Config', status: 'ok', message: 'Valid' }
      ];

      mockHealthService.runChecks.mockResolvedValue(healthChecks);

      const result = await doctorCommand.execute();

      const dbCheck = (result.data as HealthCheck[]).find(c => c.name === 'Database');
      expect(dbCheck?.status).toBe('ok');
    });

    it('should check Ollama availability', async () => {
      const healthChecks: HealthCheck[] = [
        { name: 'Database', status: 'ok', message: 'OK' },
        { name: 'Ollama', status: 'ok', message: 'Available at localhost:11434' },
        { name: 'Config', status: 'ok', message: 'Valid' }
      ];

      mockHealthService.runChecks.mockResolvedValue(healthChecks);

      const result = await doctorCommand.execute();

      const ollamaCheck = (result.data as HealthCheck[]).find(c => c.name === 'Ollama');
      expect(ollamaCheck).toBeDefined();
    });
  });

  // ============================================================================
  // Search Command Tests
  // ============================================================================

  describe('search Command', () => {
    let searchCommand: SearchCommand;

    beforeEach(() => {
      searchCommand = new SearchCommand(mockSearchService, mockProjectService);
    });

    it('should search entities by term', async () => {
      const entities = [
        { id: 'e1', name: 'AuthService', type: 'class' },
        { id: 'e2', name: 'authenticate', type: 'function' },
        { id: 'e3', name: 'authMiddleware', type: 'function' }
      ];

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.searchEntities.mockResolvedValue(entities);

      const result = await searchCommand.execute('auth', {});

      expect(result.success).toBe(true);
      expect((result.data as any[]).length).toBeGreaterThan(0);
      expect(mockSearchService.searchEntities).toHaveBeenCalledWith('p1', 'auth', expect.anything());
    });

    it('should filter by entity type', async () => {
      const entities = [
        { id: 'e2', name: 'authenticate', type: 'function' },
        { id: 'e3', name: 'authMiddleware', type: 'function' }
      ];

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.searchEntities.mockResolvedValue(entities);

      const result = await searchCommand.execute('auth', { type: 'function' });

      expect((result.data as any[]).every((r: any) => r.type === 'function')).toBe(true);
    });
  });

  // ============================================================================
  // Sync Command Tests
  // ============================================================================

  describe('sync Command', () => {
    let syncCommand: SyncCommand;

    beforeEach(() => {
      syncCommand = new SyncCommand(mockGitService, mockIndexerService, mockProjectService);
    });

    it('should sync from git changes', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockGitService.getChangedFiles.mockResolvedValue([
        '/test/src/file1.ts',
        '/test/src/file2.ts'
      ]);
      mockIndexerService.reindexFiles.mockResolvedValue({
        changedFiles: 10,
        newEntities: 25,
        deletedEntities: 5
      });

      const result = await syncCommand.execute({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Synced');
      expect(mockGitService.getChangedFiles).toHaveBeenCalled();
      expect(mockIndexerService.reindexFiles).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Watch Command Tests
  // ============================================================================

  describe('watch Command', () => {
    let watchCommand: WatchCommand;

    beforeEach(() => {
      watchCommand = new WatchCommand(mockFileWatcher, mockIndexerService, mockProjectService);
    });

    it('should start watch mode', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockFileWatcher.start.mockResolvedValue({
        watching: true,
        debounce: 500
      });

      const result = await watchCommand.execute({});

      expect(result.success).toBe(true);
      expect((result.data as any).watching).toBe(true);
      expect(mockFileWatcher.start).toHaveBeenCalled();
    });

    it('should use custom debounce', async () => {
      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockFileWatcher.start.mockResolvedValue({
        watching: true,
        debounce: 1000
      });

      const result = await watchCommand.execute({ debounce: '1000' });

      expect((result.data as any).debounce).toBe(1000);
      expect(mockFileWatcher.start).toHaveBeenCalledWith(
        expect.objectContaining({ debounce: 1000 })
      );
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle missing required arguments', async () => {
      const queryCommand = new QueryCommand(mockSearchService, mockProjectService);

      const result = await queryCommand.execute('', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle invalid options', async () => {
      const queryCommand = new QueryCommand(mockSearchService, mockProjectService);

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });

      const result = await queryCommand.execute('test', { format: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid format');
    });

    it('should handle database errors', async () => {
      const statsCommand = new StatsCommand(mockProjectService, mockDatabase);

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockProjectService.getProjectStats.mockRejectedValue(
        new Error('SQLITE_ERROR: no such table')
      );

      const result = await statsCommand.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('SQLITE_ERROR');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty project list', async () => {
      const projectCommand = new ProjectCommand(mockProjectService);

      mockProjectService.listProjects.mockResolvedValue([]);

      const result = await projectCommand.list({});

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle special characters in project name', async () => {
      const initCommand = new InitCommand(mockProjectService);
      const name = 'my-project_v2.0';

      mockProjectService.createProject.mockResolvedValue({
        id: 'p1',
        name,
        path: '/projects/my-project_v2.0'
      });

      const result = await initCommand.execute({ name, path: '/projects/my-project_v2.0' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('my-project_v2.0');
    });

    it('should handle very long queries', async () => {
      const queryCommand = new QueryCommand(mockSearchService, mockProjectService);
      const longQuery = 'a'.repeat(1000);

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.search.mockResolvedValue([]);
      mockSearchService.assembleContext.mockResolvedValue({
        context: '',
        tokenCount: 0,
        sourceCount: 0,
        truncated: false
      });

      const result = await queryCommand.execute(longQuery, {});

      expect(result.success).toBe(true);
      expect(mockSearchService.search).toHaveBeenCalledWith('p1', longQuery, expect.anything());
    });

    it('should handle unicode in input', async () => {
      const queryCommand = new QueryCommand(mockSearchService, mockProjectService);
      const unicodeQuery = 'funcion 日本語 emoji';

      mockProjectService.getActiveProject.mockResolvedValue({
        id: 'p1',
        name: 'test',
        path: '/test'
      });
      mockSearchService.search.mockResolvedValue([]);
      mockSearchService.assembleContext.mockResolvedValue({
        context: '',
        tokenCount: 0,
        sourceCount: 0,
        truncated: false
      });

      const result = await queryCommand.execute(unicodeQuery, {});

      expect(result.success).toBe(true);
      expect(mockSearchService.search).toHaveBeenCalledWith('p1', unicodeQuery, expect.anything());
    });
  });
});
