/**
 * Context assembly for LLM consumption.
 * Formats search results into coherent context with source attribution.
 */

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
  suffix: ''
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
 */
export class ContextAssembler {
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

    // Code content if requested
    if (options.includeCodeContent && entity.content) {
      const language = this.detectLanguage(entity.filePath);
      const content = entity.content.slice(0, options.maxContentLength);
      const truncated = entity.content.length > options.maxContentLength;

      lines.push('');
      lines.push('```' + (language || ''));
      lines.push(content);
      if (truncated) {
        lines.push('// ... (truncated)');
      }
      lines.push('```');
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
