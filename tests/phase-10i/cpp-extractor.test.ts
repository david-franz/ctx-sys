/**
 * Tests for C/C++ AST extractor.
 * These tests verify the extractor logic using mock SyntaxNode objects
 * since tree-sitter WASM loading requires async initialization.
 */

import { CppExtractor } from '../../src/ast/extractors/cpp';

// Helper to create mock syntax nodes
function mockNode(
  type: string,
  text: string,
  children: any[] = [],
  startRow = 0,
  endRow = 0
): any {
  const namedChildren = children;
  const node: any = {
    type,
    text,
    id: Math.random(),
    childCount: children.length,
    namedChildren,
    startPosition: { row: startRow, column: 0 },
    endPosition: { row: endRow, column: 0 },
    parent: null,
    child(i: number) { return children[i] ?? null; },
  };
  // Set parent references
  for (const child of children) {
    child.parent = node;
  }
  return node;
}

describe('CppExtractor', () => {
  const extractor = new CppExtractor();

  describe('extractImports', () => {
    it('should extract #include directives with quotes', () => {
      const root = mockNode('translation_unit', '', [
        mockNode('preproc_include', '#include "myheader.h"', [
          mockNode('string_literal', '"myheader.h"'),
        ]),
      ]);

      const imports = extractor.extractImports(root);
      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe('myheader.h');
    });

    it('should extract #include directives with angle brackets', () => {
      const root = mockNode('translation_unit', '', [
        mockNode('preproc_include', '#include <iostream>', [
          mockNode('system_lib_string', '<iostream>'),
        ]),
      ]);

      const imports = extractor.extractImports(root);
      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe('iostream');
    });

    it('should extract multiple includes', () => {
      const root = mockNode('translation_unit', '', [
        mockNode('preproc_include', '#include <vector>', [
          mockNode('system_lib_string', '<vector>'),
        ]),
        mockNode('preproc_include', '#include "utils.h"', [
          mockNode('string_literal', '"utils.h"'),
        ]),
      ]);

      const imports = extractor.extractImports(root);
      expect(imports).toHaveLength(2);
    });
  });

  describe('extractSymbols', () => {
    it('should extract a function definition', () => {
      const root = mockNode('translation_unit', '', [
        mockNode('function_definition', 'int main() {}', [
          mockNode('primitive_type', 'int'),
          mockNode('function_declarator', 'main()', [
            mockNode('identifier', 'main'),
            mockNode('parameter_list', '()', []),
          ]),
          mockNode('compound_statement', '{}'),
        ], 0, 5),
      ]);

      const symbols = extractor.extractSymbols(root, 'test.cpp');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('function');
      expect(symbols[0].name).toBe('main');
      expect(symbols[0].returnType).toBe('int');
    });

    it('should extract enum', () => {
      const root = mockNode('translation_unit', '', [
        mockNode('enum_specifier', 'enum Color { RED, GREEN, BLUE }', [
          mockNode('type_identifier', 'Color'),
        ], 0, 3),
      ]);

      const symbols = extractor.extractSymbols(root, 'test.cpp');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('enum');
      expect(symbols[0].name).toBe('Color');
    });

    it('should extract class with methods', () => {
      const methodDeclarator = mockNode('function_declarator', 'getValue()', [
        mockNode('field_identifier', 'getValue'),
        mockNode('parameter_list', '()', []),
      ]);
      const methodDef = mockNode('function_definition', 'int getValue() { return 0; }', [
        mockNode('primitive_type', 'int'),
        methodDeclarator,
        mockNode('compound_statement', '{ return 0; }'),
      ], 2, 4);

      const root = mockNode('translation_unit', '', [
        mockNode('class_specifier', 'class Foo { ... }', [
          mockNode('type_identifier', 'Foo'),
          mockNode('field_declaration_list', '{ ... }', [
            mockNode('access_specifier', 'public:', []),
            methodDef,
          ]),
        ], 0, 5),
      ]);

      const symbols = extractor.extractSymbols(root, 'test.cpp');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('class');
      expect(symbols[0].name).toBe('Foo');
      expect(symbols[0].children).toHaveLength(1);
      expect(symbols[0].children![0].type).toBe('method');
      expect(symbols[0].children![0].name).toBe('getValue');
      expect(symbols[0].children![0].visibility).toBe('public');
    });

    it('should extract struct', () => {
      const root = mockNode('translation_unit', '', [
        mockNode('struct_specifier', 'struct Point { int x; int y; }', [
          mockNode('type_identifier', 'Point'),
          mockNode('field_declaration_list', '{ int x; int y; }', [
            mockNode('field_declaration', 'int x;', [
              mockNode('primitive_type', 'int'),
              mockNode('field_identifier', 'x'),
            ]),
          ]),
        ], 0, 3),
      ]);

      const symbols = extractor.extractSymbols(root, 'test.c');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('class');
      expect(symbols[0].name).toBe('Point');
      expect(symbols[0].children).toHaveLength(1);
      expect(symbols[0].children![0].type).toBe('property');
      expect(symbols[0].children![0].name).toBe('x');
      // struct defaults to public visibility
      expect(symbols[0].children![0].visibility).toBe('public');
    });

    it('should handle namespaces', () => {
      const funcDeclarator = mockNode('function_declarator', 'foo()', [
        mockNode('identifier', 'foo'),
        mockNode('parameter_list', '()', []),
      ]);

      const root = mockNode('translation_unit', '', [
        mockNode('namespace_definition', 'namespace MyNS { ... }', [
          mockNode('identifier', 'MyNS'),
          mockNode('declaration_list', '{ ... }', [
            mockNode('function_definition', 'void foo() {}', [
              mockNode('primitive_type', 'void'),
              funcDeclarator,
              mockNode('compound_statement', '{}'),
            ], 2, 4),
          ]),
        ]),
      ]);

      const symbols = extractor.extractSymbols(root, 'test.cpp');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('foo');
      expect(symbols[0].qualifiedName).toBe('test.cpp::MyNS::foo');
    });
  });

  describe('extractExports', () => {
    it('should return empty array (C/C++ has no explicit exports)', () => {
      const root = mockNode('translation_unit', '', []);
      expect(extractor.extractExports(root)).toEqual([]);
    });
  });
});
