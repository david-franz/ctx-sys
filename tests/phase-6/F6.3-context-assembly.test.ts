/**
 * F6.3 Context Assembly Tests
 *
 * NOTE: These tests will fail until the actual implementations are created at:
 * - src/retrieval/assembler.ts (ContextAssembler class)
 * - src/retrieval/types.ts (AssembledContext, ContextOptions, ContextSource interfaces)
 * - src/retrieval/formatters.ts (MarkdownFormatter, XmlFormatter, PlainTextFormatter classes)
 * - src/retrieval/token-estimator.ts (TokenEstimator class)
 *
 * Tests for assembling search results into LLM-ready context:
 * - Token estimation and budget management
 * - Markdown, XML, and plain text formatting
 * - Source attribution
 * - Content grouping by type
 *
 * @see docs/phase-6/F6.3-context-assembly.md
 */

import { ContextAssembler } from '../../src/retrieval/assembler';
import {
  AssembledContext,
  ContextOptions,
  ContextSource,
  SearchResult,
  Entity
} from '../../src/retrieval/types';
import { MarkdownFormatter } from '../../src/retrieval/formatters/markdown-formatter';
import { XmlFormatter } from '../../src/retrieval/formatters/xml-formatter';
import { PlainTextFormatter } from '../../src/retrieval/formatters/plain-text-formatter';
import { TokenEstimator } from '../../src/retrieval/token-estimator';
import { TypeCategorizer } from '../../src/retrieval/type-categorizer';

// Mock all dependencies
jest.mock('../../src/retrieval/formatters/markdown-formatter');
jest.mock('../../src/retrieval/formatters/xml-formatter');
jest.mock('../../src/retrieval/formatters/plain-text-formatter');
jest.mock('../../src/retrieval/token-estimator');
jest.mock('../../src/retrieval/type-categorizer');

describe('F6.3 Context Assembly', () => {
  // Mock instances
  let mockMarkdownFormatter: jest.Mocked<MarkdownFormatter>;
  let mockXmlFormatter: jest.Mocked<XmlFormatter>;
  let mockPlainTextFormatter: jest.Mocked<PlainTextFormatter>;
  let mockTokenEstimator: jest.Mocked<TokenEstimator>;
  let mockTypeCategorizer: jest.Mocked<TypeCategorizer>;

  // Real instance under test
  let assembler: ContextAssembler;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockMarkdownFormatter = new MarkdownFormatter() as jest.Mocked<MarkdownFormatter>;
    mockXmlFormatter = new XmlFormatter() as jest.Mocked<XmlFormatter>;
    mockPlainTextFormatter = new PlainTextFormatter() as jest.Mocked<PlainTextFormatter>;
    mockTokenEstimator = new TokenEstimator() as jest.Mocked<TokenEstimator>;
    mockTypeCategorizer = new TypeCategorizer() as jest.Mocked<TypeCategorizer>;

    // Setup default mock implementations
    mockTokenEstimator.estimate = jest.fn((text: string) => Math.ceil(text.length / 4));
    mockTypeCategorizer.categorize = jest.fn((type: string) => {
      const codeTypes = ['function', 'method', 'class', 'interface', 'type', 'file', 'module'];
      const docTypes = ['document', 'section', 'requirement', 'feature'];
      const convTypes = ['session', 'message', 'decision'];
      if (codeTypes.includes(type)) return 'code';
      if (docTypes.includes(type)) return 'documentation';
      if (convTypes.includes(type)) return 'conversation';
      return 'other';
    });

    // Create real assembler instance with mocked dependencies
    assembler = new ContextAssembler({
      markdownFormatter: mockMarkdownFormatter,
      xmlFormatter: mockXmlFormatter,
      plainTextFormatter: mockPlainTextFormatter,
      tokenEstimator: mockTokenEstimator,
      typeCategorizer: mockTypeCategorizer
    });
  });

  // ============================================================================
  // AssembledContext Interface Tests
  // ============================================================================

  describe('AssembledContext Interface', () => {
    it('should contain all required fields', () => {
      const assembled: AssembledContext = {
        context: '## Relevant Code\n\nAuthService handles authentication',
        sources: [
          {
            entityId: 'e1',
            name: 'AuthService',
            type: 'class',
            file: 'src/auth/service.ts',
            line: 10,
            relevance: 0.95
          }
        ],
        tokenCount: 50,
        truncated: false
      };

      expect(assembled.context).toBeDefined();
      expect(assembled.sources).toHaveLength(1);
      expect(assembled.tokenCount).toBeGreaterThan(0);
      expect(assembled.truncated).toBe(false);
    });

    it('should support truncation flag', () => {
      const assembled: AssembledContext = {
        context: 'Truncated content...',
        sources: [],
        tokenCount: 1000,
        truncated: true
      };

      expect(assembled.truncated).toBe(true);
    });

    it('should support optional summary', () => {
      const assembled: AssembledContext = {
        context: 'Brief summary',
        sources: [],
        tokenCount: 10,
        truncated: true,
        summary: 'Content was summarized to fit token budget'
      };

      expect(assembled.summary).toBeDefined();
    });
  });

  // ============================================================================
  // Token Estimation Tests
  // ============================================================================

  describe('Token Estimation', () => {
    it('should estimate tokens at 4 chars per token', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = mockTokenEstimator.estimate(text);

      expect(tokens).toBe(3); // ceil(11/4) = 3
      expect(mockTokenEstimator.estimate).toHaveBeenCalledWith(text);
    });

    it('should handle empty string', () => {
      expect(mockTokenEstimator.estimate('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      const tokens = mockTokenEstimator.estimate(text);

      expect(tokens).toBe(250);
    });

    it('should round up partial tokens', () => {
      const text = 'ab'; // 2 chars
      const tokens = mockTokenEstimator.estimate(text);

      expect(tokens).toBe(1); // ceil(2/4) = 1
    });

    it('should estimate code content', () => {
      const code = `
        function authenticate(user: User): boolean {
          return user.isValid && user.hasPermission;
        }
      `;
      const tokens = mockTokenEstimator.estimate(code);

      expect(tokens).toBeGreaterThan(20);
    });
  });

  // ============================================================================
  // Token Budget Management Tests
  // ============================================================================

  describe('Token Budget Management', () => {
    beforeEach(() => {
      mockMarkdownFormatter.formatEntity = jest.fn((entity: Entity) => {
        return `### ${entity.name}\n${entity.summary || ''}`;
      });
    });

    it('should respect token budget', async () => {
      const results: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          entity: { id: 'e1', name: 'Short', type: 'function', summary: 'Brief' }
        },
        {
          entityId: 'e2',
          score: 0.8,
          entity: { id: 'e2', name: 'Long', type: 'function', summary: 'A'.repeat(500) }
        }
      ];

      const options: ContextOptions = {
        maxTokens: 50,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.tokenCount).toBeLessThanOrEqual(50);
      expect(assembled.truncated).toBe(true);
    });

    it('should include as many results as fit', async () => {
      const results: SearchResult[] = Array(10).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: 0.9 - i * 0.05,
        entity: { id: `e${i}`, name: `Func${i}`, type: 'function', summary: 'Short summary' }
      }));

      const options: ContextOptions = {
        maxTokens: 200,
        format: 'markdown',
        includeSources: false,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.sources.length).toBeGreaterThan(0);
      expect(assembled.sources.length).toBeLessThanOrEqual(10);
    });

    it('should prioritize by relevance score', async () => {
      const results: SearchResult[] = [
        { entityId: 'e1', score: 0.9, entity: { id: 'e1', name: 'Best', type: 'function' } },
        { entityId: 'e2', score: 0.5, entity: { id: 'e2', name: 'Okay', type: 'function' } },
        { entityId: 'e3', score: 0.3, entity: { id: 'e3', name: 'Low', type: 'function' } }
      ];

      const options: ContextOptions = {
        maxTokens: 1000,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      // First source should be the highest scored
      expect(assembled.sources[0].entityId).toBe('e1');
      expect(assembled.sources[2].entityId).toBe('e3');
    });

    it('should track truncation', async () => {
      const results: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          entity: { id: 'e1', name: 'Large', type: 'function', summary: 'X'.repeat(1000) }
        }
      ];

      const options: ContextOptions = {
        maxTokens: 10,
        format: 'markdown',
        includeSources: false,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.truncated).toBe(true);
      expect(assembled.sources).toHaveLength(0);
    });
  });

  // ============================================================================
  // Markdown Formatting Tests
  // ============================================================================

  describe('Markdown Formatting', () => {
    beforeEach(() => {
      mockMarkdownFormatter.formatEntity = jest.fn((entity: Entity, includeCode: boolean) => {
        const lines: string[] = [];
        const location = entity.filePath
          ? `${entity.filePath}${entity.startLine ? `:${entity.startLine}` : ''}`
          : entity.type;

        lines.push(`### ${entity.name}`);
        lines.push(`*${location}*`);
        lines.push('');

        if (entity.summary) {
          lines.push(entity.summary);
        }

        if (includeCode && entity.content) {
          const ext = entity.filePath?.split('.').pop()?.toLowerCase();
          const langMap: Record<string, string> = {
            ts: 'typescript', tsx: 'typescript',
            js: 'javascript', jsx: 'javascript',
            py: 'python', go: 'go', rs: 'rust', java: 'java'
          };
          const language = langMap[ext || ''] || '';
          lines.push('');
          lines.push('```' + language);
          lines.push(entity.content.slice(0, 500));
          if (entity.content.length > 500) {
            lines.push('// ... (truncated)');
          }
          lines.push('```');
        }

        return lines.join('\n');
      });

      mockMarkdownFormatter.detectLanguage = jest.fn((filePath?: string) => {
        if (!filePath) return null;
        const ext = filePath.split('.').pop()?.toLowerCase();
        const map: Record<string, string> = {
          ts: 'typescript', tsx: 'typescript',
          js: 'javascript', jsx: 'javascript',
          py: 'python', go: 'go', rs: 'rust', java: 'java'
        };
        return map[ext || ''] || null;
      });
    });

    it('should format entity with header', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth/service.ts',
        startLine: 10
      };

      const formatted = mockMarkdownFormatter.formatEntity(entity, false);

      expect(formatted).toContain('### AuthService');
      expect(formatted).toContain('*src/auth/service.ts:10*');
    });

    it('should include summary', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'login',
        type: 'function',
        summary: 'Authenticates user with credentials'
      };

      const formatted = mockMarkdownFormatter.formatEntity(entity, false);

      expect(formatted).toContain('Authenticates user with credentials');
    });

    it('should include code block with language', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'validate',
        type: 'function',
        filePath: 'src/utils.ts',
        content: 'function validate(input: string): boolean { return true; }'
      };

      const formatted = mockMarkdownFormatter.formatEntity(entity, true);

      expect(formatted).toContain('```typescript');
      expect(formatted).toContain('function validate');
      expect(formatted).toContain('```');
    });

    it('should truncate long code content', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'large',
        type: 'function',
        filePath: 'src/large.ts',
        content: 'x'.repeat(1000)
      };

      const formatted = mockMarkdownFormatter.formatEntity(entity, true);

      expect(formatted).toContain('// ... (truncated)');
      expect(formatted.length).toBeLessThan(1000);
    });

    it('should detect language from file extension', () => {
      const extensions = [
        { path: 'file.ts', lang: 'typescript' },
        { path: 'file.py', lang: 'python' },
        { path: 'file.go', lang: 'go' },
        { path: 'file.rs', lang: 'rust' },
        { path: 'file.java', lang: 'java' }
      ];

      for (const { path, lang } of extensions) {
        expect(mockMarkdownFormatter.detectLanguage(path)).toBe(lang);
      }
    });
  });

  // ============================================================================
  // XML Formatting Tests
  // ============================================================================

  describe('XML Formatting', () => {
    beforeEach(() => {
      mockXmlFormatter.formatEntity = jest.fn((entity: Entity) => {
        const attrs = [
          `type="${entity.type}"`,
          entity.filePath ? `file="${entity.filePath}"` : null,
          entity.startLine ? `line="${entity.startLine}"` : null
        ].filter(Boolean).join(' ');

        const content = entity.summary || entity.content || '';

        return `<entity name="${entity.name}" ${attrs}>
${content.slice(0, 500)}
</entity>`;
      });
    });

    it('should format entity as XML', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth/service.ts',
        startLine: 10,
        summary: 'Handles authentication'
      };

      const formatted = mockXmlFormatter.formatEntity(entity);

      expect(formatted).toContain('<entity name="AuthService"');
      expect(formatted).toContain('type="class"');
      expect(formatted).toContain('file="src/auth/service.ts"');
      expect(formatted).toContain('line="10"');
      expect(formatted).toContain('Handles authentication');
      expect(formatted).toContain('</entity>');
    });

    it('should handle missing optional attributes', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'util',
        type: 'function'
      };

      const formatted = mockXmlFormatter.formatEntity(entity);

      expect(formatted).not.toContain('file=');
      expect(formatted).not.toContain('line=');
    });

    it('should truncate content', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'large',
        type: 'function',
        content: 'x'.repeat(1000)
      };

      const formatted = mockXmlFormatter.formatEntity(entity);

      expect(formatted.length).toBeLessThan(700);
    });
  });

  // ============================================================================
  // Plain Text Formatting Tests
  // ============================================================================

  describe('Plain Text Formatting', () => {
    beforeEach(() => {
      mockPlainTextFormatter.formatEntity = jest.fn((entity: Entity) => {
        const location = entity.filePath
          ? `[${entity.filePath}:${entity.startLine || 0}]`
          : `[${entity.type}]`;

        return `${entity.name} ${location}\n${entity.summary || entity.content || ''}`;
      });
    });

    it('should format entity as plain text', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth/service.ts',
        startLine: 10,
        summary: 'Handles authentication'
      };

      const formatted = mockPlainTextFormatter.formatEntity(entity);

      expect(formatted).toContain('AuthService');
      expect(formatted).toContain('[src/auth/service.ts:10]');
      expect(formatted).toContain('Handles authentication');
    });

    it('should use type as location when no file', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'decision',
        type: 'decision'
      };

      const formatted = mockPlainTextFormatter.formatEntity(entity);

      expect(formatted).toContain('[decision]');
    });
  });

  // ============================================================================
  // Type Grouping Tests
  // ============================================================================

  describe('Type Grouping', () => {
    it('should categorize code types', () => {
      expect(mockTypeCategorizer.categorize('function')).toBe('code');
      expect(mockTypeCategorizer.categorize('class')).toBe('code');
      expect(mockTypeCategorizer.categorize('interface')).toBe('code');
      expect(mockTypeCategorizer.categorize('module')).toBe('code');
    });

    it('should categorize documentation types', () => {
      expect(mockTypeCategorizer.categorize('document')).toBe('documentation');
      expect(mockTypeCategorizer.categorize('section')).toBe('documentation');
      expect(mockTypeCategorizer.categorize('requirement')).toBe('documentation');
    });

    it('should categorize conversation types', () => {
      expect(mockTypeCategorizer.categorize('session')).toBe('conversation');
      expect(mockTypeCategorizer.categorize('message')).toBe('conversation');
      expect(mockTypeCategorizer.categorize('decision')).toBe('conversation');
    });

    it('should handle unknown types', () => {
      expect(mockTypeCategorizer.categorize('unknown')).toBe('other');
      expect(mockTypeCategorizer.categorize('custom')).toBe('other');
    });

    it('should group results by type category', async () => {
      const results: SearchResult[] = [
        { entityId: 'e1', score: 0.9, entity: { id: 'e1', name: 'func', type: 'function' } },
        { entityId: 'e2', score: 0.8, entity: { id: 'e2', name: 'doc', type: 'document' } },
        { entityId: 'e3', score: 0.7, entity: { id: 'e3', name: 'msg', type: 'message' } },
        { entityId: 'e4', score: 0.6, entity: { id: 'e4', name: 'cls', type: 'class' } }
      ];

      const options: ContextOptions = {
        maxTokens: 1000,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: true
      };

      mockMarkdownFormatter.formatEntity = jest.fn(() => 'formatted');
      mockMarkdownFormatter.formatGroupHeader = jest.fn((group: string) => `## ${group}`);

      const assembled = await assembler.assemble(results, options);

      // Verify categorize was called for each result
      expect(mockTypeCategorizer.categorize).toHaveBeenCalledWith('function');
      expect(mockTypeCategorizer.categorize).toHaveBeenCalledWith('document');
      expect(mockTypeCategorizer.categorize).toHaveBeenCalledWith('message');
      expect(mockTypeCategorizer.categorize).toHaveBeenCalledWith('class');
    });

    it('should maintain order within groups', async () => {
      const results: SearchResult[] = [
        { entityId: 'e1', score: 0.9, entity: { id: 'e1', name: 'first', type: 'function' } },
        { entityId: 'e2', score: 0.7, entity: { id: 'e2', name: 'second', type: 'function' } }
      ];

      const options: ContextOptions = {
        maxTokens: 1000,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: true
      };

      mockMarkdownFormatter.formatEntity = jest.fn(() => 'formatted');

      const assembled = await assembler.assemble(results, options);

      expect(assembled.sources[0].entityId).toBe('e1');
      expect(assembled.sources[1].entityId).toBe('e2');
    });
  });

  // ============================================================================
  // Source Attribution Tests
  // ============================================================================

  describe('Source Attribution', () => {
    beforeEach(() => {
      mockMarkdownFormatter.formatSources = jest.fn((sources: ContextSource[]) => {
        if (sources.length === 0) return '';

        const lines: string[] = ['---', '**Sources:**'];

        for (const source of sources.slice(0, 10)) {
          const loc = source.file
            ? `${source.file}${source.line ? `:${source.line}` : ''}`
            : source.type;
          lines.push(`- ${source.name} (${loc})`);
        }

        return lines.join('\n');
      });

      mockXmlFormatter.formatSources = jest.fn((sources: ContextSource[]) => {
        if (sources.length === 0) return '';

        const lines: string[] = ['<sources>'];

        for (const source of sources.slice(0, 10)) {
          lines.push(`  <source name="${source.name}" type="${source.type}" />`);
        }

        lines.push('</sources>');
        return lines.join('\n');
      });
    });

    it('should format sources as markdown', () => {
      const sources: ContextSource[] = [
        { entityId: 'e1', name: 'AuthService', type: 'class', file: 'src/auth.ts', line: 10, relevance: 0.9 },
        { entityId: 'e2', name: 'login', type: 'function', file: 'src/auth.ts', line: 50, relevance: 0.8 }
      ];

      const formatted = mockMarkdownFormatter.formatSources(sources);

      expect(formatted).toContain('**Sources:**');
      expect(formatted).toContain('- AuthService (src/auth.ts:10)');
      expect(formatted).toContain('- login (src/auth.ts:50)');
    });

    it('should format sources as XML', () => {
      const sources: ContextSource[] = [
        { entityId: 'e1', name: 'AuthService', type: 'class', relevance: 0.9 }
      ];

      const formatted = mockXmlFormatter.formatSources(sources);

      expect(formatted).toContain('<sources>');
      expect(formatted).toContain('<source name="AuthService" type="class" />');
      expect(formatted).toContain('</sources>');
    });

    it('should limit to 10 sources', () => {
      const sources: ContextSource[] = Array(20).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        name: `entity${i}`,
        type: 'function',
        relevance: 0.9 - i * 0.01
      }));

      const formatted = mockMarkdownFormatter.formatSources(sources);
      const sourceLines = formatted.split('\n').filter((l: string) => l.startsWith('- '));

      expect(sourceLines.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty sources', () => {
      expect(mockMarkdownFormatter.formatSources([])).toBe('');
      expect(mockXmlFormatter.formatSources([])).toBe('');
    });

    it('should use type as location when no file', () => {
      const sources: ContextSource[] = [
        { entityId: 'e1', name: 'decision', type: 'decision', relevance: 0.9 }
      ];

      const formatted = mockMarkdownFormatter.formatSources(sources);

      expect(formatted).toContain('- decision (decision)');
    });
  });

  // ============================================================================
  // Group Header Tests
  // ============================================================================

  describe('Group Headers', () => {
    beforeEach(() => {
      mockMarkdownFormatter.formatGroupHeader = jest.fn((group: string) => {
        const titles: Record<string, string> = {
          code: 'Relevant Code',
          documentation: 'Related Documentation',
          conversation: 'Previous Conversations',
          other: 'Other Context'
        };
        const title = titles[group] || group;
        return `## ${title}`;
      });

      mockXmlFormatter.formatGroupHeader = jest.fn((group: string) => {
        const titles: Record<string, string> = {
          code: 'Relevant Code',
          documentation: 'Related Documentation',
          conversation: 'Previous Conversations',
          other: 'Other Context'
        };
        const title = titles[group] || group;
        return `<section name="${title}">`;
      });

      mockPlainTextFormatter.formatGroupHeader = jest.fn((group: string) => {
        const titles: Record<string, string> = {
          code: 'Relevant Code',
          documentation: 'Related Documentation',
          conversation: 'Previous Conversations',
          other: 'Other Context'
        };
        const title = titles[group] || group;
        return `=== ${title} ===`;
      });
    });

    it('should format markdown group headers', () => {
      expect(mockMarkdownFormatter.formatGroupHeader('code')).toBe('## Relevant Code');
      expect(mockMarkdownFormatter.formatGroupHeader('documentation')).toBe('## Related Documentation');
      expect(mockMarkdownFormatter.formatGroupHeader('conversation')).toBe('## Previous Conversations');
    });

    it('should format XML group headers', () => {
      expect(mockXmlFormatter.formatGroupHeader('code')).toBe('<section name="Relevant Code">');
    });

    it('should format plain group headers', () => {
      expect(mockPlainTextFormatter.formatGroupHeader('code')).toBe('=== Relevant Code ===');
    });

    it('should handle unknown groups', () => {
      expect(mockMarkdownFormatter.formatGroupHeader('custom')).toBe('## custom');
    });
  });

  // ============================================================================
  // Full Assembly Tests
  // ============================================================================

  describe('Full Context Assembly', () => {
    beforeEach(() => {
      mockMarkdownFormatter.formatEntity = jest.fn((entity: Entity) => {
        return `### ${entity.name}\n${entity.summary || ''}`;
      });
    });

    it('should assemble complete context', async () => {
      const results: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.95,
          entity: {
            id: 'e1',
            name: 'AuthService',
            type: 'class',
            summary: 'Handles user authentication',
            filePath: 'src/auth/service.ts',
            startLine: 10
          }
        },
        {
          entityId: 'e2',
          score: 0.85,
          entity: {
            id: 'e2',
            name: 'login',
            type: 'function',
            summary: 'Performs login with credentials',
            filePath: 'src/auth/service.ts',
            startLine: 50
          }
        }
      ];

      const options: ContextOptions = {
        maxTokens: 500,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.context).toContain('AuthService');
      expect(assembled.context).toContain('login');
      expect(assembled.sources).toHaveLength(2);
      expect(assembled.tokenCount).toBeGreaterThan(0);
      expect(assembled.truncated).toBe(false);
    });

    it('should handle token budget exhaustion', async () => {
      const results: SearchResult[] = Array(50).fill(null).map((_, i) => ({
        entityId: `e${i}`,
        score: 0.9 - i * 0.01,
        entity: {
          id: `e${i}`,
          name: `Entity${i}`,
          type: 'function',
          summary: 'A summary that takes up some tokens'
        }
      }));

      const options: ContextOptions = {
        maxTokens: 100,
        format: 'markdown',
        includeSources: false,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.tokenCount).toBeLessThanOrEqual(100);
      expect(assembled.truncated).toBe(true);
      expect(assembled.sources.length).toBeLessThan(50);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockMarkdownFormatter.formatEntity = jest.fn((entity: Entity) => {
        return `### ${entity.name}\n${entity.summary || ''}`;
      });
    });

    it('should handle empty results', async () => {
      const options: ContextOptions = {
        maxTokens: 500,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble([], options);

      expect(assembled.context).toBe('');
      expect(assembled.sources).toHaveLength(0);
    });

    it('should handle entity with no content', async () => {
      const results: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          entity: {
            id: 'e1',
            name: 'empty',
            type: 'function'
          }
        }
      ];

      const options: ContextOptions = {
        maxTokens: 500,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.sources[0].type).toBe('function');
    });

    it('should handle very long entity names', async () => {
      const results: SearchResult[] = [
        {
          entityId: 'e1',
          score: 0.9,
          entity: {
            id: 'e1',
            name: 'x'.repeat(200),
            type: 'function'
          }
        }
      ];

      const options: ContextOptions = {
        maxTokens: 500,
        format: 'markdown',
        includeSources: true,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.sources[0].name.length).toBeGreaterThan(100);
    });

    it('should handle special characters in content', () => {
      const entity: Entity = {
        id: 'e1',
        name: 'test',
        type: 'function',
        content: 'const str = "Hello <World> & \"Friends\"";'
      };

      // Test XML escaping
      mockXmlFormatter.escapeXml = jest.fn((content: string) => {
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      });

      const escaped = mockXmlFormatter.escapeXml(entity.content!);

      expect(escaped).toContain('&lt;World&gt;');
      expect(escaped).toContain('&amp;');
    });

    it('should handle zero token budget', async () => {
      const results: SearchResult[] = [
        { entityId: 'e1', score: 0.9, entity: { id: 'e1', name: 'test', type: 'function' } }
      ];

      const options: ContextOptions = {
        maxTokens: 0,
        format: 'markdown',
        includeSources: false,
        includeCodeContent: false,
        groupByType: false
      };

      const assembled = await assembler.assemble(results, options);

      expect(assembled.tokenCount).toBe(0);
      expect(assembled.sources).toHaveLength(0);
      expect(assembled.truncated).toBe(true);
    });
  });
});
