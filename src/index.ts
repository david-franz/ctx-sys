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

// AST Parsing
export {
  ASTParser,
  Symbol,
  SymbolType,
  Parameter,
  ImportStatement,
  ImportSpecifier,
  ParseResult,
  ParseError,
  SupportedLanguage,
  LanguageExtractor,
  TypeScriptExtractor,
  PythonExtractor,
  GenericExtractor
} from './ast';

// Summarization
export {
  SymbolSummarizer,
  SymbolSummary,
  ParameterSummary,
  FileSummary,
  FileMetrics,
  SummaryLevel,
  SummarizationOptions,
  LLMSummarizer
} from './summarization';

// Codebase Indexing
export {
  CodebaseIndexer,
  IndexedFile,
  IndexStats,
  IndexResult,
  IndexOptions,
  IndexEntry,
  FileStatus
} from './indexer';

// Application Context
export { AppContext, getDefaultDbPath } from './context';
