/**
 * Context assembly for LLM consumption.
 * Formats search results into coherent context with source attribution.
 * F10.4: Enhanced with file reading and smart context assembly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Entity } from '../entities';
import { SearchResult } from './types';

/**
 * Source attribution for context.
 */
export interface ContextSource {
  entityId: string;
  name: string;
  type: string;
  file?: string;
  line?: number;
  relevance: number;
}

/**
 * Assembled context ready for LLM.
 */
export interface AssembledContext {
  /** Formatted context string */
  context: string;
  /** Source attributions */
  sources: ContextSource[];
  /** Estimated token count */
  tokenCount: number;
  /** Whether content was truncated */
  truncated: boolean;
  /** Summary if content was summarized to fit */
  summary?: string;
}

/**
 * Output format for context.
 */
export type ContextFormat = 'markdown' | 'xml' | 'plain';

/**
 * Options for context assembly.
 */
export interface AssemblyOptions {
  /** Maximum tokens in output */
  maxTokens?: number;
  /** Output format */
  format?: ContextFormat;
  /** Include source attribution section */
  includeSources?: boolean;
  /** Include full code content */
  includeCodeContent?: boolean;
  /** Group entities by type */
  groupByType?: boolean;
  /** Maximum content length per entity */
  maxContentLength?: number;
  /** Prefix text to add before context */
  prefix?: string;
  /** Suffix text to add after context */
  suffix?: string;
  /** F10.4: Read source files directly instead of using stored content */
  readFromSource?: boolean;
  /** F10.4: Project root for resolving relative file paths */
  projectRoot?: string;
  /** F10.4: Lines of context before/after the entity */
  contextLines?: number;
  /** F10.4: Include file imports as additional context */
  includeImports?: boolean;
}

/**
 * Default assembly options.
 */
const DEFAULT_OPTIONS: Required<AssemblyOptions> = {
  maxTokens: 4000,
  format: 'markdown',
  includeSources: true,
  includeCodeContent: true,
  groupByType: true,
  maxContentLength: 500,
  prefix: '',
  suffix: '',
  readFromSource: false,
  projectRoot: process.cwd(),
  contextLines: 0,
  includeImports: false
};

/**
 * Estimate token count for text.
 * Uses approximation of ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Assembles search results into formatted context for LLM consumption.
 * F10.4: Enhanced with file reading and smart context assembly.
 */
export class ContextAssembler {
  /** F10.4: File cache for efficient repeated reads */
  private fileCache: Map<string, string[]> = new Map();

  /**
   * F10.4: Clear the file cache.
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * F10.4: Read and cache file lines.
   */
  private getFileLines(filePath: string, projectRoot: string): string[] | null {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectRoot, filePath);

    if (this.fileCache.has(fullPath)) {
      return this.fileCache.get(fullPath)!;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      this.fileCache.set(fullPath, lines);
      return lines;
    } catch {
      return null;
    }
  }

  /**
   * F10.4: Extract code from source file with context lines.
   */
  private extractCodeFromFile(
    filePath: string,
    startLine: number,
    endLine: number | undefined,
    contextLines: number,
    projectRoot: string
  ): string | null {
    const lines = this.getFileLines(filePath, projectRoot);
    if (!lines) return null;

    const actualEndLine = endLine || startLine + 50;
    const start = Math.max(0, startLine - 1 - contextLines);
    const end = Math.min(lines.length, actualEndLine + contextLines);

    return lines.slice(start, end).join('\n');
  }

  /**
   * F10.4: Extract imports from source file.
   */
  private extractImportsFromFile(filePath: string, projectRoot: string): string | null {
    const lines = this.getFileLines(filePath, projectRoot);
    if (!lines) return null;

    const imports: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') ||
          trimmed.startsWith('from ') ||
          (trimmed.startsWith('const ') && trimmed.includes('require('))) {
        imports.push(line);
      } else if (imports.length > 0 && trimmed &&
                 !trimmed.startsWith('import') &&
                 !trimmed.startsWith('from') &&
                 !trimmed.startsWith('//') &&
                 !trimmed.startsWith('/*') &&
                 !trimmed.startsWith('*')) {
        break;
      }
    }

    return imports.length > 0 ? imports.join('\n') : null;
  }

  /**
   * Assemble context from search results.
   */
  assemble(results: SearchResult[], options?: AssemblyOptions): AssembledContext {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const context: AssembledContext = {
      context: '',
      sources: [],
      tokenCount: 0,
      truncated: false
    };

    // Add prefix tokens
    if (opts.prefix) {
      context.tokenCount += estimateTokens(opts.prefix);
    }

    // Reserve tokens for suffix and sources
    const reservedTokens = estimateTokens(opts.suffix || '') +
      (opts.includeSources ? 200 : 0);
    const availableTokens = opts.maxTokens - reservedTokens;

    // Sort by relevance
    const sorted = [...results].sort((a, b) => b.score - a.score);

    // Group by type if requested
    const grouped = opts.groupByType
      ? this.groupByType(sorted)
      : { all: sorted };

    // Build context sections
    const sections: string[] = [];

    for (const [group, groupResults] of Object.entries(grouped)) {
      const sectionLines: string[] = [];

      // Add group header
      if (opts.groupByType && group !== 'all') {
        const header = this.formatGroupHeader(group, opts.format);
        sectionLines.push(header);
        context.tokenCount += estimateTokens(header);
      }

      for (const result of groupResults) {
        const formatted = this.formatEntity(result.entity, opts);
        const tokens = estimateTokens(formatted);

        // Check if we'd exceed budget
        if (context.tokenCount + tokens > availableTokens) {
          context.truncated = true;
          break;
        }

        sectionLines.push(formatted);
        context.tokenCount += tokens;

        // Track source
        context.sources.push({
          entityId: result.entity.id,
          name: result.entity.name,
          type: result.entity.type,
          file: result.entity.filePath,
          line: result.entity.startLine,
          relevance: result.score
        });
      }

      if (sectionLines.length > (opts.groupByType && group !== 'all' ? 1 : 0)) {
        sections.push(sectionLines.join('\n\n'));
      }

      if (context.truncated) break;
    }

    // Join sections
    const separator = opts.format === 'xml' ? '\n' : '\n\n---\n\n';
    let assembled = sections.join(separator);

    // Add prefix
    if (opts.prefix) {
      assembled = opts.prefix + '\n\n' + assembled;
    }

    // Add sources footer if requested
    if (opts.includeSources && context.sources.length > 0) {
      const sourcesFooter = this.formatSources(context.sources, opts.format);
      const footerTokens = estimateTokens(sourcesFooter);

      if (context.tokenCount + footerTokens <= opts.maxTokens - estimateTokens(opts.suffix)) {
        assembled += '\n\n' + sourcesFooter;
        context.tokenCount += footerTokens;
      }
    }

    // Add suffix
    if (opts.suffix) {
      assembled += '\n\n' + opts.suffix;
      context.tokenCount += estimateTokens(opts.suffix);
    }

    context.context = assembled;

    return context;
  }

  /**
   * Assemble context from entities directly (without search results).
   */
  assembleFromEntities(entities: Entity[], options?: AssemblyOptions): AssembledContext {
    // Convert entities to search results format
    const results: SearchResult[] = entities.map((entity, index) => ({
      entity,
      score: 1 - (index * 0.01), // Preserve order with decreasing scores
      source: 'keyword' as const
    }));

    return this.assemble(results, options);
  }

  /**
   * Group results by entity type category.
   */
  private groupByType(results: SearchResult[]): Record<string, SearchResult[]> {
    const groups: Record<string, SearchResult[]> = {};

    for (const result of results) {
      const category = this.categorizeType(result.entity.type);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(result);
    }

    // Order: code first, then docs, then conversation, then other
    const ordered: Record<string, SearchResult[]> = {};
    const order = ['code', 'documentation', 'conversation', 'other'];

    for (const category of order) {
      if (groups[category]) {
        ordered[category] = groups[category];
      }
    }

    return ordered;
  }

  /**
   * Categorize entity type into broader categories.
   */
  private categorizeType(type: string): string {
    const codeTypes = ['function', 'method', 'class', 'interface', 'type', 'file', 'module', 'variable', 'constant'];
    const docTypes = ['document', 'section', 'requirement', 'feature', 'concept'];
    const convTypes = ['session', 'message', 'decision', 'summary'];

    if (codeTypes.includes(type)) return 'code';
    if (docTypes.includes(type)) return 'documentation';
    if (convTypes.includes(type)) return 'conversation';
    return 'other';
  }

  /**
   * Format a group header.
   */
  private formatGroupHeader(group: string, format: ContextFormat): string {
    const titles: Record<string, string> = {
      code: 'Relevant Code',
      documentation: 'Related Documentation',
      conversation: 'Previous Conversations',
      other: 'Other Context'
    };

    const title = titles[group] || group;

    switch (format) {
      case 'xml':
        return `<section name="${title}">`;
      case 'markdown':
        return `## ${title}`;
      default:
        return `=== ${title} ===`;
    }
  }

  /**
   * Format an entity for the context.
   */
  private formatEntity(entity: Entity, options: Required<AssemblyOptions>): string {
    switch (options.format) {
      case 'xml':
        return this.formatEntityXml(entity, options);
      case 'markdown':
        return this.formatEntityMarkdown(entity, options);
      default:
        return this.formatEntityPlain(entity, options);
    }
  }

  /**
   * Format entity as Markdown.
   * F10.4: Enhanced with source file reading and imports.
   */
  private formatEntityMarkdown(entity: Entity, options: Required<AssemblyOptions>): string {
    const lines: string[] = [];

    // Header with location
    const location = entity.filePath
      ? `${entity.filePath}${entity.startLine ? `:${entity.startLine}` : ''}`
      : entity.type;

    lines.push(`### ${entity.name}`);
    lines.push(`*${location}*`);
    lines.push('');

    // Summary
    if (entity.summary) {
      lines.push(entity.summary);
    }

    // F10.4: Include imports if requested
    if (options.includeImports && entity.filePath) {
      const imports = this.extractImportsFromFile(entity.filePath, options.projectRoot);
      if (imports) {
        lines.push('');
        lines.push('**Imports:**');
        lines.push('```');
        lines.push(imports);
        lines.push('```');
      }
    }

    // Code content if requested
    if (options.includeCodeContent) {
      let content: string | null = null;
      let truncated = false;

      // F10.4: Read from source file if enabled and we have file metadata
      if (options.readFromSource && entity.filePath && entity.startLine) {
        content = this.extractCodeFromFile(
          entity.filePath,
          entity.startLine,
          entity.endLine,
          options.contextLines,
          options.projectRoot
        );
      }

      // Fall back to stored content
      if (!content && entity.content) {
        content = entity.content;
      }

      if (content) {
        // Apply max content length
        if (content.length > options.maxContentLength) {
          content = content.slice(0, options.maxContentLength);
          truncated = true;
        }

        const language = this.detectLanguage(entity.filePath);
        lines.push('');
        lines.push('```' + (language || ''));
        lines.push(content);
        if (truncated) {
          lines.push('// ... (truncated)');
        }
        lines.push('```');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format entity as XML.
   */
  private formatEntityXml(entity: Entity, options: Required<AssemblyOptions>): string {
    const attrs = [
      `type="${entity.type}"`,
      entity.filePath ? `file="${this.escapeXml(entity.filePath)}"` : null,
      entity.startLine ? `line="${entity.startLine}"` : null
    ].filter(Boolean).join(' ');

    const content = (entity.summary || entity.content || '').slice(0, options.maxContentLength);

    return `<entity name="${this.escapeXml(entity.name)}" ${attrs}>
${this.escapeXml(content)}
</entity>`;
  }

  /**
   * Format entity as plain text.
   */
  private formatEntityPlain(entity: Entity, options: Required<AssemblyOptions>): string {
    const location = entity.filePath
      ? `[${entity.filePath}:${entity.startLine || 0}]`
      : `[${entity.type}]`;

    const content = (entity.summary || entity.content || '').slice(0, options.maxContentLength);

    return `${entity.name} ${location}\n${content}`;
  }

  /**
   * Format sources section.
   */
  private formatSources(sources: ContextSource[], format: ContextFormat): string {
    if (sources.length === 0) return '';

    const lines: string[] = [];
    const displaySources = sources.slice(0, 10);

    switch (format) {
      case 'markdown':
        lines.push('---');
        lines.push('**Sources:**');
        for (const source of displaySources) {
          const loc = source.file
            ? `${source.file}${source.line ? `:${source.line}` : ''}`
            : source.type;
          lines.push(`- ${source.name} (${loc})`);
        }
        if (sources.length > 10) {
          lines.push(`- ... and ${sources.length - 10} more`);
        }
        break;

      case 'xml':
        lines.push('<sources>');
        for (const source of displaySources) {
          lines.push(`  <source name="${this.escapeXml(source.name)}" type="${source.type}"${source.file ? ` file="${this.escapeXml(source.file)}"` : ''} />`);
        }
        lines.push('</sources>');
        break;

      default:
        lines.push('Sources:');
        for (const source of displaySources) {
          lines.push(`  - ${source.name}`);
        }
        if (sources.length > 10) {
          lines.push(`  - ... and ${sources.length - 10} more`);
        }
    }

    return lines.join('\n');
  }

  /**
   * Detect programming language from file path.
   */
  private detectLanguage(filePath?: string): string | null {
    if (!filePath) return null;

    const ext = filePath.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sh: 'bash',
      sql: 'sql',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      html: 'html',
      css: 'css'
    };

    return map[ext || ''] || null;
  }

  /**
   * Escape XML special characters.
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Create a summary of the context for when full context doesn't fit.
   */
  summarize(sources: ContextSource[], maxTokens: number = 200): string {
    const typeGroups = new Map<string, string[]>();

    for (const source of sources) {
      const category = this.categorizeType(source.type);
      const names = typeGroups.get(category) || [];
      names.push(source.name);
      typeGroups.set(category, names);
    }

    const parts: string[] = [];

    for (const [category, names] of typeGroups) {
      const displayNames = names.slice(0, 3);
      const extra = names.length > 3 ? ` (and ${names.length - 3} more)` : '';
      parts.push(`${category}: ${displayNames.join(', ')}${extra}`);
    }

    const summary = `Context includes: ${parts.join('; ')}.`;

    // Truncate if too long
    if (estimateTokens(summary) > maxTokens) {
      const truncated = summary.slice(0, maxTokens * 4 - 3) + '...';
      return truncated;
    }

    return summary;
  }
}
