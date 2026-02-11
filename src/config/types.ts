/**
 * Configuration type definitions.
 */

/**
 * Provider configuration for embeddings/summarization.
 */
export interface ProviderSettings {
  provider: 'ollama' | 'openai' | 'anthropic' | 'mock';
  model: string;
}

/**
 * Ollama provider configuration.
 */
export interface OllamaProviderConfig {
  base_url: string;
}

/**
 * OpenAI provider configuration.
 */
export interface OpenAIProviderConfig {
  api_key: string;
  base_url?: string;
}

/**
 * Anthropic provider configuration.
 */
export interface AnthropicProviderConfig {
  api_key: string;
}

/**
 * All provider configurations.
 */
export interface ProvidersConfig {
  ollama?: OllamaProviderConfig;
  openai?: OpenAIProviderConfig;
  anthropic?: AnthropicProviderConfig;
}

/**
 * CLI configuration.
 */
export interface CLIConfig {
  colors: boolean;
  progress: boolean;
}

/**
 * Default provider settings.
 */
export interface DefaultsConfig {
  summarization: ProviderSettings;
  embeddings: ProviderSettings;
}

/**
 * Database configuration.
 */
export interface DatabaseConfig {
  path: string;
}

/**
 * Global configuration (user-level).
 */
export interface GlobalConfig {
  database: DatabaseConfig;
  providers: ProvidersConfig;
  defaults: DefaultsConfig;
  cli: CLIConfig;
  /** Log level for library code: debug | info | warn | error | silent */
  log_level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
}

/**
 * Project identity.
 */
export interface ProjectIdentity {
  name: string;
}

/**
 * Indexing configuration.
 */
export interface IndexingConfig {
  mode: 'full' | 'incremental' | 'manual';
  watch: boolean;
  ignore: string[];
  languages?: string[];
}

/**
 * Summarization configuration.
 */
export interface SummarizationConfig {
  enabled: boolean;
  provider: string;
  model: string;
}

/**
 * Embeddings configuration.
 */
export interface EmbeddingsConfig {
  provider: string;
  model: string;
}

/**
 * Session configuration.
 */
export interface SessionsConfig {
  retention: number;
  auto_summarize: boolean;
}

/**
 * Retrieval configuration.
 */
export interface RetrievalConfig {
  default_max_tokens: number;
  strategies: string[];
  weights?: Record<string, number>;
}

/**
 * HyDE (Hypothetical Document Embeddings) configuration.
 */
export interface HyDeConfig {
  model: string;
}

/**
 * Project-level configuration.
 */
export interface ProjectConfigFile {
  project: ProjectIdentity;
  indexing: IndexingConfig;
  summarization: SummarizationConfig;
  embeddings: EmbeddingsConfig;
  sessions: SessionsConfig;
  retrieval: RetrievalConfig;
  hyde?: HyDeConfig;
}

/**
 * Fully resolved configuration (global + project).
 */
export interface ResolvedConfig extends GlobalConfig {
  projectConfig: ProjectConfigFile;
}
