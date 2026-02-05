// Main exports for ctx-sys

// Database
export { DatabaseConnection } from './db/connection';
export { MigrationManager } from './db/migrations';

// Project Management
export { ProjectManager, Project, ProjectConfig } from './project';

// Entity Storage
export { EntityStore, Entity, EntityType, EntityCreateInput, EntityUpdateInput, EntitySearchOptions } from './entities';

// Embeddings
export {
  EmbeddingManager,
  EmbeddingProviderFactory,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
  MockEmbeddingProvider,
  EmbeddingProvider,
  BatchOptions,
  StoredEmbedding,
  SimilarityResult,
  ProviderConfig
} from './embeddings';

// MCP Server
export { CtxSysMcpServer, McpServerConfig, ToolRegistry, Tool } from './mcp';

// Application Context
export { AppContext, getDefaultDbPath } from './context';
