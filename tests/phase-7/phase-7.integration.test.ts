/**
 * Phase 7 Integration Tests
 *
 * IMPORTANT: This test file will fail with "Cannot find module" errors until
 * the actual implementations are created. This is intentional - the tests
 * serve as a specification for what needs to be built.
 *
 * Required source files to implement:
 * - src/config/manager.ts              - ConfigManager class
 * - src/config/types.ts                - GlobalConfig, ProjectConfig interfaces
 * - src/providers/factory.ts           - ProviderFactory class
 * - src/providers/model-abstraction.ts - ModelAbstraction class
 * - src/watch/manager.ts               - WatchModeManager class
 * - src/watch/file-watcher.ts          - FileWatcher class
 * - src/cli/interface.ts               - CliInterface class
 * - src/cli/commands.ts                - CLI command implementations
 * - src/indexing/indexer.ts            - Indexer class
 * - src/database/connection.ts         - DatabaseConnection class
 *
 * Tests for feature interactions within Phase 7 - Configuration & Polish:
 * - Configuration + Provider Factory
 * - Provider Factory + Watch Mode
 * - CLI + All Features
 * - Full system integration
 *
 * @see docs/phase-7/
 */

// Import actual implementations (these don't exist yet - will cause test failures)
import { ConfigManager } from '../../src/config/manager';
import { GlobalConfig, ProjectConfig } from '../../src/config/types';
import { ProviderFactory } from '../../src/models/factory';
import { ModelAbstraction } from '../../src/models/model-abstraction';
import { WatchModeManager } from '../../src/watch/manager';
import { FileWatcher, WatchEvent } from '../../src/watch/file-watcher';
import { CliInterface, CommandResult } from '../../src/cli/interface';
import { Indexer } from '../../src/indexing/indexer';
import { DatabaseConnection } from '../../src/db/connection';

// Mock dependencies
import { createMockDatabase } from '../helpers/mocks';

// Mock the database connection
jest.mock('../../src/db/connection', () => ({
  DatabaseConnection: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({ changes: 0 }),
    isConnected: jest.fn().mockReturnValue(true)
  }))
}));

// Mock the model abstraction for provider calls
jest.mock('../../src/providers/model-abstraction', () => ({
  ModelAbstraction: jest.fn().mockImplementation(() => ({
    generateEmbedding: jest.fn().mockResolvedValue(new Array(384).fill(0)),
    summarize: jest.fn().mockResolvedValue('Mock summary'),
    isAvailable: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock file system operations for watch mode
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  watch: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('{}')
}));

describe('Phase 7 Integration Tests', () => {
  let mockDb: ReturnType<typeof createMockDatabase>;
  let configManager: ConfigManager;
  let providerFactory: ProviderFactory;
  let watchManager: WatchModeManager;
  let cli: CliInterface;
  let indexer: Indexer;
  let dbConnection: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    mockDb = createMockDatabase();
    dbConnection = new DatabaseConnection(':memory:') as jest.Mocked<DatabaseConnection>;
    configManager = new ConfigManager();
    providerFactory = new ProviderFactory(configManager);
    watchManager = new WatchModeManager(configManager);
    indexer = new Indexer(dbConnection, providerFactory);
    cli = new CliInterface(configManager, providerFactory, indexer, watchManager);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockDb.reset();
    jest.useRealTimers();
  });

  // ============================================================================
  // Configuration + Provider Factory Integration
  // ============================================================================

  describe('Configuration + Provider Factory', () => {
    it('should create provider from global config defaults', async () => {
      const globalConfig = await configManager.loadGlobal();
      const provider = await providerFactory.getEmbeddingProvider();

      expect(provider.modelId).toBe('ollama:nomic-embed-text');
      expect(globalConfig.defaults.embeddings.provider).toBe('ollama');
      expect(globalConfig.defaults.embeddings.model).toBe('nomic-embed-text');
    });

    it('should override provider with project config', async () => {
      const projectConfig: ProjectConfig = {
        project: { name: 'my-project' },
        indexing: { mode: 'full', watch: false, ignore: [] },
        summarization: { enabled: true, provider: 'openai', model: 'gpt-4o-mini' },
        embeddings: { provider: 'openai', model: 'text-embedding-3-small' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 8000, strategies: ['vector'] }
      };

      await configManager.setProjectConfig('/my-project', projectConfig);
      const provider = await providerFactory.getEmbeddingProvider('/my-project');

      expect(provider.modelId).toBe('openai:text-embedding-3-small');
      expect(configManager.setProjectConfig).toHaveBeenCalledWith('/my-project', projectConfig);
    });

    it('should use project-specific summarization model', async () => {
      const projectConfig: ProjectConfig = {
        project: { name: 'project' },
        indexing: { mode: 'incremental', watch: false, ignore: [] },
        summarization: { enabled: true, provider: 'anthropic', model: 'claude-3-haiku' },
        embeddings: { provider: 'ollama', model: 'nomic-embed-text' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      };

      await configManager.setProjectConfig('/project', projectConfig);
      const provider = await providerFactory.getSummarizationProvider('/project');

      expect(provider.modelId).toBe('anthropic:claude-3-haiku');
    });

    it('should respect disabled summarization', async () => {
      const projectConfig: ProjectConfig = {
        project: { name: 'test' },
        indexing: { mode: 'incremental', watch: false, ignore: [] },
        summarization: { enabled: false, provider: 'ollama', model: 'test' },
        embeddings: { provider: 'ollama', model: 'test' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      };

      await configManager.setProjectConfig('/test', projectConfig);
      const loadedConfig = await configManager.loadProject('/test');

      expect(loadedConfig.summarization.enabled).toBe(false);
      expect(providerFactory.isSummarizationEnabled('/test')).resolves.toBe(false);
    });
  });

  // ============================================================================
  // Provider Factory + Watch Mode Integration
  // ============================================================================

  describe('Provider Factory + Watch Mode', () => {
    let fileWatcher: FileWatcher;

    beforeEach(() => {
      fileWatcher = new FileWatcher('/project', { ignore: ['node_modules'] });
    });

    it('should re-index files on change using configured provider', async () => {
      const mockEvent: WatchEvent = {
        type: 'change',
        path: '/src/app.ts',
        timestamp: new Date()
      };

      watchManager.start('/project');
      fileWatcher.emit('change', mockEvent);

      // Allow event processing
      await jest.runAllTimersAsync();

      expect(indexer.indexFile).toHaveBeenCalledWith('/src/app.ts');
      expect(providerFactory.getEmbeddingProvider).toHaveBeenCalled();
    });

    it('should handle file deletions', async () => {
      const mockEvent: WatchEvent = {
        type: 'delete',
        path: '/src/removed.ts',
        timestamp: new Date()
      };

      watchManager.start('/project');
      fileWatcher.emit('delete', mockEvent);

      await jest.runAllTimersAsync();

      expect(indexer.deleteFile).toHaveBeenCalledWith('/src/removed.ts');
    });

    it('should skip summarization when disabled', async () => {
      const projectConfig: ProjectConfig = {
        project: { name: 'test' },
        indexing: { mode: 'incremental', watch: false, ignore: [] },
        summarization: { enabled: false, provider: 'ollama', model: 'test' },
        embeddings: { provider: 'ollama', model: 'test' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      };

      await configManager.setProjectConfig('/project', projectConfig);
      await indexer.indexFile('/src/test.ts');

      expect(indexer.indexFile).toHaveBeenCalledWith('/src/test.ts');
      expect(providerFactory.getSummarizationProvider).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CLI + Configuration Integration
  // ============================================================================

  describe('CLI + Configuration', () => {
    it('should initialize project with default config', async () => {
      const result = await cli.init({ path: '/my-project', name: 'my-app' });

      expect(result.success).toBe(true);
      expect((result.data as ProjectConfig).project.name).toBe('my-app');
      expect(configManager.setProjectConfig).toHaveBeenCalled();
    });

    it('should get config values', async () => {
      await cli.init({ path: '/project' });
      const result = await cli.configGet('/project', 'indexing.mode');

      expect(result.success).toBe(true);
      expect(result.data).toBe('incremental');
      expect(configManager.loadProject).toHaveBeenCalledWith('/project');
    });

    it('should set config values', async () => {
      await cli.init({ path: '/project' });
      await cli.configSet('/project', 'indexing.mode', 'full');
      const result = await cli.configGet('/project', 'indexing.mode');

      expect(result.data).toBe('full');
      expect(configManager.updateProjectConfig).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // CLI + Indexing + Provider Integration
  // ============================================================================

  describe('CLI + Indexing + Provider', () => {
    it('should index with configured providers', async () => {
      const projectConfig: ProjectConfig = {
        project: { name: 'test' },
        indexing: { mode: 'full', watch: false, ignore: ['node_modules'] },
        summarization: { enabled: true, provider: 'ollama', model: 'qwen2.5-coder:7b' },
        embeddings: { provider: 'ollama', model: 'nomic-embed-text' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      };

      await configManager.setProjectConfig('/project', projectConfig);
      const result = await cli.index('/project');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        provider: {
          embeddings: 'ollama:nomic-embed-text',
          summarization: 'ollama:qwen2.5-coder:7b'
        }
      });
      expect(indexer.indexDirectory).toHaveBeenCalledWith('/project', expect.any(Object));
    });

    it('should respect indexing mode from config', async () => {
      const modes: Array<'full' | 'incremental' | 'manual'> = ['full', 'incremental', 'manual'];

      for (const mode of modes) {
        const projectConfig: ProjectConfig = {
          project: { name: 'test' },
          indexing: { mode, watch: false, ignore: [] },
          summarization: { enabled: true, provider: 'ollama', model: 'test' },
          embeddings: { provider: 'ollama', model: 'test' },
          sessions: { retention: 30, auto_summarize: true },
          retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
        };

        await configManager.setProjectConfig(`/project-${mode}`, projectConfig);
        const loadedConfig = await configManager.loadProject(`/project-${mode}`);

        expect(loadedConfig.indexing.mode).toBe(mode);
      }
    });

    it('should apply ignore patterns during indexing', async () => {
      const projectConfig: ProjectConfig = {
        project: { name: 'test' },
        indexing: { mode: 'full', watch: false, ignore: ['node_modules', '.git', '*.test.ts'] },
        summarization: { enabled: true, provider: 'ollama', model: 'test' },
        embeddings: { provider: 'ollama', model: 'test' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      };

      await configManager.setProjectConfig('/project', projectConfig);
      await cli.index('/project');

      expect(indexer.indexDirectory).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          ignore: ['node_modules', '.git', '*.test.ts']
        })
      );
    });
  });

  // ============================================================================
  // Full System Integration
  // ============================================================================

  describe('Full System Integration', () => {
    it('should initialize complete system from config', async () => {
      // Step 1: Load configuration
      const globalConfig = await configManager.loadGlobal();

      expect(globalConfig.database.path).toBe('~/.ctx-sys/ctx-sys.db');
      expect(globalConfig.providers.ollama?.base_url).toBe('http://localhost:11434');

      // Step 2: Initialize project
      const initResult = await cli.init({ path: '/projects/my-app', name: 'my-app' });
      expect(initResult.success).toBe(true);

      // Step 3: Get providers
      const embeddingProvider = await providerFactory.getEmbeddingProvider('/projects/my-app');
      const summarizationProvider = await providerFactory.getSummarizationProvider('/projects/my-app');

      expect(embeddingProvider.available).toBe(true);
      expect(summarizationProvider.available).toBe(true);

      // Step 4: Start watcher
      const projectConfig = await configManager.loadProject('/projects/my-app');
      if (projectConfig.indexing.watch) {
        watchManager.start('/projects/my-app');
        expect(watchManager.isRunning('/projects/my-app')).toBe(true);
      }
    });

    it('should handle provider fallback in system', async () => {
      // Mock primary provider as unavailable
      (providerFactory.getEmbeddingProvider as jest.Mock).mockResolvedValueOnce({
        modelId: 'ollama:nomic-embed-text',
        available: false
      });

      // Should fall back to secondary provider
      const provider = await providerFactory.getEmbeddingProviderWithFallback('/project');

      expect(provider.modelId).toBe('openai:text-embedding-3-small');
      expect(provider.available).toBe(true);
      expect(providerFactory.getEmbeddingProvider).toHaveBeenCalledTimes(2);
    });

    it('should process complete CLI workflow', async () => {
      // 1. Init project
      const initResult = await cli.init({ path: '/projects/my-app', name: 'my-app' });
      expect(initResult.success).toBe(true);

      // 2. Index codebase
      const indexResult = await cli.index('/projects/my-app');
      expect(indexResult.success).toBe(true);
      expect(indexer.indexDirectory).toHaveBeenCalled();

      // 3. Start watch mode
      const watchResult = await cli.watch('/projects/my-app');
      expect(watchResult.success).toBe(true);
      expect(watchManager.start).toHaveBeenCalledWith('/projects/my-app');

      // 4. Query context
      const queryResult = await cli.query('/projects/my-app', 'AuthService');
      expect(queryResult.success).toBe(true);
      expect(queryResult.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'AuthService' })
        ])
      );

      // 5. View stats
      const statsResult = await cli.stats('/projects/my-app');
      expect(statsResult.success).toBe(true);
      expect(statsResult.data).toMatchObject({
        entities: expect.any(Number),
        relationships: expect.any(Number),
        files: expect.any(Number)
      });
    });
  });

  // ============================================================================
  // Error Handling Integration
  // ============================================================================

  describe('Error Handling Integration', () => {
    it('should handle missing config gracefully', async () => {
      (configManager.loadProject as jest.Mock).mockRejectedValueOnce(
        new Error('Config not found')
      );

      const config = await configManager.loadProjectWithDefaults('/nonexistent');

      expect(config.project.name).toBe('unnamed');
      expect(config.indexing.mode).toBe('incremental');
    });

    it('should handle provider errors with fallback', async () => {
      (providerFactory.getEmbeddingProvider as jest.Mock)
        .mockRejectedValueOnce(new Error('Provider unavailable'))
        .mockResolvedValueOnce({ modelId: 'openai:text-embedding-3-small', available: true });

      const provider = await providerFactory.getEmbeddingProviderWithFallback('/project');

      expect(provider.modelId).toBe('openai:text-embedding-3-small');
    });

    it('should handle watch errors without crashing', async () => {
      const errorHandler = jest.fn();
      watchManager.on('error', errorHandler);

      watchManager.start('/project');

      // Simulate file system errors
      const fsError = new Error('ENOENT: file not found');
      watchManager.emit('error', fsError);

      expect(errorHandler).toHaveBeenCalledWith(fsError);
      expect(watchManager.isRunning('/project')).toBe(true);
    });

    it('should handle CLI errors with helpful messages', async () => {
      (indexer.indexDirectory as jest.Mock).mockRejectedValueOnce(
        new Error('No project found')
      );

      const result = await cli.index('/nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No project found');
      expect(result.error).toContain('--help');
    });
  });

  // ============================================================================
  // Performance Integration
  // ============================================================================

  describe('Performance Integration', () => {
    it('should cache configuration', async () => {
      await configManager.loadProject('/project');
      await configManager.loadProject('/project');
      await configManager.loadProject('/project');

      // Should only load once due to caching
      expect(configManager.loadFromDisk).toHaveBeenCalledTimes(1);
    });

    it('should cache provider health status', async () => {
      await providerFactory.checkHealth('ollama:nomic-embed-text');
      await providerFactory.checkHealth('ollama:nomic-embed-text');
      await providerFactory.checkHealth('ollama:nomic-embed-text');

      // Should only check once due to caching
      expect(providerFactory.performHealthCheck).toHaveBeenCalledTimes(1);
    });

    it('should debounce watch events efficiently', async () => {
      watchManager.start('/project');

      // Simulate 10 rapid changes to same file
      for (let i = 0; i < 10; i++) {
        watchManager.handleFileChange('/src/app.ts');
      }

      jest.advanceTimersByTime(500);

      // Should only process once due to debouncing
      expect(indexer.indexFile).toHaveBeenCalledTimes(1);
      expect(indexer.indexFile).toHaveBeenCalledWith('/src/app.ts');
    });
  });
});
