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

// Relationship Extraction
export {
  RelationshipExtractor,
  Relationship,
  RelationshipType,
  GraphNode,
  GraphStats,
  ExtractionOptions
} from './relationships';

// Git Diff Processing
export {
  GitDiffProcessor,
  DiffResult,
  FileDiff,
  DiffHunk,
  DiffLine,
  DiffOptions,
  ChangeType,
  ChangedSymbol
} from './git';

// Conversation Memory
export {
  MessageStore,
  MessageInput,
  SessionManager,
  ConversationSummarizer,
  SummaryProvider,
  MockSummaryProvider,
  SummarizerOptions,
  DecisionExtractor,
  MockDecisionProvider,
  Message,
  MessageMetadata,
  ToolCall,
  MessageQueryOptions,
  Session,
  SessionConfig,
  ConversationSummary,
  Decision,
  DecisionInput
} from './conversation';

// Application Context
export { AppContext, getDefaultDbPath } from './context';

// Document Intelligence
export {
  MarkdownParser,
  MarkdownDocument,
  MarkdownSection,
  CodeBlock,
  Link
} from './documents';
