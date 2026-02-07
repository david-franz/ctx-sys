/**
 * Query parsing for advanced retrieval.
 * Extracts intent, keywords, entity mentions, and expands queries.
 */

/**
 * Query intent types.
 */
export type QueryIntent =
  | 'find'      // Looking for specific code/entity
  | 'explain'   // Wants explanation of how something works
  | 'list'      // Wants enumeration of items
  | 'compare'   // Wants comparison between entities
  | 'how'       // Wants procedural information
  | 'why'       // Wants reasoning/rationale
  | 'debug'     // Troubleshooting an issue
  | 'general';  // General question

/**
 * Extracted entity mention from query.
 */
export interface EntityMention {
  /** The raw text of the mention */
  text: string;
  /** Type of mention */
  type: 'code' | 'file' | 'class' | 'function' | 'variable' | 'unknown';
  /** Start position in original query */
  start: number;
  /** End position in original query */
  end: number;
}

/**
 * Result of parsing a query.
 */
export interface ParsedQuery {
  /** Original query text */
  original: string;
  /** Detected primary intent */
  intent: QueryIntent;
  /** Confidence in intent detection (0-1) */
  intentConfidence: number;
  /** Extracted keywords */
  keywords: string[];
  /** Entity mentions found in query */
  entityMentions: EntityMention[];
  /** Expanded query terms (synonyms, related) */
  expandedTerms: string[];
  /** Normalized query for search */
  normalizedQuery: string;
}

/**
 * Options for query parsing.
 */
export interface QueryParserOptions {
  /** Whether to expand query with synonyms */
  expandSynonyms?: boolean;
  /** Custom stop words to filter */
  customStopWords?: string[];
  /** Custom synonyms map */
  customSynonyms?: Record<string, string[]>;
  /** Minimum keyword length */
  minKeywordLength?: number;
}

/**
 * Intent detection pattern with confidence weight.
 */
interface IntentPattern {
  pattern: RegExp;
  intent: QueryIntent;
  weight: number;
}

/**
 * Parses natural language queries to extract structured information
 * for retrieval operations.
 */
export class QueryParser {
  private stopWords: Set<string>;
  private synonyms: Map<string, string[]>;
  private intentPatterns: IntentPattern[];

  constructor(private options: QueryParserOptions = {}) {
    this.stopWords = new Set([
      ...DEFAULT_STOP_WORDS,
      ...(options.customStopWords ?? [])
    ]);

    this.synonyms = buildBidirectionalSynonyms({
      ...DEFAULT_SYNONYMS,
      ...(options.customSynonyms ?? {})
    });

    this.intentPatterns = this.buildIntentPatterns();
  }

  /**
   * Parse a query string into structured components.
   */
  parse(query: string): ParsedQuery {
    const original = query.trim();
    const normalized = this.normalizeQuery(original);

    // Detect intent
    const { intent, confidence } = this.detectIntent(original);

    // Extract entity mentions
    const entityMentions = this.extractEntityMentions(original);

    // Extract keywords
    const keywords = this.extractKeywords(normalized, entityMentions);

    // Expand terms
    const expandedTerms = this.options.expandSynonyms !== false
      ? this.expandTerms(keywords)
      : [];

    return {
      original,
      intent,
      intentConfidence: confidence,
      keywords,
      entityMentions,
      expandedTerms,
      normalizedQuery: normalized
    };
  }

  /**
   * Detect the primary intent of a query.
   */
  private detectIntent(query: string): { intent: QueryIntent; confidence: number } {
    const lowerQuery = query.toLowerCase();
    let bestMatch: { intent: QueryIntent; confidence: number } = {
      intent: 'general',
      confidence: 0.3
    };

    for (const pattern of this.intentPatterns) {
      if (pattern.pattern.test(lowerQuery)) {
        if (pattern.weight > bestMatch.confidence) {
          bestMatch = { intent: pattern.intent, confidence: pattern.weight };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Build intent detection patterns.
   */
  private buildIntentPatterns(): IntentPattern[] {
    return [
      // Find patterns
      { pattern: /^(find|search|locate|where\s+is|look\s+for)\b/i, intent: 'find', weight: 0.9 },
      { pattern: /\b(definition\s+of|implementation\s+of)\b/i, intent: 'find', weight: 0.85 },
      { pattern: /\bwhere\b.*\b(defined|declared|implemented)\b/i, intent: 'find', weight: 0.85 },

      // Explain patterns
      { pattern: /^(explain|describe|what\s+is|what\s+does|what\s+are)\b/i, intent: 'explain', weight: 0.9 },
      { pattern: /\bhow\s+does\b.*\bwork\b/i, intent: 'explain', weight: 0.85 },
      { pattern: /\bexplain\b/i, intent: 'explain', weight: 0.8 },

      // List patterns
      { pattern: /^(list|show|enumerate|get\s+all)\b/i, intent: 'list', weight: 0.9 },
      { pattern: /\b(all|every)\b.*\b(function|class|method|file)s?\b/i, intent: 'list', weight: 0.8 },
      { pattern: /what\s+(are\s+)?(the\s+)?(all\s+)?.*s\?$/i, intent: 'list', weight: 0.7 },

      // Compare patterns
      { pattern: /^compare\b/i, intent: 'compare', weight: 0.95 },
      { pattern: /\bdifference\s+between\b/i, intent: 'compare', weight: 0.9 },
      { pattern: /\bvs\.?\b|\bversus\b/i, intent: 'compare', weight: 0.85 },
      { pattern: /\b(compare|contrast|differ)\b/i, intent: 'compare', weight: 0.8 },

      // How patterns
      { pattern: /^how\s+(do|can|to|should)\b/i, intent: 'how', weight: 0.9 },
      { pattern: /\bhow\s+to\b/i, intent: 'how', weight: 0.85 },
      { pattern: /\bsteps\s+to\b/i, intent: 'how', weight: 0.8 },

      // Why patterns
      { pattern: /^why\b/i, intent: 'why', weight: 0.9 },
      { pattern: /\breason\s+(for|why)\b/i, intent: 'why', weight: 0.85 },
      { pattern: /\bwhy\s+(is|does|do|are|was|were)\b/i, intent: 'why', weight: 0.85 },

      // Debug patterns
      { pattern: /\b(error|bug|issue|problem|crash|fail|broken)\b/i, intent: 'debug', weight: 0.85 },
      { pattern: /\b(debug|fix|solve|troubleshoot)\b/i, intent: 'debug', weight: 0.9 },
      { pattern: /\bnot\s+working\b/i, intent: 'debug', weight: 0.85 },
      { pattern: /\bthrow(s|ing|n)?\b.*\b(error|exception)\b/i, intent: 'debug', weight: 0.8 }
    ];
  }

  /**
   * Extract entity mentions from query.
   */
  extractEntityMentions(query: string): EntityMention[] {
    const mentions: EntityMention[] = [];

    // Backtick code mentions: `something`
    const backtickPattern = /`([^`]+)`/g;
    let match: RegExpExecArray | null;
    while ((match = backtickPattern.exec(query)) !== null) {
      mentions.push({
        text: match[1],
        type: this.classifyCodeMention(match[1]),
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // File path patterns: path/to/file.ext or ./file.ext
    const filePattern = /(?:^|[\s(])([./]?(?:[\w.-]+\/)+[\w.-]+\.\w+)(?:[\s):]|$)/g;
    while ((match = filePattern.exec(query)) !== null) {
      // Avoid duplicating backtick matches
      const start = match.index + (match[0].startsWith(' ') || match[0].startsWith('(') ? 1 : 0);
      const matchLen = match[1].length;
      if (!mentions.some(m => m.start <= start && m.end >= start + matchLen)) {
        mentions.push({
          text: match[1],
          type: 'file',
          start,
          end: start + match[1].length
        });
      }
    }

    // PascalCase class names (standalone words)
    const classPattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g;
    while ((match = classPattern.exec(query)) !== null) {
      const idx = match.index;
      const len = match[0].length;
      if (!mentions.some(m => m.start <= idx && m.end >= idx + len)) {
        mentions.push({
          text: match[1],
          type: 'class',
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    // camelCase with parentheses (function calls)
    const funcCallPattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
    while ((match = funcCallPattern.exec(query)) !== null) {
      const idx = match.index;
      const len = match[1].length;
      if (!mentions.some(m => m.start <= idx && m.end >= idx + len)) {
        mentions.push({
          text: match[1],
          type: 'function',
          start: match.index,
          end: match.index + match[1].length
        });
      }
    }

    // Sort by position
    mentions.sort((a, b) => a.start - b.start);

    return mentions;
  }

  /**
   * Classify a code mention by type.
   */
  private classifyCodeMention(text: string): EntityMention['type'] {
    // File paths
    if (text.includes('/') || text.includes('\\') || /\.\w{1,5}$/.test(text)) {
      return 'file';
    }

    // PascalCase - likely class
    if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(text)) {
      return 'class';
    }

    // camelCase or snake_case with parentheses - function
    if (/^[a-z][a-zA-Z0-9_]*$/.test(text) && text.includes('(')) {
      return 'function';
    }

    // camelCase - likely function or variable
    if (/^[a-z][a-zA-Z0-9]*$/.test(text)) {
      return 'function';
    }

    // snake_case or SCREAMING_SNAKE - variable/constant
    if (/^[a-z_][a-z0-9_]*$/i.test(text)) {
      return 'variable';
    }

    return 'code';
  }

  /**
   * Extract keywords from normalized query.
   */
  extractKeywords(normalizedQuery: string, entityMentions: EntityMention[]): string[] {
    const minLength = this.options.minKeywordLength ?? 2;

    // Get entity mention texts to preserve them
    const mentionTexts = new Set(entityMentions.map(m => m.text.toLowerCase()));

    // Tokenize
    const tokens = normalizedQuery
      .toLowerCase()
      .split(/[\s\-_.,;:!?'"()\[\]{}]+/)
      .filter(t => t.length >= minLength);

    // Filter and deduplicate
    const keywords = new Set<string>();

    for (const token of tokens) {
      // Always keep entity mentions
      if (mentionTexts.has(token)) {
        keywords.add(token);
        continue;
      }

      // Filter stop words
      if (this.stopWords.has(token)) {
        continue;
      }

      // Filter pure numbers
      if (/^\d+$/.test(token)) {
        continue;
      }

      keywords.add(token);
    }

    return Array.from(keywords);
  }

  /**
   * Expand terms with synonyms.
   */
  expandTerms(keywords: string[]): string[] {
    const expanded = new Set<string>();

    for (const keyword of keywords) {
      const synonymList = this.synonyms.get(keyword.toLowerCase());
      if (synonymList) {
        for (const syn of synonymList) {
          if (!keywords.includes(syn)) {
            expanded.add(syn);
          }
        }
      }
    }

    return Array.from(expanded);
  }

  /**
   * Normalize a query for searching.
   */
  private normalizeQuery(query: string): string {
    return query
      // Remove backticks but keep content
      .replace(/`([^`]+)`/g, '$1')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove common punctuation that doesn't add meaning
      .replace(/[?!.]+$/g, '')
      .trim();
  }

  /**
   * Get keywords suitable for exact matching.
   */
  getExactMatchTerms(parsed: ParsedQuery): string[] {
    // Entity mentions are best for exact matching
    return parsed.entityMentions.map(m => m.text);
  }

  /**
   * Get keywords suitable for fuzzy/semantic matching.
   */
  getSemanticTerms(parsed: ParsedQuery): string[] {
    // Combine keywords and expanded terms
    return [...parsed.keywords, ...parsed.expandedTerms];
  }

  /**
   * Generate search queries from a parsed query.
   */
  generateSearchQueries(parsed: ParsedQuery): string[] {
    const queries: string[] = [];

    // Original normalized query
    queries.push(parsed.normalizedQuery);

    // Keywords only
    if (parsed.keywords.length > 0) {
      queries.push(parsed.keywords.join(' '));
    }

    // With expanded terms
    if (parsed.expandedTerms.length > 0) {
      queries.push([...parsed.keywords, ...parsed.expandedTerms].join(' '));
    }

    // Entity-focused queries
    for (const mention of parsed.entityMentions) {
      queries.push(mention.text);
    }

    // Deduplicate
    return [...new Set(queries)];
  }
}

/**
 * Default stop words for English technical queries.
 */
const DEFAULT_STOP_WORDS = [
  // Articles
  'a', 'an', 'the',
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into', 'about',
  // Conjunctions
  'and', 'or', 'but', 'nor', 'so', 'yet',
  // Pronouns
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this', 'that', 'these', 'those',
  // Common verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
  // Question words (kept separate from intent detection)
  'what', 'which', 'who', 'whom', 'whose',
  // Other common words
  'there', 'here', 'when', 'where', 'then', 'than', 'if', 'else', 'also', 'just', 'only', 'very', 'too', 'any', 'all', 'each', 'every', 'some', 'no', 'not'
];

/**
 * Default synonyms for technical terms.
 * These are expanded bidirectionally at construction time.
 */
const DEFAULT_SYNONYMS: Record<string, string[]> = {
  // Functions
  'function': ['method', 'func', 'handler', 'callback', 'procedure'],
  'method': ['function', 'func', 'procedure'],

  // Classes
  'class': ['type', 'interface', 'struct', 'model'],
  'interface': ['type', 'class', 'contract'],

  // Files
  'file': ['module', 'source'],
  'module': ['file', 'package', 'library'],

  // Data storage
  'database': ['db', 'sqlite', 'sql', 'persistence', 'storage'],
  'storage': ['store', 'persistence', 'cache', 'repository'],
  'cache': ['memoize', 'cached', 'store'],

  // Actions
  'create': ['make', 'add', 'new', 'generate', 'insert'],
  'delete': ['remove', 'destroy', 'drop', 'purge'],
  'update': ['modify', 'change', 'edit', 'alter', 'patch'],
  'get': ['fetch', 'retrieve', 'read', 'load', 'find'],
  'set': ['assign', 'write', 'store', 'save'],
  'search': ['find', 'query', 'lookup', 'filter', 'match', 'retrieve'],

  // Errors
  'error': ['exception', 'bug', 'issue', 'problem', 'fault'],
  'bug': ['error', 'issue', 'defect', 'problem'],

  // Data
  'array': ['list', 'collection'],
  'object': ['instance', 'entity', 'record'],
  'string': ['text', 'str'],
  'number': ['int', 'integer', 'float', 'numeric'],

  // Testing
  'test': ['spec', 'assertion', 'mock', 'stub', 'fixture'],

  // Architecture
  'api': ['endpoint', 'route', 'handler', 'controller'],
  'config': ['configuration', 'settings', 'options', 'preferences'],

  // Patterns
  'index': ['indexer', 'indexing', 'catalog', 'scan'],
  'embed': ['embedding', 'vector', 'encode'],
  'graph': ['network', 'relationship', 'edge', 'node', 'link'],
  'parse': ['parser', 'tokenize', 'lex', 'analyze', 'ast'],

  // Common operations
  'render': ['display', 'show', 'draw'],
  'handle': ['process', 'manage', 'deal'],
  'validate': ['verify', 'check', 'ensure']
};

/**
 * Build bidirectional synonym map from one-directional definitions.
 */
function buildBidirectionalSynonyms(source: Record<string, string[]>): Map<string, string[]> {
  const biMap = new Map<string, Set<string>>();

  for (const [key, values] of Object.entries(source)) {
    const allTerms = [key, ...values];
    for (const term of allTerms) {
      const lower = term.toLowerCase();
      const existing = biMap.get(lower) || new Set<string>();
      for (const other of allTerms) {
        const otherLower = other.toLowerCase();
        if (otherLower !== lower) {
          existing.add(otherLower);
        }
      }
      biMap.set(lower, existing);
    }
  }

  const result = new Map<string, string[]>();
  for (const [key, values] of biMap) {
    result.set(key, [...values]);
  }
  return result;
}
