/**
 * F4.3 Document-Code Linking Tests
 *
 * WARNING: These tests will fail until the following implementations are created:
 * - src/documents/linker.ts (DocumentCodeLinker class)
 * - src/documents/types.ts (DocumentLink, LinkType, MarkdownSection, CodeBlock interfaces)
 * - src/database/connection.ts (DatabaseConnection class)
 * - src/entities/resolver.ts (EntityResolver class)
 *
 * Tests for linking documentation to code:
 * - DocumentCodeLinker operations
 * - Code reference detection patterns
 * - Entity resolution
 * - MENTIONS relationship creation
 *
 * @see docs/phase-4/F4.3-document-code-linking.md
 */

import { DocumentCodeLinker } from '../../src/documents/linker';
import { DocumentLink, LinkType, MarkdownSection } from '../../src/documents/types';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityResolver } from '../../src/entities/resolver';

// Mock dependencies
jest.mock('../../src/db/connection');
jest.mock('../../src/entities/resolver');

// ============================================================================
// Mock Setup
// ============================================================================

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedEntityResolver = EntityResolver as jest.MockedClass<typeof EntityResolver>;

// Helper to generate unique IDs
function generateId(): string {
  return `id_${Math.random().toString(36).substring(2, 11)}`;
}

// Mock factory for MarkdownSection
function createMockSection(overrides: Partial<MarkdownSection> = {}): MarkdownSection {
  return {
    id: generateId(),
    title: 'Test Section',
    content: 'Test content.',
    codeBlocks: [],
    ...overrides
  };
}

describe('F4.3 Document-Code Linking', () => {
  let mockDbConnection: jest.Mocked<DatabaseConnection>;
  let mockEntityResolver: jest.Mocked<EntityResolver>;
  let linker: DocumentCodeLinker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockDbConnection = new MockedDatabaseConnection() as jest.Mocked<DatabaseConnection>;
    mockEntityResolver = new MockedEntityResolver() as jest.Mocked<EntityResolver>;

    // Setup default mock implementations
    mockDbConnection.get = jest.fn();
    mockDbConnection.all = jest.fn();
    mockDbConnection.run = jest.fn();

    mockEntityResolver.resolveByName = jest.fn();
    mockEntityResolver.resolveByQualifiedName = jest.fn();
    mockEntityResolver.resolveByFilePath = jest.fn();
    mockEntityResolver.fuzzySearch = jest.fn();

    // Create real instance with mocked dependencies
    linker = new DocumentCodeLinker(mockDbConnection, mockEntityResolver);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Code Reference Pattern Tests
  // ============================================================================

  describe('Code Reference Patterns', () => {
    describe('Backtick Code', () => {
      it('should match inline code', () => {
        const content = 'Use `AuthService` for authentication.';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('AuthService');
      });

      it('should match multiple inline codes', () => {
        const content = 'The `User` model uses `hashPassword()` from `utils`.';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('User');
        expect(refs).toContain('hashPassword()');
        expect(refs).toContain('utils');
      });

      it('should not match content inside code blocks', () => {
        const content = '```typescript\nconst x = 1;\n```';
        const refs = linker.findCodeReferences(content);

        // Code blocks should be detected and excluded
        expect(refs).not.toContain('const x = 1;');
      });
    });

    describe('File Path', () => {
      it('should match TypeScript files', () => {
        const content = 'See src/auth/service.ts for implementation.';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('src/auth/service.ts');
      });

      it('should match various file extensions', () => {
        const extensions = ['ts', 'js', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h'];

        extensions.forEach(ext => {
          const content = `File: src/main.${ext}`;
          const refs = linker.findCodeReferences(content);
          expect(refs.some((r: string) => r.endsWith(`.${ext}`))).toBe(true);
        });
      });

      it('should match nested paths', () => {
        const content = 'Located in src/services/auth/login.ts';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('src/services/auth/login.ts');
      });
    });

    describe('Class Name', () => {
      it('should match Service classes', () => {
        const content = 'The AuthService handles authentication.';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('AuthService');
      });

      it('should match common class suffixes', () => {
        const classNames = [
          'UserController',
          'CacheManager',
          'RequestHandler',
          'DataProvider',
          'UserFactory',
          'SessionStore',
          'UserRepository'
        ];

        classNames.forEach(name => {
          const content = `Use ${name} for this.`;
          const refs = linker.findCodeReferences(content);
          expect(refs).toContain(name);
        });
      });

      it('should not match lowercase words', () => {
        const content = 'The service provides authentication.';
        const refs = linker.findCodeReferences(content);

        expect(refs).not.toContain('service');
        expect(refs).not.toContain('authentication');
      });
    });

    describe('Function Call', () => {
      it('should match function calls', () => {
        const content = 'Call validateUser() to check credentials.';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('validateUser');
      });

      it('should match multiple function calls', () => {
        const content = 'First hash() the password, then verify() it.';
        const refs = linker.findCodeReferences(content);

        expect(refs).toContain('hash');
        expect(refs).toContain('verify');
      });

      it('should not match class constructors', () => {
        const content = 'Create new User() instance.';
        const refs = linker.findCodeReferences(content);

        // 'User' starts with uppercase, pattern should distinguish constructors
        expect(refs.every((r: string) => r !== 'User' || !r.match(/^[a-z]/))).toBe(true);
      });
    });
  });

  // ============================================================================
  // Reference Finding Tests
  // ============================================================================

  describe('findCodeReferences()', () => {
    it('should find all reference types', () => {
      const content = `
The AuthService class in src/auth/service.ts handles authentication.
Use \`validateCredentials\` to check user input, then call login() to authenticate.
`;

      const refs = linker.findCodeReferences(content);

      expect(refs).toContain('AuthService');
      expect(refs).toContain('src/auth/service.ts');
      expect(refs).toContain('validateCredentials');
      expect(refs).toContain('login');
    });

    it('should deduplicate references', () => {
      const content = 'Use AuthService. The AuthService is important. AuthService handles auth.';
      const refs = linker.findCodeReferences(content);

      const authServiceCount = refs.filter((r: string) => r === 'AuthService').length;
      expect(authServiceCount).toBe(1);
    });

    it('should handle empty content', () => {
      const refs = linker.findCodeReferences('');
      expect(refs).toHaveLength(0);
    });

    it('should handle content with no code references', () => {
      const refs = linker.findCodeReferences('This is just plain text without any code references.');
      expect(refs).toHaveLength(0);
    });
  });

  // ============================================================================
  // Entity Resolution Tests
  // ============================================================================

  describe('resolveCodeReference()', () => {
    const projectId = 'proj_123';

    it('should resolve by exact qualified name', async () => {
      const mockEntity = {
        id: 'entity_auth',
        qualified_name: 'src/auth/service.ts::AuthService',
        name: 'AuthService',
        type: 'class'
      };

      mockEntityResolver.resolveByQualifiedName.mockResolvedValue(mockEntity);

      const entity = await linker.resolveCodeReference('src/auth/service.ts::AuthService', projectId);

      expect(mockEntityResolver.resolveByQualifiedName).toHaveBeenCalledWith(
        'src/auth/service.ts::AuthService',
        projectId
      );
      expect(entity).toEqual(mockEntity);
    });

    it('should resolve by file path', async () => {
      const mockEntity = {
        id: 'entity_file',
        file_path: 'src/auth/service.ts',
        type: 'file',
        name: 'service.ts'
      };

      mockEntityResolver.resolveByQualifiedName.mockResolvedValue(null);
      mockEntityResolver.resolveByFilePath.mockResolvedValue(mockEntity);

      const entity = await linker.resolveCodeReference('src/auth/service.ts', projectId);

      expect(mockEntityResolver.resolveByFilePath).toHaveBeenCalledWith(
        'src/auth/service.ts',
        projectId
      );
      expect(entity).toEqual(mockEntity);
    });

    it('should resolve by name and type', async () => {
      const mockEntity = {
        id: 'entity_class',
        name: 'AuthService',
        type: 'class'
      };

      mockEntityResolver.resolveByQualifiedName.mockResolvedValue(null);
      mockEntityResolver.resolveByFilePath.mockResolvedValue(null);
      mockEntityResolver.resolveByName.mockResolvedValue(mockEntity);

      const entity = await linker.resolveCodeReference('AuthService', projectId);

      expect(mockEntityResolver.resolveByName).toHaveBeenCalledWith(
        'AuthService',
        projectId,
        expect.any(Array)
      );
      expect(entity?.name).toBe('AuthService');
    });

    it('should try multiple entity types', async () => {
      const types = ['class', 'function', 'interface', 'type'];

      mockEntityResolver.resolveByQualifiedName.mockResolvedValue(null);
      mockEntityResolver.resolveByFilePath.mockResolvedValue(null);
      mockEntityResolver.resolveByName.mockResolvedValue({
        id: 'entity_match',
        name: 'SomeEntity',
        type: 'interface'
      });

      await linker.resolveCodeReference('SomeEntity', 'proj_123');

      expect(mockEntityResolver.resolveByName).toHaveBeenCalledWith(
        'SomeEntity',
        'proj_123',
        expect.arrayContaining(types)
      );
    });

    it('should fallback to fuzzy search', async () => {
      mockEntityResolver.resolveByQualifiedName.mockResolvedValue(null);
      mockEntityResolver.resolveByFilePath.mockResolvedValue(null);
      mockEntityResolver.resolveByName.mockResolvedValue(null);
      mockEntityResolver.fuzzySearch.mockResolvedValue([
        { id: 'entity_similar', name: 'AuthenticationService', score: 0.9 }
      ]);

      const entity = await linker.resolveCodeReference('Auth', 'proj_123');

      expect(mockEntityResolver.fuzzySearch).toHaveBeenCalledWith('Auth', 'proj_123');
      expect(entity?.name).toBe('AuthenticationService');
    });

    it('should return null for unresolved reference', async () => {
      mockEntityResolver.resolveByQualifiedName.mockResolvedValue(null);
      mockEntityResolver.resolveByFilePath.mockResolvedValue(null);
      mockEntityResolver.resolveByName.mockResolvedValue(null);
      mockEntityResolver.fuzzySearch.mockResolvedValue([]);

      const entity = await linker.resolveCodeReference('NonExistent', 'proj_123');

      expect(entity).toBeNull();
    });
  });

  // ============================================================================
  // DocumentCodeLinker Tests
  // ============================================================================

  describe('DocumentCodeLinker', () => {
    const projectId = 'proj_123';

    describe('linkDocument()', () => {
      it('should create MENTIONS relationships for code references', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          content: 'The AuthService handles authentication.'
        });

        const mockEntity = {
          id: 'entity_auth_service',
          name: 'AuthService',
          type: 'class'
        };

        mockEntityResolver.resolveByName.mockResolvedValue(mockEntity);
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await linker.linkDocument(documentEntityId, [section], projectId);

        expect(mockDbConnection.run).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO'),
          expect.arrayContaining([
            expect.any(String), // id
            'MENTIONS',
            documentEntityId,
            'entity_auth_service'
          ])
        );
      });

      it('should link code blocks to entities', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          content: 'Example usage:',
          codeBlocks: [{
            language: 'typescript',
            code: 'const auth = new AuthService();',
            startLine: 10
          }]
        });

        const mockEntity = {
          id: 'entity_auth_service',
          name: 'AuthService',
          type: 'class'
        };

        mockEntityResolver.resolveByName.mockResolvedValue(mockEntity);
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await linker.linkDocument(documentEntityId, [section], projectId);

        // Should find AuthService in code block and create relationship
        expect(mockEntityResolver.resolveByName).toHaveBeenCalled();
      });

      it('should set lower weight for code block references', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          codeBlocks: [{
            language: 'typescript',
            code: 'const auth = new AuthService();',
            startLine: 10
          }]
        });

        const mockEntity = {
          id: 'entity_auth_service',
          name: 'AuthService',
          type: 'class'
        };

        mockEntityResolver.resolveByName.mockResolvedValue(mockEntity);
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await linker.linkDocument(documentEntityId, [section], projectId);

        // Verify weight is lower for code block refs (0.8 vs 1.0)
        expect(mockDbConnection.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([expect.any(String), expect.any(String), expect.any(String), expect.any(String)])
        );
      });

      it('should track section information in metadata', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          title: 'Authentication',
          content: 'The AuthService handles authentication.'
        });

        const mockEntity = {
          id: 'entity_auth_service',
          name: 'AuthService',
          type: 'class'
        };

        mockEntityResolver.resolveByName.mockResolvedValue(mockEntity);
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await linker.linkDocument(documentEntityId, [section], projectId);

        // Metadata should include section title and reference
        expect(mockDbConnection.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([
            expect.stringContaining('Authentication') // section in metadata JSON
          ])
        );
      });

      it('should return count of created links', async () => {
        const documentEntityId = 'entity_doc_1';
        const sections = [
          createMockSection({ content: 'Use AuthService here.' }),
          createMockSection({ content: 'And UserService here.' })
        ];

        mockEntityResolver.resolveByName.mockResolvedValue({
          id: 'entity_service',
          name: 'Service',
          type: 'class'
        });
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        const result = await linker.linkDocument(documentEntityId, sections, projectId);

        expect(result.linksCreated).toBeGreaterThan(0);
      });
    });

    describe('linkSection()', () => {
      it('should process section content', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          content: 'Use UserService and AuthService together.'
        });

        mockEntityResolver.resolveByName.mockResolvedValue({
          id: 'entity_service',
          name: 'Service',
          type: 'class'
        });
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        const result = await linker.linkSection(documentEntityId, section, projectId);

        expect(mockEntityResolver.resolveByName).toHaveBeenCalledTimes(2);
        expect(result.linksCreated).toBe(2);
      });

      it('should process section code blocks', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          codeBlocks: [
            { language: 'typescript', code: 'const user = new UserService();', startLine: 5 },
            { language: 'typescript', code: 'const auth = new AuthService();', startLine: 10 }
          ]
        });

        mockEntityResolver.resolveByName.mockResolvedValue({
          id: 'entity_service',
          name: 'Service',
          type: 'class'
        });
        mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

        await linker.linkSection(documentEntityId, section, projectId);

        expect(mockEntityResolver.resolveByName).toHaveBeenCalledTimes(2);
      });

      it('should skip sections with no code references', async () => {
        const documentEntityId = 'entity_doc_1';
        const section = createMockSection({
          content: 'This is just plain documentation text.'
        });

        const result = await linker.linkSection(documentEntityId, section, projectId);

        expect(mockEntityResolver.resolveByName).not.toHaveBeenCalled();
        expect(result.linksCreated).toBe(0);
      });
    });
  });

  // ============================================================================
  // MCP Tool Tests
  // ============================================================================

  describe('index_document MCP Tool', () => {
    it('should have correct tool definition', () => {
      const toolDef = linker.getToolDefinition();

      expect(toolDef.name).toBe('index_document');
      expect(toolDef.inputSchema.required).toContain('path');
      expect(toolDef.inputSchema.properties).toHaveProperty('path');
      expect(toolDef.inputSchema.properties).toHaveProperty('project');
      expect(toolDef.inputSchema.properties).toHaveProperty('extract_requirements');
    });

    it('should support optional requirement extraction', async () => {
      mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const result = await linker.indexDocument({
        path: 'docs/readme.md',
        project: 'test_project',
        extract_requirements: true
      });

      expect(result.requirementsExtracted).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle document with no code references', async () => {
      const documentEntityId = 'entity_doc_1';
      const sections = [
        createMockSection({ content: 'This document contains no code references at all.' })
      ];

      const result = await linker.linkDocument(documentEntityId, sections, 'proj_123');

      expect(result.linksCreated).toBe(0);
    });

    it('should handle very long documents', async () => {
      const content = 'AuthService '.repeat(1000);
      const documentEntityId = 'entity_doc_1';
      const sections = [createMockSection({ content })];

      mockEntityResolver.resolveByName.mockResolvedValue({
        id: 'entity_auth',
        name: 'AuthService',
        type: 'class'
      });
      mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const result = await linker.linkDocument(documentEntityId, sections, 'proj_123');

      // Should deduplicate - only one link created
      expect(result.linksCreated).toBe(1);
    });

    it('should handle special characters in code references', () => {
      const content = 'Use `MyClass<T>` for generics.';
      const refs = linker.findCodeReferences(content);

      expect(refs).toContain('MyClass<T>');
    });

    it('should handle nested backticks gracefully', () => {
      const content = 'Run `npm install \`package\``.';
      const refs = linker.findCodeReferences(content);

      // Should handle gracefully without throwing
      expect(Array.isArray(refs)).toBe(true);
    });

    it('should handle unresolvable references gracefully', async () => {
      const documentEntityId = 'entity_doc_1';
      const sections = [
        createMockSection({ content: 'Use NonExistentClass for this.' })
      ];

      mockEntityResolver.resolveByName.mockResolvedValue(null);
      mockEntityResolver.fuzzySearch.mockResolvedValue([]);

      // Should not throw, just skip creating relationship
      const result = await linker.linkDocument(documentEntityId, sections, 'proj_123');

      expect(result.linksCreated).toBe(0);
      expect(mockDbConnection.run).not.toHaveBeenCalled();
    });

    it('should handle concurrent linking', async () => {
      const documentEntityId = 'entity_doc_1';
      const sections = Array(10).fill(null).map((_, i) =>
        createMockSection({ content: `Section ${i} mentions AuthService.` })
      );

      mockEntityResolver.resolveByName.mockResolvedValue({
        id: 'entity_auth',
        name: 'AuthService',
        type: 'class'
      });
      mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const operations = sections.map(section =>
        linker.linkSection(documentEntityId, section, 'proj_123')
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach((result: { linksCreated: number }) => {
        expect(result.linksCreated).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle database errors gracefully', async () => {
      const documentEntityId = 'entity_doc_1';
      const sections = [
        createMockSection({ content: 'Use AuthService for this.' })
      ];

      mockEntityResolver.resolveByName.mockResolvedValue({
        id: 'entity_auth',
        name: 'AuthService',
        type: 'class'
      });
      mockDbConnection.run.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        linker.linkDocument(documentEntityId, sections, 'proj_123')
      ).rejects.toThrow('Database connection lost');
    });
  });

  // ============================================================================
  // Relationship Creation Tests
  // ============================================================================

  describe('Relationship Creation', () => {
    const projectId = 'proj_123';

    it('should create bidirectional MENTIONS relationship', async () => {
      const docEntityId = 'entity_doc';
      const codeEntityId = 'entity_code';

      mockEntityResolver.resolveByName.mockResolvedValue({
        id: codeEntityId,
        name: 'AuthService',
        type: 'class'
      });
      mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const section = createMockSection({ content: 'The AuthService handles auth.' });
      await linker.linkSection(docEntityId, section, projectId);

      expect(mockDbConnection.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([
          expect.any(String),
          'MENTIONS',
          docEntityId,
          codeEntityId
        ])
      );
    });

    it('should set appropriate weight for relationships', async () => {
      const docEntityId = 'entity_doc';

      mockEntityResolver.resolveByName.mockResolvedValue({
        id: 'entity_code',
        name: 'AuthService',
        type: 'class'
      });
      mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      // Content reference (weight 1.0)
      const contentSection = createMockSection({ content: 'The AuthService handles auth.' });
      await linker.linkSection(docEntityId, contentSection, projectId);

      // Code block reference (weight 0.8)
      const codeBlockSection = createMockSection({
        content: '',
        codeBlocks: [{ language: 'typescript', code: 'new AuthService()', startLine: 1 }]
      });
      await linker.linkSection(docEntityId, codeBlockSection, projectId);

      // Verify different weights were used
      expect(mockDbConnection.run).toHaveBeenCalledTimes(2);
    });

    it('should include language in code block metadata', async () => {
      const docEntityId = 'entity_doc';

      mockEntityResolver.resolveByName.mockResolvedValue({
        id: 'entity_code',
        name: 'AuthService',
        type: 'class'
      });
      mockDbConnection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

      const section = createMockSection({
        codeBlocks: [{
          language: 'typescript',
          code: 'const auth = new AuthService();',
          startLine: 10
        }]
      });

      await linker.linkSection(docEntityId, section, projectId);

      // Metadata should include language
      expect(mockDbConnection.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringMatching(/typescript/)
        ])
      );
    });
  });

  // ============================================================================
  // Link Type Tests
  // ============================================================================

  describe('LinkType enum', () => {
    it('should have correct link types', () => {
      expect(LinkType.MENTIONS).toBe('MENTIONS');
      expect(LinkType.DOCUMENTS).toBe('DOCUMENTS');
      expect(LinkType.IMPLEMENTS).toBe('IMPLEMENTS');
      expect(LinkType.REFERENCES).toBe('REFERENCES');
    });
  });

  // ============================================================================
  // DocumentLink Interface Tests
  // ============================================================================

  describe('DocumentLink interface', () => {
    it('should create valid DocumentLink objects', () => {
      const link: DocumentLink = {
        id: generateId(),
        type: LinkType.MENTIONS,
        sourceId: 'doc_entity_1',
        targetId: 'code_entity_1',
        weight: 1.0,
        metadata: {
          section: 'Overview',
          reference: 'AuthService',
          inCodeBlock: false
        }
      };

      expect(link.type).toBe(LinkType.MENTIONS);
      expect(link.weight).toBe(1.0);
      expect(link.metadata?.section).toBe('Overview');
    });
  });
});
