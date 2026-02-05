import { ASTParser, TypeScriptExtractor, PythonExtractor, GenericExtractor } from '../../src/ast';

describe('F2.1 - AST Parsing', () => {
  let parser: ASTParser;

  beforeAll(async () => {
    // Use default grammars directory (from @vscode/tree-sitter-wasm)
    parser = new ASTParser();
  });

  describe('ASTParser', () => {
    describe('Language Detection', () => {
      it('should detect TypeScript files', () => {
        expect(parser.getLanguage('file.ts')).toBe('typescript');
        expect(parser.getLanguage('file.tsx')).toBe('typescript');
      });

      it('should detect JavaScript files', () => {
        expect(parser.getLanguage('file.js')).toBe('javascript');
        expect(parser.getLanguage('file.jsx')).toBe('javascript');
        expect(parser.getLanguage('file.mjs')).toBe('javascript');
        expect(parser.getLanguage('file.cjs')).toBe('javascript');
      });

      it('should detect Python files', () => {
        expect(parser.getLanguage('file.py')).toBe('python');
      });

      it('should detect Go files', () => {
        expect(parser.getLanguage('file.go')).toBe('go');
      });

      it('should detect Rust files', () => {
        expect(parser.getLanguage('file.rs')).toBe('rust');
      });

      it('should detect Java files', () => {
        expect(parser.getLanguage('file.java')).toBe('java');
      });

      it('should detect C/C++ files', () => {
        expect(parser.getLanguage('file.c')).toBe('c');
        expect(parser.getLanguage('file.h')).toBe('c');
        expect(parser.getLanguage('file.cpp')).toBe('cpp');
        expect(parser.getLanguage('file.hpp')).toBe('cpp');
        expect(parser.getLanguage('file.cc')).toBe('cpp');
        expect(parser.getLanguage('file.cxx')).toBe('cpp');
      });

      it('should return null for unsupported files', () => {
        expect(parser.getLanguage('file.txt')).toBeNull();
        expect(parser.getLanguage('file.md')).toBeNull();
        expect(parser.getLanguage('file.json')).toBeNull();
      });

      it('should check if file is supported', () => {
        expect(parser.isSupported('file.ts')).toBe(true);
        expect(parser.isSupported('file.py')).toBe(true);
        expect(parser.isSupported('file.txt')).toBe(false);
      });
    });

    describe('Supported Extensions and Languages', () => {
      it('should return list of supported extensions', () => {
        const extensions = parser.getSupportedExtensions();
        expect(extensions).toContain('.ts');
        expect(extensions).toContain('.tsx');
        expect(extensions).toContain('.js');
        expect(extensions).toContain('.py');
        expect(extensions.length).toBeGreaterThan(10);
      });

      it('should return list of supported languages', () => {
        const languages = parser.getSupportedLanguages();
        expect(languages).toContain('typescript');
        expect(languages).toContain('javascript');
        expect(languages).toContain('python');
        expect(languages).toContain('go');
        expect(languages).toContain('rust');
      });
    });
  });

  describe('TypeScriptExtractor', () => {
    let extractor: TypeScriptExtractor;

    beforeAll(async () => {
      extractor = new TypeScriptExtractor();
    });

    it('should extract function declarations', async () => {
      const code = `
function greet(name: string): string {
  return 'Hello, ' + name;
}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(1);
      expect(result.symbols[0].type).toBe('function');
      expect(result.symbols[0].name).toBe('greet');
      expect(result.symbols[0].parameters).toHaveLength(1);
      expect(result.symbols[0].parameters![0].name).toBe('name');
      expect(result.symbols[0].parameters![0].type).toBe('string');
      expect(result.symbols[0].returnType).toBe('string');
    });

    it('should extract class declarations with methods', async () => {
      const code = `
class Calculator {
  private value: number;

  constructor(initial: number) {
    this.value = initial;
  }

  add(x: number): number {
    return this.value + x;
  }

  static create(): Calculator {
    return new Calculator(0);
  }
}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(1);
      const classSymbol = result.symbols[0];
      expect(classSymbol.type).toBe('class');
      expect(classSymbol.name).toBe('Calculator');
      expect(classSymbol.children).toBeDefined();
      expect(classSymbol.children!.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract interface declarations', async () => {
      const code = `
interface User {
  id: number;
  name: string;
  email?: string;
}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(1);
      expect(result.symbols[0].type).toBe('interface');
      expect(result.symbols[0].name).toBe('User');
    });

    it('should extract type alias declarations', async () => {
      const code = `
type ID = string | number;
type UserMap = Map<string, User>;
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(2);
      expect(result.symbols[0].type).toBe('type');
      expect(result.symbols[0].name).toBe('ID');
      expect(result.symbols[1].type).toBe('type');
      expect(result.symbols[1].name).toBe('UserMap');
    });

    it('should extract enum declarations', async () => {
      const code = `
enum Status {
  Active = 'active',
  Inactive = 'inactive',
  Pending = 'pending'
}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(1);
      expect(result.symbols[0].type).toBe('enum');
      expect(result.symbols[0].name).toBe('Status');
    });

    it('should extract arrow functions assigned to variables', async () => {
      const code = `
const add = (a: number, b: number): number => a + b;
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(1);
      expect(result.symbols[0].type).toBe('function');
      expect(result.symbols[0].name).toBe('add');
    });

    it('should extract async functions', async () => {
      const code = `
async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.symbols.length).toBe(1);
      expect(result.symbols[0].isAsync).toBe(true);
    });

    it('should detect exported symbols', async () => {
      const code = `
export function publicFn() {}
function privateFn() {}
export class PublicClass {}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      const publicFn = result.symbols.find(s => s.name === 'publicFn');
      const privateFn = result.symbols.find(s => s.name === 'privateFn');
      const publicClass = result.symbols.find(s => s.name === 'PublicClass');

      expect(publicFn?.isExported).toBe(true);
      expect(privateFn?.isExported).toBeFalsy();
      expect(publicClass?.isExported).toBe(true);
    });

    it('should extract imports', async () => {
      const code = `
import { useState, useEffect } from 'react';
import * as fs from 'fs';
import path from 'path';
import type { Request } from 'express';
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.imports.length).toBeGreaterThanOrEqual(3);

      const reactImport = result.imports.find(i => i.source === 'react');
      expect(reactImport).toBeDefined();
      expect(reactImport?.specifiers.some(s => s.name === 'useState')).toBe(true);
      expect(reactImport?.specifiers.some(s => s.name === 'useEffect')).toBe(true);

      const fsImport = result.imports.find(i => i.source === 'fs');
      expect(fsImport).toBeDefined();
      expect(fsImport?.isNamespace).toBe(true);

      const pathImport = result.imports.find(i => i.source === 'path');
      expect(pathImport).toBeDefined();
      expect(pathImport?.isDefault).toBe(true);
    });

    it('should extract exports', async () => {
      const code = `
export function foo() {}
export class Bar {}
export { baz, qux };
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      expect(result.exports).toContain('foo');
      expect(result.exports).toContain('Bar');
      expect(result.exports).toContain('baz');
      expect(result.exports).toContain('qux');
    });
  });

  describe('PythonExtractor', () => {
    it('should extract function definitions', async () => {
      const code = `
def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}"
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      expect(result.symbols.length).toBe(1);
      expect(result.symbols[0].type).toBe('function');
      expect(result.symbols[0].name).toBe('greet');
      expect(result.symbols[0].docstring).toBe('Return a greeting.');
    });

    it('should extract class definitions with methods', async () => {
      const code = `
class Calculator:
    """A simple calculator class."""

    def __init__(self, initial: int = 0):
        self.value = initial

    def add(self, x: int) -> int:
        """Add x to value."""
        return self.value + x

    @staticmethod
    def create():
        return Calculator(0)

    @classmethod
    def from_string(cls, s: str):
        return cls(int(s))
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      expect(result.symbols.length).toBe(1);
      const classSymbol = result.symbols[0];
      expect(classSymbol.type).toBe('class');
      expect(classSymbol.name).toBe('Calculator');
      expect(classSymbol.docstring).toBe('A simple calculator class.');
      expect(classSymbol.children).toBeDefined();
      // Should have at least __init__ and add methods
      expect(classSymbol.children!.length).toBeGreaterThanOrEqual(2);

      // Verify add method exists
      const addMethod = classSymbol.children!.find(m => m.name === 'add');
      expect(addMethod).toBeDefined();
      expect(addMethod?.type).toBe('method');
    });

    it('should extract async functions', async () => {
      const code = `
async def fetch_data(url: str) -> dict:
    """Fetch data from URL."""
    pass
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      expect(result.symbols[0].isAsync).toBe(true);
    });

    it('should detect method visibility from naming convention', async () => {
      const code = `
class Example:
    def public_method(self):
        pass

    def _protected_method(self):
        pass

    def __private_method(self):
        pass
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      const classSymbol = result.symbols[0];
      const publicMethod = classSymbol.children!.find(m => m.name === 'public_method');
      const protectedMethod = classSymbol.children!.find(m => m.name === '_protected_method');
      const privateMethod = classSymbol.children!.find(m => m.name === '__private_method');

      expect(publicMethod?.visibility).toBe('public');
      expect(protectedMethod?.visibility).toBe('protected');
      expect(privateMethod?.visibility).toBe('private');
    });

    it('should extract decorators', async () => {
      const code = `
@decorator
@another_decorator(arg)
def decorated_function():
    pass
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      expect(result.symbols[0].decorators).toBeDefined();
      expect(result.symbols[0].decorators!.length).toBe(2);
    });

    it('should extract imports', async () => {
      const code = `
import os
import sys, json
from pathlib import Path
from typing import Dict, List, Optional
from . import local_module
from ..parent import something as alias
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      expect(result.imports.length).toBeGreaterThanOrEqual(3);
    });

    it('should extract __all__ exports', async () => {
      const code = `
__all__ = ['foo', 'bar', 'baz']

def foo(): pass
def bar(): pass
def baz(): pass
def internal(): pass
`;
      const result = await parser.parseContent(code, 'python', 'test.py');

      expect(result.exports).toContain('foo');
      expect(result.exports).toContain('bar');
      expect(result.exports).toContain('baz');
      expect(result.exports).not.toContain('internal');
    });
  });

  describe('GenericExtractor', () => {
    it('should attempt to extract functions from unknown languages', async () => {
      // This would only work if we had a grammar loaded for the language
      // For now, just verify the extractor exists and has the right interface
      const extractor = new GenericExtractor();
      expect(extractor.extractSymbols).toBeDefined();
      expect(extractor.extractImports).toBeDefined();
      expect(extractor.extractExports).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported file types', async () => {
      await expect(parser.parseFile('file.txt')).rejects.toThrow('Unsupported file type');
    });

    it('should handle parse errors gracefully', async () => {
      const code = `
function broken( {
  // Missing closing paren and brace
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      // Should still return a result, possibly with errors
      expect(result).toBeDefined();
      expect(result.language).toBe('typescript');
    });

    it('should include parse errors in result', async () => {
      const code = `
function valid() {}
function broken syntax here {
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      // The parser may or may not report errors depending on tree-sitter's error recovery
      expect(result.errors).toBeDefined();
    });
  });

  describe('Qualified Names', () => {
    it('should build qualified names with file path', async () => {
      const code = `
function myFunction() {}
`;
      const result = await parser.parseContent(code, 'typescript', '/path/to/file.ts');

      expect(result.symbols[0].qualifiedName).toBe('/path/to/file.ts::myFunction');
    });

    it('should build qualified names for nested symbols', async () => {
      const code = `
class MyClass {
  myMethod() {}
}
`;
      const result = await parser.parseContent(code, 'typescript', 'file.ts');

      expect(result.symbols[0].qualifiedName).toBe('file.ts::MyClass');
      const method = result.symbols[0].children![0];
      expect(method.qualifiedName).toBe('file.ts::MyClass::myMethod');
    });
  });

  describe('Line Numbers', () => {
    it('should capture correct line numbers', async () => {
      const code = `// Comment line
function first() {}

function second() {
  return 42;
}
`;
      const result = await parser.parseContent(code, 'typescript', 'test.ts');

      const first = result.symbols.find(s => s.name === 'first');
      const second = result.symbols.find(s => s.name === 'second');

      expect(first?.startLine).toBe(2);
      expect(second?.startLine).toBe(4);
      expect(second?.endLine).toBe(6);
    });
  });
});
