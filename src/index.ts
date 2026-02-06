// Main exports for ctx-sys

// Configuration
export {
  ConfigManager,
  ConfigManagerOptions,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PROJECT_CONFIG_FILE,
  GlobalConfig,
  ProjectConfigFile,
  ResolvedConfig,
  ProviderSettings,
  ProvidersConfig,
  OllamaProviderConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  CLIConfig,
  DefaultsConfig,
  DatabaseConfig,
  ProjectIdentity,
  IndexingConfig,
  SummarizationConfig as ConfigSummarizationConfig,
  EmbeddingsConfig,
  SessionsConfig,
  RetrievalConfig as ConfigRetrievalConfig
} from './config';

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
  RequirementExtractor,
  DocumentLinker,
  MarkdownDocument,
  MarkdownSection,
  CodeBlock,
  Link,
  Requirement,
  RequirementInput,
  RequirementSource,
  CodeReference,
  LinkingResult
} from './documents';

// Graph RAG
export {
  RelationshipStore,
  GraphTraversal,
  EntityResolver,
  DuplicateGroup,
  DuplicateDetectionOptions,
  MergeOptions,
  MergeResult,
  SemanticLinker,
  SemanticDiscoveryOptions,
  DiscoveryResult,
  SemanticLink,
  FindRelatedOptions,
  GraphRelationshipType,
  StoredRelationship,
  RelationshipInput,
  RelationshipQueryOptions,
  SubgraphResult,
  PathInfo,
  PathResult,
  GraphStatistics,
  TraversalOptions
} from './graph';

// Advanced Retrieval
export {
  QueryParser,
  QueryIntent,
  EntityMention,
  ParsedQuery,
  QueryParserOptions,
  MultiStrategySearch,
  MultiSearchOptions,
  StrategyWeights,
  ContextAssembler,
  ContextSource,
  ContextFormat,
  AssemblyOptions,
  AssembledContext,
  estimateTokens,
  RelevanceFeedback,
  FeedbackType,
  FeedbackSignal,
  FeedbackStats,
  RecordFeedbackOptions,
  HyDEQueryExpander,
  HypotheticalProvider,
  HypotheticalOptions,
  HyDEConfig,
  HyDEResult,
  HyDEQueryContext,
  MockHypotheticalProvider,
  DEFAULT_HYDE_CONFIG,
  buildHypotheticalPrompt,
  SearchResult,
  SearchStrategy,
  SearchConfig,
  RelevanceFeedbackInput,
  StoredFeedback,
  RetrievalGate,
  GateModelProvider,
  GateDecision,
  GateContext,
  GateConfig,
  MockGateModelProvider,
  DEFAULT_GATE_CONFIG,
  DraftCritique,
  CritiqueModelProvider,
  CritiqueConfig,
  DEFAULT_CRITIQUE_CONFIG,
  ExtractedClaim,
  CritiqueIteration,
  DraftCritiqueOutput,
  CritiqueOptions,
  MockCritiqueModelProvider,
  CritiqueResult,
  CritiqueIssue
} from './retrieval';

// Model Abstraction
export {
  ProviderFactory,
  ProviderFactoryOptions,
  ModelProviderConfig,
  ProviderHealth,
  MockSummarizationProvider,
  defaultProviderFactory
} from './models';

// File Watching
export {
  FileWatcher,
  WatchConfig,
  WatchEvent,
  WatchEventType,
  WatchStats,
  DEFAULT_WATCH_CONFIG,
  createFileWatcher
} from './watch';

// Agent Checkpointing and Memory Management
export {
  CheckpointManager,
  TriggerType,
  StepStatus,
  PlanStep,
  StepResult,
  AgentState,
  CheckpointMetadata,
  Checkpoint,
  CheckpointSummary,
  SaveOptions,
  CheckpointedExecutor,
  ExecuteOptions,
  ExecutionResult,
  StepExecutor,
  createStepExecutor,
  MemoryTierManager,
  MemoryTier,
  MemoryItemType,
  MemoryItem,
  MemoryStatus,
  MemorySuggestion,
  SpillResult,
  RecallResult,
  MemoryConfig,
  DEFAULT_MEMORY_CONFIG,
  SpillOptions,
  RecallOptions,
  AddMemoryOptions,
  MemoryEmbeddingProvider,
  ReflectionStore,
  ReflectionOutcome,
  Reflection,
  ReflectionInput,
  ReflectionQuery,
  ReflectionSummary,
  ReflectionConfig,
  DEFAULT_REFLECTION_CONFIG,
  ReflectionEmbeddingProvider,
  ProactiveContextProvider,
  ProactiveTriggerType,
  SuggestionType,
  SuggestionStatus,
  WatchPatternType,
  CallbackType,
  WatchPattern,
  ContextSubscription,
  SubscriptionInput,
  SuggestionItem,
  ContextSuggestion,
  ProactiveQuery,
  ProactiveConfig,
  DEFAULT_PROACTIVE_CONFIG,
  ProactiveContextSource
} from './agent';

// Token Analytics
export {
  QueryLogger,
  FullContextEstimator,
  DashboardService,
  QueryLog,
  UsageStats,
  DailyStats,
  QueryTypeStats,
  ProjectStats,
  TokenPricing,
  AnalyticsConfig,
  FullContextEstimate,
  QueryResult,
  LogOptions,
  DashboardData,
  SummaryCard,
  ChartData,
  RecentQueryItem,
  ProjectComparison,
  AnalyticsReport,
  DEFAULT_ANALYTICS_CONFIG
} from './analytics';
