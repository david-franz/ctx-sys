/**
 * Tests for C# AST extractor.
 * These tests verify the extractor logic using mock SyntaxNode objects.
 */

import { CSharpExtractor } from '../../src/ast/extractors/csharp';

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
  for (const child of children) {
    child.parent = node;
  }
  return node;
}

describe('CSharpExtractor', () => {
  const extractor = new CSharpExtractor();

  describe('extractImports', () => {
    it('should extract using directives', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('using_directive', 'using System;', [
          mockNode('identifier', 'System'),
        ]),
        mockNode('using_directive', 'using System.Collections.Generic;', [
          mockNode('qualified_name', 'System.Collections.Generic'),
        ]),
      ]);

      const imports = extractor.extractImports(root);
      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe('System');
      expect(imports[1].source).toBe('System.Collections.Generic');
    });
  });

  describe('extractSymbols', () => {
    it('should extract a class', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('class_declaration', 'public class Foo { }', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'Foo'),
          mockNode('declaration_list', '{ }', []),
        ], 0, 5),
      ]);

      const symbols = extractor.extractSymbols(root, 'Foo.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('class');
      expect(symbols[0].name).toBe('Foo');
      expect(symbols[0].visibility).toBe('public');
    });

    it('should extract an interface', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('interface_declaration', 'public interface IFoo { }', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'IFoo'),
          mockNode('declaration_list', '{ }', []),
        ], 0, 3),
      ]);

      const symbols = extractor.extractSymbols(root, 'IFoo.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('interface');
      expect(symbols[0].name).toBe('IFoo');
    });

    it('should extract enum', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('enum_declaration', 'public enum Color { }', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'Color'),
        ], 0, 3),
      ]);

      const symbols = extractor.extractSymbols(root, 'Color.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('enum');
      expect(symbols[0].name).toBe('Color');
    });

    it('should extract class with methods and properties', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('class_declaration', 'public class MyService { }', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'MyService'),
          mockNode('declaration_list', '{ }', [
            mockNode('method_declaration', 'public async Task DoWork() { }', [
              mockNode('modifier', 'public'),
              mockNode('modifier', 'async'),
              mockNode('generic_name', 'Task'),
              mockNode('identifier', 'DoWork'),
              mockNode('parameter_list', '()', []),
            ], 2, 4),
            mockNode('property_declaration', 'public string Name { get; set; }', [
              mockNode('modifier', 'public'),
              mockNode('predefined_type', 'string'),
              mockNode('identifier', 'Name'),
            ], 5, 5),
          ]),
        ], 0, 10),
      ]);

      const symbols = extractor.extractSymbols(root, 'MyService.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('MyService');
      expect(symbols[0].children).toHaveLength(2);

      const method = symbols[0].children![0];
      expect(method.type).toBe('method');
      expect(method.name).toBe('DoWork');
      expect(method.visibility).toBe('public');
      expect(method.isAsync).toBe(true);

      const prop = symbols[0].children![1];
      expect(prop.type).toBe('property');
      expect(prop.name).toBe('Name');
      expect(prop.returnType).toBe('string');
    });

    it('should extract static methods', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('class_declaration', 'class Utils { }', [
          mockNode('identifier', 'Utils'),
          mockNode('declaration_list', '{ }', [
            mockNode('method_declaration', 'public static int Add(int a, int b) { }', [
              mockNode('modifier', 'public'),
              mockNode('modifier', 'static'),
              mockNode('predefined_type', 'int'),
              mockNode('identifier', 'Add'),
              mockNode('parameter_list', '(int a, int b)', [
                mockNode('parameter', 'int a', [
                  mockNode('predefined_type', 'int'),
                  mockNode('identifier', 'a'),
                ]),
                mockNode('parameter', 'int b', [
                  mockNode('predefined_type', 'int'),
                  mockNode('identifier', 'b'),
                ]),
              ]),
            ], 1, 3),
          ]),
        ], 0, 5),
      ]);

      const symbols = extractor.extractSymbols(root, 'Utils.cs');
      const method = symbols[0].children![0];
      expect(method.isStatic).toBe(true);
      expect(method.parameters).toHaveLength(2);
      expect(method.parameters![0].name).toBe('a');
      expect(method.parameters![0].type).toBe('int');
    });

    it('should handle namespaces', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('namespace_declaration', 'namespace MyApp { }', [
          mockNode('identifier', 'MyApp'),
          mockNode('declaration_list', '{ }', [
            mockNode('class_declaration', 'class Foo { }', [
              mockNode('identifier', 'Foo'),
              mockNode('declaration_list', '{ }', []),
            ], 2, 5),
          ]),
        ]),
      ]);

      const symbols = extractor.extractSymbols(root, 'Foo.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('Foo');
      expect(symbols[0].qualifiedName).toBe('Foo.cs::MyApp::Foo');
    });

    it('should extract struct', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('struct_declaration', 'public struct Point { }', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'Point'),
          mockNode('declaration_list', '{ }', []),
        ], 0, 3),
      ]);

      const symbols = extractor.extractSymbols(root, 'Point.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('class');
      expect(symbols[0].name).toBe('Point');
    });

    it('should extract record', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('record_declaration', 'public record Person(string Name, int Age);', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'Person'),
          mockNode('declaration_list', '{ }', []),
        ], 0, 1),
      ]);

      const symbols = extractor.extractSymbols(root, 'Person.cs');
      expect(symbols).toHaveLength(1);
      expect(symbols[0].type).toBe('class');
      expect(symbols[0].name).toBe('Person');
    });
  });

  describe('extractExports', () => {
    it('should collect public top-level types', () => {
      const root = mockNode('compilation_unit', '', [
        mockNode('class_declaration', 'public class Foo { }', [
          mockNode('modifier', 'public'),
          mockNode('identifier', 'Foo'),
          mockNode('declaration_list', '{ }', []),
        ]),
        mockNode('class_declaration', 'internal class Bar { }', [
          mockNode('modifier', 'internal'),
          mockNode('identifier', 'Bar'),
          mockNode('declaration_list', '{ }', []),
        ]),
      ]);

      const exports = extractor.extractExports(root);
      expect(exports).toEqual(['Foo']);
    });
  });
});
