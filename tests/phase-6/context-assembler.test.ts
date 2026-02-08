import {
  ContextAssembler,
  SearchResult,
  estimateTokens
} from '../../src/retrieval';
import { Entity } from '../../src/entities';

describe('F6.3 - Context Assembly', () => {
  let assembler: ContextAssembler;

  // Helper to create mock entities
  function createEntity(overrides: Partial<Entity> = {}): Entity {
    return {
      id: `entity-${Math.random().toString(36).substr(2, 9)}`,
      name: 'TestEntity',
      type: 'function',
      filePath: 'src/test.ts',
      startLine: 1,
      content: 'function test() { return true; }',
      summary: 'A test function that returns true',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  // Helper to create mock search results
  function createSearchResult(entity: Entity, score: number): SearchResult {
    return {
      entity,
      score,
      source: 'semantic'
    };
  }

  beforeEach(() => {
    assembler = new ContextAssembler();
  });

  describe('Token Estimation', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = estimateTokens(text);
      expect(tokens).toBe(Math.ceil(11 / 4)); // ~3 tokens
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);
      expect(estimateTokens(text)).toBe(250);
    });
  });

  describe('Basic Assembly', () => {
    it('should assemble context from search results', () => {
      const entity = createEntity({ name: 'getUserById' });
      const results = [createSearchResult(entity, 0.95)];

      const context = assembler.assemble(results);

      expect(context.context).toBeTruthy();
      expect(context.sources.length).toBe(1);
      expect(context.sources[0].name).toBe('getUserById');
      expect(context.tokenCount).toBeGreaterThan(0);
    });

    it('should sort results by relevance score', () => {
      const entity1 = createEntity({ name: 'LowScore' });
      const entity2 = createEntity({ name: 'HighScore' });
      const results = [
        createSearchResult(entity1, 0.5),
        createSearchResult(entity2, 0.9)
      ];

      const context = assembler.assemble(results, { groupByType: false });

      // HighScore should appear first
      expect(context.context.indexOf('HighScore')).toBeLessThan(
        context.context.indexOf('LowScore')
      );
    });

    it('should include source attribution', () => {
      const entity = createEntity({
        name: 'myFunction',
        filePath: 'src/utils.ts',
        startLine: 42
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { includeSources: true });

      expect(context.sources.length).toBe(1);
      expect(context.sources[0].filePath).toBe('src/utils.ts');
      expect(context.sources[0].line).toBe(42);
      expect(context.context).toContain('Sources');
    });
  });

  describe('Token Budget', () => {
    it('should respect max token limit', () => {
      const entities = Array(20).fill(null).map((_, i) =>
        createEntity({
          name: `Entity${i}`,
          content: 'x'.repeat(200), // ~50 tokens each
          summary: 'Summary ' + 'y'.repeat(100)
        })
      );
      const results = entities.map((e, i) => createSearchResult(e, 1 - i * 0.01));

      const context = assembler.assemble(results, {
        maxTokens: 500,
        includeCodeContent: true
      });

      expect(context.tokenCount).toBeLessThanOrEqual(500);
    });

    it('should mark context as truncated when exceeding budget', () => {
      const entities = Array(50).fill(null).map((_, i) =>
        createEntity({
          name: `Entity${i}`,
          content: 'x'.repeat(500)
        })
      );
      const results = entities.map((e, i) => createSearchResult(e, 1 - i * 0.01));

      const context = assembler.assemble(results, { maxTokens: 200 });

      expect(context.truncated).toBe(true);
    });

    it('should not mark as truncated when within budget', () => {
      const entity = createEntity({ name: 'SmallEntity' });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { maxTokens: 10000 });

      expect(context.truncated).toBe(false);
    });
  });

  describe('Markdown Format', () => {
    it('should format as markdown by default', () => {
      const entity = createEntity({
        name: 'myFunction',
        filePath: 'src/test.ts',
        startLine: 10
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { format: 'markdown' });

      expect(context.context).toContain('### myFunction');
      expect(context.context).toContain('*src/test.ts:10*');
    });

    it('should include code blocks with language', () => {
      const entity = createEntity({
        name: 'processData',
        filePath: 'src/processor.ts',
        content: 'function processData() { return 42; }'
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, {
        format: 'markdown',
        includeCodeContent: true
      });

      expect(context.context).toContain('```typescript');
      expect(context.context).toContain('function processData');
    });

    it('should detect language from file extension', () => {
      const pyEntity = createEntity({
        filePath: 'script.py',
        content: 'def hello(): pass'
      });
      const results = [createSearchResult(pyEntity, 0.9)];

      const context = assembler.assemble(results, {
        format: 'markdown',
        includeCodeContent: true
      });

      expect(context.context).toContain('```python');
    });
  });

  describe('XML Format', () => {
    it('should format as XML when specified', () => {
      const entity = createEntity({
        name: 'myFunction',
        type: 'function',
        filePath: 'src/test.ts'
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { format: 'xml' });

      expect(context.context).toContain('<entity name="myFunction"');
      expect(context.context).toContain('type="function"');
      expect(context.context).toContain('file="src/test.ts"');
    });

    it('should escape XML special characters', () => {
      const entity = createEntity({
        name: 'compare<T>',
        summary: 'Compares a < b && b > c',
        content: 'if (a < b && b > c) { return true; }'
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { format: 'xml' });

      expect(context.context).toContain('&lt;T&gt;');
      expect(context.context).toContain('&lt;');
      expect(context.context).toContain('&amp;');
    });

    it('should include sources as XML elements', () => {
      const entity = createEntity({ name: 'TestFunc' });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, {
        format: 'xml',
        includeSources: true
      });

      expect(context.context).toContain('<sources>');
      expect(context.context).toContain('<source name="TestFunc"');
    });
  });

  describe('Plain Format', () => {
    it('should format as plain text when specified', () => {
      const entity = createEntity({
        name: 'myFunction',
        filePath: 'src/test.ts',
        startLine: 5
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { format: 'plain' });

      expect(context.context).toContain('myFunction [src/test.ts:5]');
    });
  });

  describe('Type Grouping', () => {
    it('should group entities by type when enabled', () => {
      const func = createEntity({ name: 'myFunc', type: 'function' });
      const cls = createEntity({ name: 'MyClass', type: 'class' });
      const doc = createEntity({ name: 'README', type: 'document' });
      const results = [
        createSearchResult(doc, 0.9),
        createSearchResult(func, 0.85),
        createSearchResult(cls, 0.8)
      ];

      const context = assembler.assemble(results, {
        format: 'markdown',
        groupByType: true
      });

      // Code should come before documentation
      const codeIndex = context.context.indexOf('## Relevant Code');
      const docIndex = context.context.indexOf('## Related Documentation');
      expect(codeIndex).toBeLessThan(docIndex);
    });

    it('should not group when disabled', () => {
      const func = createEntity({ name: 'myFunc', type: 'function' });
      const doc = createEntity({ name: 'README', type: 'document' });
      const results = [
        createSearchResult(func, 0.9),
        createSearchResult(doc, 0.85)
      ];

      const context = assembler.assemble(results, { groupByType: false });

      expect(context.context).not.toContain('## Relevant Code');
      expect(context.context).not.toContain('## Related Documentation');
    });

    it('should categorize conversation types correctly', () => {
      const session = createEntity({ name: 'Session1', type: 'session' });
      const decision = createEntity({ name: 'Decision1', type: 'decision' });
      const results = [
        createSearchResult(session, 0.9),
        createSearchResult(decision, 0.85)
      ];

      const context = assembler.assemble(results, {
        format: 'markdown',
        groupByType: true
      });

      expect(context.context).toContain('## Previous Conversations');
    });
  });

  describe('Content Truncation', () => {
    it('should truncate long content', () => {
      const entity = createEntity({
        name: 'LongFunction',
        content: 'x'.repeat(2000)
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, {
        includeCodeContent: true,
        maxContentLength: 100
      });

      expect(context.context).toContain('truncated');
    });

    it('should not truncate short content', () => {
      const entity = createEntity({
        name: 'ShortFunction',
        content: 'return 42;'
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, {
        includeCodeContent: true,
        maxContentLength: 500
      });

      expect(context.context).not.toContain('truncated');
    });
  });

  describe('Prefix and Suffix', () => {
    it('should add prefix to context', () => {
      const entity = createEntity({ name: 'Test' });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, {
        prefix: 'Here is the relevant context:'
      });

      expect(context.context.startsWith('Here is the relevant context:')).toBe(true);
    });

    it('should add suffix to context', () => {
      const entity = createEntity({ name: 'Test' });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, {
        suffix: 'End of context.',
        includeSources: false
      });

      expect(context.context.endsWith('End of context.')).toBe(true);
    });
  });

  describe('Assemble From Entities', () => {
    it('should assemble directly from entities', () => {
      const entities = [
        createEntity({ name: 'Entity1' }),
        createEntity({ name: 'Entity2' })
      ];

      const context = assembler.assembleFromEntities(entities);

      expect(context.sources.length).toBe(2);
      expect(context.context).toContain('Entity1');
      expect(context.context).toContain('Entity2');
    });

    it('should preserve entity order', () => {
      const entities = [
        createEntity({ name: 'First' }),
        createEntity({ name: 'Second' }),
        createEntity({ name: 'Third' })
      ];

      const context = assembler.assembleFromEntities(entities, { groupByType: false });

      const firstIndex = context.context.indexOf('First');
      const secondIndex = context.context.indexOf('Second');
      const thirdIndex = context.context.indexOf('Third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary of sources', () => {
      const sources = [
        { entityId: '1', name: 'func1', type: 'function', relevance: 0.9 },
        { entityId: '2', name: 'func2', type: 'function', relevance: 0.8 },
        { entityId: '3', name: 'MyClass', type: 'class', relevance: 0.7 },
        { entityId: '4', name: 'README', type: 'document', relevance: 0.6 }
      ];

      const summary = assembler.summarize(sources);

      expect(summary).toContain('Context includes:');
      expect(summary).toContain('code');
      expect(summary).toContain('documentation');
    });

    it('should indicate when there are more sources', () => {
      const sources = Array(10).fill(null).map((_, i) => ({
        entityId: `${i}`,
        name: `func${i}`,
        type: 'function',
        relevance: 0.9 - i * 0.05
      }));

      const summary = assembler.summarize(sources);

      expect(summary).toContain('and');
      expect(summary).toContain('more');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty results', () => {
      const context = assembler.assemble([]);

      expect(context.context).toBe('');
      expect(context.sources.length).toBe(0);
      expect(context.tokenCount).toBe(0);
      expect(context.truncated).toBe(false);
    });

    it('should handle entities without file path', () => {
      const entity = createEntity({
        name: 'Concept',
        type: 'concept',
        filePath: undefined,
        startLine: undefined
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results);

      expect(context.context).toContain('Concept');
      expect(context.sources[0].filePath).toBeUndefined();
    });

    it('should handle entities without content', () => {
      const entity = createEntity({
        name: 'NoContent',
        content: undefined,
        summary: 'Just a summary'
      });
      const results = [createSearchResult(entity, 0.9)];

      const context = assembler.assemble(results, { includeCodeContent: true });

      expect(context.context).toContain('Just a summary');
    });

    it('should handle very long source lists', () => {
      const entities = Array(50).fill(null).map((_, i) =>
        createEntity({ name: `Entity${i}` })
      );
      const results = entities.map((e, i) => createSearchResult(e, 1 - i * 0.01));

      const context = assembler.assemble(results, {
        maxTokens: 100000,
        includeSources: true
      });

      // Should only show first 10 sources
      expect(context.context).toContain('and 40 more');
    });
  });
});
