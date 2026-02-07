import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore, Entity } from '../../src/entities';
import { RelationshipStore } from '../../src/graph/relationship-store';
import { ContextExpander } from '../../src/retrieval/context-expander';
import { SearchResult } from '../../src/retrieval/types';

describe('F10.11 - Smart Context Expansion', () => {
  let tempDir: string;
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let relationshipStore: RelationshipStore;
  let expander: ContextExpander;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-11-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject('test-project');
    entityStore = new EntityStore(db, 'test-project');
    relationshipStore = new RelationshipStore(db, 'test-project');
    expander = new ContextExpander(entityStore, relationshipStore);
  });

  afterEach(() => {
    db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function makeResult(entity: Entity, score: number): SearchResult {
    return {
      entity,
      score,
      source: 'keyword',
      matchInfo: { snippet: entity.name },
    };
  }

  describe('Parent Expansion', () => {
    it('should include parent class for a method', async () => {
      const parentClass = await entityStore.create({
        type: 'class',
        name: 'UserService',
        content: 'class UserService { ... }',
        summary: 'Manages user operations',
      });

      const method = await entityStore.create({
        type: 'method',
        name: 'getUser',
        content: 'getUser(id: string) { return db.find(id); }',
        summary: 'Fetches a user by ID',
      });

      await relationshipStore.create({
        sourceId: parentClass.id,
        targetId: method.id,
        relationship: 'CONTAINS',
      });

      const results = await expander.expand([makeResult(method, 0.9)]);

      expect(results.length).toBe(2);
      expect(results.some(r => r.entity.id === parentClass.id)).toBe(true);
      const parentResult = results.find(r => r.entity.id === parentClass.id)!;
      expect(parentResult.score).toBe(0.9 * 0.5);
      expect(parentResult.source).toBe('structural');
    });

    it('should not duplicate entities already in results', async () => {
      const parentClass = await entityStore.create({
        type: 'class',
        name: 'UserService',
        content: 'class UserService { ... }',
      });

      const method = await entityStore.create({
        type: 'method',
        name: 'getUser',
        content: 'getUser(id) {}',
      });

      await relationshipStore.create({
        sourceId: parentClass.id,
        targetId: method.id,
        relationship: 'CONTAINS',
      });

      // Both parent and method are already in results
      const results = await expander.expand([
        makeResult(method, 0.9),
        makeResult(parentClass, 0.8),
      ]);

      // Should not add duplicate parent
      const parentCount = results.filter(r => r.entity.id === parentClass.id).length;
      expect(parentCount).toBe(1);
    });
  });

  describe('Import Expansion', () => {
    it('should include imported files for file entities', async () => {
      const fileEntity = await entityStore.create({
        type: 'file',
        name: 'auth.ts',
        content: 'import { hash } from "./crypto"',
        filePath: 'src/auth.ts',
      });

      const importedFile = await entityStore.create({
        type: 'file',
        name: 'crypto.ts',
        content: 'export function hash(s: string) { ... }',
        filePath: 'src/crypto.ts',
      });

      await relationshipStore.create({
        sourceId: fileEntity.id,
        targetId: importedFile.id,
        relationship: 'IMPORTS',
      });

      const results = await expander.expand([makeResult(fileEntity, 0.8)]);

      expect(results.length).toBe(2);
      expect(results.some(r => r.entity.id === importedFile.id)).toBe(true);
      const importResult = results.find(r => r.entity.id === importedFile.id)!;
      expect(importResult.score).toBe(0.8 * 0.3);
    });

    it('should not expand imports for non-file entities', async () => {
      const funcEntity = await entityStore.create({
        type: 'function',
        name: 'doStuff',
        content: 'function doStuff() {}',
      });

      const otherEntity = await entityStore.create({
        type: 'function',
        name: 'helper',
        content: 'function helper() {}',
      });

      await relationshipStore.create({
        sourceId: funcEntity.id,
        targetId: otherEntity.id,
        relationship: 'IMPORTS',
      });

      const results = await expander.expand([makeResult(funcEntity, 0.8)]);

      // Should only have the original result (imports only expand for files)
      expect(results.length).toBe(1);
    });
  });

  describe('Type Expansion', () => {
    it('should include referenced type definitions', async () => {
      const func = await entityStore.create({
        type: 'function',
        name: 'createUser',
        content: 'function createUser(input: UserInput): User { ... }',
      });

      const userType = await entityStore.create({
        type: 'interface',
        name: 'User',
        content: 'interface User { id: string; name: string; }',
      });

      await relationshipStore.create({
        sourceId: func.id,
        targetId: userType.id,
        relationship: 'USES',
      });

      const results = await expander.expand([makeResult(func, 0.9)]);

      expect(results.length).toBe(2);
      expect(results.some(r => r.entity.id === userType.id)).toBe(true);
    });

    it('should include IMPLEMENTS and EXTENDS targets', async () => {
      const childClass = await entityStore.create({
        type: 'class',
        name: 'AdminUser',
        content: 'class AdminUser extends BaseUser implements Serializable { }',
      });

      const baseClass = await entityStore.create({
        type: 'class',
        name: 'BaseUser',
        content: 'class BaseUser { id: string; }',
      });

      const iface = await entityStore.create({
        type: 'interface',
        name: 'Serializable',
        content: 'interface Serializable { toJSON(): string; }',
      });

      await relationshipStore.create({
        sourceId: childClass.id,
        targetId: baseClass.id,
        relationship: 'EXTENDS',
      });

      await relationshipStore.create({
        sourceId: childClass.id,
        targetId: iface.id,
        relationship: 'IMPLEMENTS',
      });

      const results = await expander.expand([makeResult(childClass, 0.9)]);

      expect(results.length).toBe(3);
      expect(results.some(r => r.entity.id === baseClass.id)).toBe(true);
      expect(results.some(r => r.entity.id === iface.id)).toBe(true);
    });

    it('should skip non-type entities in USES relationships', async () => {
      const func = await entityStore.create({
        type: 'function',
        name: 'processData',
        content: 'function processData() {}',
      });

      const otherFunc = await entityStore.create({
        type: 'function',
        name: 'helperFunc',
        content: 'function helperFunc() {}',
      });

      await relationshipStore.create({
        sourceId: func.id,
        targetId: otherFunc.id,
        relationship: 'USES',
      });

      const results = await expander.expand([makeResult(func, 0.8)]);

      // Should not include helperFunc (it's a function, not a type/interface/class)
      expect(results.length).toBe(1);
    });
  });

  describe('Token Budget', () => {
    it('should respect maxExpansionTokens budget', async () => {
      const method = await entityStore.create({
        type: 'method',
        name: 'smallMethod',
        content: 'x()',
      });

      // Create a parent with very large content
      const largeContent = 'x'.repeat(20000); // ~5000 tokens
      const parentClass = await entityStore.create({
        type: 'class',
        name: 'HugeClass',
        content: largeContent,
      });

      await relationshipStore.create({
        sourceId: parentClass.id,
        targetId: method.id,
        relationship: 'CONTAINS',
      });

      // Set a small token budget
      const results = await expander.expand(
        [makeResult(method, 0.9)],
        { maxExpansionTokens: 100 }
      );

      // Parent exceeds budget, should not be included
      expect(results.length).toBe(1);
      expect(results[0].entity.id).toBe(method.id);
    });
  });

  describe('Options', () => {
    it('should disable parent expansion when includeParent is false', async () => {
      const parent = await entityStore.create({
        type: 'class',
        name: 'ParentClass',
        content: 'class ParentClass {}',
      });

      const method = await entityStore.create({
        type: 'method',
        name: 'childMethod',
        content: 'childMethod() {}',
      });

      await relationshipStore.create({
        sourceId: parent.id,
        targetId: method.id,
        relationship: 'CONTAINS',
      });

      const results = await expander.expand(
        [makeResult(method, 0.9)],
        { includeParent: false }
      );

      expect(results.length).toBe(1);
    });

    it('should disable type expansion when includeTypes is false', async () => {
      const func = await entityStore.create({
        type: 'function',
        name: 'myFunc',
        content: 'function myFunc(): MyType {}',
      });

      const myType = await entityStore.create({
        type: 'type',
        name: 'MyType',
        content: 'type MyType = { x: number }',
      });

      await relationshipStore.create({
        sourceId: func.id,
        targetId: myType.id,
        relationship: 'USES',
      });

      const results = await expander.expand(
        [makeResult(func, 0.9)],
        { includeTypes: false }
      );

      expect(results.length).toBe(1);
    });
  });

  describe('Result Ordering', () => {
    it('should sort results by score descending', async () => {
      const e1 = await entityStore.create({ type: 'function', name: 'a', content: 'a()' });
      const e2 = await entityStore.create({ type: 'function', name: 'b', content: 'b()' });
      const e3 = await entityStore.create({ type: 'function', name: 'c', content: 'c()' });

      const results = await expander.expand([
        makeResult(e2, 0.5),
        makeResult(e1, 0.9),
        makeResult(e3, 0.3),
      ]);

      expect(results[0].entity.id).toBe(e1.id);
      expect(results[1].entity.id).toBe(e2.id);
      expect(results[2].entity.id).toBe(e3.id);
    });
  });
});
