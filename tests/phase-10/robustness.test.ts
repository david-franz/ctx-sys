import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodebaseIndexer } from '../../src/indexer';
import { EntityStore } from '../../src/entities';
import { RelationshipStore } from '../../src/graph/relationship-store';
import { DatabaseConnection } from '../../src/db/connection';
import { MarkdownParser } from '../../src/documents/markdown-parser';

describe('F10.8 - Robustness Improvements', () => {
  let tempDir: string;
  let db: DatabaseConnection;
  let entityStore: EntityStore;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-8-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject('test-project');
    entityStore = new EntityStore(db, 'test-project');
  });

  afterEach(() => {
    db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Picomatch Glob Matching', () => {
    it('should exclude node_modules/** patterns', async () => {
      // Create files including ones that should be excluded
      const srcDir = path.join(tempDir, 'src');
      const nmDir = path.join(tempDir, 'node_modules', 'pkg');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'app.ts'), 'export const x = 1;');
      fs.writeFileSync(path.join(nmDir, 'index.ts'), 'export const y = 2;');

      const relationshipStore = new RelationshipStore(db, 'test-project');
      const indexer = new CodebaseIndexer(tempDir, entityStore, undefined, undefined, relationshipStore);
      const result = await indexer.indexAll({ exclude: ['node_modules/**'] });

      // Should only index src/app.ts, not node_modules
      expect(result.added.length).toBeGreaterThanOrEqual(1);
      expect(result.added.some(f => f.includes('node_modules'))).toBe(false);
    });

    it('should exclude files matching *.min.js pattern', async () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'app.js'), 'const x = 1;');
      fs.writeFileSync(path.join(srcDir, 'app.min.js'), 'const x=1;');

      const indexer = new CodebaseIndexer(tempDir, entityStore);
      const result = await indexer.indexAll({ exclude: ['**/*.min.js'] });

      expect(result.added.some(f => f.includes('.min.js'))).toBe(false);
    });
  });

  describe('YAML Frontmatter Parsing', () => {
    it('should parse simple frontmatter with yaml package', () => {
      const parser = new MarkdownParser();
      const content = `---
title: Test Document
tags:
  - javascript
  - typescript
version: 2.0
draft: false
---

# Hello World
`;
      const doc = parser.parseContent(content, 'test.md');
      expect(doc.frontmatter).toBeDefined();
      expect(doc.frontmatter!.title).toBe('Test Document');
      expect(doc.frontmatter!.tags).toEqual(['javascript', 'typescript']);
      expect(doc.frontmatter!.version).toBe(2.0);
      expect(doc.frontmatter!.draft).toBe(false);
      expect(doc.title).toBe('Test Document');
    });

    it('should handle nested YAML objects', () => {
      const parser = new MarkdownParser();
      const content = `---
database:
  host: localhost
  port: 5432
  name: mydb
---

# Config
`;
      const doc = parser.parseContent(content, 'test.md');
      expect(doc.frontmatter).toBeDefined();
      expect((doc.frontmatter!.database as any).host).toBe('localhost');
      expect((doc.frontmatter!.database as any).port).toBe(5432);
    });

    it('should handle invalid YAML gracefully', () => {
      const parser = new MarkdownParser();
      const content = `---
invalid: [unclosed bracket
---

# Content
`;
      const doc = parser.parseContent(content, 'test.md');
      expect(doc.frontmatter).toEqual({});
    });
  });
});
