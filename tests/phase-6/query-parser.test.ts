import { QueryParser } from '../../src/retrieval';

describe('F6.1 - Query Parsing', () => {
  let parser: QueryParser;

  beforeEach(() => {
    parser = new QueryParser();
  });

  describe('Intent Detection', () => {
    it('should detect find intent', () => {
      const queries = [
        'find the UserService class',
        'search for authentication functions',
        'locate the database connection',
        'where is the config file defined',
        'look for error handlers'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('find');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect explain intent', () => {
      const queries = [
        'explain how the caching works',
        'what is the EntityStore class',
        'what does the parse function do',
        'describe the authentication flow',
        'how does the embedding system work'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('explain');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect list intent', () => {
      const queries = [
        'list all functions in this file',
        'show all classes',
        'enumerate the endpoints',
        'get all test files'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('list');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect compare intent', () => {
      const queries = [
        'compare UserService and AdminService',
        'difference between REST and GraphQL',
        'React vs Vue',
        'contrast the two approaches'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('compare');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect how intent', () => {
      const queries = [
        'how do I create a new entity',
        'how can I configure the database',
        'how to add authentication',
        'how should I handle errors'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('how');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect why intent', () => {
      const queries = [
        'why is this function async',
        'why does the test fail',
        'reason for the design decision',
        'why was this deprecated'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('why');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect debug intent', () => {
      const queries = [
        'fix the null pointer error',
        'debug the authentication bug',
        'there is a crash in the parser',
        'the function is not working',
        'troubleshoot the connection issue',
        'throws an exception when called'
      ];

      for (const query of queries) {
        const result = parser.parse(query);
        expect(result.intent).toBe('debug');
        expect(result.intentConfidence).toBeGreaterThan(0.5);
      }
    });

    it('should fall back to general intent', () => {
      const result = parser.parse('hello world');
      expect(result.intent).toBe('general');
    });
  });

  describe('Entity Mention Extraction', () => {
    it('should extract backtick code mentions', () => {
      const result = parser.parse('What does the `processData` function do?');

      expect(result.entityMentions.length).toBe(1);
      expect(result.entityMentions[0].text).toBe('processData');
      expect(result.entityMentions[0].type).toBe('function');
    });

    it('should extract multiple backtick mentions', () => {
      const result = parser.parse('Compare `UserService` with `AdminService`');

      expect(result.entityMentions.length).toBe(2);
      expect(result.entityMentions[0].text).toBe('UserService');
      expect(result.entityMentions[1].text).toBe('AdminService');
    });

    it('should classify file paths in backticks', () => {
      const result = parser.parse('Look at `src/utils/helper.ts`');

      expect(result.entityMentions.length).toBe(1);
      expect(result.entityMentions[0].text).toBe('src/utils/helper.ts');
      expect(result.entityMentions[0].type).toBe('file');
    });

    it('should extract file paths without backticks', () => {
      const result = parser.parse('Check the file at ./src/index.ts please');

      expect(result.entityMentions.some(m => m.type === 'file')).toBe(true);
    });

    it('should extract PascalCase class names', () => {
      const result = parser.parse('The EntityStore class needs updating');

      const classMention = result.entityMentions.find(m => m.type === 'class');
      expect(classMention).toBeDefined();
      expect(classMention!.text).toBe('EntityStore');
    });

    it('should extract function calls with parentheses', () => {
      const result = parser.parse('Call getData( and then process it');

      const funcMention = result.entityMentions.find(m => m.type === 'function');
      expect(funcMention).toBeDefined();
      expect(funcMention!.text).toBe('getData');
    });

    it('should preserve mention positions', () => {
      const query = 'What does `myFunc` do?';
      const result = parser.parse(query);

      expect(result.entityMentions.length).toBe(1);
      const mention = result.entityMentions[0];
      expect(query.substring(mention.start, mention.end)).toBe('`myFunc`');
    });

    it('should avoid duplicate mentions', () => {
      const result = parser.parse('The `UserService` class UserService');

      // Should have backtick mention but not duplicate PascalCase
      const mentions = result.entityMentions.filter(m => m.text === 'UserService');
      expect(mentions.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Keyword Extraction', () => {
    it('should extract meaningful keywords', () => {
      const result = parser.parse('How do I handle authentication errors');

      expect(result.keywords).toContain('authentication');
      expect(result.keywords).toContain('errors');
      expect(result.keywords).toContain('handle');
    });

    it('should filter stop words', () => {
      const result = parser.parse('What is the function in this file');

      expect(result.keywords).not.toContain('what');
      expect(result.keywords).not.toContain('is');
      expect(result.keywords).not.toContain('the');
      expect(result.keywords).not.toContain('in');
      expect(result.keywords).not.toContain('this');
    });

    it('should filter short words based on minKeywordLength', () => {
      const customParser = new QueryParser({ minKeywordLength: 4 });
      const result = customParser.parse('Get all API data');

      expect(result.keywords).not.toContain('get');
      expect(result.keywords).not.toContain('all');
      expect(result.keywords).not.toContain('api');
      expect(result.keywords).toContain('data');
    });

    it('should keep entity mention texts as keywords', () => {
      const result = parser.parse('Explain the `db` connection');

      // 'db' is short but should be kept as it's in backticks
      expect(result.keywords).toContain('db');
    });

    it('should deduplicate keywords', () => {
      const result = parser.parse('function function function test');

      const functionCount = result.keywords.filter(k => k === 'function').length;
      expect(functionCount).toBe(1);
    });

    it('should handle custom stop words', () => {
      const customParser = new QueryParser({
        customStopWords: ['please', 'thanks']
      });
      const result = customParser.parse('please help me debug this thanks');

      expect(result.keywords).not.toContain('please');
      expect(result.keywords).not.toContain('thanks');
    });
  });

  describe('Query Expansion', () => {
    it('should expand terms with synonyms', () => {
      const result = parser.parse('find the function');

      expect(result.expandedTerms.length).toBeGreaterThan(0);
      // 'function' should expand to 'method', 'func', etc.
      expect(result.expandedTerms.some(t =>
        ['method', 'func', 'procedure', 'routine'].includes(t)
      )).toBe(true);
    });

    it('should expand error-related terms', () => {
      const result = parser.parse('fix the error');

      expect(result.expandedTerms.some(t =>
        ['exception', 'bug', 'issue', 'problem'].includes(t)
      )).toBe(true);
    });

    it('should not include original keywords in expanded terms', () => {
      const result = parser.parse('find the function');

      expect(result.expandedTerms).not.toContain('function');
      expect(result.expandedTerms).not.toContain('find');
    });

    it('should respect expandSynonyms option', () => {
      const customParser = new QueryParser({ expandSynonyms: false });
      const result = customParser.parse('find the function');

      expect(result.expandedTerms.length).toBe(0);
    });

    it('should use custom synonyms', () => {
      const customParser = new QueryParser({
        customSynonyms: {
          'widget': ['component', 'element']
        }
      });
      const result = customParser.parse('find the widget');

      expect(result.expandedTerms).toContain('component');
      expect(result.expandedTerms).toContain('element');
    });
  });

  describe('Query Normalization', () => {
    it('should remove backticks but keep content', () => {
      const result = parser.parse('What is `myFunction`?');

      expect(result.normalizedQuery).toBe('What is myFunction');
    });

    it('should normalize whitespace', () => {
      const result = parser.parse('Find   the    function');

      expect(result.normalizedQuery).toBe('Find the function');
    });

    it('should remove trailing punctuation', () => {
      const result = parser.parse('What is this???');

      expect(result.normalizedQuery).toBe('What is this');
    });

    it('should trim whitespace', () => {
      const result = parser.parse('  query with spaces  ');

      expect(result.normalizedQuery).toBe('query with spaces');
    });
  });

  describe('Search Query Generation', () => {
    it('should generate multiple search queries', () => {
      const result = parser.parse('Explain the `UserService` authentication');
      const queries = parser.generateSearchQueries(result);

      expect(queries.length).toBeGreaterThan(1);
      expect(queries).toContain('UserService');
    });

    it('should include normalized query', () => {
      const result = parser.parse('Find `myFunc`');
      const queries = parser.generateSearchQueries(result);

      expect(queries).toContain('Find myFunc');
    });

    it('should include keywords-only query', () => {
      const result = parser.parse('How do I handle errors');
      const queries = parser.generateSearchQueries(result);

      // Should have a keywords-only version
      const keywordsQuery = result.keywords.join(' ');
      expect(queries).toContain(keywordsQuery);
    });

    it('should deduplicate queries', () => {
      const result = parser.parse('test');
      const queries = parser.generateSearchQueries(result);

      const uniqueQueries = [...new Set(queries)];
      expect(queries.length).toBe(uniqueQueries.length);
    });
  });

  describe('Helper Methods', () => {
    it('getExactMatchTerms returns entity mentions', () => {
      const result = parser.parse('Find `UserService` and `getData`');
      const exactTerms = parser.getExactMatchTerms(result);

      expect(exactTerms).toContain('UserService');
      expect(exactTerms).toContain('getData');
    });

    it('getSemanticTerms returns keywords and expanded terms', () => {
      const result = parser.parse('Find the function');
      const semanticTerms = parser.getSemanticTerms(result);

      expect(semanticTerms).toContain('function');
      expect(semanticTerms.some(t => ['method', 'func'].includes(t))).toBe(true);
    });
  });

  describe('Complex Queries', () => {
    it('should handle complex technical query', () => {
      const query = 'Explain how the `EntityStore.create()` method handles validation errors in src/entities/store.ts';
      const result = parser.parse(query);

      expect(result.intent).toBe('explain');
      expect(result.entityMentions.some(m => m.text.includes('EntityStore'))).toBe(true);
      expect(result.keywords).toContain('validation');
      expect(result.keywords).toContain('errors');
    });

    it('should handle comparison query with multiple entities', () => {
      const query = 'Compare the `OllamaProvider` vs `OpenAIProvider` for embedding generation';
      const result = parser.parse(query);

      expect(result.intent).toBe('compare');
      expect(result.entityMentions.length).toBe(2);
      expect(result.keywords).toContain('embedding');
      expect(result.keywords).toContain('generation');
    });

    it('should handle debugging query', () => {
      const query = 'Fix the error: TypeError in `processData` function at line 45';
      const result = parser.parse(query);

      expect(result.intent).toBe('debug');
      expect(result.entityMentions.some(m => m.text === 'processData')).toBe(true);
    });

    it('should handle query with file paths', () => {
      const query = 'Explain the code in src/graph/traversal.ts';
      const result = parser.parse(query);

      expect(result.intent).toBe('explain');
      expect(result.entityMentions.some(m =>
        m.type === 'file' && m.text.includes('traversal.ts')
      )).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', () => {
      const result = parser.parse('');

      expect(result.original).toBe('');
      expect(result.keywords.length).toBe(0);
      expect(result.intent).toBe('general');
    });

    it('should handle query with only stop words', () => {
      const result = parser.parse('the is a an');

      expect(result.keywords.length).toBe(0);
    });

    it('should handle query with only punctuation', () => {
      const result = parser.parse('???!!!...');

      expect(result.keywords.length).toBe(0);
    });

    it('should handle very long query', () => {
      const longQuery = 'find '.repeat(100) + 'the function';
      const result = parser.parse(longQuery);

      expect(result.intent).toBe('find');
      expect(result.keywords).toContain('function');
    });

    it('should handle unicode characters', () => {
      const result = parser.parse('Find the café function');

      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should handle nested backticks gracefully', () => {
      const result = parser.parse('What is `outer `inner` text`');

      // Should handle without crashing
      expect(result.entityMentions.length).toBeGreaterThan(0);
    });
  });
});
