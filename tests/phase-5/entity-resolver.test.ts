import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  EntityStore,
  EmbeddingManager,
  MockEmbeddingProvider,
  RelationshipStore,
  EntityResolver
} from '../../src';

describe('F5.2 - Entity Resolution', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let embeddingManager: EmbeddingManager;
  let relationshipStore: RelationshipStore;
  let resolver: EntityResolver;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-resolver-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    const provider = new MockEmbeddingProvider();
    embeddingManager = new EmbeddingManager(db, projectId, provider);
    relationshipStore = new RelationshipStore(db, projectId);
    resolver = new EntityResolver(entityStore, embeddingManager, relationshipStore);
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

  describe('resolve', () => {
    it('should resolve exact name match', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });

      const resolved = await resolver.resolve('AuthService');

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(entity.id);
    });

    it('should resolve by qualified name', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'src/auth.ts',
        startLine: 1,
        endLine: 50
      });

      const resolved = await resolver.resolve('src/auth.ts::AuthService');

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(entity.id);
    });

    it('should resolve by partial name search', async () => {
      const entity = await entityStore.create({
        name: 'UserAuthenticationService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });

      const resolved = await resolver.resolve('AuthenticationService');

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(entity.id);
    });

    it('should filter by type', async () => {
      await entityStore.create({
        name: 'Config',
        type: 'class',
        filePath: 'config.ts',
        startLine: 1,
        endLine: 50
      });
      const func = await entityStore.create({
        name: 'Config',
        type: 'function',
        filePath: 'utils.ts',
        startLine: 1,
        endLine: 10
      });

      const resolved = await resolver.resolve('Config', { type: 'function' });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(func.id);
      expect(resolved?.type).toBe('function');
    });

    it('should return null for non-existent entity', async () => {
      const resolved = await resolver.resolve('NonExistent');

      expect(resolved).toBeNull();
    });
  });

  describe('resolveMany', () => {
    it('should resolve multiple names', async () => {
      const auth = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });
      const user = await entityStore.create({
        name: 'UserService',
        type: 'class',
        filePath: 'user.ts',
        startLine: 1,
        endLine: 50
      });

      const results = await resolver.resolveMany(['AuthService', 'UserService', 'NonExistent']);

      expect(results.size).toBe(3);
      expect(results.get('AuthService')?.id).toBe(auth.id);
      expect(results.get('UserService')?.id).toBe(user.id);
      expect(results.get('NonExistent')).toBeNull();
    });
  });

  describe('findDuplicates', () => {
    it('should find duplicate entities by embedding similarity', async () => {
      // Create entities with similar content - MockEmbeddingProvider returns
      // embeddings based on content hash, so exact duplicates will match
      const entity1 = await entityStore.create({
        name: 'Authentication',
        type: 'concept',
        content: 'User authentication and login'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Auth',
        type: 'concept',
        content: 'User authentication and login' // Same content
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      const duplicates = await resolver.findDuplicates({
        threshold: 0.99,
        types: ['concept']
      });

      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should not find duplicates when threshold is high and content differs', async () => {
      const entity1 = await entityStore.create({
        name: 'DatabaseService',
        type: 'concept',
        content: 'Handles database connections and queries'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'CacheService',
        type: 'concept',
        content: 'Manages in-memory caching'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      const duplicates = await resolver.findDuplicates({
        threshold: 0.99,
        types: ['concept']
      });

      // With very different content, shouldn't find duplicates at high threshold
      expect(duplicates.length).toBe(0);
    });

    it('should respect entity type filter', async () => {
      const concept = await entityStore.create({
        name: 'Auth',
        type: 'concept',
        content: 'Authentication concept'
      });
      await embeddingManager.embed(concept.id, concept.content!);

      const classEntity = await entityStore.create({
        name: 'Auth',
        type: 'class',
        content: 'Authentication class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });
      await embeddingManager.embed(classEntity.id, classEntity.content!);

      const duplicates = await resolver.findDuplicates({
        types: ['concept']
      });

      // Should only look at concepts, not classes
      const allPrimaries = duplicates.map(d => d.primary);
      const allDuplicates = duplicates.flatMap(d => d.duplicates);
      const allEntities = [...allPrimaries, ...allDuplicates];

      for (const e of allEntities) {
        expect(['concept', 'technology', 'pattern']).toContain(e.type);
      }
    });
  });

  describe('merge', () => {
    it('should merge duplicates into primary entity', async () => {
      const primary = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });
      const duplicate = await entityStore.create({
        name: 'AuthenticationService',
        type: 'class',
        filePath: 'authentication.ts',
        startLine: 1,
        endLine: 60
      });

      const result = await resolver.merge(primary.id, [duplicate.id]);

      expect(result.mergedCount).toBe(1);
      expect(result.aliasesAdded).toContain('AuthenticationService');

      // Duplicate should be deleted
      const deletedEntity = await entityStore.get(duplicate.id);
      expect(deletedEntity).toBeNull();
    });

    it('should redirect relationships when merging', async () => {
      const primary = await entityStore.create({
        name: 'Primary',
        type: 'class',
        filePath: 'primary.ts',
        startLine: 1,
        endLine: 50
      });
      const duplicate = await entityStore.create({
        name: 'Duplicate',
        type: 'class',
        filePath: 'dup.ts',
        startLine: 1,
        endLine: 50
      });
      const other = await entityStore.create({
        name: 'Other',
        type: 'class',
        filePath: 'other.ts',
        startLine: 1,
        endLine: 50
      });

      // Create relationship to duplicate
      await relationshipStore.create({
        sourceId: other.id,
        targetId: duplicate.id,
        relationship: 'IMPORTS'
      });

      const result = await resolver.merge(primary.id, [duplicate.id]);

      expect(result.relationshipsRedirected).toBe(1);

      // Relationship should now point to primary
      const rels = await relationshipStore.getForEntity(primary.id, 'in');
      expect(rels.length).toBe(1);
      expect(rels[0].sourceId).toBe(other.id);
      expect(rels[0].targetId).toBe(primary.id);
    });

    it('should not create self-loops when merging', async () => {
      const primary = await entityStore.create({
        name: 'Primary',
        type: 'class',
        filePath: 'primary.ts',
        startLine: 1,
        endLine: 50
      });
      const duplicate = await entityStore.create({
        name: 'Duplicate',
        type: 'class',
        filePath: 'dup.ts',
        startLine: 1,
        endLine: 50
      });

      // Create relationship from primary to duplicate (would become self-loop)
      await relationshipStore.create({
        sourceId: primary.id,
        targetId: duplicate.id,
        relationship: 'CALLS'
      });

      const result = await resolver.merge(primary.id, [duplicate.id]);

      // Self-loop should not be created
      const rels = await relationshipStore.getForEntity(primary.id, 'both');
      const selfLoops = rels.filter(r => r.sourceId === r.targetId);
      expect(selfLoops.length).toBe(0);
    });

    it('should preserve existing aliases from duplicate', async () => {
      const primary = await entityStore.create({
        name: 'Primary',
        type: 'class',
        filePath: 'primary.ts',
        startLine: 1,
        endLine: 50
      });
      const duplicate = await entityStore.create({
        name: 'Duplicate',
        type: 'class',
        filePath: 'dup.ts',
        startLine: 1,
        endLine: 50,
        metadata: { aliases: ['OldName', 'AnotherName'] }
      });

      const result = await resolver.merge(primary.id, [duplicate.id]);

      expect(result.aliasesAdded).toContain('Duplicate');
      expect(result.aliasesAdded).toContain('OldName');
      expect(result.aliasesAdded).toContain('AnotherName');
    });

    it('should optionally not delete duplicates', async () => {
      const primary = await entityStore.create({
        name: 'Primary',
        type: 'class',
        filePath: 'primary.ts',
        startLine: 1,
        endLine: 50
      });
      const duplicate = await entityStore.create({
        name: 'Duplicate',
        type: 'class',
        filePath: 'dup.ts',
        startLine: 1,
        endLine: 50
      });

      await resolver.merge(primary.id, [duplicate.id], { deleteDuplicates: false });

      // Duplicate should still exist
      const stillExists = await entityStore.get(duplicate.id);
      expect(stillExists).not.toBeNull();
    });
  });

  describe('alias management', () => {
    it('should get aliases for an entity', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50,
        metadata: { aliases: ['Auth', 'AuthenticationService'] }
      });

      const aliases = await resolver.getAliases(entity.id);

      expect(aliases).toContain('Auth');
      expect(aliases).toContain('AuthenticationService');
    });

    it('should return empty array for entity without aliases', async () => {
      const entity = await entityStore.create({
        name: 'Simple',
        type: 'class',
        filePath: 'simple.ts',
        startLine: 1,
        endLine: 50
      });

      const aliases = await resolver.getAliases(entity.id);

      expect(aliases).toEqual([]);
    });

    it('should add alias to an entity', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });

      await resolver.addAlias(entity.id, 'Auth');
      await resolver.addAlias(entity.id, 'AuthenticationService');

      const aliases = await resolver.getAliases(entity.id);
      expect(aliases).toContain('Auth');
      expect(aliases).toContain('AuthenticationService');
    });

    it('should not add duplicate aliases', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50,
        metadata: { aliases: ['Auth'] }
      });

      await resolver.addAlias(entity.id, 'Auth'); // Already exists
      await resolver.addAlias(entity.id, 'AuthService'); // Same as name

      const aliases = await resolver.getAliases(entity.id);
      expect(aliases).toEqual(['Auth']); // No duplicates
    });

    it('should remove alias from an entity', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50,
        metadata: { aliases: ['Auth', 'AuthenticationService'] }
      });

      await resolver.removeAlias(entity.id, 'Auth');

      const aliases = await resolver.getAliases(entity.id);
      expect(aliases).not.toContain('Auth');
      expect(aliases).toContain('AuthenticationService');
    });
  });

  describe('findPotentialAliases', () => {
    it('should find potential aliases by embedding similarity', async () => {
      const entity1 = await entityStore.create({
        name: 'Authentication',
        type: 'concept',
        content: 'User authentication and verification'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Auth',
        type: 'concept',
        content: 'User authentication and verification' // Same content
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      const potentialAliases = await resolver.findPotentialAliases(entity1.id, {
        threshold: 0.99
      });

      expect(potentialAliases.some(pa => pa.entity.id === entity2.id)).toBe(true);
    });

    it('should not include the entity itself', async () => {
      const entity = await entityStore.create({
        name: 'TestEntity',
        type: 'concept',
        content: 'Test content'
      });
      await embeddingManager.embed(entity.id, entity.content!);

      const potentialAliases = await resolver.findPotentialAliases(entity.id);

      const selfIncluded = potentialAliases.some(pa => pa.entity.id === entity.id);
      expect(selfIncluded).toBe(false);
    });
  });

  describe('name similarity', () => {
    it('should recognize similar names', async () => {
      const entity = await entityStore.create({
        name: 'UserAuthenticationService',
        type: 'class',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });

      // Should match with high threshold for partial name
      const resolved = await resolver.resolve('AuthenticationService', { threshold: 0.5 });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(entity.id);
    });
  });
});
