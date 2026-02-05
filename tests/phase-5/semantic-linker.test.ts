import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  EntityStore,
  EmbeddingManager,
  MockEmbeddingProvider,
  RelationshipStore,
  SemanticLinker
} from '../../src';

describe('F5.3 - Semantic Relationship Discovery', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let embeddingManager: EmbeddingManager;
  let relationshipStore: RelationshipStore;
  let linker: SemanticLinker;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-semantic-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    const provider = new MockEmbeddingProvider();
    embeddingManager = new EmbeddingManager(db, projectId, provider);
    relationshipStore = new RelationshipStore(db, projectId);
    linker = new SemanticLinker(entityStore, embeddingManager, relationshipStore);
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

  describe('discoverRelationships', () => {
    it('should discover relationships between similar entities', async () => {
      // Create entities with identical content (will have same embedding)
      const entity1 = await entityStore.create({
        name: 'UserAuth',
        type: 'concept',
        content: 'User authentication and login'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'AuthService',
        type: 'concept',
        content: 'User authentication and login' // Same content = high similarity
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      const result = await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept']
      });

      expect(result.created).toBeGreaterThan(0);
      expect(result.entitiesProcessed).toBe(2);
    });

    it('should not create duplicate relationships', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      // Run twice
      const result1 = await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept']
      });
      const result2 = await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept'],
        skipExisting: false // Don't skip
      });

      // Second run should not create duplicates
      const totalRels = await relationshipStore.count('RELATES_TO');
      expect(totalRels).toBe(result1.created); // Only first run's count
    });

    it('should skip entities with existing relationships when skipExisting is true', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Content A'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Content A'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      // First run creates relationships
      await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept']
      });

      // Second run should skip entities that already have semantic relationships
      const result2 = await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept'],
        skipExisting: true
      });

      expect(result2.entitiesSkipped).toBeGreaterThan(0);
    });

    it('should respect entity type filter', async () => {
      const concept = await entityStore.create({
        name: 'Concept1',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(concept.id, concept.content!);

      const func = await entityStore.create({
        name: 'function1',
        type: 'function',
        content: 'Same content',
        filePath: 'func.ts',
        startLine: 1,
        endLine: 10
      });
      await embeddingManager.embed(func.id, func.content!);

      const result = await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept'] // Only concepts
      });

      expect(result.entitiesProcessed).toBe(1);
    });

    it('should use custom relationship type', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      await linker.discoverRelationships({
        minSimilarity: 0.99,
        entityTypes: ['concept'],
        relationshipType: 'DEPENDS_ON'
      });

      const deps = await relationshipStore.count('DEPENDS_ON');
      expect(deps).toBeGreaterThan(0);
    });
  });

  describe('linkNewEntity', () => {
    it('should link a new entity to similar existing entities', async () => {
      // Create existing entity
      const existing = await entityStore.create({
        name: 'ExistingEntity',
        type: 'concept',
        content: 'Authentication logic'
      });
      await embeddingManager.embed(existing.id, existing.content!);

      // Create new entity with same content
      const newEntity = await entityStore.create({
        name: 'NewEntity',
        type: 'concept',
        content: 'Authentication logic'
      });
      await embeddingManager.embed(newEntity.id, newEntity.content!);

      const created = await linker.linkNewEntity(newEntity.id, {
        minSimilarity: 0.99
      });

      expect(created).toBeGreaterThan(0);

      // Verify relationship exists
      const rels = await relationshipStore.getForEntity(newEntity.id, 'out');
      expect(rels.some(r => r.targetId === existing.id)).toBe(true);
    });

    it('should create bidirectional links when specified', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Shared content'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Shared content'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      await linker.linkNewEntity(entity2.id, {
        minSimilarity: 0.99,
        bidirectional: true
      });

      // Check both directions
      const outgoing = await relationshipStore.getForEntity(entity2.id, 'out');
      const incoming = await relationshipStore.getForEntity(entity2.id, 'in');

      expect(outgoing.some(r => r.targetId === entity1.id)).toBe(true);
      expect(incoming.some(r => r.sourceId === entity1.id)).toBe(true);
    });

    it('should respect max links limit', async () => {
      // Create multiple entities with same content
      for (let i = 0; i < 10; i++) {
        const entity = await entityStore.create({
          name: `Entity${i}`,
          type: 'concept',
          content: 'Identical content'
        });
        await embeddingManager.embed(entity.id, entity.content!);
      }

      const newEntity = await entityStore.create({
        name: 'NewEntity',
        type: 'concept',
        content: 'Identical content'
      });
      await embeddingManager.embed(newEntity.id, newEntity.content!);

      await linker.linkNewEntity(newEntity.id, {
        minSimilarity: 0.99,
        maxLinks: 3
      });

      const rels = await relationshipStore.getForEntity(newEntity.id, 'out');
      expect(rels.length).toBeLessThanOrEqual(3);
    });
  });

  describe('findRelated', () => {
    it('should find entities related to a query', async () => {
      const entity = await entityStore.create({
        name: 'AuthService',
        type: 'class',
        content: 'Authentication service',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });
      await embeddingManager.embed(entity.id, entity.content!);

      const results = await linker.findRelated('Authentication service', {
        minSimilarity: 0.99
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entity.id).toBe(entity.id);
    });

    it('should filter by entity type', async () => {
      const classEntity = await entityStore.create({
        name: 'AuthClass',
        type: 'class',
        content: 'Same content',
        filePath: 'auth.ts',
        startLine: 1,
        endLine: 50
      });
      await embeddingManager.embed(classEntity.id, classEntity.content!);

      const concept = await entityStore.create({
        name: 'AuthConcept',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(concept.id, concept.content!);

      const results = await linker.findRelated('Same content', {
        minSimilarity: 0.99,
        entityTypes: ['concept']
      });

      expect(results.every(r => r.entity.type === 'concept')).toBe(true);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 10; i++) {
        const entity = await entityStore.create({
          name: `Entity${i}`,
          type: 'concept',
          content: 'Same content'
        });
        await embeddingManager.embed(entity.id, entity.content!);
      }

      const results = await linker.findRelated('Same content', {
        limit: 3,
        minSimilarity: 0.99
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('findRelatedConcepts', () => {
    it('should find concepts related to an entity', async () => {
      const sourceEntity = await entityStore.create({
        name: 'Source',
        type: 'class',
        content: 'Authentication logic',
        filePath: 'source.ts',
        startLine: 1,
        endLine: 50
      });
      await embeddingManager.embed(sourceEntity.id, sourceEntity.content!);

      const concept = await entityStore.create({
        name: 'AuthConcept',
        type: 'concept',
        content: 'Authentication logic'
      });
      await embeddingManager.embed(concept.id, concept.content!);

      const results = await linker.findRelatedConcepts(sourceEntity.id, {
        minSimilarity: 0.99
      });

      expect(results.some(r => r.entity.id === concept.id)).toBe(true);
    });

    it('should not include the source entity in results', async () => {
      const entity = await entityStore.create({
        name: 'TestEntity',
        type: 'concept',
        content: 'Test content'
      });
      await embeddingManager.embed(entity.id, entity.content!);

      const results = await linker.findRelatedConcepts(entity.id);

      expect(results.some(r => r.entity.id === entity.id)).toBe(false);
    });
  });

  describe('getSemanticLinks', () => {
    it('should get semantic links for an entity', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Content'
      });
      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Content'
      });

      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity2.id,
        relationship: 'RELATES_TO',
        weight: 0.9
      });

      const links = await linker.getSemanticLinks(entity1.id);

      expect(links.length).toBe(1);
      expect(links[0].similarity).toBe(0.9);
    });

    it('should filter by direction', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Content'
      });
      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Content'
      });

      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity2.id,
        relationship: 'RELATES_TO',
        weight: 0.9
      });

      const outLinks = await linker.getSemanticLinks(entity1.id, { direction: 'out' });
      const inLinks = await linker.getSemanticLinks(entity1.id, { direction: 'in' });

      expect(outLinks.length).toBe(1);
      expect(inLinks.length).toBe(0);
    });

    it('should filter by minimum weight', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Content'
      });
      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Content'
      });
      const entity3 = await entityStore.create({
        name: 'Entity3',
        type: 'concept',
        content: 'Content'
      });

      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity2.id,
        relationship: 'RELATES_TO',
        weight: 0.9
      });
      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity3.id,
        relationship: 'RELATES_TO',
        weight: 0.5
      });

      const links = await linker.getSemanticLinks(entity1.id, { minWeight: 0.7 });

      expect(links.length).toBe(1);
      expect(links[0].similarity).toBe(0.9);
    });
  });

  describe('updateLinks', () => {
    it('should remove old semantic links and create new ones', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Original content'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Original content'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      // Create initial link
      await linker.linkNewEntity(entity1.id, { minSimilarity: 0.99 });

      // Create a different entity
      const entity3 = await entityStore.create({
        name: 'Entity3',
        type: 'concept',
        content: 'Original content'
      });
      await embeddingManager.embed(entity3.id, entity3.content!);

      // Update links - should find entity3 too
      await linker.updateLinks(entity1.id, { minSimilarity: 0.99 });

      const links = await linker.getSemanticLinks(entity1.id, { direction: 'out' });
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('getSuggestions', () => {
    it('should suggest unlinked similar entities', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Authentication system'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Authentication system'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      const suggestions = await linker.getSuggestions(entity1.id, {
        minSimilarity: 0.99
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].entity.id).toBe(entity2.id);
      expect(suggestions[0].reason).toContain('similar');
    });

    it('should not suggest already linked entities', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(entity1.id, entity1.content!);

      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Same content'
      });
      await embeddingManager.embed(entity2.id, entity2.content!);

      // Link them
      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity2.id,
        relationship: 'RELATES_TO',
        weight: 0.95
      });

      const suggestions = await linker.getSuggestions(entity1.id, {
        minSimilarity: 0.99
      });

      expect(suggestions.every(s => s.entity.id !== entity2.id)).toBe(true);
    });
  });

  describe('batchLink', () => {
    it('should process multiple entities', async () => {
      const entities: string[] = [];

      for (let i = 0; i < 5; i++) {
        const entity = await entityStore.create({
          name: `Entity${i}`,
          type: 'concept',
          content: 'Same content'
        });
        await embeddingManager.embed(entity.id, entity.content!);
        entities.push(entity.id);
      }

      const result = await linker.batchLink(entities, {
        minSimilarity: 0.99
      });

      expect(result.processed).toBe(5);
      expect(result.totalCreated).toBeGreaterThan(0);
    });

    it('should call progress callback', async () => {
      const entities: string[] = [];
      const progressCalls: number[] = [];

      for (let i = 0; i < 3; i++) {
        const entity = await entityStore.create({
          name: `Entity${i}`,
          type: 'concept',
          content: `Content ${i}`
        });
        await embeddingManager.embed(entity.id, entity.content!);
        entities.push(entity.id);
      }

      await linker.batchLink(entities, {
        onProgress: (processed) => progressCalls.push(processed)
      });

      expect(progressCalls).toEqual([1, 2, 3]);
    });
  });

  describe('pruneWeakLinks', () => {
    it('should remove semantic relationships below threshold', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Content'
      });
      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Content'
      });
      const entity3 = await entityStore.create({
        name: 'Entity3',
        type: 'concept',
        content: 'Content'
      });

      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity2.id,
        relationship: 'RELATES_TO',
        weight: 0.9,
        metadata: { discoveredBy: 'semantic' }
      });
      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity3.id,
        relationship: 'RELATES_TO',
        weight: 0.4, // Below threshold
        metadata: { discoveredBy: 'semantic' }
      });

      const removed = await linker.pruneWeakLinks(0.6);

      expect(removed).toBe(1);

      const remaining = await relationshipStore.count('RELATES_TO');
      expect(remaining).toBe(1);
    });

    it('should only remove semantically discovered links', async () => {
      const entity1 = await entityStore.create({
        name: 'Entity1',
        type: 'concept',
        content: 'Content'
      });
      const entity2 = await entityStore.create({
        name: 'Entity2',
        type: 'concept',
        content: 'Content'
      });

      // Non-semantic relationship with low weight
      await relationshipStore.create({
        sourceId: entity1.id,
        targetId: entity2.id,
        relationship: 'RELATES_TO',
        weight: 0.3,
        metadata: { discoveredBy: 'manual' } // Not semantic
      });

      const removed = await linker.pruneWeakLinks(0.6);

      expect(removed).toBe(0); // Should not remove manual links

      const remaining = await relationshipStore.count('RELATES_TO');
      expect(remaining).toBe(1);
    });
  });
});
