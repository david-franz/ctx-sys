// Query Parsing
export {
  QueryParser,
  QueryIntent,
  EntityMention,
  ParsedQuery,
  QueryParserOptions
} from './query-parser';

// Multi-Strategy Search
export {
  MultiStrategySearch,
  MultiSearchOptions,
  StrategyWeights
} from './multi-strategy-search';

// Context Assembly
export {
  ContextAssembler,
  ContextSource,
  ContextFormat,
  AssemblyOptions,
  AssembledContext,
  estimateTokens
} from './context-assembler';

// Relevance Feedback
export {
  RelevanceFeedback,
  FeedbackType,
  FeedbackSignal,
  FeedbackStats,
  RecordFeedbackOptions
} from './relevance-feedback';

// HyDE Query Expansion
export {
  HyDEQueryExpander,
  HypotheticalProvider,
  HypotheticalOptions,
  HyDEConfig,
  HyDEResult,
  HyDEQueryContext,
  MockHypotheticalProvider,
  DEFAULT_HYDE_CONFIG,
  buildHypotheticalPrompt
} from './hyde-expander';

// Shared Types
export {
  SearchResult,
  SearchStrategy,
  SearchConfig,
  RelevanceFeedbackInput,
  StoredFeedback,
  GateDecision,
  CritiqueResult,
  CritiqueIssue
} from './types';
