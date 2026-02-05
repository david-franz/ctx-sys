/**
 * Phase 7: Configuration Types
 * Type definitions for configuration
 */

export type IndexingMode = 'full' | 'incremental' | 'watch' | 'manual';

export interface Config {
  database?: DatabaseConfig;
  embedding?: EmbeddingConfig;
  summarization?: SummarizationConfig;
  server?: ServerConfig;
  project?: ProjectConfigInfo;
  cli?: CliConfig;
  indexing?: IndexingConfig;
  providers?: ProvidersConfig;
  defaults?: DefaultsConfig;
  sessions?: SessionsConfig;
  retrieval?: RetrievalConfig;
  embeddings?: EmbeddingsConfig;
}

// Alias for compatibility
export type AppConfig = Config;
export type ResolvedConfig = Config & {
  database: GlobalConfig;
  project: ProjectConfig;
};

export interface DatabaseConfig {
  path: string;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface SummarizationConfig {
  enabled?: boolean;
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface ProjectConfigInfo {
  name?: string;
  root?: string;
  ignore?: string[];
}

export interface CliConfig {
  colors?: boolean;
  verbose?: boolean;
  progress?: boolean;
}

export interface IndexingConfig {
  mode?: IndexingMode;
  watch?: boolean;
  ignore?: string[];
  include?: string[];
}

export interface ProviderConfig {
  base_url?: string;
  api_key?: string;
}

export interface ProvidersConfig {
  ollama?: ProviderConfig;
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  [key: string]: ProviderConfig | undefined;
}

export interface DefaultsConfig {
  summarization?: { provider: string; model: string };
  embeddings?: { provider: string; model: string };
}

export interface SessionsConfig {
  retention?: number;
  auto_summarize?: boolean;
}

export interface RetrievalConfig {
  default_max_tokens?: number;
  strategies?: string[];
  weights?: {
    vector?: number;
    graph?: number;
    fts?: number;
  };
}

export interface EmbeddingsConfig {
  provider: string;
  model: string;
}

export interface GlobalConfig {
  dataDir?: string;
  logLevel?: string;
  database?: DatabaseConfig;
  providers?: ProvidersConfig;
  defaults?: DefaultsConfig;
  cli?: CliConfig;
}

export interface ProjectConfig {
  name?: string;
  root?: string;
  ignore?: string[];
  project?: ProjectConfigInfo;
  indexing?: IndexingConfig;
  summarization?: SummarizationConfig;
  embeddings?: EmbeddingsConfig;
  sessions?: SessionsConfig;
  retrieval?: RetrievalConfig;
}

export interface ConfigSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}
