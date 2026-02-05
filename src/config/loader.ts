/**
 * Phase 7: Configuration Loader
 * Loads configuration from files
 */

import { Config, GlobalConfig, ProjectConfig } from './types';
import { ConfigValidator } from './validator';
import { EnvResolver } from './resolver';

export interface ConfigLoaderOptions {
  fileSystem?: any;
  validator?: ConfigValidator;
  envResolver?: EnvResolver;
}

export class ConfigLoader {
  constructor(options?: ConfigLoaderOptions) {
    // Stub implementation
  }

  async load(path: string): Promise<Config> {
    throw new Error('Not implemented');
  }

  async loadGlobal(): Promise<GlobalConfig> {
    throw new Error('Not implemented');
  }

  async loadProject(projectPath: string): Promise<ProjectConfig> {
    throw new Error('Not implemented');
  }

  async loadFromYAML(path: string): Promise<Config> {
    throw new Error('Not implemented');
  }

  async loadFromJSON(path: string): Promise<Config> {
    throw new Error('Not implemented');
  }
}
