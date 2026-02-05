import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  RelationshipStore,
  GraphTraversal,
  EntityStore
} from '../../src';

describe('F5.1 - Graph Storage and Traversal', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let relationshipStore: RelationshipStore;
  let traversal: GraphTraversal;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-graph-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    relationshipStore = new RelationshipStore(db, projectId);
    traversal = new GraphTraversal(db, projectId, relationshipStore, entityStore);
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

  describe('RelationshipStore', () => {
    describe('create', () => {
      it('should create a relationship', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        const rel = await relationshipStore.create({
          sourceId: entity1.id,
          targetId: entity2.id,
          relationship: 'IMPORTS'
        });

        expect(rel.id).toBeDefined();
        expect(rel.sourceId).toBe(entity1.id);
        expect(rel.targetId).toBe(entity2.id);
        expect(rel.relationship).toBe('IMPORTS');
        expect(rel.weight).toBe(1.0);
      });

      it('should create relationship with custom weight', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        const rel = await relationshipStore.create({
          sourceId: entity1.id,
          targetId: entity2.id,
          relationship: 'RELATES_TO',
          weight: 0.85
        });

        expect(rel.weight).toBe(0.85);
      });

      it('should create relationship with metadata', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        const rel = await relationshipStore.create({
          sourceId: entity1.id,
          targetId: entity2.id,
          relationship: 'CALLS',
          metadata: { line: 42, context: 'constructor' }
        });

        expect(rel.metadata.line).toBe(42);
        expect(rel.metadata.context).toBe('constructor');
      });
    });

    describe('createMany', () => {
      it('should create multiple relationships in a transaction', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });
        const entity3 = await entityStore.create({ name: 'Entity3', type: 'class', filePath: 'file3.ts', startLine: 1, endLine: 10 });

        const rels = await relationshipStore.createMany([
          { sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' },
          { sourceId: entity1.id, targetId: entity3.id, relationship: 'IMPORTS' },
          { sourceId: entity2.id, targetId: entity3.id, relationship: 'CALLS' }
        ]);

        expect(rels.length).toBe(3);
        expect(await relationshipStore.count()).toBe(3);
      });
    });

    describe('get', () => {
      it('should retrieve a relationship by ID', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        const created = await relationshipStore.create({
          sourceId: entity1.id,
          targetId: entity2.id,
          relationship: 'EXTENDS'
        });

        const retrieved = await relationshipStore.get(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.relationship).toBe('EXTENDS');
      });

      it('should return null for non-existent relationship', async () => {
        const retrieved = await relationshipStore.get('non-existent-id');
        expect(retrieved).toBeNull();
      });
    });

    describe('getForEntity', () => {
      it('should get outgoing relationships', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });
        const entity3 = await entityStore.create({ name: 'Entity3', type: 'class', filePath: 'file3.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity3.id, relationship: 'CALLS' });
        await relationshipStore.create({ sourceId: entity2.id, targetId: entity1.id, relationship: 'USES' });

        const outgoing = await relationshipStore.getForEntity(entity1.id, 'out');
        expect(outgoing.length).toBe(2);
      });

      it('should get incoming relationships', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'CALLS' });

        const incoming = await relationshipStore.getForEntity(entity2.id, 'in');
        expect(incoming.length).toBe(2);
      });

      it('should get both directions', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity2.id, targetId: entity1.id, relationship: 'CALLS' });

        const both = await relationshipStore.getForEntity(entity1.id, 'both');
        expect(both.length).toBe(2);
      });

      it('should filter by relationship type', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'CALLS' });

        const imports = await relationshipStore.getForEntity(entity1.id, 'out', { types: ['IMPORTS'] });
        expect(imports.length).toBe(1);
        expect(imports[0].relationship).toBe('IMPORTS');
      });

      it('should filter by minimum weight', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'RELATES_TO', weight: 0.9 });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'RELATES_TO', weight: 0.5 });

        const highWeight = await relationshipStore.getForEntity(entity1.id, 'out', { minWeight: 0.7 });
        expect(highWeight.length).toBe(1);
        expect(highWeight[0].weight).toBe(0.9);
      });
    });

    describe('exists', () => {
      it('should return true if relationship exists', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });

        expect(await relationshipStore.exists(entity1.id, entity2.id)).toBe(true);
        expect(await relationshipStore.exists(entity1.id, entity2.id, 'IMPORTS')).toBe(true);
        expect(await relationshipStore.exists(entity1.id, entity2.id, 'CALLS')).toBe(false);
      });

      it('should return false if relationship does not exist', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        expect(await relationshipStore.exists(entity1.id, entity2.id)).toBe(false);
      });
    });

    describe('delete operations', () => {
      it('should delete a relationship by ID', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        const rel = await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.delete(rel.id);

        expect(await relationshipStore.get(rel.id)).toBeNull();
      });

      it('should delete all relationships for an entity', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });
        const entity3 = await entityStore.create({ name: 'Entity3', type: 'class', filePath: 'file3.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity2.id, targetId: entity1.id, relationship: 'CALLS' });
        await relationshipStore.create({ sourceId: entity2.id, targetId: entity3.id, relationship: 'EXTENDS' });

        const deleted = await relationshipStore.deleteForEntity(entity1.id);
        expect(deleted).toBe(2);
        expect(await relationshipStore.count()).toBe(1);
      });

      it('should delete relationships between two entities', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'CALLS' });

        const deleted = await relationshipStore.deleteBetween(entity1.id, entity2.id);
        expect(deleted).toBe(2);
        expect(await relationshipStore.count()).toBe(0);
      });
    });

    describe('statistics', () => {
      it('should count relationships', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'CALLS' });

        expect(await relationshipStore.count()).toBe(2);
        expect(await relationshipStore.count('IMPORTS')).toBe(1);
      });

      it('should get stats by type', async () => {
        const entity1 = await entityStore.create({ name: 'Entity1', type: 'class', filePath: 'file1.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Entity2', type: 'class', filePath: 'file2.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'CALLS' });

        const stats = await relationshipStore.getStatsByType();
        expect(stats['IMPORTS']).toBe(2);
        expect(stats['CALLS']).toBe(1);
      });

      it('should get most connected entities', async () => {
        const entity1 = await entityStore.create({ name: 'Hub', type: 'class', filePath: 'hub.ts', startLine: 1, endLine: 10 });
        const entity2 = await entityStore.create({ name: 'Spoke1', type: 'class', filePath: 'spoke1.ts', startLine: 1, endLine: 10 });
        const entity3 = await entityStore.create({ name: 'Spoke2', type: 'class', filePath: 'spoke2.ts', startLine: 1, endLine: 10 });
        const entity4 = await entityStore.create({ name: 'Spoke3', type: 'class', filePath: 'spoke3.ts', startLine: 1, endLine: 10 });

        await relationshipStore.create({ sourceId: entity1.id, targetId: entity2.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity3.id, relationship: 'IMPORTS' });
        await relationshipStore.create({ sourceId: entity1.id, targetId: entity4.id, relationship: 'IMPORTS' });

        const mostConnected = await relationshipStore.getMostConnected(2);
        expect(mostConnected.length).toBe(2);
        expect(mostConnected[0].entityId).toBe(entity1.id);
        expect(mostConnected[0].connections).toBe(3);
      });
    });
  });

  describe('GraphTraversal', () => {
    let entities: {
      a: ReturnType<typeof entityStore.create> extends Promise<infer T> ? T : never;
      b: ReturnType<typeof entityStore.create> extends Promise<infer T> ? T : never;
      c: ReturnType<typeof entityStore.create> extends Promise<infer T> ? T : never;
      d: ReturnType<typeof entityStore.create> extends Promise<infer T> ? T : never;
    };

    beforeEach(async () => {
      // Create a simple graph: A -> B -> C -> D
      //                         \-> C
      const a = await entityStore.create({ name: 'A', type: 'class', filePath: 'a.ts', startLine: 1, endLine: 10 });
      const b = await entityStore.create({ name: 'B', type: 'class', filePath: 'b.ts', startLine: 1, endLine: 10 });
      const c = await entityStore.create({ name: 'C', type: 'class', filePath: 'c.ts', startLine: 1, endLine: 10 });
      const d = await entityStore.create({ name: 'D', type: 'class', filePath: 'd.ts', startLine: 1, endLine: 10 });

      await relationshipStore.create({ sourceId: a.id, targetId: b.id, relationship: 'CALLS' });
      await relationshipStore.create({ sourceId: a.id, targetId: c.id, relationship: 'IMPORTS' });
      await relationshipStore.create({ sourceId: b.id, targetId: c.id, relationship: 'CALLS' });
      await relationshipStore.create({ sourceId: c.id, targetId: d.id, relationship: 'EXTENDS' });

      entities = { a, b, c, d };
    });

    describe('getNeighborhood', () => {
      it('should get immediate neighborhood (depth 1)', async () => {
        const result = await traversal.getNeighborhood(entities.a.id, { maxDepth: 1 });

        expect(result.entities.length).toBe(3); // A, B, C
        expect(result.relationships.length).toBe(2); // A->B, A->C
      });

      it('should get extended neighborhood (depth 2)', async () => {
        const result = await traversal.getNeighborhood(entities.a.id, { maxDepth: 2 });

        expect(result.entities.length).toBe(4); // A, B, C, D
        expect(result.relationships.length).toBe(4); // All relationships
      });

      it('should filter by relationship type', async () => {
        const result = await traversal.getNeighborhood(entities.a.id, {
          maxDepth: 2,
          types: ['CALLS'],
          direction: 'out' // Only follow outgoing CALLS relationships
        });

        // Following only outgoing CALLS from A: A->B, then B->C
        const entityNames = result.entities.map(e => e.name).sort();
        expect(entityNames).toEqual(['A', 'B', 'C']);

        const callRels = result.relationships.filter(r => r.type === 'CALLS');
        expect(callRels.length).toBe(2);
      });

      it('should respect direction', async () => {
        const result = await traversal.getNeighborhood(entities.c.id, {
          maxDepth: 1,
          direction: 'in'
        });

        // C has incoming from A and B
        expect(result.entities.length).toBe(3); // C, A, B
      });
    });

    describe('findPaths', () => {
      it('should find paths between two entities', async () => {
        const result = await traversal.findPaths(entities.a.id, entities.d.id);

        expect(result.found).toBe(true);
        expect(result.paths.length).toBeGreaterThan(0);

        // All paths should start at A and end at D
        for (const path of result.paths) {
          expect(path.nodes[0]).toBe(entities.a.id);
          expect(path.nodes[path.nodes.length - 1]).toBe(entities.d.id);
        }
      });

      it('should find multiple paths if they exist', async () => {
        const result = await traversal.findPaths(entities.a.id, entities.c.id);

        expect(result.found).toBe(true);
        // Should find: A->C (direct) and A->B->C
        expect(result.paths.length).toBe(2);
      });

      it('should return empty when no path exists', async () => {
        const result = await traversal.findPaths(entities.d.id, entities.a.id);

        expect(result.found).toBe(false);
        expect(result.paths.length).toBe(0);
      });

      it('should filter by relationship type', async () => {
        const result = await traversal.findPaths(entities.a.id, entities.c.id, {
          types: ['IMPORTS']
        });

        // Only direct path A->C via IMPORTS
        expect(result.paths.length).toBe(1);
        expect(result.paths[0].length).toBe(1);
      });
    });

    describe('findShortestPath', () => {
      it('should find shortest path', async () => {
        const path = await traversal.findShortestPath(entities.a.id, entities.c.id);

        expect(path).not.toBeNull();
        expect(path!.length).toBe(1); // Direct A->C
        expect(path!.nodes).toEqual([entities.a.id, entities.c.id]);
      });

      it('should return null when no path exists', async () => {
        const path = await traversal.findShortestPath(entities.d.id, entities.a.id);

        expect(path).toBeNull();
      });
    });

    describe('getReachable', () => {
      it('should get all reachable entities', async () => {
        const reachable = await traversal.getReachable(entities.a.id);

        expect(reachable.length).toBe(3); // B, C, D
        expect(reachable).toContain(entities.b.id);
        expect(reachable).toContain(entities.c.id);
        expect(reachable).toContain(entities.d.id);
      });

      it('should respect max depth', async () => {
        const reachable = await traversal.getReachable(entities.a.id, { maxDepth: 1 });

        expect(reachable.length).toBe(2); // B, C
        expect(reachable).not.toContain(entities.d.id);
      });
    });

    describe('getDependents and getDependencies', () => {
      it('should get direct dependents', async () => {
        const dependents = await traversal.getDependents(entities.c.id);

        expect(dependents.length).toBe(2); // A, B
        expect(dependents).toContain(entities.a.id);
        expect(dependents).toContain(entities.b.id);
      });

      it('should get direct dependencies', async () => {
        const deps = await traversal.getDependencies(entities.a.id);

        expect(deps.length).toBe(2); // B, C
        expect(deps).toContain(entities.b.id);
        expect(deps).toContain(entities.c.id);
      });
    });

    describe('getStatistics', () => {
      it('should return graph statistics', async () => {
        const stats = await traversal.getStatistics();

        expect(stats.entityCount).toBe(4);
        expect(stats.relationshipCount).toBe(4);
        expect(stats.averageDegree).toBeGreaterThan(0);
        expect(stats.relationshipsByType['CALLS']).toBe(2);
        expect(stats.relationshipsByType['IMPORTS']).toBe(1);
        expect(stats.relationshipsByType['EXTENDS']).toBe(1);
      });
    });

    describe('findCommonNeighbors', () => {
      it('should find common neighbors', async () => {
        const common = await traversal.findCommonNeighbors(entities.a.id, entities.b.id);

        // Both A and B connect to C
        expect(common).toContain(entities.c.id);
      });
    });

    describe('getDegree', () => {
      it('should calculate entity degree', async () => {
        const outDegree = await traversal.getDegree(entities.a.id, 'out');
        expect(outDegree).toBe(2); // A->B, A->C

        const inDegree = await traversal.getDegree(entities.c.id, 'in');
        expect(inDegree).toBe(2); // A->C, B->C

        const totalDegree = await traversal.getDegree(entities.c.id, 'both');
        expect(totalDegree).toBe(3); // 2 in + 1 out
      });
    });

    describe('areConnected', () => {
      it('should detect connected entities', async () => {
        expect(await traversal.areConnected(entities.a.id, entities.d.id)).toBe(true);
        expect(await traversal.areConnected(entities.a.id, entities.b.id)).toBe(true);
      });

      it('should detect unconnected entities', async () => {
        const isolated = await entityStore.create({ name: 'Isolated', type: 'class', filePath: 'isolated.ts', startLine: 1, endLine: 10 });

        expect(await traversal.areConnected(entities.a.id, isolated.id)).toBe(false);
      });
    });

    describe('getSubgraphByEntityTypes', () => {
      it('should extract subgraph with specific entity types', async () => {
        // Add some different entity types
        const func1 = await entityStore.create({ name: 'func1', type: 'function', filePath: 'funcs.ts', startLine: 1, endLine: 5 });
        const func2 = await entityStore.create({ name: 'func2', type: 'function', filePath: 'funcs.ts', startLine: 10, endLine: 15 });

        await relationshipStore.create({ sourceId: func1.id, targetId: func2.id, relationship: 'CALLS' });
        await relationshipStore.create({ sourceId: entities.a.id, targetId: func1.id, relationship: 'CONTAINS' });

        const subgraph = await traversal.getSubgraphByEntityTypes(['function']);

        expect(subgraph.entities.length).toBe(2);
        expect(subgraph.relationships.length).toBe(1); // Only func1->func2
      });
    });
  });
});
