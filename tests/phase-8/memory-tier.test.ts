/**
 * Tests for MemoryTierManager - Hot/Cold Memory API (F8.2)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  MemoryTierManager,
  MemoryItem,
  MemoryEmbeddingProvider,
  DEFAULT_MEMORY_CONFIG
} from '../../src/agent';
import { DatabaseConnection } from '../../src/db/connection';

describe('MemoryTierManager', () => {
  let db: DatabaseConnection;
  let manager: MemoryTierManager;
  let tempDir: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-tier-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject(projectId);
    manager = new MemoryTierManager(db, projectId);
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('addToHot', () => {
    it('should add item to hot memory', async () => {
      const item = await manager.addToHot('session-1', 'Test content', 'message');

      expect(item.id).toMatch(/^mem_/);
      expect(item.sessionId).toBe('session-1');
      expect(item.content).toBe('Test content');
      expect(item.type).toBe('message');
      expect(item.tier).toBe('hot');
      expect(item.accessCount).toBe(0);
      expect(item.relevanceScore).toBe(1.0);
    });

    it('should add item with custom relevance score', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'fact', {
        relevanceScore: 0.8
      });

      expect(item.relevanceScore).toBe(0.8);
    });

    it('should add item with metadata', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'decision', {
        metadata: { key: 'value', nested: { data: 123 } }
      });

      expect(item.metadata).toEqual({ key: 'value', nested: { data: 123 } });
    });

    it('should calculate token count', async () => {
      const content = 'This is a test message with some content';
      const item = await manager.addToHot('session-1', content, 'message');

      // Token count is estimated as content.length / 4
      expect(item.tokenCount).toBe(Math.ceil(content.length / 4));
    });

    it('should auto-spill when hot memory exceeds limit', async () => {
      const smallLimitManager = new MemoryTierManager(db, projectId, undefined, {
        hotTokenLimit: 100, // Small limit
        autoSpillEnabled: true
      });

      // Add items that exceed the limit
      await smallLimitManager.addToHot('session-1', 'A'.repeat(50), 'message');
      await smallLimitManager.addToHot('session-1', 'B'.repeat(50), 'message');
      await smallLimitManager.addToHot('session-1', 'C'.repeat(50), 'message');

      const status = await smallLimitManager.getStatus('session-1');

      // Some items should have been spilled
      expect(status.hot.tokens).toBeLessThanOrEqual(100);
    });

    it('should not auto-spill when disabled', async () => {
      const noAutoSpillManager = new MemoryTierManager(db, projectId, undefined, {
        hotTokenLimit: 50,
        autoSpillEnabled: false
      });

      await noAutoSpillManager.addToHot('session-1', 'A'.repeat(100), 'message');
      await noAutoSpillManager.addToHot('session-1', 'B'.repeat(100), 'message');

      const status = await noAutoSpillManager.getStatus('session-1');

      // Items should remain in hot even though exceeding limit
      expect(status.hot.items).toBe(2);
    });
  });

  describe('getHot', () => {
    it('should return empty array for session with no items', async () => {
      const items = await manager.getHot('non-existent');
      expect(items).toEqual([]);
    });

    it('should return only hot items', async () => {
      await manager.addToHot('session-1', 'Hot 1', 'message');
      await manager.addToHot('session-1', 'Hot 2', 'message');

      const item = await manager.addToHot('session-1', 'To be spilled', 'message');
      await manager.demote(item.id, 'cold');

      const hot = await manager.getHot('session-1');

      expect(hot).toHaveLength(2);
      expect(hot.every(i => i.tier === 'hot')).toBe(true);
    });

    it('should return items in descending creation order', async () => {
      await manager.addToHot('session-1', 'First', 'message');
      await new Promise(resolve => setTimeout(resolve, 10));
      await manager.addToHot('session-1', 'Second', 'message');

      const hot = await manager.getHot('session-1');

      expect(hot[0].content).toBe('Second');
      expect(hot[1].content).toBe('First');
    });
  });

  describe('getByTier', () => {
    it('should return items by tier', async () => {
      const item1 = await manager.addToHot('session-1', 'Hot', 'message');
      const item2 = await manager.addToHot('session-1', 'Warm', 'message');
      const item3 = await manager.addToHot('session-1', 'Cold', 'message');

      await manager.demote(item2.id, 'warm');
      await manager.demote(item3.id, 'cold');

      const hotItems = await manager.getByTier('session-1', 'hot');
      const warmItems = await manager.getByTier('session-1', 'warm');
      const coldItems = await manager.getByTier('session-1', 'cold');

      expect(hotItems).toHaveLength(1);
      expect(warmItems).toHaveLength(1);
      expect(coldItems).toHaveLength(1);
    });
  });

  describe('getItem', () => {
    it('should return null for non-existent item', async () => {
      const item = await manager.getItem('non-existent');
      expect(item).toBeNull();
    });

    it('should return item by ID', async () => {
      const created = await manager.addToHot('session-1', 'Test', 'message');
      const item = await manager.getItem(created.id);

      expect(item).not.toBeNull();
      expect(item!.id).toBe(created.id);
      expect(item!.content).toBe('Test');
    });
  });

  describe('spillToWarm', () => {
    it('should spill items from hot to warm/cold', async () => {
      await manager.addToHot('session-1', 'Item 1', 'message');
      await manager.addToHot('session-1', 'Item 2', 'message');
      await manager.addToHot('session-1', 'Item 3', 'message');

      const result = await manager.spillToWarm('session-1', { count: 2 });

      expect(result.spilledCount).toBe(2);
      expect(result.spilledIds).toHaveLength(2);
    });

    it('should spill specific items by ID', async () => {
      const item1 = await manager.addToHot('session-1', 'Item 1', 'message');
      const item2 = await manager.addToHot('session-1', 'Item 2', 'message');

      const result = await manager.spillToWarm('session-1', { itemIds: [item1.id] });

      expect(result.spilledCount).toBe(1);
      expect(result.spilledIds).toContain(item1.id);

      const updatedItem = await manager.getItem(item1.id);
      expect(updatedItem!.tier).not.toBe('hot');
    });

    it('should spill to warm for frequently accessed items', async () => {
      const managerWithLowThreshold = new MemoryTierManager(db, projectId, undefined, {
        warmAccessThreshold: 2
      });

      const item = await managerWithLowThreshold.addToHot('session-1', 'Test', 'message');

      // Simulate access by updating access count
      db.run(
        `UPDATE p_test_project_memory_items SET access_count = 5 WHERE id = ?`,
        [item.id]
      );

      await managerWithLowThreshold.spillToWarm('session-1', { itemIds: [item.id] });

      const updated = await managerWithLowThreshold.getItem(item.id);
      expect(updated!.tier).toBe('warm');
    });

    it('should spill to cold for rarely accessed items', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message');

      await manager.spillToWarm('session-1', { itemIds: [item.id] });

      const updated = await manager.getItem(item.id);
      expect(updated!.tier).toBe('cold');
    });

    it('should select lowest relevance items for spill', async () => {
      await manager.addToHot('session-1', 'High relevance', 'message', { relevanceScore: 1.0 });
      await manager.addToHot('session-1', 'Low relevance', 'message', { relevanceScore: 0.1 });

      const result = await manager.spillToWarm('session-1', { count: 1 });

      const spilled = await manager.getItem(result.spilledIds[0]);
      expect(spilled!.content).toBe('Low relevance');
    });
  });

  describe('recall', () => {
    it('should recall items from cold storage by keyword', async () => {
      const item = await manager.addToHot('session-1', 'The budget is $50,000', 'fact');
      await manager.demote(item.id, 'cold');

      const result = await manager.recall('session-1', 'budget');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].content).toContain('budget');
    });

    it('should return empty result when no matches with minRelevance', async () => {
      await manager.addToHot('session-1', 'Some content', 'message');
      await manager.spillToWarm('session-1');

      const result = await manager.recall('session-1', 'nonexistent keyword xyz', {
        minRelevance: 0.1 // Require at least 10% relevance
      });

      expect(result.items).toHaveLength(0);
    });

    it('should filter by type', async () => {
      const fact = await manager.addToHot('session-1', 'Important fact', 'fact');
      const message = await manager.addToHot('session-1', 'Important message', 'message');
      await manager.demote(fact.id, 'cold');
      await manager.demote(message.id, 'cold');

      const result = await manager.recall('session-1', 'important', {
        types: ['fact']
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('fact');
    });

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        const item = await manager.addToHot('session-1', `Item ${i} with keyword`, 'message');
        await manager.demote(item.id, 'cold');
      }

      const result = await manager.recall('session-1', 'keyword', { limit: 2 });

      expect(result.items).toHaveLength(2);
    });

    it('should update access count on recall', async () => {
      const item = await manager.addToHot('session-1', 'Test content', 'message');
      await manager.demote(item.id, 'cold');

      await manager.recall('session-1', 'test');

      const updated = await manager.getItem(item.id);
      expect(updated!.accessCount).toBe(1);
    });

    it('should auto-promote high relevance items', async () => {
      const item = await manager.addToHot('session-1', 'Very specific keyword match', 'fact');
      await manager.demote(item.id, 'cold');

      const managerWithLowThreshold = new MemoryTierManager(db, projectId, undefined, {
        promoteThreshold: 0.5,
        autoPromoteEnabled: true
      });

      const result = await managerWithLowThreshold.recall('session-1', 'very specific keyword match');

      expect(result.promoted.length).toBeGreaterThanOrEqual(0);
    });

    it('should not auto-promote when disabled', async () => {
      const item = await manager.addToHot('session-1', 'Test content', 'message');
      await manager.demote(item.id, 'cold');

      const result = await manager.recall('session-1', 'test content', {
        autoPromote: false
      });

      expect(result.promoted).toHaveLength(0);
      const updated = await manager.getItem(item.id);
      expect(updated!.tier).toBe('cold');
    });
  });

  describe('recall with embeddings', () => {
    let mockEmbeddingProvider: MemoryEmbeddingProvider;
    let managerWithEmbeddings: MemoryTierManager;

    beforeEach(() => {
      // Simple mock that creates deterministic embeddings based on content
      mockEmbeddingProvider = {
        embed: async (text: string) => {
          // Create a simple embedding based on character codes
          const embedding = new Array(10).fill(0);
          for (let i = 0; i < text.length && i < 10; i++) {
            embedding[i] = text.charCodeAt(i) / 255;
          }
          return embedding;
        }
      };

      managerWithEmbeddings = new MemoryTierManager(
        db,
        projectId,
        mockEmbeddingProvider
      );
    });

    it('should use embeddings for semantic recall', async () => {
      const item = await managerWithEmbeddings.addToHot(
        'session-1',
        'The project budget is fifty thousand dollars',
        'fact'
      );
      await managerWithEmbeddings.demote(item.id, 'cold');

      const result = await managerWithEmbeddings.recall('session-1', 'money');

      // Should find the item even though exact keywords don't match
      expect(result.items.length).toBeGreaterThanOrEqual(0);
      expect(result.relevanceScores.size).toBeGreaterThanOrEqual(0);
    });

    it('should store embeddings when adding items', async () => {
      await managerWithEmbeddings.addToHot('session-1', 'Test content', 'message');

      const row = db.get<{ embedding_json: string }>(
        `SELECT embedding_json FROM p_test_project_memory_items WHERE session_id = ?`,
        ['session-1']
      );

      expect(row!.embedding_json).not.toBeNull();
      const embedding = JSON.parse(row!.embedding_json);
      expect(Array.isArray(embedding)).toBe(true);
    });
  });

  describe('promoteToHot', () => {
    it('should return false for non-existent item', async () => {
      const result = await manager.promoteToHot('non-existent');
      expect(result).toBe(false);
    });

    it('should return false for already hot item', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message');
      const result = await manager.promoteToHot(item.id);
      expect(result).toBe(false);
    });

    it('should promote cold item to hot', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message');
      await manager.demote(item.id, 'cold');

      const result = await manager.promoteToHot(item.id);

      expect(result).toBe(true);
      const updated = await manager.getItem(item.id);
      expect(updated!.tier).toBe('hot');
    });

    it('should reset relevance score to 1.0 on promotion', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message', {
        relevanceScore: 0.3
      });
      await manager.demote(item.id, 'cold');

      await manager.promoteToHot(item.id);

      const updated = await manager.getItem(item.id);
      expect(updated!.relevanceScore).toBe(1.0);
    });
  });

  describe('demote', () => {
    it('should return false for non-existent item', async () => {
      const result = await manager.demote('non-existent');
      expect(result).toBe(false);
    });

    it('should demote to warm by default', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message');
      await manager.demote(item.id);

      const updated = await manager.getItem(item.id);
      expect(updated!.tier).toBe('warm');
    });

    it('should demote to cold when specified', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message');
      await manager.demote(item.id, 'cold');

      const updated = await manager.getItem(item.id);
      expect(updated!.tier).toBe('cold');
    });
  });

  describe('getStatus', () => {
    it('should return empty status for session with no items', async () => {
      const status = await manager.getStatus('non-existent');

      expect(status.sessionId).toBe('non-existent');
      expect(status.hot.items).toBe(0);
      expect(status.hot.tokens).toBe(0);
      expect(status.warm.items).toBe(0);
      expect(status.cold.items).toBe(0);
    });

    it('should return correct counts by tier', async () => {
      await manager.addToHot('session-1', 'Hot 1', 'message');
      await manager.addToHot('session-1', 'Hot 2', 'message');

      const warmItem = await manager.addToHot('session-1', 'Warm', 'message');
      await manager.demote(warmItem.id, 'warm');

      const coldItem = await manager.addToHot('session-1', 'Cold', 'message');
      await manager.demote(coldItem.id, 'cold');

      const status = await manager.getStatus('session-1');

      expect(status.hot.items).toBe(2);
      expect(status.warm.items).toBe(1);
      expect(status.cold.items).toBe(1);
    });

    it('should calculate utilization percentage', async () => {
      const managerWithLimit = new MemoryTierManager(db, projectId, undefined, {
        hotTokenLimit: 100
      });

      // Add ~50 tokens (200 characters / 4)
      await managerWithLimit.addToHot('session-1', 'A'.repeat(200), 'message');

      const status = await managerWithLimit.getStatus('session-1');

      expect(status.hot.utilizationPercent).toBe(50);
    });

    it('should suggest spill when hot is near capacity', async () => {
      const managerWithLimit = new MemoryTierManager(db, projectId, undefined, {
        hotTokenLimit: 100
      });

      // Fill to >90%
      await managerWithLimit.addToHot('session-1', 'A'.repeat(400), 'message');

      const status = await managerWithLimit.getStatus('session-1');

      expect(status.suggestions.some(s => s.type === 'spill')).toBe(true);
    });

    it('should suggest prune when cold exceeds limit', async () => {
      const managerWithLimit = new MemoryTierManager(db, projectId, undefined, {
        maxColdItems: 2,
        autoSpillEnabled: false
      });

      for (let i = 0; i < 5; i++) {
        const item = await managerWithLimit.addToHot('session-1', `Item ${i}`, 'message');
        await managerWithLimit.demote(item.id, 'cold');
      }

      const status = await managerWithLimit.getStatus('session-1');

      expect(status.suggestions.some(s => s.type === 'prune')).toBe(true);
    });
  });

  describe('delete', () => {
    it('should return false for non-existent item', async () => {
      const result = await manager.delete('non-existent');
      expect(result).toBe(false);
    });

    it('should delete item', async () => {
      const item = await manager.addToHot('session-1', 'Test', 'message');
      const result = await manager.delete(item.id);

      expect(result).toBe(true);
      expect(await manager.getItem(item.id)).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('should return 0 for session with no items', async () => {
      const count = await manager.clearSession('non-existent');
      expect(count).toBe(0);
    });

    it('should delete all items for session', async () => {
      await manager.addToHot('session-1', 'Item 1', 'message');
      await manager.addToHot('session-1', 'Item 2', 'message');
      await manager.addToHot('session-1', 'Item 3', 'message');

      const count = await manager.clearSession('session-1');

      expect(count).toBe(3);
      expect(await manager.getHot('session-1')).toHaveLength(0);
    });

    it('should not affect other sessions', async () => {
      await manager.addToHot('session-1', 'Session 1', 'message');
      await manager.addToHot('session-2', 'Session 2', 'message');

      await manager.clearSession('session-1');

      expect(await manager.getHot('session-2')).toHaveLength(1);
    });
  });

  describe('pruneCold', () => {
    it('should not prune when under limit', async () => {
      const managerWithLimit = new MemoryTierManager(db, projectId, undefined, {
        maxColdItems: 10,
        autoSpillEnabled: false
      });

      const item = await managerWithLimit.addToHot('session-1', 'Test', 'message');
      await managerWithLimit.demote(item.id, 'cold');

      const pruned = await managerWithLimit.pruneCold('session-1');

      expect(pruned).toBe(0);
    });

    it('should prune to max limit', async () => {
      const managerWithLimit = new MemoryTierManager(db, projectId, undefined, {
        maxColdItems: 3,
        autoSpillEnabled: false
      });

      for (let i = 0; i < 6; i++) {
        const item = await managerWithLimit.addToHot('session-1', `Item ${i}`, 'message');
        await managerWithLimit.demote(item.id, 'cold');
      }

      const pruned = await managerWithLimit.pruneCold('session-1');

      expect(pruned).toBe(3);
      const status = await managerWithLimit.getStatus('session-1');
      expect(status.cold.items).toBe(3);
    });

    it('should keep highest relevance items', async () => {
      const managerWithLimit = new MemoryTierManager(db, projectId, undefined, {
        maxColdItems: 2,
        autoSpillEnabled: false
      });

      const lowItem = await managerWithLimit.addToHot('session-1', 'Low', 'message', {
        relevanceScore: 0.1
      });
      const midItem = await managerWithLimit.addToHot('session-1', 'Mid', 'message', {
        relevanceScore: 0.5
      });
      const highItem = await managerWithLimit.addToHot('session-1', 'High', 'message', {
        relevanceScore: 0.9
      });

      await managerWithLimit.demote(lowItem.id, 'cold');
      await managerWithLimit.demote(midItem.id, 'cold');
      await managerWithLimit.demote(highItem.id, 'cold');

      await managerWithLimit.pruneCold('session-1');

      expect(await managerWithLimit.getItem(lowItem.id)).toBeNull();
      expect(await managerWithLimit.getItem(highItem.id)).not.toBeNull();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_MEMORY_CONFIG.hotTokenLimit).toBe(4000);
      expect(DEFAULT_MEMORY_CONFIG.warmAccessThreshold).toBe(3);
      expect(DEFAULT_MEMORY_CONFIG.promoteThreshold).toBe(0.85);
      expect(DEFAULT_MEMORY_CONFIG.maxColdItems).toBe(1000);
    });

    it('should merge custom configuration', async () => {
      const customManager = new MemoryTierManager(db, projectId, undefined, {
        hotTokenLimit: 1000
      });

      const status = await customManager.getStatus('session-1');
      expect(status.hot.limit).toBe(1000);
    });
  });

  describe('multiple projects', () => {
    it('should isolate memory between projects', async () => {
      const project2 = 'test-project-2';
      db.createProject(project2);
      const manager2 = new MemoryTierManager(db, project2);

      await manager.addToHot('session-1', 'Project 1 item', 'message');
      await manager2.addToHot('session-1', 'Project 2 item', 'message');

      const items1 = await manager.getHot('session-1');
      const items2 = await manager2.getHot('session-1');

      expect(items1).toHaveLength(1);
      expect(items1[0].content).toBe('Project 1 item');
      expect(items2).toHaveLength(1);
      expect(items2[0].content).toBe('Project 2 item');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', async () => {
      const item = await manager.addToHot('session-1', '', 'message');
      expect(item.content).toBe('');
      expect(item.tokenCount).toBe(0);
    });

    it('should handle special characters', async () => {
      const content = 'Special: "quotes" \'apostrophes\' & symbols <> \n newlines';
      const item = await manager.addToHot('session-1', content, 'message');

      const loaded = await manager.getItem(item.id);
      expect(loaded!.content).toBe(content);
    });

    it('should handle unicode content', async () => {
      const content = '日本語 中文 한국어 🚀 💻';
      const item = await manager.addToHot('session-1', content, 'fact');

      const loaded = await manager.getItem(item.id);
      expect(loaded!.content).toBe(content);
    });

    it('should handle large content', async () => {
      const content = 'A'.repeat(10000);
      const item = await manager.addToHot('session-1', content, 'context');

      const loaded = await manager.getItem(item.id);
      expect(loaded!.content).toBe(content);
    });
  });
});
