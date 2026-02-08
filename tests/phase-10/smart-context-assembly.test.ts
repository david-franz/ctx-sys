import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContextAssembler, estimateTokens } from '../../src/retrieval/context-assembler';
import { SearchResult } from '../../src/retrieval/types';
import { Entity } from '../../src/entities';

describe('F10.4 - Smart Context Assembly', () => {
  let tempDir: string;
  let assembler: ContextAssembler;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-4-test-'));
    assembler = new ContextAssembler();
  });

  afterEach(() => {
    assembler.clearCache();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function createTestFile(relativePath: string, content: string): string {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return relativePath;
  }

  function createEntity(name: string, type: string, filePath?: string, startLine?: number, endLine?: number): Entity {
    return {
      id: `entity-${name}`,
      name,
      type: type as any,
      content: `function ${name}() { return 42; }`,
      summary: `A ${type} named ${name}`,
      filePath,
      startLine,
      endLine,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  function createSearchResult(entity: Entity, score: number = 0.9): SearchResult {
    return {
      entity,
      score,
      source: 'semantic'
    };
  }

  describe('Basic Assembly', () => {
    it('should assemble context from search results', () => {
      const entity = createEntity('testFunc', 'function');
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results);

      expect(context.context).toContain('testFunc');
      expect(context.sources.length).toBe(1);
      expect(context.tokenCount).toBeGreaterThan(0);
    });

    it('should respect token budget', () => {
      const entities = [];
      for (let i = 0; i < 20; i++) {
        entities.push(createEntity(`func${i}`, 'function'));
      }
      const results = entities.map(e => createSearchResult(e));

      const context = assembler.assemble(results, { maxTokens: 200 });

      expect(context.tokenCount).toBeLessThanOrEqual(200);
      expect(context.truncated).toBe(true);
    });

    it('should format as markdown by default', () => {
      const entity = createEntity('myFunc', 'function');
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results);

      expect(context.context).toContain('###');
      expect(context.context).toContain('```');
    });

    it('should format as XML when requested', () => {
      const entity = createEntity('myFunc', 'function');
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, { format: 'xml' });

      expect(context.context).toContain('<entity');
      expect(context.context).toContain('</entity>');
    });
  });

  describe('Source File Reading', () => {
    it('should read code from source files when enabled', () => {
      createTestFile('src/test.ts', `
import { something } from './other';

export function myFunction() {
  console.log('hello');
  return 42;
}

export function otherFunction() {
  return 'world';
}
`);

      const entity = createEntity('myFunction', 'function', 'src/test.ts', 4, 7);
      entity.content = undefined; // Clear stored content to test file reading
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir
      });

      expect(context.context).toContain('export function myFunction');
      expect(context.context).toContain('return 42');
    });

    it('should include context lines before and after', () => {
      createTestFile('src/test.ts', `// Line 1
// Line 2
export function targetFunction() {
  return 'target';
}
// Line 6
// Line 7
`);

      const entity = createEntity('targetFunction', 'function', 'src/test.ts', 3, 5);
      entity.content = undefined;
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir,
        contextLines: 2
      });

      expect(context.context).toContain('Line 2');
      expect(context.context).toContain('Line 6');
    });

    it('should fall back to stored content if file not found', () => {
      const entity = createEntity('myFunc', 'function', 'nonexistent.ts', 1, 5);
      entity.content = 'function myFunc() { return "stored"; }';
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir
      });

      expect(context.context).toContain('stored');
    });

    it('should cache file contents for repeated reads', () => {
      createTestFile('src/cached.ts', 'export const x = 1;');

      const entity1 = createEntity('func1', 'function', 'src/cached.ts', 1, 1);
      const entity2 = createEntity('func2', 'function', 'src/cached.ts', 1, 1);
      entity1.content = undefined;
      entity2.content = undefined;
      const results = [createSearchResult(entity1), createSearchResult(entity2)];

      // Should not throw and should use cache
      const context = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir
      });

      expect(context.sources.length).toBe(2);
    });
  });

  describe('Import Extraction', () => {
    it('should include imports when requested', () => {
      createTestFile('src/imports.ts', `import { A } from './a';
import { B } from './b';
const C = require('./c');

export function myFunc() {
  return A + B;
}
`);

      const entity = createEntity('myFunc', 'function', 'src/imports.ts', 5, 7);
      entity.content = undefined;
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir,
        includeImports: true
      });

      expect(context.context).toContain('**Imports:**');
      expect(context.context).toContain("import { A } from './a'");
      expect(context.context).toContain("import { B } from './b'");
    });

    it('should handle files without imports', () => {
      createTestFile('src/no-imports.ts', `export function myFunc() {
  return 42;
}
`);

      const entity = createEntity('myFunc', 'function', 'src/no-imports.ts', 1, 3);
      entity.content = undefined;
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir,
        includeImports: true
      });

      expect(context.context).not.toContain('**Imports:**');
    });
  });

  describe('Content Truncation', () => {
    it('should truncate long content to maxContentLength', () => {
      const entity = createEntity('longFunc', 'function');
      entity.content = 'a'.repeat(1000);
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        maxContentLength: 100
      });

      expect(context.context).toContain('// ... (truncated)');
    });
  });

  describe('Source Attribution', () => {
    it('should include source attribution', () => {
      const entity = createEntity('myFunc', 'function', 'src/test.ts', 10);
      const results = [createSearchResult(entity, 0.85)];

      const context = assembler.assemble(results, { includeSources: true });

      expect(context.sources.length).toBe(1);
      expect(context.sources[0].name).toBe('myFunc');
      expect(context.sources[0].filePath).toBe('src/test.ts');
      expect(context.sources[0].line).toBe(10);
      expect(context.sources[0].relevance).toBe(0.85);
    });

    it('should format sources in markdown', () => {
      const entity = createEntity('myFunc', 'function', 'src/test.ts', 10);
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        includeSources: true,
        format: 'markdown'
      });

      expect(context.context).toContain('**Sources:**');
      expect(context.context).toContain('myFunc');
    });
  });

  describe('Grouping', () => {
    it('should group entities by type', () => {
      const func = createEntity('myFunc', 'function');
      const cls = createEntity('MyClass', 'class');
      const doc = createEntity('README', 'document');
      const results = [
        createSearchResult(func),
        createSearchResult(cls),
        createSearchResult(doc)
      ];

      const context = assembler.assemble(results, { groupByType: true });

      expect(context.context).toContain('## Relevant Code');
      expect(context.context).toContain('## Related Documentation');
    });

    it('should not group when disabled', () => {
      const func = createEntity('myFunc', 'function');
      const doc = createEntity('README', 'document');
      const results = [createSearchResult(func), createSearchResult(doc)];

      const context = assembler.assemble(results, { groupByType: false });

      expect(context.context).not.toContain('## Relevant Code');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens roughly as length/4', () => {
      const text = 'a'.repeat(100);
      expect(estimateTokens(text)).toBe(25);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', () => {
      createTestFile('src/test.ts', 'export const x = 1;');

      const entity = createEntity('x', 'variable', 'src/test.ts', 1, 1);
      entity.content = undefined;
      const results = [createSearchResult(entity)];

      // First read
      assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir
      });

      // Modify file
      createTestFile('src/test.ts', 'export const x = 2;');

      // Read again without clearing cache
      const context1 = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir
      });
      expect(context1.context).toContain('= 1'); // Still cached

      // Clear cache and read again
      assembler.clearCache();
      const context2 = assembler.assemble(results, {
        readFromSource: true,
        projectRoot: tempDir
      });
      expect(context2.context).toContain('= 2'); // Updated
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript from .ts extension', () => {
      const entity = createEntity('myFunc', 'function', 'test.ts');
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results);

      expect(context.context).toContain('```typescript');
    });

    it('should detect Python from .py extension', () => {
      const entity = createEntity('my_func', 'function', 'test.py');
      entity.content = 'def my_func(): pass';
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results);

      expect(context.context).toContain('```python');
    });
  });

  describe('Prefix and Suffix', () => {
    it('should add prefix text', () => {
      const entity = createEntity('myFunc', 'function');
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        prefix: 'Here is the relevant context:'
      });

      expect(context.context.startsWith('Here is the relevant context:')).toBe(true);
    });

    it('should add suffix text', () => {
      const entity = createEntity('myFunc', 'function');
      const results = [createSearchResult(entity)];

      const context = assembler.assemble(results, {
        suffix: 'End of context.',
        includeSources: false
      });

      expect(context.context.endsWith('End of context.')).toBe(true);
    });
  });
});
