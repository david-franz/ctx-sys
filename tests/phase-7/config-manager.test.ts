/**
 * Tests for F7.1 - Configuration System
 */

import { join } from 'path';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import {
  ConfigManager,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PROJECT_CONFIG_FILE,
  GlobalConfig,
  ProjectConfigFile
} from '../../src/config';

describe('ConfigManager', () => {
  let testDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `ctx-sys-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('DEFAULT_GLOBAL_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_GLOBAL_CONFIG.database.path).toContain('.ctx-sys');
      expect(DEFAULT_GLOBAL_CONFIG.providers.ollama?.base_url).toBe('http://localhost:11434');
      expect(DEFAULT_GLOBAL_CONFIG.defaults.summarization.provider).toBe('ollama');
      expect(DEFAULT_GLOBAL_CONFIG.defaults.embeddings.provider).toBe('ollama');
      expect(DEFAULT_GLOBAL_CONFIG.cli.colors).toBe(true);
      expect(DEFAULT_GLOBAL_CONFIG.cli.progress).toBe(true);
    });
  });

  describe('DEFAULT_PROJECT_CONFIG_FILE', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_PROJECT_CONFIG_FILE.project.name).toBe('unnamed');
      expect(DEFAULT_PROJECT_CONFIG_FILE.indexing.mode).toBe('incremental');
      expect(DEFAULT_PROJECT_CONFIG_FILE.indexing.watch).toBe(false);
      expect(DEFAULT_PROJECT_CONFIG_FILE.indexing.ignore).toContain('node_modules');
      expect(DEFAULT_PROJECT_CONFIG_FILE.summarization.enabled).toBe(true);
      expect(DEFAULT_PROJECT_CONFIG_FILE.sessions.retention).toBe(30);
      expect(DEFAULT_PROJECT_CONFIG_FILE.retrieval.default_max_tokens).toBe(4000);
    });
  });

  describe('in-memory mode', () => {
    beforeEach(() => {
      configManager = new ConfigManager({ inMemoryOnly: true });
    });

    it('should load default global config', async () => {
      const config = await configManager.loadGlobal();

      expect(config.database.path).toContain('.ctx-sys');
      expect(config.providers.ollama?.base_url).toBe('http://localhost:11434');
    });

    it('should load default project config', async () => {
      const config = await configManager.loadProject('/some/path');

      expect(config.project.name).toBe('unnamed');
      expect(config.indexing.mode).toBe('incremental');
    });

    it('should cache global config', async () => {
      const config1 = await configManager.loadGlobal();
      const config2 = await configManager.loadGlobal();

      expect(config1).toBe(config2);
    });

    it('should cache project config', async () => {
      const config1 = await configManager.loadProject('/some/path');
      const config2 = await configManager.loadProject('/some/path');

      expect(config1).toBe(config2);
    });

    it('should clear cache', async () => {
      const config1 = await configManager.loadGlobal();
      configManager.clearCache();
      const config2 = await configManager.loadGlobal();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should save and load global config in memory', async () => {
      const newConfig: GlobalConfig = {
        ...DEFAULT_GLOBAL_CONFIG,
        cli: { colors: false, progress: false }
      };

      await configManager.saveGlobal(newConfig);
      const loaded = await configManager.loadGlobal();

      expect(loaded.cli.colors).toBe(false);
      expect(loaded.cli.progress).toBe(false);
    });

    it('should save and load project config in memory', async () => {
      const newConfig: ProjectConfigFile = {
        ...DEFAULT_PROJECT_CONFIG_FILE,
        project: { name: 'test-project' }
      };

      await configManager.saveProject('/test/path', newConfig);
      const loaded = await configManager.loadProject('/test/path');

      expect(loaded.project.name).toBe('test-project');
    });
  });

  describe('file-based mode', () => {
    let globalConfigPath: string;
    let projectPath: string;

    beforeEach(async () => {
      globalConfigPath = join(testDir, 'global-config.yaml');
      projectPath = join(testDir, 'project');
      await mkdir(projectPath, { recursive: true });

      configManager = new ConfigManager({ globalConfigPath });
    });

    it('should return default when global config file does not exist', async () => {
      const config = await configManager.loadGlobal();

      expect(config.database.path).toContain('.ctx-sys');
    });

    it('should load global config from file', async () => {
      const yamlContent = `
database:
  path: /custom/db.sqlite
providers:
  ollama:
    base_url: http://custom:11434
cli:
  colors: false
  progress: true
`;
      await writeFile(globalConfigPath, yamlContent);

      const config = await configManager.loadGlobal();

      expect(config.database.path).toBe('/custom/db.sqlite');
      expect(config.providers.ollama?.base_url).toBe('http://custom:11434');
      expect(config.cli.colors).toBe(false);
    });

    it('should merge global config with defaults', async () => {
      const yamlContent = `
database:
  path: /custom/db.sqlite
`;
      await writeFile(globalConfigPath, yamlContent);

      const config = await configManager.loadGlobal();

      // Custom value
      expect(config.database.path).toBe('/custom/db.sqlite');
      // Default values preserved
      expect(config.providers.ollama?.base_url).toBe('http://localhost:11434');
      expect(config.defaults.summarization.provider).toBe('ollama');
    });

    it('should return default when project config file does not exist', async () => {
      const config = await configManager.loadProject(projectPath);

      expect(config.project.name).toBe('unnamed');
    });

    it('should load project config from file', async () => {
      const configDir = join(projectPath, '.ctx-sys');
      await mkdir(configDir, { recursive: true });

      const yamlContent = `
project:
  name: my-project
indexing:
  mode: full
  watch: true
  ignore:
    - node_modules
    - .git
`;
      await writeFile(join(configDir, 'config.yaml'), yamlContent);

      const config = await configManager.loadProject(projectPath);

      expect(config.project.name).toBe('my-project');
      expect(config.indexing.mode).toBe('full');
      expect(config.indexing.watch).toBe(true);
    });

    it('should merge project config with defaults', async () => {
      const configDir = join(projectPath, '.ctx-sys');
      await mkdir(configDir, { recursive: true });

      const yamlContent = `
project:
  name: my-project
`;
      await writeFile(join(configDir, 'config.yaml'), yamlContent);

      const config = await configManager.loadProject(projectPath);

      // Custom value
      expect(config.project.name).toBe('my-project');
      // Default values preserved
      expect(config.indexing.mode).toBe('incremental');
      expect(config.sessions.retention).toBe(30);
    });

    it('should save global config to file', async () => {
      const newConfig: GlobalConfig = {
        ...DEFAULT_GLOBAL_CONFIG,
        database: { path: '/saved/db.sqlite' }
      };

      await configManager.saveGlobal(newConfig);

      const content = await readFile(globalConfigPath, 'utf-8');
      expect(content).toContain('/saved/db.sqlite');
    });

    it('should save project config to file', async () => {
      const newConfig: ProjectConfigFile = {
        ...DEFAULT_PROJECT_CONFIG_FILE,
        project: { name: 'saved-project' }
      };

      await configManager.saveProject(projectPath, newConfig);

      const configPath = join(projectPath, '.ctx-sys', 'config.yaml');
      const content = await readFile(configPath, 'utf-8');
      expect(content).toContain('saved-project');
    });

    it('should create directories when saving', async () => {
      const newProjectPath = join(testDir, 'new-project');
      const newConfig: ProjectConfigFile = {
        ...DEFAULT_PROJECT_CONFIG_FILE,
        project: { name: 'new-project' }
      };

      await configManager.saveProject(newProjectPath, newConfig);

      const configPath = join(newProjectPath, '.ctx-sys', 'config.yaml');
      const content = await readFile(configPath, 'utf-8');
      expect(content).toContain('new-project');
    });
  });

  describe('environment variable resolution', () => {
    let globalConfigPath: string;

    beforeEach(() => {
      globalConfigPath = join(testDir, 'global-config.yaml');
      configManager = new ConfigManager({ globalConfigPath });
    });

    it('should resolve environment variables in config', async () => {
      process.env.TEST_API_KEY = 'test-key-123';

      const yamlContent = `
providers:
  openai:
    api_key: \${TEST_API_KEY}
`;
      await writeFile(globalConfigPath, yamlContent);

      const config = await configManager.loadGlobal();

      expect(config.providers.openai?.api_key).toBe('test-key-123');

      delete process.env.TEST_API_KEY;
    });

    it('should resolve empty string for missing env vars', async () => {
      delete process.env.MISSING_VAR;

      const yamlContent = `
providers:
  openai:
    api_key: \${MISSING_VAR}
`;
      await writeFile(globalConfigPath, yamlContent);

      const config = await configManager.loadGlobal();

      expect(config.providers.openai?.api_key).toBe('');
    });

    it('should resolve multiple env vars', async () => {
      process.env.TEST_URL = 'http://test.com';
      process.env.TEST_KEY = 'key123';

      const yamlContent = `
providers:
  ollama:
    base_url: \${TEST_URL}
  openai:
    api_key: \${TEST_KEY}
`;
      await writeFile(globalConfigPath, yamlContent);

      const config = await configManager.loadGlobal();

      expect(config.providers.ollama?.base_url).toBe('http://test.com');
      expect(config.providers.openai?.api_key).toBe('key123');

      delete process.env.TEST_URL;
      delete process.env.TEST_KEY;
    });
  });

  describe('resolve()', () => {
    it('should combine global and project config', async () => {
      configManager = new ConfigManager({ inMemoryOnly: true });

      await configManager.saveGlobal({
        ...DEFAULT_GLOBAL_CONFIG,
        cli: { colors: false, progress: true }
      });

      await configManager.saveProject('/test/path', {
        ...DEFAULT_PROJECT_CONFIG_FILE,
        project: { name: 'resolved-project' }
      });

      const resolved = await configManager.resolve('/test/path');

      expect(resolved.cli.colors).toBe(false);
      expect(resolved.projectConfig.project.name).toBe('resolved-project');
    });
  });

  describe('config existence checks', () => {
    let globalConfigPath: string;
    let projectPath: string;

    beforeEach(async () => {
      globalConfigPath = join(testDir, 'global-config.yaml');
      projectPath = join(testDir, 'project');
      await mkdir(projectPath, { recursive: true });

      configManager = new ConfigManager({ globalConfigPath });
    });

    it('should return false when global config does not exist', async () => {
      const exists = await configManager.globalConfigExists();
      expect(exists).toBe(false);
    });

    it('should return true when global config exists', async () => {
      await writeFile(globalConfigPath, 'database:\n  path: /test');
      const exists = await configManager.globalConfigExists();
      expect(exists).toBe(true);
    });

    it('should return false when project config does not exist', async () => {
      const exists = await configManager.projectConfigExists(projectPath);
      expect(exists).toBe(false);
    });

    it('should return true when project config exists', async () => {
      const configDir = join(projectPath, '.ctx-sys');
      await mkdir(configDir, { recursive: true });
      await writeFile(join(configDir, 'config.yaml'), 'project:\n  name: test');

      const exists = await configManager.projectConfigExists(projectPath);
      expect(exists).toBe(true);
    });
  });

  describe('updateGlobal() and updateProject()', () => {
    beforeEach(() => {
      configManager = new ConfigManager({ inMemoryOnly: true });
    });

    it('should update specific global config values', async () => {
      await configManager.loadGlobal();

      const updated = await configManager.updateGlobal({
        cli: { colors: false, progress: false }
      });

      expect(updated.cli.colors).toBe(false);
      expect(updated.cli.progress).toBe(false);
      // Other values preserved
      expect(updated.database.path).toContain('.ctx-sys');
    });

    it('should update specific project config values', async () => {
      await configManager.loadProject('/test/path');

      const updated = await configManager.updateProject('/test/path', {
        project: { name: 'updated-name' }
      });

      expect(updated.project.name).toBe('updated-name');
      // Other values preserved
      expect(updated.indexing.mode).toBe('incremental');
    });
  });

  describe('get() and set()', () => {
    beforeEach(() => {
      configManager = new ConfigManager({ inMemoryOnly: true });
    });

    it('should get nested global config value', async () => {
      const value = await configManager.get(null, 'cli.colors');
      expect(value).toBe(true);
    });

    it('should get nested project config value', async () => {
      await configManager.loadProject('/test/path');
      const value = await configManager.get('/test/path', 'projectConfig.indexing.mode');
      expect(value).toBe('incremental');
    });

    it('should return undefined for non-existent key', async () => {
      const value = await configManager.get(null, 'nonexistent.key');
      expect(value).toBeUndefined();
    });

    it('should set global config value', async () => {
      await configManager.loadGlobal();
      await configManager.set(null, 'cli.colors', false);

      const config = await configManager.loadGlobal();
      expect(config.cli.colors).toBe(false);
    });

    it('should set project config value', async () => {
      await configManager.loadProject('/test/path');
      await configManager.set('/test/path', 'project.name', 'new-name');

      const config = await configManager.loadProject('/test/path');
      expect(config.project.name).toBe('new-name');
    });

    it('should create nested structure when setting', async () => {
      await configManager.loadGlobal();
      await configManager.set(null, 'providers.anthropic.api_key', 'test-key');

      const config = await configManager.loadGlobal();
      expect(config.providers.anthropic?.api_key).toBe('test-key');
    });
  });

  describe('config paths', () => {
    it('should return correct global config path', () => {
      const customPath = '/custom/path/config.yaml';
      configManager = new ConfigManager({ globalConfigPath: customPath });

      expect(configManager.getGlobalConfigPath()).toBe(customPath);
    });

    it('should return correct project config path', () => {
      configManager = new ConfigManager({ inMemoryOnly: true });

      const path = configManager.getProjectConfigFilePath('/my/project');
      expect(path).toBe('/my/project/.ctx-sys/config.yaml');
    });
  });

  describe('edge cases', () => {
    it('should handle empty yaml file', async () => {
      const globalConfigPath = join(testDir, 'global-config.yaml');
      await writeFile(globalConfigPath, '');

      configManager = new ConfigManager({ globalConfigPath });
      const config = await configManager.loadGlobal();

      // Should return defaults
      expect(config.database.path).toContain('.ctx-sys');
    });

    it('should handle malformed yaml', async () => {
      const globalConfigPath = join(testDir, 'global-config.yaml');
      await writeFile(globalConfigPath, 'not: valid: yaml: content:');

      configManager = new ConfigManager({ globalConfigPath });
      const config = await configManager.loadGlobal();

      // Should return defaults on parse error
      expect(config.database.path).toContain('.ctx-sys');
    });

    it('should handle deeply nested updates', async () => {
      configManager = new ConfigManager({ inMemoryOnly: true });
      await configManager.loadGlobal();

      const updated = await configManager.updateGlobal({
        defaults: {
          summarization: { provider: 'openai', model: 'gpt-4' },
          embeddings: { provider: 'openai', model: 'text-embedding-3-small' }
        }
      });

      expect(updated.defaults.summarization.provider).toBe('openai');
      expect(updated.defaults.summarization.model).toBe('gpt-4');
      expect(updated.defaults.embeddings.provider).toBe('openai');
    });

    it('should isolate project configs', async () => {
      configManager = new ConfigManager({ inMemoryOnly: true });

      await configManager.saveProject('/project1', {
        ...DEFAULT_PROJECT_CONFIG_FILE,
        project: { name: 'project1' }
      });

      await configManager.saveProject('/project2', {
        ...DEFAULT_PROJECT_CONFIG_FILE,
        project: { name: 'project2' }
      });

      const config1 = await configManager.loadProject('/project1');
      const config2 = await configManager.loadProject('/project2');

      expect(config1.project.name).toBe('project1');
      expect(config2.project.name).toBe('project2');
    });
  });
});
