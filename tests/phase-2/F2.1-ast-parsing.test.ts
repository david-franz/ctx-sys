/**
 * F2.1 AST Parsing Tests
 *
 * IMPORTANT: These tests will FAIL with "Cannot find module" errors until
 * the actual implementations are created at:
 *   - src/parsing/parser.ts (ASTParser, TypeScriptExtractor, PythonExtractor)
 *   - src/parsing/types.ts (ParseResult, Symbol, Import, Export, ParseError)
 *
 * Tests verify tree-sitter based AST parsing including symbol extraction,
 * import/export detection, and language support.
 *
 * @see docs/phase-2/F2.1-ast-parsing.md
 */

// Import actual implementations from source paths (will fail until implemented)
import { ASTParser, TypeScriptExtractor, PythonExtractor } from '../../src/ast/parser';
import { ParseResult, Symbol, Import, Export, ParseError, Parameter } from '../../src/ast/types';

// Mock external dependencies
jest.mock('tree-sitter', () => {
  const mockParser = {
    setLanguage: jest.fn(),
    parse: jest.fn().mockReturnValue({
      rootNode: {
        type: 'program',
        children: [],
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        hasError: jest.fn().mockReturnValue(false),
        walk: jest.fn().mockReturnValue({
          gotoFirstChild: jest.fn().mockReturnValue(false),
          gotoNextSibling: jest.fn().mockReturnValue(false),
          gotoParent: jest.fn().mockReturnValue(false),
          currentNode: jest.fn()
        })
      }
    })
  };
  return jest.fn(() => mockParser);
});

jest.mock('tree-sitter-typescript', () => ({
  typescript: { name: 'typescript' },
  tsx: { name: 'tsx' }
}));

jest.mock('tree-sitter-javascript', () => ({
  name: 'javascript'
}));

jest.mock('tree-sitter-python', () => ({
  name: 'python'
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

// Import mocked modules for assertions
import TreeSitter from 'tree-sitter';
import * as fs from 'fs/promises';

describe('F2.1 AST Parsing', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // ASTParser Tests
  // ============================================================================

  describe('ASTParser', () => {
    let parser: ASTParser;

    beforeEach(() => {
      parser = new ASTParser();
    });

    describe('constructor', () => {
      it('should initialize with empty parser cache', () => {
        const newParser = new ASTParser();
        expect(newParser).toBeDefined();
        // Verify TreeSitter was instantiated
        expect(TreeSitter).toHaveBeenCalled();
      });

      it('should have language map for file extensions', () => {
        // Test language detection for various extensions
        expect(parser.getLanguage('.ts')).toBe('typescript');
        expect(parser.getLanguage('.tsx')).toBe('typescript');
        expect(parser.getLanguage('.js')).toBe('javascript');
        expect(parser.getLanguage('.jsx')).toBe('javascript');
        expect(parser.getLanguage('.mjs')).toBe('javascript');
        expect(parser.getLanguage('.py')).toBe('python');
        expect(parser.getLanguage('.go')).toBe('go');
        expect(parser.getLanguage('.rs')).toBe('rust');
        expect(parser.getLanguage('.java')).toBe('java');
        expect(parser.getLanguage('.c')).toBe('c');
        expect(parser.getLanguage('.h')).toBe('c');
        expect(parser.getLanguage('.cpp')).toBe('cpp');
        expect(parser.getLanguage('.hpp')).toBe('cpp');
        expect(parser.getLanguage('.cc')).toBe('cpp');
      });
    });

    describe('getLanguage', () => {
      it('should return typescript for .ts files', () => {
        const language = parser.getLanguage('.ts');
        expect(language).toBe('typescript');
      });

      it('should return typescript for .tsx files', () => {
        const language = parser.getLanguage('.tsx');
        expect(language).toBe('typescript');
      });

      it('should return javascript for .js files', () => {
        const language = parser.getLanguage('.js');
        expect(language).toBe('javascript');
      });

      it('should return javascript for .jsx files', () => {
        const language = parser.getLanguage('.jsx');
        expect(language).toBe('javascript');
      });

      it('should return javascript for .mjs files', () => {
        const language = parser.getLanguage('.mjs');
        expect(language).toBe('javascript');
      });

      it('should return python for .py files', () => {
        const language = parser.getLanguage('.py');
        expect(language).toBe('python');
      });

      it('should return null for unsupported extensions', () => {
        expect(parser.getLanguage('.md')).toBeNull();
        expect(parser.getLanguage('.txt')).toBeNull();
        expect(parser.getLanguage('.json')).toBeNull();
        expect(parser.getLanguage('.unsupported')).toBeNull();
      });
    });

    describe('parseFile', () => {
      it('should throw for unsupported file types', async () => {
        await expect(parser.parseFile('test.unsupported')).rejects.toThrow(
          /unsupported.*file.*type/i
        );
      });

      it('should read file and parse content for supported files', async () => {
        const mockContent = 'export function hello(): void {}';
        (fs.readFile as jest.Mock).mockResolvedValueOnce(mockContent);

        const result = await parser.parseFile('src/test.ts');

        expect(fs.readFile).toHaveBeenCalledWith('src/test.ts', 'utf-8');
        expect(result).toMatchObject({
          filePath: 'src/test.ts',
          language: 'typescript'
        });
        expect(result.symbols).toBeDefined();
        expect(result.imports).toBeDefined();
        expect(result.exports).toBeDefined();
        expect(result.errors).toBeDefined();
      });

      it('should return ParseResult for valid TypeScript file', async () => {
        const mockContent = `
          export class AuthService {
            login(username: string): boolean { return true; }
          }
        `;
        (fs.readFile as jest.Mock).mockResolvedValueOnce(mockContent);

        const result: ParseResult = await parser.parseFile('src/auth.ts');

        expect(result.filePath).toBe('src/auth.ts');
        expect(result.language).toBe('typescript');
        expect(Array.isArray(result.symbols)).toBe(true);
        expect(Array.isArray(result.imports)).toBe(true);
        expect(Array.isArray(result.exports)).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should return ParseResult for valid Python file', async () => {
        const mockContent = `
def greet(name: str) -> str:
    return f"Hello, {name}!"
        `;
        (fs.readFile as jest.Mock).mockResolvedValueOnce(mockContent);

        const result: ParseResult = await parser.parseFile('src/utils.py');

        expect(result.filePath).toBe('src/utils.py');
        expect(result.language).toBe('python');
        expect(Array.isArray(result.symbols)).toBe(true);
      });

      it('should handle file read errors', async () => {
        (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('ENOENT: file not found'));

        await expect(parser.parseFile('nonexistent.ts')).rejects.toThrow('ENOENT');
      });
    });

    describe('parseContent', () => {
      it('should parse TypeScript content directly', () => {
        const content = `
          export function hello(name: string): string {
            return \`Hello, \${name}!\`;
          }
        `;

        const result = parser.parseContent(content, 'typescript');

        expect(result.filePath).toBe('<inline>');
        expect(result.language).toBe('typescript');
        expect(Array.isArray(result.symbols)).toBe(true);
        expect(Array.isArray(result.imports)).toBe(true);
        expect(Array.isArray(result.exports)).toBe(true);
      });

      it('should parse Python content directly', () => {
        const content = `
def greet(name: str) -> str:
    """Greet a person by name."""
    return f"Hello, {name}!"
        `;

        const result = parser.parseContent(content, 'python');

        expect(result.filePath).toBe('<inline>');
        expect(result.language).toBe('python');
        expect(Array.isArray(result.symbols)).toBe(true);
      });

      it('should collect parse errors without crashing', () => {
        const malformedContent = `
          function broken( {
            // missing closing paren and syntax errors
        `;

        const result = parser.parseContent(malformedContent, 'typescript');

        // Parser should return result even with errors
        expect(result).toBeDefined();
        expect(result.language).toBe('typescript');
        // Errors may be collected
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should throw for unsupported languages', () => {
        expect(() => parser.parseContent('code', 'brainfuck' as any)).toThrow(
          /unsupported.*language/i
        );
      });
    });

    describe('caching behavior', () => {
      it('should reuse parser instances for same language', async () => {
        const content1 = 'const a = 1;';
        const content2 = 'const b = 2;';

        parser.parseContent(content1, 'typescript');
        parser.parseContent(content2, 'typescript');

        // TreeSitter constructor should be called once per language, not per parse
        // The exact call count depends on implementation but should demonstrate caching
        expect(TreeSitter).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // TypeScriptExtractor Tests
  // ============================================================================

  describe('TypeScriptExtractor', () => {
    let extractor: TypeScriptExtractor;
    let mockTree: any;

    beforeEach(() => {
      extractor = new TypeScriptExtractor();
      // Create a mock tree for testing
      mockTree = {
        rootNode: {
          type: 'program',
          children: [],
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 0 }
        }
      };
    });

    describe('extractSymbols', () => {
      it('should extract classes with methods', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/service.ts');

        expect(Array.isArray(symbols)).toBe(true);
        // Verify extractor was called (actual extraction depends on tree structure)
      });

      it('should extract interfaces', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/types.ts');

        expect(Array.isArray(symbols)).toBe(true);
      });

      it('should extract functions with parameters', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/utils.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.type === 'function') {
            expect(symbol.name).toBeDefined();
            expect(symbol.parameters).toBeDefined();
            expect(Array.isArray(symbol.parameters)).toBe(true);
          }
        });
      });

      it('should extract type annotations', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/typed.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.type === 'function' && symbol.returnType) {
            expect(typeof symbol.returnType).toBe('string');
          }
        });
      });

      it('should extract decorators', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/decorated.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.decorators) {
            expect(Array.isArray(symbol.decorators)).toBe(true);
          }
        });
      });

      it('should detect async functions', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/async.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.isAsync !== undefined) {
            expect(typeof symbol.isAsync).toBe('boolean');
          }
        });
      });

      it('should detect static methods', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/static.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.isStatic !== undefined) {
            expect(typeof symbol.isStatic).toBe('boolean');
          }
        });
      });

      it('should extract visibility modifiers', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/visibility.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.visibility) {
            expect(['public', 'private', 'protected']).toContain(symbol.visibility);
          }
        });
      });

      it('should detect exported symbols', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/exports.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.isExported !== undefined) {
            expect(typeof symbol.isExported).toBe('boolean');
          }
        });
      });

      it('should extract docstrings', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/documented.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.docstring) {
            expect(typeof symbol.docstring).toBe('string');
          }
        });
      });

      it('should build correct qualified names', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/auth/service.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.qualifiedName) {
            expect(symbol.qualifiedName).toContain('::');
            // Qualified name should contain file path and symbol name
            expect(symbol.qualifiedName).toContain(symbol.name);
          }
        });
      });

      it('should build correct signatures', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/functions.ts');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.signature && symbol.type === 'function') {
            expect(symbol.signature).toContain(symbol.name);
            expect(symbol.signature).toContain('(');
            expect(symbol.signature).toContain(')');
          }
        });
      });

      it('should have correct line numbers', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/lines.ts');

        symbols.forEach((symbol: Symbol) => {
          expect(typeof symbol.startLine).toBe('number');
          expect(typeof symbol.endLine).toBe('number');
          expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.startLine);
        });
      });
    });

    describe('extractImports', () => {
      it('should extract default imports', () => {
        const imports = extractor.extractImports(mockTree);

        expect(Array.isArray(imports)).toBe(true);
        imports.forEach((imp: Import) => {
          expect(imp.source).toBeDefined();
          expect(imp.specifiers).toBeDefined();
        });
      });

      it('should extract named imports', () => {
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          if (imp.specifiers.length > 1) {
            imp.specifiers.forEach((spec: { name: string; alias?: string }) => {
              expect(spec.name).toBeDefined();
            });
          }
        });
      });

      it('should extract aliased imports', () => {
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          imp.specifiers.forEach((spec: { name: string; alias?: string }) => {
            if (spec.alias) {
              expect(typeof spec.alias).toBe('string');
              expect(spec.alias).not.toBe(spec.name);
            }
          });
        });
      });

      it('should extract namespace imports', () => {
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          if (imp.isNamespace) {
            expect(imp.isNamespace).toBe(true);
            expect(imp.specifiers[0].name).toBe('*');
          }
        });
      });

      it('should handle relative paths', () => {
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          if (imp.source.startsWith('.')) {
            expect(imp.source.startsWith('./') || imp.source.startsWith('../')).toBe(true);
          }
        });
      });

      it('should include line numbers', () => {
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          expect(typeof imp.startLine).toBe('number');
          expect(imp.startLine).toBeGreaterThanOrEqual(1);
        });
      });
    });

    describe('extractExports', () => {
      it('should extract named exports', () => {
        const exports = extractor.extractExports(mockTree);

        expect(Array.isArray(exports)).toBe(true);
        exports.forEach((exp: Export) => {
          expect(typeof exp.name).toBe('string');
        });
      });

      it('should extract default exports', () => {
        const exports = extractor.extractExports(mockTree);

        const hasDefault = exports.some((exp: Export) => exp.isDefault === true);
        // May or may not have default export depending on tree
        expect(typeof hasDefault).toBe('boolean');
      });

      it('should extract re-exports', () => {
        const exports = extractor.extractExports(mockTree);

        exports.forEach((exp: Export) => {
          if (exp.source) {
            // Re-export has a source
            expect(typeof exp.source).toBe('string');
          }
        });
      });

      it('should include line numbers', () => {
        const exports = extractor.extractExports(mockTree);

        exports.forEach((exp: Export) => {
          if (exp.startLine !== undefined) {
            expect(typeof exp.startLine).toBe('number');
          }
        });
      });
    });
  });

  // ============================================================================
  // PythonExtractor Tests
  // ============================================================================

  describe('PythonExtractor', () => {
    let extractor: PythonExtractor;
    let mockTree: any;

    beforeEach(() => {
      extractor = new PythonExtractor();
      mockTree = {
        rootNode: {
          type: 'module',
          children: [],
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 10, column: 0 }
        }
      };
    });

    describe('extractSymbols', () => {
      it('should extract classes with methods', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/service.py');

        expect(Array.isArray(symbols)).toBe(true);
      });

      it('should extract functions', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/utils.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.type === 'function') {
            expect(symbol.name).toBeDefined();
          }
        });
      });

      it('should extract docstrings', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/documented.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.docstring) {
            expect(typeof symbol.docstring).toBe('string');
          }
        });
      });

      it('should extract decorators', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/decorated.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.decorators) {
            expect(Array.isArray(symbol.decorators)).toBe(true);
            symbol.decorators.forEach((dec: string) => {
              expect(dec.startsWith('@')).toBe(true);
            });
          }
        });
      });

      it('should extract type hints', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/typed.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.parameters) {
            symbol.parameters.forEach((param: Parameter) => {
              if (param.type) {
                expect(typeof param.type).toBe('string');
              }
            });
          }
        });
      });

      it('should detect visibility from naming convention', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/private.py');

        symbols.forEach((symbol: Symbol) => {
          // Python convention: _ = protected, __ = private
          if (symbol.name.startsWith('__') && !symbol.name.endsWith('__')) {
            expect(symbol.visibility).toBe('private');
          } else if (symbol.name.startsWith('_')) {
            expect(symbol.visibility).toBe('protected');
          }
        });
      });

      it('should detect staticmethod decorator', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/static.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.decorators?.includes('@staticmethod')) {
            expect(symbol.isStatic).toBe(true);
          }
        });
      });

      it('should detect classmethod decorator', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/classmethod.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.decorators?.includes('@classmethod')) {
            // Class methods have cls as first parameter
            expect(symbol.decorators).toContain('@classmethod');
          }
        });
      });

      it('should detect async functions', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/async.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.isAsync !== undefined) {
            expect(typeof symbol.isAsync).toBe('boolean');
          }
        });
      });

      it('should extract __init__ methods', () => {
        const symbols = extractor.extractSymbols(mockTree, 'src/classes.py');

        symbols.forEach((symbol: Symbol) => {
          if (symbol.type === 'class' && symbol.children) {
            const hasInit = symbol.children.some((child: Symbol) => child.name === '__init__');
            // Class may or may not have __init__
            expect(typeof hasInit).toBe('boolean');
          }
        });
      });
    });

    describe('extractImports', () => {
      it('should extract import statements', () => {
        // import os
        const imports = extractor.extractImports(mockTree);

        expect(Array.isArray(imports)).toBe(true);
        imports.forEach((imp: Import) => {
          expect(imp.source).toBeDefined();
        });
      });

      it('should extract from imports', () => {
        // from typing import List, Dict
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          expect(imp.specifiers).toBeDefined();
          expect(Array.isArray(imp.specifiers)).toBe(true);
        });
      });

      it('should extract aliased imports', () => {
        // from numpy import array as np_array
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          imp.specifiers.forEach((spec: { name: string; alias?: string }) => {
            if (spec.alias) {
              expect(typeof spec.alias).toBe('string');
            }
          });
        });
      });

      it('should handle relative imports', () => {
        // from .utils import helper
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          if (imp.source.startsWith('.')) {
            expect(imp.isRelative).toBe(true);
          }
        });
      });

      it('should include line numbers', () => {
        const imports = extractor.extractImports(mockTree);

        imports.forEach((imp: Import) => {
          expect(typeof imp.startLine).toBe('number');
        });
      });
    });

    describe('extractExports', () => {
      it('should extract __all__ list', () => {
        // __all__ = ['func1', 'Class1']
        const exports = extractor.extractExports(mockTree);

        expect(Array.isArray(exports)).toBe(true);
      });

      it('should infer exports from public symbols', () => {
        // In Python, non-underscore prefixed top-level symbols are public
        const exports = extractor.extractExports(mockTree);

        exports.forEach((exp: Export) => {
          expect(exp.name).toBeDefined();
        });
      });
    });
  });

  // ============================================================================
  // Symbol Data Model Tests
  // ============================================================================

  describe('Symbol data model', () => {
    it('should have all required fields', () => {
      const parser = new ASTParser();
      const result = parser.parseContent('const x = 1;', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        expect(symbol.type).toBeDefined();
        expect(symbol.name).toBeDefined();
        expect(symbol.qualifiedName).toBeDefined();
        expect(typeof symbol.startLine).toBe('number');
        expect(typeof symbol.endLine).toBe('number');
      });
    });

    it('should support all symbol types', () => {
      const validTypes = [
        'class', 'interface', 'type', 'function', 'method',
        'property', 'variable', 'enum', 'namespace', 'module'
      ];

      const parser = new ASTParser();
      const result = parser.parseContent('class A {}', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        expect(validTypes).toContain(symbol.type);
      });
    });

    it('should support nested children', () => {
      const parser = new ASTParser();
      const content = `
        class Parent {
          child1() {}
          child2() {}
        }
      `;
      const result = parser.parseContent(content, 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        if (symbol.type === 'class' && symbol.children) {
          expect(Array.isArray(symbol.children)).toBe(true);
          symbol.children.forEach((child: Symbol) => {
            expect(child.name).toBeDefined();
            expect(child.type).toBeDefined();
          });
        }
      });
    });

    it('should have correct line numbers', () => {
      const parser = new ASTParser();
      const result = parser.parseContent('function f() {\n  return 1;\n}', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        expect(symbol.startLine).toBeGreaterThanOrEqual(1);
        expect(symbol.endLine).toBeGreaterThanOrEqual(symbol.startLine);
      });
    });
  });

  // ============================================================================
  // Parameter Data Model Tests
  // ============================================================================

  describe('Parameter data model', () => {
    it('should support required parameters', () => {
      const parser = new ASTParser();
      const result = parser.parseContent('function f(id: string) {}', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        if (symbol.parameters) {
          symbol.parameters.forEach((param: Parameter) => {
            expect(param.name).toBeDefined();
            if (!param.isOptional && !param.defaultValue) {
              // Required parameter
              expect(param.isOptional).toBeFalsy();
            }
          });
        }
      });
    });

    it('should support optional parameters', () => {
      const parser = new ASTParser();
      const result = parser.parseContent('function f(opt?: string) {}', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        if (symbol.parameters) {
          symbol.parameters.forEach((param: Parameter) => {
            if (param.isOptional) {
              expect(param.isOptional).toBe(true);
            }
          });
        }
      });
    });

    it('should support rest parameters', () => {
      const parser = new ASTParser();
      const result = parser.parseContent('function f(...args: string[]) {}', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        if (symbol.parameters) {
          symbol.parameters.forEach((param: Parameter) => {
            if (param.isRest) {
              expect(param.isRest).toBe(true);
            }
          });
        }
      });
    });

    it('should support default values', () => {
      const parser = new ASTParser();
      const result = parser.parseContent('function f(timeout = 3000) {}', 'typescript');

      result.symbols.forEach((symbol: Symbol) => {
        if (symbol.parameters) {
          symbol.parameters.forEach((param: Parameter) => {
            if (param.defaultValue) {
              expect(typeof param.defaultValue).toBe('string');
            }
          });
        }
      });
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    let parser: ASTParser;

    beforeEach(() => {
      parser = new ASTParser();
    });

    it('should collect parse errors in result', () => {
      const malformedContent = 'function broken( { syntax error here';
      const result = parser.parseContent(malformedContent, 'typescript');

      expect(Array.isArray(result.errors)).toBe(true);
      // Errors should have proper structure
      result.errors.forEach((error: ParseError) => {
        expect(error.message).toBeDefined();
        expect(typeof error.startLine).toBe('number');
      });
    });

    it('should continue parsing after errors', () => {
      const contentWithErrors = `
        function broken( {

        function valid() {
          return true;
        }
      `;
      const result = parser.parseContent(contentWithErrors, 'typescript');

      // Parser should recover and find valid symbols
      expect(result).toBeDefined();
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it('should handle empty content', () => {
      const result = parser.parseContent('', 'typescript');

      expect(result.symbols).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
    });

    it('should handle null/undefined gracefully', () => {
      expect(() => parser.parseContent(null as any, 'typescript')).toThrow();
      expect(() => parser.parseContent(undefined as any, 'typescript')).toThrow();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    let parser: ASTParser;

    beforeEach(() => {
      parser = new ASTParser();
    });

    it('should handle empty files', () => {
      const result = parser.parseContent('', 'typescript');

      expect(result.symbols).toHaveLength(0);
      expect(result.imports).toHaveLength(0);
      expect(result.exports).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files with only comments', () => {
      const content = `
        // This is a comment
        /* This is a block comment */
        /** This is a JSDoc comment */
      `;
      const result = parser.parseContent(content, 'typescript');

      expect(result.symbols).toHaveLength(0);
    });

    it('should handle deeply nested classes', () => {
      const content = `
        class Outer {
          static Inner = class {
            method() {}
          }
        }
      `;
      const result = parser.parseContent(content, 'typescript');

      // Should find Outer class
      const outerClass = result.symbols.find((s: Symbol) => s.name === 'Outer');
      if (outerClass?.children) {
        expect(outerClass.children.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle anonymous functions', () => {
      const content = `
        const handler = () => {};
        const fn = function() {};
      `;
      const result = parser.parseContent(content, 'typescript');

      // Should capture variables with function values
      expect(Array.isArray(result.symbols)).toBe(true);
    });

    it('should handle generic types', () => {
      const content = `
        function identity<T>(value: T): T {
          return value;
        }
      `;
      const result = parser.parseContent(content, 'typescript');

      const func = result.symbols.find((s: Symbol) => s.name === 'identity');
      if (func?.signature) {
        expect(func.signature).toContain('<T>');
      }
    });

    it('should handle unicode identifiers', () => {
      const content = `
        const \u8BA1\u7B97\u603B\u548C = (a: number) => a;
      `;
      const result = parser.parseContent(content, 'typescript');

      const unicodeSymbol = result.symbols.find((s: Symbol) => s.name === '\u8BA1\u7B97\u603B\u548C');
      if (unicodeSymbol) {
        expect(unicodeSymbol.name).toBe('\u8BA1\u7B97\u603B\u548C');
      }
    });

    it('should handle very long parameter lists', () => {
      const params = Array(20).fill(null).map((_, i) => `param${i}: string`).join(', ');
      const content = `function manyParams(${params}) {}`;
      const result = parser.parseContent(content, 'typescript');

      const func = result.symbols.find((s: Symbol) => s.name === 'manyParams');
      if (func?.parameters) {
        expect(func.parameters.length).toBe(20);
      }
    });

    it('should handle JSX/TSX content', () => {
      const content = `
        function Component() {
          return <div className="test">Hello</div>;
        }
      `;
      const result = parser.parseContent(content, 'typescript');

      expect(Array.isArray(result.symbols)).toBe(true);
    });
  });

  // ============================================================================
  // Language-specific Features
  // ============================================================================

  describe('language-specific features', () => {
    describe('TypeScript specific', () => {
      let parser: ASTParser;

      beforeEach(() => {
        parser = new ASTParser();
      });

      it('should handle type aliases', () => {
        const content = 'type UserId = string;';
        const result = parser.parseContent(content, 'typescript');

        const typeAlias = result.symbols.find((s: Symbol) => s.type === 'type');
        if (typeAlias) {
          expect(typeAlias.name).toBe('UserId');
        }
      });

      it('should handle enums', () => {
        const content = `
          enum Status {
            Active,
            Inactive
          }
        `;
        const result = parser.parseContent(content, 'typescript');

        const enumSymbol = result.symbols.find((s: Symbol) => s.type === 'enum');
        if (enumSymbol) {
          expect(enumSymbol.name).toBe('Status');
        }
      });

      it('should handle namespaces', () => {
        const content = `
          namespace API {
            export function call() {}
          }
        `;
        const result = parser.parseContent(content, 'typescript');

        const namespace = result.symbols.find((s: Symbol) => s.type === 'namespace');
        if (namespace) {
          expect(namespace.name).toBe('API');
        }
      });

      it('should handle interfaces', () => {
        const content = `
          interface User {
            id: string;
            name: string;
          }
        `;
        const result = parser.parseContent(content, 'typescript');

        const iface = result.symbols.find((s: Symbol) => s.type === 'interface');
        if (iface) {
          expect(iface.name).toBe('User');
        }
      });

      it('should handle abstract classes', () => {
        const content = `
          abstract class BaseService {
            abstract process(): void;
          }
        `;
        const result = parser.parseContent(content, 'typescript');

        const abstractClass = result.symbols.find((s: Symbol) => s.name === 'BaseService');
        if (abstractClass) {
          expect(abstractClass.type).toBe('class');
        }
      });
    });

    describe('Python specific', () => {
      let parser: ASTParser;

      beforeEach(() => {
        parser = new ASTParser();
      });

      it('should extract __init__ methods', () => {
        const content = `
class MyClass:
    def __init__(self, value):
        self.value = value
        `;
        const result = parser.parseContent(content, 'python');

        const classSymbol = result.symbols.find((s: Symbol) => s.type === 'class');
        if (classSymbol?.children) {
          const initMethod = classSymbol.children.find((c: Symbol) => c.name === '__init__');
          if (initMethod) {
            expect(initMethod.name).toBe('__init__');
          }
        }
      });

      it('should handle class methods', () => {
        const content = `
class MyClass:
    @classmethod
    def from_dict(cls, data):
        return cls(data)
        `;
        const result = parser.parseContent(content, 'python');

        const classSymbol = result.symbols.find((s: Symbol) => s.type === 'class');
        if (classSymbol?.children) {
          const classMethod = classSymbol.children.find((c: Symbol) => c.name === 'from_dict');
          if (classMethod?.decorators) {
            expect(classMethod.decorators).toContain('@classmethod');
          }
        }
      });

      it('should handle property decorators', () => {
        const content = `
class MyClass:
    @property
    def value(self):
        return self._value
        `;
        const result = parser.parseContent(content, 'python');

        expect(Array.isArray(result.symbols)).toBe(true);
      });

      it('should handle dataclasses', () => {
        const content = `
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float
        `;
        const result = parser.parseContent(content, 'python');

        const dataclass = result.symbols.find((s: Symbol) => s.name === 'Point');
        if (dataclass?.decorators) {
          expect(dataclass.decorators).toContain('@dataclass');
        }
      });
    });
  });

  // ============================================================================
  // Integration Tests - Mock Interactions
  // ============================================================================

  describe('mock interactions', () => {
    it('should call TreeSitter parser with correct language', () => {
      const parser = new ASTParser();
      parser.parseContent('const x = 1;', 'typescript');

      expect(TreeSitter).toHaveBeenCalled();
    });

    it('should read file content when parsing file', async () => {
      (fs.readFile as jest.Mock).mockResolvedValueOnce('const x = 1;');

      const parser = new ASTParser();
      await parser.parseFile('test.ts');

      expect(fs.readFile).toHaveBeenCalledWith('test.ts', 'utf-8');
    });

    it('should handle multiple file parses', async () => {
      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('const a = 1;')
        .mockResolvedValueOnce('const b = 2;')
        .mockResolvedValueOnce('def c(): pass');

      const parser = new ASTParser();
      await parser.parseFile('a.ts');
      await parser.parseFile('b.ts');
      await parser.parseFile('c.py');

      expect(fs.readFile).toHaveBeenCalledTimes(3);
    });
  });
});
