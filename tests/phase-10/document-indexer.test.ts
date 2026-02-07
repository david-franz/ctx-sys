import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities';
import { RelationshipStore } from '../../src/graph/relationship-store';
import { DocumentIndexer } from '../../src/documents/document-indexer';

describe('F10.9 - Document Indexer', () => {
  let tempDir: string;
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let relationshipStore: RelationshipStore;
  let indexer: DocumentIndexer;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-9-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject('test-project');
    entityStore = new EntityStore(db, 'test-project');
    relationshipStore = new RelationshipStore(db, 'test-project');
    indexer = new DocumentIndexer(entityStore, relationshipStore);
  });

  afterEach(() => {
    db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function createFile(name: string, content: string): string {
    const filePath = path.join(tempDir, name);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  describe('Markdown Indexing', () => {
    it('should create document entity for markdown file', async () => {
      const filePath = createFile('README.md', '# Hello World\n\nSome content here.');
      const result = await indexer.indexFile(filePath);

      expect(result.documentId).toBeDefined();
      expect(result.entitiesCreated).toBeGreaterThanOrEqual(2); // document + section
      expect(result.skipped).toBeFalsy();

      const doc = await entityStore.getByQualifiedName(filePath);
      expect(doc).not.toBeNull();
      expect(doc!.type).toBe('document');
      expect(doc!.name).toBe('README.md');
    });

    it('should create section entities from headings', async () => {
      const filePath = createFile('doc.md', '# Introduction\n\nIntro text.\n\n## Setup\n\nSetup text.\n\n## Usage\n\nUsage text.');
      const result = await indexer.indexFile(filePath);

      // 1 document + 3 sections
      expect(result.entitiesCreated).toBeGreaterThanOrEqual(4);

      const sections = await entityStore.getByType('section');
      expect(sections.length).toBeGreaterThanOrEqual(3);
      expect(sections.map(s => s.name)).toContain('Introduction');
      expect(sections.map(s => s.name)).toContain('Setup');
      expect(sections.map(s => s.name)).toContain('Usage');
    });

    it('should build section hierarchy with CONTAINS relationships', async () => {
      const filePath = createFile('hierarchy.md', '# Top\n\nTop content.\n\n## Sub\n\nSub content.');
      const result = await indexer.indexFile(filePath);

      expect(result.relationshipsCreated).toBeGreaterThanOrEqual(2); // doc→top, top→sub
    });

    it('should skip unchanged files on re-index', async () => {
      const filePath = createFile('stable.md', '# Stable\n\nSame content.');
      await indexer.indexFile(filePath);
      const result2 = await indexer.indexFile(filePath);

      expect(result2.skipped).toBe(true);
      expect(result2.entitiesCreated).toBe(0);
    });

    it('should re-index changed files', async () => {
      const filePath = createFile('changing.md', '# V1\n\nOriginal.');
      await indexer.indexFile(filePath);

      fs.writeFileSync(filePath, '# V2\n\nUpdated content.\n\n## New Section\n\nMore.');
      const result2 = await indexer.indexFile(filePath);

      expect(result2.skipped).toBeFalsy();
      expect(result2.entitiesCreated).toBeGreaterThanOrEqual(1);
    });
  });

  describe('JSON Indexing', () => {
    it('should create document entity for JSON file', async () => {
      const filePath = createFile('config.json', JSON.stringify({ key: 'value', nested: { a: 1 } }));
      const result = await indexer.indexFile(filePath);

      expect(result.documentId).toBeDefined();
      expect(result.entitiesCreated).toBeGreaterThanOrEqual(3); // doc + key + nested
    });

    it('should extract dependencies from package.json', async () => {
      const pkg = {
        name: 'test-pkg',
        dependencies: { 'express': '^4.0.0', 'lodash': '^4.0.0' },
        scripts: { build: 'tsc', test: 'jest' }
      };
      const filePath = createFile('package.json', JSON.stringify(pkg));
      const result = await indexer.indexFile(filePath);

      // doc + 2 deps (technology) + 2 scripts (task)
      expect(result.entitiesCreated).toBeGreaterThanOrEqual(5);

      const techs = await entityStore.getByType('technology');
      expect(techs.map(t => t.name)).toContain('express');
      expect(techs.map(t => t.name)).toContain('lodash');

      const tasks = await entityStore.getByType('task');
      expect(tasks.map(t => t.name)).toContain('build');
      expect(tasks.map(t => t.name)).toContain('test');
    });
  });

  describe('YAML Indexing', () => {
    it('should create entities from YAML file', async () => {
      const filePath = createFile('config.yaml', 'database:\n  host: localhost\n  port: 5432\nredis:\n  host: redis-server');
      const result = await indexer.indexFile(filePath);

      expect(result.documentId).toBeDefined();
      expect(result.entitiesCreated).toBeGreaterThanOrEqual(3); // doc + database + redis
    });
  });

  describe('Plain Text Indexing', () => {
    it('should create document entity for plain text', async () => {
      const filePath = createFile('notes.txt', 'Some plain text notes about the project.');
      const result = await indexer.indexFile(filePath);

      expect(result.documentId).toBeDefined();
      expect(result.entitiesCreated).toBe(1); // just the document
    });
  });

  describe('TOML Indexing', () => {
    it('should create entities from TOML file', async () => {
      const filePath = createFile('config.toml', '[server]\nhost = "localhost"\nport = 8080\n\n[database]\nurl = "postgres://localhost"');
      const result = await indexer.indexFile(filePath);

      expect(result.documentId).toBeDefined();
      expect(result.entitiesCreated).toBeGreaterThanOrEqual(3); // doc + server + database
    });
  });
});
