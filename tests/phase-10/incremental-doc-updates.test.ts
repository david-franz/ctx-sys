import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities';
import { RelationshipStore } from '../../src/graph/relationship-store';
import { DocumentIndexer } from '../../src/documents/document-indexer';

describe('F10.13 - Incremental Document Updates', () => {
  let tempDir: string;
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let relationshipStore: RelationshipStore;
  let indexer: DocumentIndexer;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-13-test-'));
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

  describe('Hash-based Change Detection', () => {
    it('should skip unchanged files on re-index', async () => {
      const filePath = createFile('stable.md', '# Stable\n\nNo changes.');
      const first = await indexer.indexFile(filePath);
      expect(first.skipped).toBeFalsy();
      expect(first.entitiesCreated).toBeGreaterThanOrEqual(1);

      const second = await indexer.indexFile(filePath);
      expect(second.skipped).toBe(true);
      expect(second.entitiesCreated).toBe(0);
    });

    it('should re-index changed files', async () => {
      const filePath = createFile('changing.md', '# Version 1\n\nOriginal.');
      await indexer.indexFile(filePath);

      fs.writeFileSync(filePath, '# Version 2\n\nUpdated content.\n\n## New Section\n\nMore.');
      const second = await indexer.indexFile(filePath);
      expect(second.skipped).toBeFalsy();
      expect(second.entitiesCreated).toBeGreaterThanOrEqual(1);
    });

    it('should skip unchanged YAML files', async () => {
      const filePath = createFile('config.yaml', 'database:\n  host: localhost\n  port: 5432');
      await indexer.indexFile(filePath);

      const second = await indexer.indexFile(filePath);
      expect(second.skipped).toBe(true);
    });

    it('should skip unchanged JSON files', async () => {
      const filePath = createFile('config.json', '{"key": "value"}');
      await indexer.indexFile(filePath);

      const second = await indexer.indexFile(filePath);
      expect(second.skipped).toBe(true);
    });
  });

  describe('Directory Indexing', () => {
    it('should index all documents in a directory', async () => {
      createFile('README.md', '# Project\n\nOverview.');
      createFile('docs/guide.md', '# Guide\n\nSetup instructions.');
      createFile('config.yaml', 'server:\n  port: 3000');

      const result = await indexer.indexDirectory(tempDir);
      expect(result.filesProcessed).toBeGreaterThanOrEqual(3);
      expect(result.totalEntities).toBeGreaterThanOrEqual(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip unchanged files in directory mode', async () => {
      createFile('README.md', '# Project\n\nOverview.');
      createFile('notes.txt', 'Some notes.');

      const first = await indexer.indexDirectory(tempDir);
      expect(first.filesProcessed).toBeGreaterThanOrEqual(2);

      const second = await indexer.indexDirectory(tempDir);
      expect(second.filesSkipped).toBeGreaterThanOrEqual(2);
      expect(second.filesProcessed).toBe(0);
    });

    it('should respect exclude patterns', async () => {
      createFile('README.md', '# Project');
      createFile('node_modules/pkg/README.md', '# Package');

      const result = await indexer.indexDirectory(tempDir);
      // Only README.md should be indexed, not node_modules/
      expect(result.filesProcessed).toBe(1);
    });

    it('should filter by extension', async () => {
      createFile('README.md', '# Project');
      createFile('config.yaml', 'key: value');
      createFile('notes.txt', 'Notes here');

      const result = await indexer.indexDirectory(tempDir, {
        extensions: ['.md'],
      });
      expect(result.filesProcessed).toBe(1);
    });

    it('should handle non-recursive mode', async () => {
      createFile('README.md', '# Root');
      createFile('docs/guide.md', '# Nested');

      const result = await indexer.indexDirectory(tempDir, { recursive: false });
      // Only root-level files
      expect(result.filesProcessed).toBe(1);
    });

    it('should detect changed files in mixed directory', async () => {
      createFile('stable.md', '# Stable');
      createFile('changing.md', '# V1');

      await indexer.indexDirectory(tempDir);

      // Change one file
      fs.writeFileSync(path.join(tempDir, 'changing.md'), '# V2\n\nUpdated.');

      const second = await indexer.indexDirectory(tempDir);
      expect(second.filesProcessed).toBe(1); // only changing.md
      expect(second.filesSkipped).toBe(1);   // stable.md skipped
    });
  });

  describe('Supported Extensions', () => {
    it('should return all supported extensions', () => {
      const extensions = DocumentIndexer.getSupportedExtensions();
      expect(extensions).toContain('.md');
      expect(extensions).toContain('.yaml');
      expect(extensions).toContain('.yml');
      expect(extensions).toContain('.json');
      expect(extensions).toContain('.toml');
      expect(extensions).toContain('.txt');
    });
  });
});
