import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  DocumentLinker,
  MarkdownParser,
  EntityStore
} from '../../src';

describe('F4.3 - Document-Code Linking', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let linker: DocumentLinker;
  let parser: MarkdownParser;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-linker-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    linker = new DocumentLinker(entityStore);
    parser = new MarkdownParser();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (testDbPath) {
      const dir = path.dirname(testDbPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
      }
    }
  });

  describe('findReferencesInText', () => {
    it('should find backtick code references', () => {
      const text = 'Use the `AuthService` to handle `login()` calls.';
      const refs = linker.findReferencesInText(text);

      expect(refs.length).toBe(2);
      expect(refs[0].text).toBe('AuthService');
      expect(refs[0].type).toBe('backtick');
      expect(refs[1].text).toBe('login()');
      expect(refs[1].type).toBe('backtick');
    });

    it('should find file path references', () => {
      const text = 'Check src/services/auth.ts and utils/helper.js for implementation.';
      const refs = linker.findReferencesInText(text);

      const filePaths = refs.filter(r => r.type === 'filepath');
      expect(filePaths.length).toBe(2);
      expect(filePaths[0].text).toBe('src/services/auth.ts');
      expect(filePaths[1].text).toBe('utils/helper.js');
    });

    it('should find class-like names', () => {
      const text = 'The UserController interacts with DatabaseService and CacheManager.';
      const refs = linker.findReferencesInText(text);

      const classNames = refs.filter(r => r.type === 'classname');
      expect(classNames.length).toBe(3);
      expect(classNames.map(r => r.text)).toContain('UserController');
      expect(classNames.map(r => r.text)).toContain('DatabaseService');
      expect(classNames.map(r => r.text)).toContain('CacheManager');
    });

    it('should find function calls', () => {
      const text = 'Call validateUser() before processRequest() to ensure security.';
      const refs = linker.findReferencesInText(text);

      const functions = refs.filter(r => r.type === 'function');
      expect(functions.length).toBe(2);
      expect(functions[0].text).toBe('validateUser');
      expect(functions[1].text).toBe('processRequest');
    });

    it('should include section information', () => {
      const refs = linker.findReferencesInText('Use `config` here.', 'Setup Section');

      expect(refs[0].section).toBe('Setup Section');
    });

    it('should mark code block references', () => {
      const refs = linker.findReferencesInText('const AuthService = ...', 'Code', true);

      expect(refs[0].inCodeBlock).toBe(true);
    });

    it('should not duplicate references found in backticks', () => {
      const text = 'The `AuthService` class provides authentication via AuthService methods.';
      const refs = linker.findReferencesInText(text);

      // AuthService should only appear once (from backtick)
      const authRefs = refs.filter(r => r.text === 'AuthService');
      expect(authRefs.length).toBe(1);
    });

    it('should handle various file extensions', () => {
      const text = `
        Check src/main.py for Python.
        See lib/utils.go for Go.
        Look at src/app.rs for Rust.
        Open core/Main.java for Java.
        Edit src/module.cpp for C++.
      `;
      const refs = linker.findReferencesInText(text);
      const filePaths = refs.filter(r => r.type === 'filepath');

      expect(filePaths.map(r => r.text)).toContain('src/main.py');
      expect(filePaths.map(r => r.text)).toContain('lib/utils.go');
      expect(filePaths.map(r => r.text)).toContain('src/app.rs');
      expect(filePaths.map(r => r.text)).toContain('core/Main.java');
      expect(filePaths.map(r => r.text)).toContain('src/module.cpp');
    });
  });

  describe('findCodeReferences', () => {
    it('should find references across all sections', () => {
      const content = `
# Overview

Uses \`AuthService\` for authentication.

## Implementation

Check src/auth.ts for the implementation.

\`\`\`typescript
const service = new AuthService();
\`\`\`
`;
      const doc = parser.parseContent(content, 'doc.md');
      const refs = linker.findCodeReferences(doc);

      expect(refs.length).toBeGreaterThan(0);
      expect(refs.some(r => r.text === 'AuthService')).toBe(true);
      expect(refs.some(r => r.text === 'src/auth.ts')).toBe(true);
    });

    it('should deduplicate references by text', () => {
      const content = `
# Doc

Use \`ConfigService\` here.

## More

Also use \`ConfigService\` there.
`;
      const doc = parser.parseContent(content, 'doc.md');
      const refs = linker.findCodeReferences(doc);

      const configRefs = refs.filter(r => r.text === 'ConfigService');
      expect(configRefs.length).toBe(1);
    });

    it('should find references in code blocks', () => {
      const content = `
# Code

\`\`\`typescript
import { UserService } from './services';
const manager = new SessionManager();
\`\`\`
`;
      const doc = parser.parseContent(content, 'doc.md');
      const refs = linker.findCodeReferences(doc);

      // Should find class names from code block
      expect(refs.some(r => r.text.includes('Service') || r.text.includes('Manager'))).toBe(true);
    });
  });

  describe('resolveReference', () => {
    it('should resolve reference to exact entity', async () => {
      await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth.ts',
        startLine: 1,
        endLine: 50
      });

      const entity = await linker.resolveReference('AuthService');

      expect(entity).not.toBeNull();
      expect(entity?.name).toBe('AuthService');
    });

    it('should resolve file path reference', async () => {
      await entityStore.create({
        name: 'auth.ts',
        type: 'file',
        filePath: 'src/services/auth.ts',
        startLine: 1,
        endLine: 100
      });

      const entity = await linker.resolveReference('auth.ts');

      expect(entity).not.toBeNull();
      expect(entity?.type).toBe('file');
    });

    it('should return null for unmatched reference', async () => {
      const entity = await linker.resolveReference('NonExistentThing');

      expect(entity).toBeNull();
    });

    it('should try different entity types', async () => {
      await entityStore.create({
        name: 'UserInterface',
        type: 'interface',
        filePath: 'src/types.ts',
        startLine: 10,
        endLine: 20
      });

      const entity = await linker.resolveReference('UserInterface');

      expect(entity).not.toBeNull();
      expect(entity?.type).toBe('interface');
    });

    it('should find functions by name', async () => {
      await entityStore.create({
        name: 'validateInput',
        type: 'function',
        filePath: 'src/validation.ts',
        startLine: 5,
        endLine: 15
      });

      const entity = await linker.resolveReference('validateInput');

      expect(entity).not.toBeNull();
      expect(entity?.type).toBe('function');
    });
  });

  describe('resolveReferences', () => {
    it('should resolve multiple references', async () => {
      await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth.ts',
        startLine: 1,
        endLine: 50
      });
      await entityStore.create({
        name: 'UserService',
        type: 'class',
        filePath: 'src/user.ts',
        startLine: 1,
        endLine: 40
      });

      const refs = [
        { text: 'AuthService', type: 'backtick' as const },
        { text: 'UserService', type: 'classname' as const },
        { text: 'UnknownService', type: 'classname' as const }
      ];

      const resolved = await linker.resolveReferences(refs);

      expect(resolved.size).toBe(2);
      expect(resolved.has('AuthService')).toBe(true);
      expect(resolved.has('UserService')).toBe(true);
      expect(resolved.has('UnknownService')).toBe(false);
    });

    it('should not duplicate resolution for same text', async () => {
      await entityStore.create({
        name: 'ConfigService',
        type: 'class',
        filePath: 'src/config.ts',
        startLine: 1,
        endLine: 30
      });

      const refs = [
        { text: 'ConfigService', type: 'backtick' as const },
        { text: 'ConfigService', type: 'classname' as const }
      ];

      const resolved = await linker.resolveReferences(refs);

      // Should only resolve once
      expect(resolved.size).toBe(1);
    });
  });

  describe('linkDocument', () => {
    it('should link document and return statistics', async () => {
      await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth.ts',
        startLine: 1,
        endLine: 50
      });

      const content = `
# Auth Documentation

The \`AuthService\` handles authentication.

Also references \`UnknownThing\` that doesn't exist.
`;
      const doc = parser.parseContent(content, 'auth.md');
      const result = await linker.linkDocument(doc);

      expect(result.documentId).toBe('auth.md');
      expect(result.linksCreated).toBe(1);
      expect(result.unresolvedReferences).toContain('UnknownThing');
    });

    it('should use custom document entity ID if provided', async () => {
      const doc = parser.parseContent('# Doc', 'test.md');
      const result = await linker.linkDocument(doc, 'custom-doc-id');

      expect(result.documentId).toBe('custom-doc-id');
    });

    it('should handle document with no code references', async () => {
      const doc = parser.parseContent('# Plain Document\n\nJust text.', 'plain.md');
      const result = await linker.linkDocument(doc);

      expect(result.linksCreated).toBe(0);
      expect(result.unresolvedReferences.length).toBe(0);
    });
  });

  describe('looksLikeCode', () => {
    it('should identify file paths', () => {
      expect(linker.looksLikeCode('src/utils.ts')).toBe(true);
      expect(linker.looksLikeCode('config.js')).toBe(true);
    });

    it('should identify class names', () => {
      expect(linker.looksLikeCode('AuthService')).toBe(true);
      expect(linker.looksLikeCode('UserController')).toBe(true);
      expect(linker.looksLikeCode('DatabaseManager')).toBe(true);
    });

    it('should identify function calls', () => {
      expect(linker.looksLikeCode('validateUser()')).toBe(true);
      expect(linker.looksLikeCode('processData()')).toBe(true);
    });

    it('should identify camelCase identifiers', () => {
      expect(linker.looksLikeCode('userName')).toBe(true);
      expect(linker.looksLikeCode('isValid')).toBe(true);
      expect(linker.looksLikeCode('getData')).toBe(true);
    });

    it('should identify code characters', () => {
      expect(linker.looksLikeCode('user.name')).toBe(true);
      expect(linker.looksLikeCode('get_data')).toBe(true);
      expect(linker.looksLikeCode('func()')).toBe(true);
    });

    it('should not identify plain words', () => {
      expect(linker.looksLikeCode('hello')).toBe(false);
      expect(linker.looksLikeCode('world')).toBe(false);
      expect(linker.looksLikeCode('documentation')).toBe(false);
    });
  });

  describe('getPatterns', () => {
    it('should return code detection patterns', () => {
      const patterns = linker.getPatterns();

      expect(patterns.backtick).toBeInstanceOf(RegExp);
      expect(patterns.filePath).toBeInstanceOf(RegExp);
      expect(patterns.className).toBeInstanceOf(RegExp);
      expect(patterns.functionCall).toBeInstanceOf(RegExp);
      expect(patterns.pascalCase).toBeInstanceOf(RegExp);
      expect(patterns.constant).toBeInstanceOf(RegExp);
    });
  });

  describe('integration scenarios', () => {
    it('should link comprehensive technical documentation', async () => {
      // Set up entities
      await entityStore.create({
        name: 'UserService',
        type: 'class',
        filePath: 'src/services/user.ts',
        startLine: 1,
        endLine: 100
      });
      await entityStore.create({
        name: 'validateEmail',
        type: 'function',
        filePath: 'src/utils/validation.ts',
        startLine: 10,
        endLine: 20
      });
      await entityStore.create({
        name: 'User',
        type: 'interface',
        filePath: 'src/types/user.ts',
        startLine: 1,
        endLine: 15
      });

      const content = `
# User Management

## Overview

The \`UserService\` class manages user operations. It implements the \`User\` interface.

## Validation

Use \`validateEmail()\` to check email format before creating users.

\`\`\`typescript
const service = new UserService();
const isValid = validateEmail(email);
\`\`\`

## Files

- src/services/user.ts - Main service
- src/utils/validation.ts - Validation helpers
`;

      const doc = parser.parseContent(content, 'user-docs.md');
      const result = await linker.linkDocument(doc);

      expect(result.linksCreated).toBeGreaterThanOrEqual(2);
    });

    it('should handle documentation with many unresolved references', async () => {
      const content = `
# External Dependencies

This module uses \`express\`, \`lodash\`, \`moment\`, and other npm packages.

See ExternalAPI and ThirdPartyService for integration details.
`;
      const doc = parser.parseContent(content, 'deps.md');
      const result = await linker.linkDocument(doc);

      // All references should be unresolved since no entities exist
      expect(result.linksCreated).toBe(0);
      expect(result.unresolvedReferences.length).toBeGreaterThan(0);
    });
  });
});
