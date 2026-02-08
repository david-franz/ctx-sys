/**
 * Configuration management for ctx-sys.
 * Handles global and project-level configuration with YAML files.
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import * as yaml from 'yaml';
import {
  GlobalConfig,
  ProjectConfigFile,
  ResolvedConfig,
  ProviderSettings,
  IndexingConfig,
  SummarizationConfig,
  EmbeddingsConfig,
  SessionsConfig,
  RetrievalConfig
} from './types';

/**
 * Options for ConfigManager.
 */
export interface ConfigManagerOptions {
  /** Override global config path (for testing) */
  globalConfigPath?: string;
  /** Skip file I/O (for testing) */
  inMemoryOnly?: boolean;
}

/**
 * Manages configuration loading, merging, and persistence.
 */
export class ConfigManager {
  private globalConfigPath: string;
  private globalConfig: GlobalConfig | null = null;
  private projectConfigs: Map<string, ProjectConfigFile> = new Map();
  private inMemoryOnly: boolean;

  constructor(options: ConfigManagerOptions = {}) {
    this.globalConfigPath = options.globalConfigPath ??
      join(homedir(), '.ctx-sys', 'config.yaml');
    this.inMemoryOnly = options.inMemoryOnly ?? false;
  }

  /**
   * Load global configuration.
   */
  async loadGlobal(): Promise<GlobalConfig> {
    if (this.globalConfig) {
      return this.globalConfig;
    }

    if (this.inMemoryOnly) {
      this.globalConfig = this.defaultGlobalConfig();
      return this.globalConfig;
    }

    try {
      const content = await readFile(this.globalConfigPath, 'utf-8');
      const parsed = yaml.parse(content);
      this.globalConfig = this.mergeGlobalWithDefaults(
        this.resolveEnvVars(parsed) as Partial<GlobalConfig>
      );
    } catch {
      this.globalConfig = this.defaultGlobalConfig();
    }

    return this.globalConfig;
  }

  /**
   * Load project configuration.
   */
  async loadProject(projectPath: string): Promise<ProjectConfigFile> {
    if (this.projectConfigs.has(projectPath)) {
      return this.projectConfigs.get(projectPath)!;
    }

    if (this.inMemoryOnly) {
      const config = this.defaultProjectConfigFile();
      this.projectConfigs.set(projectPath, config);
      return config;
    }

    const configPath = join(projectPath, '.ctx-sys', 'config.yaml');

    try {
      const content = await readFile(configPath, 'utf-8');
      const parsed = yaml.parse(content);
      const config = this.mergeProjectWithDefaults(parsed);
      this.projectConfigs.set(projectPath, config);
      return config;
    } catch {
      const defaultConfig = this.defaultProjectConfigFile();
      this.projectConfigs.set(projectPath, defaultConfig);
      return defaultConfig;
    }
  }

  /**
   * Resolve full configuration for a project.
   */
  async resolve(projectPath: string): Promise<ResolvedConfig> {
    const global = await this.loadGlobal();
    const projectConfig = await this.loadProject(projectPath);

    // Default database path to inside the project directory
    const defaultDbPath = this.defaultGlobalConfig().database.path;
    const database = {
      ...global.database,
      path: global.database.path === defaultDbPath
        ? join(projectPath, '.ctx-sys', 'ctx-sys.db')
        : global.database.path
    };

    return {
      ...global,
      database,
      projectConfig
    };
  }

  /**
   * Save global configuration.
   */
  async saveGlobal(config: GlobalConfig): Promise<void> {
    this.globalConfig = config;

    if (this.inMemoryOnly) {
      return;
    }

    await mkdir(dirname(this.globalConfigPath), { recursive: true });
    await writeFile(this.globalConfigPath, yaml.stringify(config));
  }

  /**
   * Save project configuration.
   */
  async saveProject(projectPath: string, config: ProjectConfigFile): Promise<void> {
    this.projectConfigs.set(projectPath, config);

    if (this.inMemoryOnly) {
      return;
    }

    const configDir = join(projectPath, '.ctx-sys');
    const configPath = join(configDir, 'config.yaml');

    await mkdir(configDir, { recursive: true });
    await writeFile(configPath, yaml.stringify(config));
  }

  /**
   * Check if global config file exists.
   */
  async globalConfigExists(): Promise<boolean> {
    try {
      await access(this.globalConfigPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if project config file exists.
   */
  async projectConfigExists(projectPath: string): Promise<boolean> {
    try {
      await access(join(projectPath, '.ctx-sys', 'config.yaml'));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update specific global config values.
   */
  async updateGlobal(updates: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const current = await this.loadGlobal();
    const updated = this.deepMerge(current, updates) as GlobalConfig;
    await this.saveGlobal(updated);
    return updated;
  }

  /**
   * Update specific project config values.
   */
  async updateProject(
    projectPath: string,
    updates: Partial<ProjectConfigFile>
  ): Promise<ProjectConfigFile> {
    const current = await this.loadProject(projectPath);
    const updated = this.deepMerge(current, updates) as ProjectConfigFile;
    await this.saveProject(projectPath, updated);
    return updated;
  }

  /**
   * Get a specific config value using dot notation.
   */
  async get<T = unknown>(
    projectPath: string | null,
    key: string
  ): Promise<T | undefined> {
    const config = projectPath
      ? await this.resolve(projectPath)
      : await this.loadGlobal();

    return this.getNestedValue(config, key) as T | undefined;
  }

  /**
   * Set a specific config value using dot notation.
   */
  async set(
    projectPath: string | null,
    key: string,
    value: unknown
  ): Promise<void> {
    if (projectPath) {
      const config = await this.loadProject(projectPath);
      this.setNestedValue(config, key, value);
      await this.saveProject(projectPath, config);
    } else {
      const config = await this.loadGlobal();
      this.setNestedValue(config, key, value);
      await this.saveGlobal(config);
    }
  }

  /**
   * Clear cached configurations.
   */
  clearCache(): void {
    this.globalConfig = null;
    this.projectConfigs.clear();
  }

  /**
   * Get the global config path.
   */
  getGlobalConfigPath(): string {
    return this.globalConfigPath;
  }

  /**
   * Get the project config path.
   */
  getProjectConfigFilePath(projectPath: string): string {
    return join(projectPath, '.ctx-sys', 'config.yaml');
  }

  /**
   * Resolve environment variables in config values.
   */
  private resolveEnvVars(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvVars(item));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveEnvVars(value);
      }
      return result;
    }
    return obj;
  }

  /**
   * Merge global config with defaults.
   */
  private mergeGlobalWithDefaults(config: Partial<GlobalConfig>): GlobalConfig {
    const defaults = this.defaultGlobalConfig();
    return {
      database: { ...defaults.database, ...config.database },
      providers: { ...defaults.providers, ...config.providers },
      defaults: {
        summarization: {
          ...defaults.defaults.summarization,
          ...config.defaults?.summarization
        },
        embeddings: {
          ...defaults.defaults.embeddings,
          ...config.defaults?.embeddings
        }
      },
      cli: { ...defaults.cli, ...config.cli }
    };
  }

  /**
   * Merge project config with defaults.
   */
  private mergeProjectWithDefaults(config: Partial<ProjectConfigFile>): ProjectConfigFile {
    const defaults = this.defaultProjectConfigFile();
    return {
      project: { ...defaults.project, ...config.project },
      indexing: { ...defaults.indexing, ...config.indexing },
      summarization: { ...defaults.summarization, ...config.summarization },
      embeddings: { ...defaults.embeddings, ...config.embeddings },
      sessions: { ...defaults.sessions, ...config.sessions },
      retrieval: { ...defaults.retrieval, ...config.retrieval }
    };
  }

  /**
   * Deep merge two objects.
   */
  private deepMerge(target: unknown, source: unknown): unknown {
    if (source === undefined) return target;
    if (target === undefined) return source;

    if (
      typeof target !== 'object' ||
      typeof source !== 'object' ||
      target === null ||
      source === null ||
      Array.isArray(target) ||
      Array.isArray(source)
    ) {
      return source;
    }

    const result: Record<string, unknown> = { ...target as Record<string, unknown> };
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      result[key] = this.deepMerge(
        (target as Record<string, unknown>)[key],
        value
      );
    }
    return result;
  }

  /**
   * Get nested value using dot notation.
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Set nested value using dot notation.
   */
  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Default global configuration.
   */
  private defaultGlobalConfig(): GlobalConfig {
    return {
      database: {
        path: join(homedir(), '.ctx-sys', 'ctx-sys.db')
      },
      providers: {
        ollama: { base_url: 'http://localhost:11434' }
      },
      defaults: {
        summarization: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
        embeddings: { provider: 'ollama', model: 'mxbai-embed-large:latest' }
      },
      cli: {
        colors: true,
        progress: true
      }
    };
  }

  /**
   * Default project configuration.
   */
  private defaultProjectConfigFile(): ProjectConfigFile {
    return {
      project: { name: 'unnamed' },
      indexing: {
        mode: 'incremental',
        watch: false,
        ignore: ['node_modules', '.git', '.ctx-sys', 'dist', 'build']
      },
      summarization: {
        enabled: true,
        provider: 'ollama',
        model: 'qwen2.5-coder:7b'
      },
      embeddings: {
        provider: 'ollama',
        model: 'mxbai-embed-large:latest'
      },
      sessions: {
        retention: 30,
        auto_summarize: true
      },
      retrieval: {
        default_max_tokens: 4000,
        strategies: ['vector', 'graph', 'fts']
      },
      hyde: {
        model: 'gemma3:12b'
      }
    };
  }
}

/**
 * Default global config values.
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  database: {
    path: join(homedir(), '.ctx-sys', 'ctx-sys.db')
  },
  providers: {
    ollama: { base_url: 'http://localhost:11434' }
  },
  defaults: {
    summarization: { provider: 'ollama', model: 'qwen2.5-coder:7b' },
    embeddings: { provider: 'ollama', model: 'mxbai-embed-large:latest' }
  },
  cli: {
    colors: true,
    progress: true
  }
};

/**
 * Default project config values.
 */
export const DEFAULT_PROJECT_CONFIG_FILE: ProjectConfigFile = {
  project: { name: 'unnamed' },
  indexing: {
    mode: 'incremental',
    watch: false,
    ignore: ['node_modules', '.git', '.ctx-sys', 'dist', 'build']
  },
  summarization: {
    enabled: true,
    provider: 'ollama',
    model: 'qwen2.5-coder:7b'
  },
  embeddings: {
    provider: 'ollama',
    model: 'mxbai-embed-large:latest'
  },
  sessions: {
    retention: 30,
    auto_summarize: true
  },
  retrieval: {
    default_max_tokens: 4000,
    strategies: ['vector', 'graph', 'fts']
  },
  hyde: {
    model: 'gemma3:12b'
  }
};
