import { SymbolSummarizer, ASTParser, Symbol, ParseResult } from '../../src';

describe('F2.2 - Symbol Summarization', () => {
  let parser: ASTParser;
  let summarizer: SymbolSummarizer;

  beforeAll(() => {
    parser = new ASTParser();
    summarizer = new SymbolSummarizer();
  });

  describe('SymbolSummarizer', () => {
    describe('Function Summarization', () => {
      it('should summarize a simple function', async () => {
        const code = `
function greet(name: string): string {
  return 'Hello, ' + name;
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols.length).toBe(1);
        expect(summary.symbols[0].name).toBe('greet');
        expect(summary.symbols[0].type).toBe('function');
        expect(summary.symbols[0].description).toContain('function');
        expect(summary.symbols[0].parameters).toHaveLength(1);
        expect(summary.symbols[0].parameters![0].name).toBe('name');
        expect(summary.symbols[0].returnType).toBe('string');
      });

      it('should summarize an async function', async () => {
        const code = `
async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].description).toContain('Async');
      });

      it('should include signature in summary', async () => {
        const code = `
function add(a: number, b: number): number {
  return a + b;
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].signature).toBeDefined();
        expect(summary.symbols[0].signature).toContain('add');
      });
    });

    describe('Class Summarization', () => {
      it('should summarize a class with methods', async () => {
        const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols.length).toBe(1);
        expect(summary.symbols[0].type).toBe('class');
        expect(summary.symbols[0].name).toBe('Calculator');
        expect(summary.symbols[0].children).toBeDefined();
        expect(summary.symbols[0].children!.length).toBe(2);
        expect(summary.symbols[0].description).toContain('class');
        expect(summary.symbols[0].description).toContain('method');
      });

      it('should summarize exported class', async () => {
        const code = `
export class PublicClass {
  getValue(): number {
    return 42;
  }
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].description).toContain('Exported');
      });
    });

    describe('Interface Summarization', () => {
      it('should summarize an interface', async () => {
        const code = `
interface User {
  id: number;
  name: string;
  email?: string;
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].type).toBe('interface');
        expect(summary.symbols[0].description).toContain('Interface');
      });
    });

    describe('Python Summarization', () => {
      it('should summarize Python function with docstring', async () => {
        const code = `
def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}"
`;
        const parseResult = await parser.parseContent(code, 'python', 'test.py');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].description).toBe('Return a greeting message.');
      });

      it('should summarize Python class', async () => {
        const code = `
class Calculator:
    """A simple calculator class."""

    def add(self, a: int, b: int) -> int:
        """Add two numbers."""
        return a + b
`;
        const parseResult = await parser.parseContent(code, 'python', 'test.py');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].type).toBe('class');
        expect(summary.symbols[0].description).toBe('A simple calculator class.');
      });
    });

    describe('File Summary', () => {
      it('should generate file description', async () => {
        const code = `
export function foo() {}
export function bar() {}
export class Baz {}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.filePath).toBe('test.ts');
        expect(summary.language).toBe('typescript');
        expect(summary.description).toContain('typescript');
        expect(summary.exports).toContain('foo');
        expect(summary.exports).toContain('bar');
        expect(summary.exports).toContain('Baz');
      });

      it('should compute file metrics', async () => {
        const code = `
import { something } from 'somewhere';
import { another } from 'another-place';

export class MyClass {
  method1() {}
  method2() {}
}

export function standalone() {}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.metrics).toBeDefined();
        expect(summary.metrics!.classCount).toBe(1);
        expect(summary.metrics!.functionCount).toBeGreaterThanOrEqual(1);
        expect(summary.metrics!.importCount).toBe(2);
      });

      it('should include dependencies from imports', async () => {
        const code = `
import { useState } from 'react';
import * as fs from 'fs';
import path from 'path';
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.dependencies).toContain('react');
        expect(summary.dependencies).toContain('fs');
        expect(summary.dependencies).toContain('path');
      });
    });

    describe('Summarization Options', () => {
      it('should filter private symbols when includePrivate is false', async () => {
        const code = `
class Example:
    def public_method(self):
        pass

    def _protected_method(self):
        pass

    def __private_method(self):
        pass
`;
        const parseResult = await parser.parseContent(code, 'python', 'test.py');

        // Default (includePrivate = false)
        const summary = await summarizer.summarizeFile(parseResult);
        const classSymbol = summary.symbols[0];

        // Should only have public method
        const publicMethods = classSymbol.children?.filter(
          c => !c.name.startsWith('_')
        );
        expect(publicMethods?.length).toBeGreaterThan(0);
      });

      it('should include private symbols when includePrivate is true', async () => {
        const code = `
class Example:
    def public_method(self):
        pass

    def _protected_method(self):
        pass
`;
        const parseResult = await parser.parseContent(code, 'python', 'test.py');

        const privateSummarizer = new SymbolSummarizer({ includePrivate: true });
        const summary = await privateSummarizer.summarizeFile(parseResult);
        const classSymbol = summary.symbols[0];

        // Should have both public and protected methods
        expect(classSymbol.children?.length).toBeGreaterThanOrEqual(2);
      });

      it('should limit children with maxChildren option', async () => {
        const code = `
class ManyMethods {
  method1() {}
  method2() {}
  method3() {}
  method4() {}
  method5() {}
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');

        const limitedSummarizer = new SymbolSummarizer({ maxChildren: 2 });
        const summary = await limitedSummarizer.summarizeFile(parseResult);
        const classSymbol = summary.symbols[0];

        expect(classSymbol.children?.length).toBe(2);
      });

      it('should include metadata in detailed level', async () => {
        const code = `
@decorator
async function decorated(): Promise<void> {}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');

        const detailedSummarizer = new SymbolSummarizer({ level: 'detailed' });
        const summary = await detailedSummarizer.summarizeFile(parseResult);

        // Metadata should be present in detailed mode
        expect(summary.symbols[0].metadata).toBeDefined();
      });
    });

    describe('Location Information', () => {
      it('should include correct location information', async () => {
        const code = `// Line 1
function first() {} // Line 2

function second() { // Line 4
  return 42;
} // Line 6
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        const firstFn = summary.symbols.find(s => s.name === 'first');
        const secondFn = summary.symbols.find(s => s.name === 'second');

        expect(firstFn?.location.startLine).toBe(2);
        expect(secondFn?.location.startLine).toBe(4);
        expect(secondFn?.location.endLine).toBe(6);
      });
    });

    describe('Qualified Names', () => {
      it('should preserve qualified names in summaries', async () => {
        const code = `
class MyClass {
  myMethod() {}
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', '/path/to/file.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.symbols[0].qualifiedName).toBe('/path/to/file.ts::MyClass');
        expect(summary.symbols[0].children![0].qualifiedName).toBe(
          '/path/to/file.ts::MyClass::myMethod'
        );
      });
    });

    describe('Complexity Assessment', () => {
      it('should assess low complexity for simple files', async () => {
        const code = `
function simple() {}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(summary.metrics!.complexity).toBe('low');
      });

      it('should assess higher complexity for larger files', async () => {
        // Generate code with many functions
        const functions = Array.from({ length: 15 }, (_, i) =>
          `function fn${i}() {}`
        ).join('\n');

        const parseResult = await parser.parseContent(functions, 'typescript', 'test.ts');
        const summary = await summarizer.summarizeFile(parseResult);

        expect(['medium', 'high']).toContain(summary.metrics!.complexity);
      });
    });
  });
});
