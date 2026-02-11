import { Symbol, ParseResult } from '../ast';

/**
 * Summary detail level.
 */
export type SummaryLevel = 'minimal' | 'standard' | 'detailed';

/**
 * A summarized symbol with context-relevant information.
 */
export interface SymbolSummary {
  /** Symbol name */
  name: string;
  /** Symbol type (function, class, etc.) */
  type: string;
  /** Qualified name including file path */
  qualifiedName: string;
  /** One-line description */
  description: string;
  /** Function/method signature if applicable */
  signature?: string;
  /** Parameter descriptions */
  parameters?: ParameterSummary[];
  /** Return type description */
  returnType?: string;
  /** Child summaries (methods, properties) */
  children?: SymbolSummary[];
  /** Source location */
  location: {
    filePath: string;
    startLine: number;
    endLine: number;
  };
  /** Visibility (public, private, protected) */
  visibility?: 'public' | 'private' | 'protected';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Summarized parameter information.
 */
export interface ParameterSummary {
  name: string;
  type?: string;
  description?: string;
  isOptional?: boolean;
  isRest?: boolean;
  defaultValue?: string;
}

/**
 * File-level summary.
 */
export interface FileSummary {
  /** File path */
  filePath: string;
  /** Programming language */
  language: string;
  /** Brief file description */
  description: string;
  /** Main exports */
  exports: string[];
  /** Dependencies (imports) */
  dependencies: string[];
  /** Symbol summaries */
  symbols: SymbolSummary[];
  /** Total line count */
  lineCount?: number;
  /** Complexity metrics */
  metrics?: FileMetrics;
}

/**
 * File complexity metrics.
 */
export interface FileMetrics {
  /** Number of functions/methods */
  functionCount: number;
  /** Number of classes */
  classCount: number;
  /** Number of imports */
  importCount: number;
  /** Number of exports */
  exportCount: number;
  /** Estimated complexity (simple heuristic) */
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Options for summarization.
 */
export interface SummarizationOptions {
  /** Level of detail */
  level?: SummaryLevel;
  /** Include private/protected symbols */
  includePrivate?: boolean;
  /** Maximum children to include per symbol */
  maxChildren?: number;
  /** Include docstrings/comments */
  includeDocstrings?: boolean;
  /** Generate descriptions using LLM (requires provider) */
  useLLM?: boolean;
}

/**
 * LLM provider interface for generating descriptions.
 */
export interface LLMSummarizer {
  readonly name?: string;

  /**
   * Generate a description for a symbol.
   */
  summarizeSymbol(symbol: Symbol, context?: string): Promise<string>;

  /**
   * Generate a file description.
   */
  summarizeFile(parseResult: ParseResult): Promise<string>;
}
