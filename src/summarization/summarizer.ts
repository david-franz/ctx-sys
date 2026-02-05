import { Symbol, ParseResult, Parameter } from '../ast';
import {
  SymbolSummary,
  ParameterSummary,
  FileSummary,
  FileMetrics,
  SummarizationOptions,
  LLMSummarizer
} from './types';

/**
 * Default summarization options.
 */
const DEFAULT_OPTIONS: Required<SummarizationOptions> = {
  level: 'standard',
  includePrivate: false,
  maxChildren: 20,
  includeDocstrings: true,
  useLLM: false
};

/**
 * Summarizes parsed code symbols into context-friendly descriptions.
 */
export class SymbolSummarizer {
  private options: Required<SummarizationOptions>;
  private llmSummarizer?: LLMSummarizer;

  constructor(options?: SummarizationOptions, llmSummarizer?: LLMSummarizer) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.llmSummarizer = llmSummarizer;
  }

  /**
   * Summarize a complete file parse result.
   */
  async summarizeFile(parseResult: ParseResult): Promise<FileSummary> {
    const symbols = await this.summarizeSymbols(
      parseResult.symbols,
      parseResult.filePath
    );

    const metrics = this.computeMetrics(parseResult);
    let description = this.generateFileDescription(parseResult, metrics);

    // Use LLM for better description if available
    if (this.options.useLLM && this.llmSummarizer) {
      try {
        description = await this.llmSummarizer.summarizeFile(parseResult);
      } catch {
        // Fall back to generated description
      }
    }

    return {
      filePath: parseResult.filePath,
      language: parseResult.language,
      description,
      exports: parseResult.exports,
      dependencies: parseResult.imports.map(i => i.source),
      symbols,
      metrics
    };
  }

  /**
   * Summarize an array of symbols.
   */
  async summarizeSymbols(
    symbols: Symbol[],
    filePath: string
  ): Promise<SymbolSummary[]> {
    const summaries: SymbolSummary[] = [];

    for (const symbol of symbols) {
      // Skip private symbols if not included
      if (!this.options.includePrivate && this.isPrivate(symbol)) {
        continue;
      }

      const summary = await this.summarizeSymbol(symbol, filePath);
      summaries.push(summary);
    }

    return summaries;
  }

  /**
   * Summarize a single symbol.
   */
  async summarizeSymbol(symbol: Symbol, filePath: string): Promise<SymbolSummary> {
    let description = this.generateSymbolDescription(symbol);

    // Use LLM for better description if available
    if (this.options.useLLM && this.llmSummarizer) {
      try {
        description = await this.llmSummarizer.summarizeSymbol(symbol);
      } catch {
        // Fall back to generated description
      }
    }

    const summary: SymbolSummary = {
      name: symbol.name,
      type: symbol.type,
      qualifiedName: symbol.qualifiedName,
      description,
      location: {
        filePath,
        startLine: symbol.startLine,
        endLine: symbol.endLine
      }
    };

    // Add signature for functions/methods
    if (symbol.signature) {
      summary.signature = symbol.signature;
    }

    // Add parameters
    if (symbol.parameters && symbol.parameters.length > 0) {
      summary.parameters = this.summarizeParameters(symbol.parameters);
    }

    // Add return type
    if (symbol.returnType) {
      summary.returnType = symbol.returnType;
    }

    // Add visibility
    if (symbol.visibility) {
      summary.visibility = symbol.visibility;
    }

    // Add children (methods, properties)
    if (symbol.children && symbol.children.length > 0) {
      const childSymbols = this.options.maxChildren
        ? symbol.children.slice(0, this.options.maxChildren)
        : symbol.children;

      summary.children = await Promise.all(
        childSymbols.map(child => this.summarizeSymbol(child, filePath))
      );
    }

    // Add metadata based on detail level
    if (this.options.level === 'detailed') {
      summary.metadata = this.extractMetadata(symbol);
    }

    return summary;
  }

  /**
   * Generate a description for a symbol.
   */
  private generateSymbolDescription(symbol: Symbol): string {
    // Use docstring if available and option is enabled
    if (this.options.includeDocstrings && symbol.docstring) {
      // Return first line of docstring
      const firstLine = symbol.docstring.split('\n')[0].trim();
      if (firstLine) return firstLine;
    }

    // Generate based on symbol type
    switch (symbol.type) {
      case 'function':
        return this.describeFunctionSymbol(symbol);
      case 'method':
        return this.describeMethodSymbol(symbol);
      case 'class':
        return this.describeClassSymbol(symbol);
      case 'interface':
        return `Interface defining ${symbol.name} contract`;
      case 'type':
        return `Type alias ${symbol.name}`;
      case 'enum':
        return `Enumeration ${symbol.name}`;
      case 'property':
        return this.describePropertySymbol(symbol);
      case 'variable':
        return `Variable ${symbol.name}`;
      case 'namespace':
        return `Namespace ${symbol.name}`;
      case 'module':
        return `Module ${symbol.name}`;
      default:
        return `${symbol.type} ${symbol.name}`;
    }
  }

  /**
   * Describe a function symbol.
   */
  private describeFunctionSymbol(symbol: Symbol): string {
    const parts: string[] = [];

    if (symbol.isAsync) parts.push('Async');
    if (symbol.isExported) parts.push('exported');

    parts.push('function');

    if (symbol.parameters && symbol.parameters.length > 0) {
      parts.push(`taking ${symbol.parameters.length} parameter(s)`);
    }

    if (symbol.returnType && symbol.returnType !== 'void') {
      parts.push(`returning ${symbol.returnType}`);
    }

    return parts.join(' ');
  }

  /**
   * Describe a method symbol.
   */
  private describeMethodSymbol(symbol: Symbol): string {
    const parts: string[] = [];

    if (symbol.visibility && symbol.visibility !== 'public') {
      parts.push(symbol.visibility);
    }
    if (symbol.isStatic) parts.push('static');
    if (symbol.isAsync) parts.push('async');

    parts.push('method');

    if (symbol.parameters && symbol.parameters.length > 0) {
      // Don't count 'self' or 'this' as real parameters
      const realParams = symbol.parameters.filter(
        p => p.name !== 'self' && p.name !== 'this'
      );
      if (realParams.length > 0) {
        parts.push(`taking ${realParams.length} parameter(s)`);
      }
    }

    if (symbol.returnType && symbol.returnType !== 'void') {
      parts.push(`returning ${symbol.returnType}`);
    }

    return parts.join(' ');
  }

  /**
   * Describe a class symbol.
   */
  private describeClassSymbol(symbol: Symbol): string {
    const parts: string[] = [];

    if (symbol.isExported) parts.push('Exported');

    parts.push('class');

    if (symbol.children && symbol.children.length > 0) {
      const methods = symbol.children.filter(c => c.type === 'method').length;
      const props = symbol.children.filter(c => c.type === 'property').length;

      const memberParts: string[] = [];
      if (methods > 0) memberParts.push(`${methods} method(s)`);
      if (props > 0) memberParts.push(`${props} property/ies`);

      if (memberParts.length > 0) {
        parts.push(`with ${memberParts.join(' and ')}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Describe a property symbol.
   */
  private describePropertySymbol(symbol: Symbol): string {
    const parts: string[] = [];

    if (symbol.visibility && symbol.visibility !== 'public') {
      parts.push(symbol.visibility);
    }
    if (symbol.isStatic) parts.push('static');

    parts.push('property');

    if (symbol.returnType) {
      parts.push(`of type ${symbol.returnType}`);
    }

    return parts.join(' ');
  }

  /**
   * Summarize parameters.
   */
  private summarizeParameters(params: Parameter[]): ParameterSummary[] {
    return params.map(p => ({
      name: p.name,
      type: p.type,
      isOptional: p.isOptional,
      isRest: p.isRest
    }));
  }

  /**
   * Extract additional metadata for detailed summaries.
   */
  private extractMetadata(symbol: Symbol): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (symbol.decorators && symbol.decorators.length > 0) {
      metadata.decorators = symbol.decorators;
    }

    if (symbol.isAsync) metadata.async = true;
    if (symbol.isStatic) metadata.static = true;
    if (symbol.isExported) metadata.exported = true;

    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  /**
   * Check if a symbol is private.
   */
  private isPrivate(symbol: Symbol): boolean {
    if (symbol.visibility === 'private') return true;
    // Python convention: names starting with underscore are private
    if (symbol.name.startsWith('_') && !symbol.name.startsWith('__')) return true;
    // Python dunder methods are public
    if (symbol.name.startsWith('__') && symbol.name.endsWith('__')) return false;
    // Python double underscore prefix is private
    if (symbol.name.startsWith('__')) return true;
    return false;
  }

  /**
   * Compute file metrics.
   */
  private computeMetrics(parseResult: ParseResult): FileMetrics {
    let functionCount = 0;
    let classCount = 0;

    const countSymbols = (symbols: Symbol[]): void => {
      for (const symbol of symbols) {
        if (symbol.type === 'function' || symbol.type === 'method') {
          functionCount++;
        } else if (symbol.type === 'class') {
          classCount++;
        }

        if (symbol.children) {
          countSymbols(symbol.children);
        }
      }
    };

    countSymbols(parseResult.symbols);

    const importCount = parseResult.imports.length;
    const exportCount = parseResult.exports.length;

    // Simple complexity heuristic
    const totalItems = functionCount + classCount + importCount;
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (totalItems > 20) complexity = 'high';
    else if (totalItems > 10) complexity = 'medium';

    return {
      functionCount,
      classCount,
      importCount,
      exportCount,
      complexity
    };
  }

  /**
   * Generate a file description.
   */
  private generateFileDescription(
    parseResult: ParseResult,
    metrics: FileMetrics
  ): string {
    const parts: string[] = [];

    parts.push(`${parseResult.language} file`);

    const mainTypes: string[] = [];
    if (metrics.classCount > 0) {
      mainTypes.push(`${metrics.classCount} class(es)`);
    }
    if (metrics.functionCount > 0) {
      mainTypes.push(`${metrics.functionCount} function(s)`);
    }

    if (mainTypes.length > 0) {
      parts.push(`containing ${mainTypes.join(' and ')}`);
    }

    if (parseResult.exports.length > 0) {
      if (parseResult.exports.length <= 3) {
        parts.push(`exporting ${parseResult.exports.join(', ')}`);
      } else {
        parts.push(`exporting ${parseResult.exports.length} symbols`);
      }
    }

    return parts.join(' ');
  }
}
