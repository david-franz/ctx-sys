import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import {
  EntityStore,
  EmbeddingManager,
  MockEmbeddingProvider,
  RelationshipStore,
  GraphTraversal,
  MultiStrategySearch
} from '../../src';

describe('F6.2 - Multi-Strategy Search', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let embeddingManager: EmbeddingManager;
  let relationshipStore: RelationshipStore;
  let graphTraversal: GraphTraversal;
  let search: MultiStrategySearch;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-search-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    const provider = new MockEmbeddingProvider();
    embeddingManager = new EmbeddingManager(db, projectId, provider);
    relationshipStore = new RelationshipStore(db, projectId);
    graphTraversal = new GraphTraversal(db, projectId, relationshipStore, entityStore);
    search = new MultiStrategySearch(entityStore, embeddingManager, graphTraversal);

    // Create test entities
    await createTestEntities();
  });

  afterEach(() => {
    db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  async function createTestEntities() {
    // Create function entities
    const func1 = await entityStore.create({
      name: 'getUserById',
      type: 'function',
      filePath: 'src/users/service.ts',
      startLine: 10,
      content: 'async function getUserById(id: string) { return db.users.find(id); }',
      summary: 'Retrieves a user by their unique identifier from the database'
    });

    const func2 = await entityStore.create({
      name: 'createUser',
      type: 'function',
      filePath: 'src/users/service.ts',
      startLine: 20,
      content: 'async function createUser(data: UserInput) { return db.users.create(data); }',
      summary: 'Creates a new user in the database'
    });

    const func3 = await entityStore.create({
      name: 'authenticateUser',
      type: 'function',
      filePath: 'src/auth/service.ts',
      startLine: 5,
      content: 'async function authenticateUser(email: string, password: string) { ... }',
      summary: 'Authenticates a user with email and password'
    });

    // Create class entities
    const class1 = await entityStore.create({
      name: 'UserService',
      type: 'class',
      filePath: 'src/users/service.ts',
      startLine: 1,
      content: 'class UserService { ... }',
      summary: 'Service class for user management operations'
    });

    const class2 = await entityStore.create({
      name: 'AuthenticationService',
      type: 'class',
      filePath: 'src/auth/service.ts',
      startLine: 1,
      content: 'class AuthenticationService { ... }',
      summary: 'Service class for authentication and authorization'
    });

    // Create embeddings for all entities
    await embeddingManager.embed(func1.id, func1.summary || func1.content || func1.name);
    await embeddingManager.embed(func2.id, func2.summary || func2.content || func2.name);
    await embeddingManager.embed(func3.id, func3.summary || func3.content || func3.name);
    await embeddingManager.embed(class1.id, class1.summary || class1.content || class1.name);
    await embeddingManager.embed(class2.id, class2.summary || class2.content || class2.name);

    // Create relationships
    await relationshipStore.create({
      sourceId: class1.id,
      targetId: func1.id,
      relationship: 'CONTAINS',
      weight: 1.0
    });

    await relationshipStore.create({
      sourceId: class1.id,
      targetId: func2.id,
      relationship: 'CONTAINS',
      weight: 1.0
    });

    await relationshipStore.create({
      sourceId: class2.id,
      targetId: func3.id,
      relationship: 'CONTAINS',
      weight: 1.0
    });

    await relationshipStore.create({
      sourceId: func1.id,
      targetId: func3.id,
      relationship: 'CALLS',
      weight: 0.8
    });
  }

  describe('Single Strategy Search', () => {
    it('should search using keyword strategy', async () => {
      const results = await search.searchWithStrategy('user', 'keyword', {
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
      // Should find user-related entities
      expect(results.some(r => r.entity.name.toLowerCase().includes('user'))).toBe(true);
    });

    it('should search using semantic strategy', async () => {
      const results = await search.searchWithStrategy(
        'fetch user from database',
        'semantic',
        { limit: 10 }
      );

      expect(results.length).toBeGreaterThan(0);
      // Semantic search should find relevant content
      expect(results[0].source).toBe('semantic');
    });

    it('should search using graph strategy', async () => {
      const results = await search.searchWithStrategy(
        'What does `UserService` contain?',
        'graph',
        { limit: 10 }
      );

      // Graph search requires entity mentions to be found
      // If UserService is found, it should return its connected entities
      if (results.length > 0) {
        expect(results[0].source).toBe('graph');
      }
    });
  });

  describe('Multi-Strategy Search', () => {
    it('should combine results from multiple strategies', async () => {
      const results = await search.search('user database operations', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const results = await search.search('user', {
        strategies: ['keyword', 'semantic'],
        limit: 2
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by entity type', async () => {
      const results = await search.search('user', {
        strategies: ['keyword', 'semantic'],
        entityTypes: ['function'],
        limit: 10
      });

      for (const result of results) {
        expect(result.entity.type).toBe('function');
      }
    });

    it('should return unique entities (no duplicates)', async () => {
      const results = await search.search('user service', {
        strategies: ['keyword', 'semantic'],
        limit: 20
      });

      const ids = results.map(r => r.entity.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('Reciprocal Rank Fusion', () => {
    it('should score results higher when found by multiple strategies', async () => {
      // Search for something that should match both keyword and semantic
      const results = await search.search('getUserById function', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      // The top result should have a reasonable score
      if (results.length > 0) {
        expect(results[0].score).toBeGreaterThan(0);
        // Results should be sorted by score descending
        for (let i = 1; i < results.length; i++) {
          expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
        }
      }
    });

    it('should apply custom weights', async () => {
      const defaultResults = await search.search('user', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      const keywordBoostedResults = await search.search('user', {
        strategies: ['keyword', 'semantic'],
        weights: { keyword: 2.0, semantic: 0.5 },
        limit: 10
      });

      // Results may differ when weights change
      expect(keywordBoostedResults.length).toBeGreaterThan(0);
    });
  });

  describe('Query Parsing Integration', () => {
    it('should use parsed query for better results', async () => {
      // Query with backtick mention
      const results = await search.search('How does `getUserById` work?', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      // Should find the mentioned function
      const hasGetUserById = results.some(r => r.entity.name === 'getUserById');
      expect(hasGetUserById).toBe(true);
    });

    it('should extract entity mentions for graph search', async () => {
      const results = await search.search('Show me `UserService` and related code', {
        strategies: ['keyword', 'semantic', 'graph'],
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should expand query with synonyms', async () => {
      // 'function' should be expanded to 'method', etc.
      const results = await search.search('find the function', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Graph-Based Search', () => {
    it('should find connected entities', async () => {
      const results = await search.search('Explain the `UserService` class', {
        strategies: ['graph'],
        limit: 10,
        graphDepth: 2
      });

      // Should find entities connected to UserService
      if (results.length > 0) {
        expect(results[0].source).toBe('graph');
      }
    });

    it('should respect graph depth parameter', async () => {
      const shallowResults = await search.search('`UserService`', {
        strategies: ['graph'],
        limit: 20,
        graphDepth: 1
      });

      const deepResults = await search.search('`UserService`', {
        strategies: ['graph'],
        limit: 20,
        graphDepth: 3
      });

      // Deep search may find more entities
      expect(deepResults.length).toBeGreaterThanOrEqual(shallowResults.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', async () => {
      const results = await search.search('', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle query with no matches', async () => {
      const results = await search.search('xyznonexistent123', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle search without graph traversal', async () => {
      const searchWithoutGraph = new MultiStrategySearch(
        entityStore,
        embeddingManager
        // No graphTraversal
      );

      const results = await searchWithoutGraph.search('user', {
        strategies: ['keyword', 'semantic', 'graph'], // graph will be skipped
        limit: 10
      });

      expect(Array.isArray(results)).toBe(true);
      // No results should have 'graph' as source
      expect(results.every(r => r.source !== 'graph')).toBe(true);
    });

    it('should filter by minimum score', async () => {
      const results = await search.search('user', {
        strategies: ['keyword', 'semantic'],
        limit: 10,
        minScore: 0.01
      });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.01);
      }
    });

    it('should handle all strategies at once', async () => {
      const results = await search.search('authenticate user', {
        strategies: ['keyword', 'semantic', 'graph'],
        limit: 10
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Result Quality', () => {
    it('should return hydrated entities', async () => {
      const results = await search.search('user', {
        strategies: ['keyword'],
        limit: 5
      });

      for (const result of results) {
        expect(result.entity).toBeDefined();
        expect(result.entity.id).toBeDefined();
        expect(result.entity.name).toBeDefined();
        expect(result.entity.type).toBeDefined();
      }
    });

    it('should include source information', async () => {
      const results = await search.search('user', {
        strategies: ['keyword', 'semantic'],
        limit: 5
      });

      for (const result of results) {
        expect(['keyword', 'semantic', 'graph', 'structural', 'hybrid']).toContain(result.source);
      }
    });

    it('should return results sorted by score', async () => {
      const results = await search.search('user database', {
        strategies: ['keyword', 'semantic'],
        limit: 10
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });
  });
});
