/**
 * F7.1 Configuration System Tests
 *
 * WARNING: These tests will fail until the following implementations are created:
 * - src/config/manager.ts (ConfigManager class)
 * - src/config/types.ts (AppConfig, ProjectConfig, ConfigSchema interfaces)
 * - src/config/loader.ts (ConfigLoader class)
 * - src/config/validator.ts (ConfigValidator class)
 * - src/config/resolver.ts (EnvResolver class)
 *
 * Tests for configuration management:
 * - Global configuration loading/saving
 * - Project configuration loading/saving
 * - Environment variable resolution
 * - Configuration merging with defaults
 * - Configuration hierarchy
 *
 * @see docs/phase-7/F7.1-configuration.md
 */

// Import actual implementations from source paths (will fail until created)
import { ConfigManager } from '../../src/config/manager';
import { ConfigLoader } from '../../src/config/loader';
import { ConfigValidator } from '../../src/config/validator';
import { EnvResolver } from '../../src/config/resolver';
import {
  AppConfig,
  ProjectConfig,
  GlobalConfig,
  ConfigSchema,
  ResolvedConfig,
  IndexingMode
} from '../../src/config/types';

// Import test helpers
import {
  createMockDatabase,
  createMockFileSystem,
  MockDatabase,
  MockFileSystem,
  generateId
} from '../helpers/mocks';

// ============================================================================
// Mock External Dependencies
// ============================================================================

// Mock the YAML library
jest.mock('yaml', () => ({
  parse: jest.fn((content: string) => JSON.parse(content)),
  stringify: jest.fn((obj: unknown) => JSON.stringify(obj, null, 2))
}));

// Mock fs/promises for file operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
}));

// Mock os for home directory
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/testuser')
}));

// Mock path for cross-platform compatibility
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/'))
}));

// Get mocked modules for test manipulation
import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const mockedYaml = yaml as jest.Mocked<typeof yaml>;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;
const mockedPath = path as jest.Mocked<typeof path>;

describe('F7.1 Configuration System', () => {
  let mockDb: MockDatabase;
  let mockFileSystem: MockFileSystem;
  let configManager: ConfigManager;
  let configLoader: ConfigLoader;
  let configValidator: ConfigValidator;
  let envResolver: EnvResolver;

  // Default configurations for testing
  const defaultGlobalConfig: GlobalConfig = {
    database: {
      path: '~/.ctx-sys/ctx-sys.db'
    },
    providers: {
      ollama: { base_url: 'http://localhost:11434' }
    },
    defaults: {
      summarization: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
      embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
    },
    cli: {
      colors: true,
      progress: true
    }
  };

  const defaultProjectConfig: ProjectConfig = {
    project: { name: 'unnamed' },
    indexing: {
      mode: 'incremental' as IndexingMode,
      watch: false,
      ignore: ['node_modules', '.git', 'dist', 'build']
    },
    summarization: {
      enabled: true,
      provider: 'ollama',
      model: 'qwen2.5-coder:7b'
    },
    embeddings: {
      provider: 'ollama',
      model: 'nomic-embed-text'
    },
    sessions: {
      retention: 30,
      auto_summarize: true
    },
    retrieval: {
      default_max_tokens: 4000,
      strategies: ['vector', 'graph', 'fts']
    }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockDb = createMockDatabase();
    mockFileSystem = createMockFileSystem();

    // Create real instances with mocked dependencies
    envResolver = new EnvResolver();
    configValidator = new ConfigValidator();
    configLoader = new ConfigLoader({
      fileSystem: mockFileSystem,
      validator: configValidator,
      envResolver: envResolver
    });
    configManager = new ConfigManager({
      loader: configLoader,
      validator: configValidator,
      envResolver: envResolver
    });
  });

  afterEach(() => {
    mockDb.reset();
    mockFileSystem.reset();
  });

  // ============================================================================
  // GlobalConfig Interface Tests
  // ============================================================================

  describe('GlobalConfig Interface', () => {
    it('should have all required fields', () => {
      const config: GlobalConfig = {
        database: {
          path: '~/.ctx-sys/ctx-sys.db'
        },
        providers: {
          ollama: { base_url: 'http://localhost:11434' }
        },
        defaults: {
          summarization: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
          embeddings: { provider: 'ollama', model: 'nomic-embed-text' }
        },
        cli: {
          colors: true,
          progress: true
        }
      };

      expect(config.database.path).toBeDefined();
      expect(config.providers).toBeDefined();
      expect(config.defaults.summarization).toBeDefined();
      expect(config.defaults.embeddings).toBeDefined();
      expect(config.cli).toBeDefined();
    });

    it('should support multiple providers', () => {
      const config: GlobalConfig = {
        database: { path: '/path/to/db' },
        providers: {
          ollama: { base_url: 'http://localhost:11434' },
          openai: { api_key: 'sk-test' },
          anthropic: { api_key: 'sk-ant-test' }
        },
        defaults: {
          summarization: { provider: 'openai', model: 'gpt-4o-mini' },
          embeddings: { provider: 'openai', model: 'text-embedding-3-small' }
        },
        cli: { colors: true, progress: true }
      };

      expect(config.providers.ollama).toBeDefined();
      expect(config.providers.openai).toBeDefined();
      expect(config.providers.anthropic).toBeDefined();
    });
  });

  // ============================================================================
  // ProjectConfig Interface Tests
  // ============================================================================

  describe('ProjectConfig Interface', () => {
    it('should have all required fields', () => {
      const config: ProjectConfig = {
        project: { name: 'test-project' },
        indexing: {
          mode: 'incremental' as IndexingMode,
          watch: false,
          ignore: ['node_modules', '.git']
        },
        summarization: {
          enabled: true,
          provider: 'ollama',
          model: 'qwen2.5-coder:7b'
        },
        embeddings: {
          provider: 'ollama',
          model: 'nomic-embed-text'
        },
        sessions: {
          retention: 30,
          auto_summarize: true
        },
        retrieval: {
          default_max_tokens: 4000,
          strategies: ['vector', 'graph', 'fts']
        }
      };

      expect(config.project.name).toBe('test-project');
      expect(config.indexing.mode).toBe('incremental');
      expect(config.summarization.enabled).toBe(true);
    });

    it('should support indexing modes', () => {
      const modes: IndexingMode[] = ['full', 'incremental', 'manual'];

      for (const mode of modes) {
        const config: ProjectConfig = {
          project: { name: 'test' },
          indexing: { mode, watch: false, ignore: [] },
          summarization: { enabled: true, provider: 'ollama', model: 'test' },
          embeddings: { provider: 'ollama', model: 'test' },
          sessions: { retention: 30, auto_summarize: true },
          retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
        };

        expect(config.indexing.mode).toBe(mode);
      }
    });

    it('should support custom retrieval weights', () => {
      const config: ProjectConfig = {
        project: { name: 'test' },
        indexing: { mode: 'incremental' as IndexingMode, watch: false, ignore: [] },
        summarization: { enabled: true, provider: 'ollama', model: 'test' },
        embeddings: { provider: 'ollama', model: 'test' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: {
          default_max_tokens: 4000,
          strategies: ['vector', 'graph', 'fts'],
          weights: {
            vector: 1.0,
            graph: 0.8,
            fts: 0.6
          }
        }
      };

      expect(config.retrieval.weights!.vector).toBe(1.0);
      expect(config.retrieval.weights!.graph).toBe(0.8);
    });
  });

  // ============================================================================
  // EnvResolver Tests
  // ============================================================================

  describe('EnvResolver', () => {
    it('should resolve environment variables in strings', () => {
      const originalEnv = process.env.TEST_VAR;
      process.env.TEST_VAR = 'resolved_value';

      const input = '${TEST_VAR}';
      const result = envResolver.resolve(input);

      expect(result).toBe('resolved_value');

      process.env.TEST_VAR = originalEnv;
    });

    it('should resolve nested environment variables in objects', () => {
      const originalKey = process.env.API_KEY;
      process.env.API_KEY = 'sk-secret-key';

      const config = {
        providers: {
          openai: {
            api_key: '${API_KEY}'
          }
        }
      };

      const resolved = envResolver.resolveObject(config);

      expect(resolved.providers.openai.api_key).toBe('sk-secret-key');

      process.env.API_KEY = originalKey;
    });

    it('should handle missing environment variables', () => {
      delete process.env.NONEXISTENT_VAR;

      const input = '${NONEXISTENT_VAR}';
      const result = envResolver.resolve(input);

      expect(result).toBe('');
    });

    it('should preserve non-string values', () => {
      const config = {
        port: 8080,
        enabled: true,
        items: [1, 2, 3]
      };

      const resolved = envResolver.resolveObject(config);

      expect(resolved.port).toBe(8080);
      expect(resolved.enabled).toBe(true);
      expect(resolved.items).toEqual([1, 2, 3]);
    });

    it('should resolve variables in arrays', () => {
      const originalVar = process.env.ITEM;
      process.env.ITEM = 'value';

      const config = {
        items: ['${ITEM}', 'static']
      };

      const resolved = envResolver.resolveObject(config);

      expect(resolved.items).toEqual(['value', 'static']);

      process.env.ITEM = originalVar;
    });
  });

  // ============================================================================
  // ConfigValidator Tests
  // ============================================================================

  describe('ConfigValidator', () => {
    it('should validate a valid global config', () => {
      const result = configValidator.validateGlobal(defaultGlobalConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid project config', () => {
      const result = configValidator.validateProject(defaultProjectConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid indexing mode', () => {
      const invalidConfig = {
        ...defaultProjectConfig,
        indexing: {
          ...defaultProjectConfig.indexing,
          mode: 'invalid' as IndexingMode
        }
      };

      const result = configValidator.validateProject(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject negative max tokens', () => {
      const invalidConfig = {
        ...defaultProjectConfig,
        retrieval: {
          ...defaultProjectConfig.retrieval,
          default_max_tokens: -1
        }
      };

      const result = configValidator.validateProject(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: 'retrieval.default_max_tokens' })
      );
    });
  });

  // ============================================================================
  // ConfigLoader Tests
  // ============================================================================

  describe('ConfigLoader', () => {
    it('should load global config from file', async () => {
      const configContent = JSON.stringify({
        database: { path: '/custom/path.db' },
        providers: { ollama: { base_url: 'http://localhost:11434' } },
        defaults: {
          summarization: { provider: 'ollama', model: 'custom' },
          embeddings: { provider: 'ollama', model: 'custom' }
        },
        cli: { colors: false, progress: true }
      });

      mockFileSystem.setFile('/home/testuser/.ctx-sys/config.yaml', configContent);
      mockedFs.readFile.mockResolvedValue(configContent);

      const config = await configLoader.loadGlobal();

      expect(config.database.path).toBe('/custom/path.db');
      expect(config.cli.colors).toBe(false);
    });

    it('should return defaults when global config missing', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const config = await configLoader.loadGlobal();

      expect(config.database.path).toBe('~/.ctx-sys/ctx-sys.db');
      expect(config.cli.colors).toBe(true);
    });

    it('should load project config from file', async () => {
      const configContent = JSON.stringify({
        project: { name: 'test-project' },
        indexing: { mode: 'full', watch: true, ignore: [] },
        summarization: { enabled: true, provider: 'ollama', model: 'test' },
        embeddings: { provider: 'ollama', model: 'test' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      });

      mockFileSystem.setFile('/project/.ctx-sys/config.yaml', configContent);
      mockedFs.readFile.mockResolvedValue(configContent);

      const config = await configLoader.loadProject('/project');

      expect(config.project.name).toBe('test-project');
      expect(config.indexing.mode).toBe('full');
    });

    it('should return defaults when project config missing', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const config = await configLoader.loadProject('/nonexistent');

      expect(config.project.name).toBe('unnamed');
    });

    it('should merge partial config with defaults', async () => {
      const partialContent = JSON.stringify({
        project: { name: 'my-project' }
      });

      mockedFs.readFile.mockResolvedValue(partialContent);

      const config = await configLoader.loadProject('/project');

      expect(config.project.name).toBe('my-project');
      expect(config.indexing.mode).toBe('incremental'); // Default
      expect(config.summarization.enabled).toBe(true); // Default
    });
  });

  // ============================================================================
  // ConfigManager Tests
  // ============================================================================

  describe('ConfigManager', () => {
    it('should load and cache global config', async () => {
      const configContent = JSON.stringify(defaultGlobalConfig);
      mockedFs.readFile.mockResolvedValue(configContent);

      // First load
      const config1 = await configManager.getGlobalConfig();
      // Second load (should use cache)
      const config2 = await configManager.getGlobalConfig();

      expect(config1).toEqual(config2);
      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should load and cache project config', async () => {
      const configContent = JSON.stringify(defaultProjectConfig);
      mockedFs.readFile.mockResolvedValue(configContent);

      // First load
      const config1 = await configManager.getProjectConfig('/project');
      // Second load (should use cache)
      const config2 = await configManager.getProjectConfig('/project');

      expect(config1).toEqual(config2);
      expect(mockedFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should resolve combined configuration', async () => {
      const globalContent = JSON.stringify({
        database: { path: '/db.sqlite' },
        providers: { ollama: { base_url: 'http://localhost:11434' } },
        defaults: {
          summarization: { provider: 'ollama', model: 'model1' },
          embeddings: { provider: 'ollama', model: 'model2' }
        },
        cli: { colors: true, progress: true }
      });

      const projectContent = JSON.stringify({
        project: { name: 'my-app' },
        indexing: { mode: 'incremental', watch: false, ignore: [] },
        summarization: { enabled: true, provider: 'ollama', model: 'model1' },
        embeddings: { provider: 'ollama', model: 'model2' },
        sessions: { retention: 30, auto_summarize: true },
        retrieval: { default_max_tokens: 4000, strategies: ['vector'] }
      });

      mockedFs.readFile
        .mockResolvedValueOnce(globalContent)
        .mockResolvedValueOnce(projectContent);

      const resolved = await configManager.getResolvedConfig('/project');

      expect(resolved.database.path).toBe('/db.sqlite');
      expect(resolved.project.project.name).toBe('my-app');
    });

    it('should invalidate cache when requested', async () => {
      const configContent = JSON.stringify(defaultGlobalConfig);
      mockedFs.readFile.mockResolvedValue(configContent);

      await configManager.getGlobalConfig();
      configManager.invalidateCache();
      await configManager.getGlobalConfig();

      expect(mockedFs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should save global config', async () => {
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);

      const newConfig: GlobalConfig = {
        ...defaultGlobalConfig,
        cli: { colors: false, progress: false }
      };

      await configManager.saveGlobalConfig(newConfig);

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });

    it('should save project config', async () => {
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);

      const newConfig: ProjectConfig = {
        ...defaultProjectConfig,
        project: { name: 'updated-project' }
      };

      await configManager.saveProjectConfig('/project', newConfig);

      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Configuration Merging Tests
  // ============================================================================

  describe('Configuration Merging', () => {
    it('should merge partial config with defaults', async () => {
      const partial: Partial<ProjectConfig> = {
        project: { name: 'my-project' }
      };

      const merged = configManager.mergeWithDefaults(partial);

      expect(merged.project.name).toBe('my-project');
      expect(merged.indexing.mode).toBe('incremental'); // Default
      expect(merged.summarization.enabled).toBe(true); // Default
    });

    it('should override nested defaults', async () => {
      const partial: Partial<ProjectConfig> = {
        summarization: {
          enabled: false,
          provider: 'openai',
          model: 'gpt-4o-mini'
        }
      };

      const merged = configManager.mergeWithDefaults(partial);

      expect(merged.summarization.enabled).toBe(false);
      expect(merged.summarization.provider).toBe('openai');
      expect(merged.summarization.model).toBe('gpt-4o-mini');
    });

    it('should preserve custom ignore patterns', async () => {
      const partial: Partial<ProjectConfig> = {
        indexing: {
          mode: 'full' as IndexingMode,
          watch: true,
          ignore: ['custom_dir', '*.log']
        }
      };

      const merged = configManager.mergeWithDefaults(partial);

      expect(merged.indexing.ignore).toEqual(['custom_dir', '*.log']);
    });

    it('should merge retrieval weights', async () => {
      const partial: Partial<ProjectConfig> = {
        retrieval: {
          default_max_tokens: 8000,
          strategies: ['vector'],
          weights: { vector: 1.5 }
        }
      };

      const merged = configManager.mergeWithDefaults(partial);

      expect(merged.retrieval.default_max_tokens).toBe(8000);
      expect(merged.retrieval.weights!.vector).toBe(1.5);
    });
  });

  // ============================================================================
  // YAML Parsing Tests
  // ============================================================================

  describe('YAML Parsing', () => {
    it('should handle valid YAML structure', async () => {
      const yamlContent = `
project:
  name: test-project
indexing:
  mode: incremental
  watch: false
  ignore:
    - node_modules
    - dist
      `;

      // Mock YAML.parse to return expected structure
      mockedYaml.parse.mockReturnValue({
        project: { name: 'test-project' },
        indexing: {
          mode: 'incremental',
          watch: false,
          ignore: ['node_modules', 'dist']
        }
      });

      mockedFs.readFile.mockResolvedValue(yamlContent);

      const config = await configLoader.loadProject('/project');

      expect(config.project.name).toBe('test-project');
      expect(config.indexing.ignore).toContain('node_modules');
    });

    it('should handle empty config file', async () => {
      mockedYaml.parse.mockReturnValue({});
      mockedFs.readFile.mockResolvedValue('');

      const config = await configLoader.loadProject('/project');

      // Should use defaults when merging
      expect(config.project.name).toBe('unnamed');
    });

    it('should serialize config to YAML', async () => {
      const config = {
        project: { name: 'test' },
        indexing: { mode: 'full' }
      };

      mockedYaml.stringify.mockReturnValue('project:\n  name: test\nindexing:\n  mode: full');
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.mkdir.mockResolvedValue(undefined);

      await configManager.saveProjectConfig('/project', config as ProjectConfig);

      expect(mockedYaml.stringify).toHaveBeenCalledWith(config);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty ignore patterns', () => {
      const config: Partial<ProjectConfig> = {
        indexing: {
          mode: 'incremental' as IndexingMode,
          watch: false,
          ignore: []
        }
      };

      const merged = configManager.mergeWithDefaults(config);

      expect(merged.indexing.ignore).toHaveLength(0);
    });

    it('should handle missing provider config', () => {
      const config: GlobalConfig = {
        database: { path: '/db.sqlite' },
        providers: {},
        defaults: {
          summarization: { provider: 'ollama', model: 'test' },
          embeddings: { provider: 'ollama', model: 'test' }
        },
        cli: { colors: true, progress: true }
      };

      expect(config.providers.ollama).toBeUndefined();
      expect(config.providers.openai).toBeUndefined();
    });

    it('should handle special characters in paths', async () => {
      const configContent = JSON.stringify({
        ...defaultGlobalConfig,
        database: { path: '/path/with spaces/and-special_chars/db.sqlite' }
      });

      mockedFs.readFile.mockResolvedValue(configContent);

      const config = await configManager.getGlobalConfig();

      expect(config.database.path).toContain('spaces');
    });

    it('should handle very long ignore lists', () => {
      const ignorePatterns = Array(100).fill(null).map((_, i) => `pattern_${i}`);

      const config: Partial<ProjectConfig> = {
        indexing: {
          mode: 'incremental' as IndexingMode,
          watch: false,
          ignore: ignorePatterns
        }
      };

      const merged = configManager.mergeWithDefaults(config);

      expect(merged.indexing.ignore).toHaveLength(100);
    });

    it('should handle zero retention days', () => {
      const config: Partial<ProjectConfig> = {
        sessions: {
          retention: 0, // Means no automatic cleanup
          auto_summarize: true
        }
      };

      const merged = configManager.mergeWithDefaults(config);

      expect(merged.sessions.retention).toBe(0);
    });

    it('should reject negative max tokens through validation', () => {
      const config: Partial<ProjectConfig> = {
        retrieval: {
          default_max_tokens: -1, // Invalid
          strategies: ['vector']
        }
      };

      const merged = configManager.mergeWithDefaults(config);
      const result = configValidator.validateProject(merged);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle concurrent config loads', async () => {
      const configContent = JSON.stringify(defaultGlobalConfig);
      mockedFs.readFile.mockResolvedValue(configContent);

      // Simulate concurrent loads
      const [config1, config2, config3] = await Promise.all([
        configManager.getGlobalConfig(),
        configManager.getGlobalConfig(),
        configManager.getGlobalConfig()
      ]);

      expect(config1).toEqual(config2);
      expect(config2).toEqual(config3);
    });

    it('should handle config file permission errors', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(configLoader.loadGlobal()).rejects.toThrow('EACCES');
    });

    it('should handle malformed YAML gracefully', async () => {
      mockedYaml.parse.mockImplementation(() => {
        throw new Error('Invalid YAML syntax');
      });
      mockedFs.readFile.mockResolvedValue('invalid: yaml: content:');

      await expect(configLoader.loadGlobal()).rejects.toThrow('Invalid YAML syntax');
    });
  });
});
