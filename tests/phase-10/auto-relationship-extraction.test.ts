import {
  TypeScriptRelationshipExtractor,
  JavaScriptRelationshipExtractor,
  PythonRelationshipExtractor,
  RelationshipExtractorRegistry,
  ExtractedRelationship,
  ParseResultLike
} from '../../src/ast/relationships';

describe('F10.5 - Auto Relationship Extraction', () => {
  describe('TypeScriptRelationshipExtractor', () => {
    let extractor: TypeScriptRelationshipExtractor;

    beforeEach(() => {
      extractor = new TypeScriptRelationshipExtractor();
    });

    function createParseResult(overrides: Partial<ParseResultLike> = {}): ParseResultLike {
      return {
        filePath: 'test.ts',
        language: 'typescript',
        symbols: [],
        imports: [],
        exports: [],
        ...overrides
      };
    }

    describe('Import Extraction', () => {
      it('should extract import relationships from named imports', () => {
        const parseResult = createParseResult({
          imports: [
            { source: './user', specifiers: [{ name: 'User' }, { name: 'UserRole' }], startLine: 1 }
          ]
        });

        const relationships = extractor.extract(parseResult);

        // Should have file-level import
        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts',
            target: './user',
            type: 'imports',
            weight: 1.0
          })
        );

        // Should have references for named imports
        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts',
            target: 'User',
            type: 'references'
          })
        );
        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts',
            target: 'UserRole',
            type: 'references'
          })
        );
      });

      it('should extract multiple import statements', () => {
        const parseResult = createParseResult({
          imports: [
            { source: './user', specifiers: [{ name: 'User' }], startLine: 1 },
            { source: './utils', specifiers: [{ name: 'formatDate' }], startLine: 2 },
            { source: 'lodash', specifiers: [{ name: 'debounce' }], startLine: 3 }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const imports = relationships.filter(r => r.type === 'imports');
        expect(imports.length).toBe(3);
        expect(imports.map(i => i.target)).toEqual(['./user', './utils', 'lodash']);
      });

      it('should not create references for wildcard imports', () => {
        const parseResult = createParseResult({
          imports: [
            { source: './types', specifiers: [{ name: '*', alias: 'Types' }], startLine: 1 }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const refs = relationships.filter(r => r.type === 'references');
        expect(refs.length).toBe(0);
      });
    });

    describe('Class Containment Extraction', () => {
      it('should extract contains relationships for class methods', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'class',
              name: 'UserService',
              qualifiedName: 'test.ts::UserService',
              startLine: 1,
              endLine: 20,
              children: [
                { type: 'method', name: 'getUser', qualifiedName: 'test.ts::UserService.getUser', startLine: 3, endLine: 8 },
                { type: 'method', name: 'saveUser', qualifiedName: 'test.ts::UserService.saveUser', startLine: 10, endLine: 15 }
              ]
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const contains = relationships.filter(r => r.type === 'contains');
        expect(contains.length).toBe(2);
        expect(contains).toContainEqual(
          expect.objectContaining({
            source: 'test.ts::UserService',
            target: 'test.ts::UserService.getUser',
            type: 'contains'
          })
        );
      });

      it('should extract contains for properties', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'class',
              name: 'Config',
              qualifiedName: 'test.ts::Config',
              startLine: 1,
              endLine: 10,
              children: [
                { type: 'property', name: 'apiUrl', qualifiedName: 'test.ts::Config.apiUrl', startLine: 2, endLine: 2 }
              ]
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts::Config',
            target: 'test.ts::Config.apiUrl',
            type: 'contains',
            targetType: 'property'
          })
        );
      });
    });

    describe('Type Reference Extraction', () => {
      it('should extract uses_type for parameter types', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'processUser',
              qualifiedName: 'test.ts::processUser',
              parameters: [
                { name: 'user', type: 'User' },
                { name: 'options', type: 'ProcessOptions' }
              ],
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const typeRefs = relationships.filter(r => r.type === 'uses_type');
        expect(typeRefs.length).toBe(2);
        expect(typeRefs).toContainEqual(
          expect.objectContaining({
            source: 'test.ts::processUser',
            target: 'User',
            type: 'uses_type'
          })
        );
      });

      it('should extract uses_type for return types', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'getUser',
              qualifiedName: 'test.ts::getUser',
              returnType: 'User',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts::getUser',
            target: 'User',
            type: 'uses_type'
          })
        );
      });

      it('should not extract uses_type for primitive types', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'count',
              qualifiedName: 'test.ts::count',
              parameters: [
                { name: 'n', type: 'number' },
                { name: 's', type: 'string' }
              ],
              returnType: 'boolean',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const typeRefs = relationships.filter(r => r.type === 'uses_type');
        expect(typeRefs.length).toBe(0);
      });

      it('should normalize generic types', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'getUsers',
              qualifiedName: 'test.ts::getUsers',
              returnType: 'Promise<User[]>',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts::getUsers',
            target: 'Promise',
            type: 'uses_type'
          })
        );
      });

      it('should handle union types by taking first type', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'getResult',
              qualifiedName: 'test.ts::getResult',
              returnType: 'User | null',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            target: 'User',
            type: 'uses_type'
          })
        );
      });
    });

    describe('Nested Symbol Processing', () => {
      it('should process nested class methods', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'class',
              name: 'Outer',
              qualifiedName: 'test.ts::Outer',
              startLine: 1,
              endLine: 30,
              children: [
                {
                  type: 'method',
                  name: 'process',
                  qualifiedName: 'test.ts::Outer.process',
                  parameters: [{ name: 'data', type: 'DataType' }],
                  returnType: 'Result',
                  startLine: 5,
                  endLine: 15
                }
              ]
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        // Should have contains relationship
        expect(relationships).toContainEqual(
          expect.objectContaining({
            source: 'test.ts::Outer',
            target: 'test.ts::Outer.process',
            type: 'contains'
          })
        );

        // Should have type references from nested method
        const typeRefs = relationships.filter(r => r.type === 'uses_type');
        expect(typeRefs.length).toBe(2);
      });
    });
  });

  describe('JavaScriptRelationshipExtractor', () => {
    let extractor: JavaScriptRelationshipExtractor;

    beforeEach(() => {
      extractor = new JavaScriptRelationshipExtractor();
    });

    it('should extract imports like TypeScript', () => {
      const parseResult: ParseResultLike = {
        filePath: 'test.js',
        language: 'javascript',
        symbols: [],
        imports: [
          { source: './user', specifiers: [{ name: 'User' }], startLine: 1 }
        ],
        exports: []
      };

      const relationships = extractor.extract(parseResult);

      expect(relationships).toContainEqual(
        expect.objectContaining({
          target: './user',
          type: 'imports'
        })
      );
    });

    it('should not extract type references (no types in JS)', () => {
      const parseResult: ParseResultLike = {
        filePath: 'test.js',
        language: 'javascript',
        symbols: [
          {
            type: 'function',
            name: 'process',
            qualifiedName: 'test.js::process',
            parameters: [{ name: 'user', type: 'User' }], // JSDoc types should be ignored
            startLine: 1,
            endLine: 5
          }
        ],
        imports: [],
        exports: []
      };

      const relationships = extractor.extract(parseResult);

      const typeRefs = relationships.filter(r => r.type === 'uses_type');
      expect(typeRefs.length).toBe(0);
    });

    it('should extract class containment', () => {
      const parseResult: ParseResultLike = {
        filePath: 'test.js',
        language: 'javascript',
        symbols: [
          {
            type: 'class',
            name: 'Handler',
            qualifiedName: 'test.js::Handler',
            startLine: 1,
            endLine: 10,
            children: [
              { type: 'method', name: 'handle', qualifiedName: 'test.js::Handler.handle', startLine: 3, endLine: 8 }
            ]
          }
        ],
        imports: [],
        exports: []
      };

      const relationships = extractor.extract(parseResult);

      expect(relationships).toContainEqual(
        expect.objectContaining({
          source: 'test.js::Handler',
          target: 'test.js::Handler.handle',
          type: 'contains'
        })
      );
    });
  });

  describe('PythonRelationshipExtractor', () => {
    let extractor: PythonRelationshipExtractor;

    beforeEach(() => {
      extractor = new PythonRelationshipExtractor();
    });

    function createParseResult(overrides: Partial<ParseResultLike> = {}): ParseResultLike {
      return {
        filePath: 'test.py',
        language: 'python',
        symbols: [],
        imports: [],
        exports: [],
        ...overrides
      };
    }

    describe('Import Extraction', () => {
      it('should extract module imports', () => {
        const parseResult = createParseResult({
          imports: [
            { source: 'os', specifiers: [{ name: 'os' }], startLine: 1 },
            { source: 'typing', specifiers: [{ name: 'List' }, { name: 'Dict' }], startLine: 2 }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const imports = relationships.filter(r => r.type === 'imports');
        expect(imports.length).toBe(2);
        expect(imports[0].targetType).toBe('module');
      });

      it('should extract references from from...import', () => {
        const parseResult = createParseResult({
          imports: [
            { source: 'models', specifiers: [{ name: 'User' }, { name: 'Post' }], startLine: 1 }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const refs = relationships.filter(r => r.type === 'references');
        expect(refs.map(r => r.target)).toEqual(['User', 'Post']);
      });
    });

    describe('Class Containment', () => {
      it('should extract method containment', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'class',
              name: 'UserService',
              qualifiedName: 'test.py::UserService',
              startLine: 1,
              endLine: 20,
              children: [
                { type: 'method', name: '__init__', qualifiedName: 'test.py::UserService.__init__', startLine: 2, endLine: 5 },
                { type: 'method', name: 'get_user', qualifiedName: 'test.py::UserService.get_user', startLine: 7, endLine: 12 }
              ]
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const contains = relationships.filter(r => r.type === 'contains');
        expect(contains.length).toBe(2);
      });
    });

    describe('Type Hint Extraction', () => {
      it('should extract type hints from parameters', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'process_user',
              qualifiedName: 'test.py::process_user',
              parameters: [
                { name: 'user', type: 'User' },
                { name: 'role', type: 'Role' }
              ],
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const typeRefs = relationships.filter(r => r.type === 'uses_type');
        expect(typeRefs.length).toBe(2);
        expect(typeRefs.map(r => r.target)).toEqual(['User', 'Role']);
      });

      it('should extract return type hints', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'get_user',
              qualifiedName: 'test.py::get_user',
              returnType: 'User',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            target: 'User',
            type: 'uses_type'
          })
        );
      });

      it('should not extract primitive type hints', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'count',
              qualifiedName: 'test.py::count',
              parameters: [
                { name: 'n', type: 'int' },
                { name: 's', type: 'str' }
              ],
              returnType: 'bool',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        const typeRefs = relationships.filter(r => r.type === 'uses_type');
        expect(typeRefs.length).toBe(0);
      });

      it('should handle Optional type', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'find_user',
              qualifiedName: 'test.py::find_user',
              returnType: 'Optional[User]',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            target: 'User',
            type: 'uses_type'
          })
        );
      });

      it('should handle List and Dict types', () => {
        const parseResult = createParseResult({
          symbols: [
            {
              type: 'function',
              name: 'get_users',
              qualifiedName: 'test.py::get_users',
              returnType: 'List[User]',
              startLine: 1,
              endLine: 5
            }
          ]
        });

        const relationships = extractor.extract(parseResult);

        expect(relationships).toContainEqual(
          expect.objectContaining({
            target: 'User',
            type: 'uses_type'
          })
        );
      });
    });
  });

  describe('RelationshipExtractorRegistry', () => {
    let registry: RelationshipExtractorRegistry;

    beforeEach(() => {
      registry = new RelationshipExtractorRegistry();
    });

    describe('Language Detection', () => {
      it('should return TypeScript extractor for .ts files', () => {
        const extractor = registry.getExtractor('.ts');
        expect(extractor).toBeInstanceOf(TypeScriptRelationshipExtractor);
      });

      it('should return TypeScript extractor for .tsx files', () => {
        const extractor = registry.getExtractor('.tsx');
        expect(extractor).toBeInstanceOf(TypeScriptRelationshipExtractor);
      });

      it('should return JavaScript extractor for .js files', () => {
        const extractor = registry.getExtractor('.js');
        expect(extractor).toBeInstanceOf(JavaScriptRelationshipExtractor);
      });

      it('should return JavaScript extractor for .jsx files', () => {
        const extractor = registry.getExtractor('.jsx');
        expect(extractor).toBeInstanceOf(JavaScriptRelationshipExtractor);
      });

      it('should return Python extractor for .py files', () => {
        const extractor = registry.getExtractor('.py');
        expect(extractor).toBeInstanceOf(PythonRelationshipExtractor);
      });

      it('should return null for unsupported languages', () => {
        expect(registry.getExtractor('.java')).toBeNull();
        expect(registry.getExtractor('.go')).toBeNull();
        expect(registry.getExtractor('.rs')).toBeNull();
      });
    });

    describe('File Path Detection', () => {
      it('should get extractor from file path', () => {
        expect(registry.getExtractorForFile('src/index.ts')).toBeInstanceOf(TypeScriptRelationshipExtractor);
        expect(registry.getExtractorForFile('app/main.py')).toBeInstanceOf(PythonRelationshipExtractor);
        expect(registry.getExtractorForFile('lib/utils.js')).toBeInstanceOf(JavaScriptRelationshipExtractor);
      });

      it('should handle paths with multiple dots', () => {
        expect(registry.getExtractorForFile('test.spec.ts')).toBeInstanceOf(TypeScriptRelationshipExtractor);
        expect(registry.getExtractorForFile('file.test.py')).toBeInstanceOf(PythonRelationshipExtractor);
      });
    });

    describe('Language Support', () => {
      it('should support TypeScript', () => {
        expect(registry.supportsLanguage('typescript')).toBe(true);
        expect(registry.supportsLanguage('.ts')).toBe(true);
      });

      it('should support JavaScript', () => {
        expect(registry.supportsLanguage('javascript')).toBe(true);
        expect(registry.supportsLanguage('.js')).toBe(true);
        expect(registry.supportsLanguage('.mjs')).toBe(true);
        expect(registry.supportsLanguage('.cjs')).toBe(true);
      });

      it('should support Python', () => {
        expect(registry.supportsLanguage('python')).toBe(true);
        expect(registry.supportsLanguage('.py')).toBe(true);
      });

      it('should list supported languages', () => {
        const languages = registry.getSupportedLanguages();
        expect(languages).toContain('typescript');
        expect(languages).toContain('javascript');
        expect(languages).toContain('python');
      });

      it('should list supported extensions', () => {
        const extensions = registry.getSupportedExtensions();
        expect(extensions).toContain('.ts');
        expect(extensions).toContain('.tsx');
        expect(extensions).toContain('.js');
        expect(extensions).toContain('.jsx');
        expect(extensions).toContain('.py');
      });
    });

    describe('Case Insensitivity', () => {
      it('should handle uppercase extensions', () => {
        expect(registry.getExtractor('.TS')).toBeInstanceOf(TypeScriptRelationshipExtractor);
        expect(registry.getExtractor('.PY')).toBeInstanceOf(PythonRelationshipExtractor);
      });

      it('should handle mixed case language names', () => {
        expect(registry.getExtractor('TypeScript')).toBeInstanceOf(TypeScriptRelationshipExtractor);
        expect(registry.getExtractor('PYTHON')).toBeInstanceOf(PythonRelationshipExtractor);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should extract all relationship types from a complex file', () => {
      const registry = new RelationshipExtractorRegistry();
      const extractor = registry.getExtractor('typescript')!;

      const parseResult: ParseResultLike = {
        filePath: 'src/services/user-service.ts',
        language: 'typescript',
        imports: [
          { source: '../models/user', specifiers: [{ name: 'User' }], startLine: 1 },
          { source: '../repositories/user-repo', specifiers: [{ name: 'UserRepository' }], startLine: 2 }
        ],
        exports: ['UserService'],
        symbols: [
          {
            type: 'class',
            name: 'UserService',
            qualifiedName: 'src/services/user-service.ts::UserService',
            startLine: 5,
            endLine: 30,
            children: [
              {
                type: 'property',
                name: 'repo',
                qualifiedName: 'src/services/user-service.ts::UserService.repo',
                startLine: 6,
                endLine: 6
              },
              {
                type: 'method',
                name: 'getById',
                qualifiedName: 'src/services/user-service.ts::UserService.getById',
                parameters: [{ name: 'id', type: 'string' }],
                returnType: 'Promise<User>',
                startLine: 8,
                endLine: 15
              },
              {
                type: 'method',
                name: 'save',
                qualifiedName: 'src/services/user-service.ts::UserService.save',
                parameters: [{ name: 'user', type: 'User' }],
                returnType: 'void',
                startLine: 17,
                endLine: 25
              }
            ]
          }
        ]
      };

      const relationships = extractor.extract(parseResult);

      // Check we got all relationship types
      const types = new Set(relationships.map(r => r.type));
      expect(types.has('imports')).toBe(true);
      expect(types.has('references')).toBe(true);
      expect(types.has('contains')).toBe(true);
      expect(types.has('uses_type')).toBe(true);

      // Check counts
      expect(relationships.filter(r => r.type === 'imports').length).toBe(2);
      expect(relationships.filter(r => r.type === 'references').length).toBe(2);
      expect(relationships.filter(r => r.type === 'contains').length).toBe(3);
      expect(relationships.filter(r => r.type === 'uses_type').length).toBeGreaterThan(0);
    });

    it('should handle empty parse results', () => {
      const registry = new RelationshipExtractorRegistry();
      const extractor = registry.getExtractor('typescript')!;

      const parseResult: ParseResultLike = {
        filePath: 'empty.ts',
        language: 'typescript',
        imports: [],
        exports: [],
        symbols: []
      };

      const relationships = extractor.extract(parseResult);
      expect(relationships).toEqual([]);
    });
  });
});
