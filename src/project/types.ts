/**
 * Project and configuration type definitions.
 */

export interface Project {
  id: string;
  name: string;
  path: string;
  config: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt?: Date;
  lastSyncCommit?: string;
}

export interface HyDeConfig {
  model: string;
}

export interface ProjectConfig {
  indexing: IndexingConfig;
  summarization: SummarizationConfig;
  embeddings: EmbeddingsConfig;
  sessions: SessionsConfig;
  retrieval: RetrievalConfig;
  hyde?: HyDeConfig;
}

export interface IndexingConfig {
  mode: 'full' | 'incremental' | 'manual';
  watch: boolean;
  ignore: string[];
  languages?: string[];
}

export interface SummarizationConfig {
  enabled: boolean;
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
}

export interface EmbeddingsConfig {
  provider: 'ollama' | 'openai';
  model: string;
}

export interface SessionsConfig {
  retention: number;
  autoSummarize: boolean;
}

export interface RetrievalConfig {
  defaultMaxTokens: number;
  strategies: ('vector' | 'graph' | 'fts')[];
}

/**
 * Default configuration for new projects.
 */
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  indexing: {
    mode: 'incremental',
    watch: false,
    ignore: [
      'node_modules',
      '.git',
      'dist',
      'build',
      '__pycache__',
      '*.min.js',
      '*.map'
    ]
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
    autoSummarize: true
  },
  retrieval: {
    defaultMaxTokens: 4000,
    strategies: ['vector', 'graph', 'fts']
  }
};

/**
 * Database row representation of a project.
 */
export interface ProjectRow {
  id: string;
  name: string;
  path: string;
  config: string;
  created_at: string;
  updated_at: string;
  last_indexed_at: string | null;
  last_sync_commit: string | null;
}
