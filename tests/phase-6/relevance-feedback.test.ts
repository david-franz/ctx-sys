import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../../src/db/connection';
import { EntityStore } from '../../src/entities';
import { RelevanceFeedback, FeedbackType } from '../../src/retrieval';

describe('F6.4 - Relevance Feedback', () => {
  let db: DatabaseConnection;
  let entityStore: EntityStore;
  let feedback: RelevanceFeedback;
  let testDbPath: string;
  const projectId = 'test-project';

  beforeEach(async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-feedback-test-'));
    testDbPath = path.join(testDir, 'test.db');
    db = new DatabaseConnection(testDbPath);
    await db.initialize();
    db.createProject(projectId);

    entityStore = new EntityStore(db, projectId);
    feedback = new RelevanceFeedback(db, projectId, entityStore);
  });

  afterEach(() => {
    db.close();
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Recording Feedback', () => {
    it('should record a single feedback signal', () => {
      feedback.record({
        queryId: 'query-1',
        entityId: 'entity-1',
        signal: 'used'
      });

      expect(feedback.count()).toBe(1);
    });

    it('should record multiple feedback signals', () => {
      feedback.record({ queryId: 'q1', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q1', entityId: 'e2', signal: 'ignored' });
      feedback.record({ queryId: 'q2', entityId: 'e1', signal: 'explicit_positive' });

      expect(feedback.count()).toBe(3);
    });

    it('should record batch feedback', () => {
      feedback.recordBatch('query-1', [
        { entityId: 'e1', signal: 'used' },
        { entityId: 'e2', signal: 'ignored' },
        { entityId: 'e3', signal: 'used' }
      ]);

      expect(feedback.count()).toBe(3);
    });

    it('should record explicit positive feedback', () => {
      feedback.recordExplicit('query-1', 'entity-1', true, 'Very helpful!');

      const stats = feedback.getStats('entity-1');
      expect(stats.positiveCount).toBe(1);
    });

    it('should record explicit negative feedback', () => {
      feedback.recordExplicit('query-1', 'entity-1', false, 'Not relevant');

      const stats = feedback.getStats('entity-1');
      expect(stats.negativeCount).toBe(1);
    });
  });

  describe('Feedback Statistics', () => {
    it('should compute correct statistics', () => {
      // Record various feedback for an entity
      feedback.record({ queryId: 'q1', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q2', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q3', entityId: 'e1', signal: 'ignored' });
      feedback.record({ queryId: 'q4', entityId: 'e1', signal: 'explicit_positive' });
      feedback.record({ queryId: 'q5', entityId: 'e1', signal: 'explicit_negative' });

      const stats = feedback.getStats('e1');

      expect(stats.totalReturns).toBe(5);
      expect(stats.usedCount).toBe(2);
      expect(stats.ignoredCount).toBe(1);
      expect(stats.positiveCount).toBe(1);
      expect(stats.negativeCount).toBe(1);
      expect(stats.useRate).toBeCloseTo(0.4); // 2/5
    });

    it('should return default stats for unknown entity', () => {
      const stats = feedback.getStats('unknown-entity');

      expect(stats.totalReturns).toBe(0);
      expect(stats.usedCount).toBe(0);
      expect(stats.useRate).toBe(0.5); // Default when no data
    });

    it('should track stats per entity', () => {
      feedback.record({ queryId: 'q1', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q1', entityId: 'e2', signal: 'ignored' });

      const stats1 = feedback.getStats('e1');
      const stats2 = feedback.getStats('e2');

      expect(stats1.usedCount).toBe(1);
      expect(stats1.ignoredCount).toBe(0);
      expect(stats2.usedCount).toBe(0);
      expect(stats2.ignoredCount).toBe(1);
    });
  });

  describe('Score Adjustment', () => {
    it('should not adjust scores with insufficient data', () => {
      // Only 3 feedback records (below threshold of 5)
      feedback.record({ queryId: 'q1', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q2', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q3', entityId: 'e1', signal: 'used' });

      const results = [{ entityId: 'e1', score: 1.0 }];
      const adjusted = feedback.adjustScores(results);

      expect(adjusted[0].adjustment).toBe(1.0); // No adjustment
      expect(adjusted[0].score).toBe(1.0);
    });

    it('should boost scores for frequently used entities', () => {
      // Record 5 "used" signals
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'used' });
      }

      const results = [{ entityId: 'e1', score: 1.0 }];
      const adjusted = feedback.adjustScores(results);

      // With 100% use rate, multiplier should be 1.5 (0.5 + 1.0)
      expect(adjusted[0].adjustment).toBeCloseTo(1.5);
      expect(adjusted[0].score).toBeCloseTo(1.5);
    });

    it('should reduce scores for frequently ignored entities', () => {
      // Record 5 "ignored" signals
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'ignored' });
      }

      const results = [{ entityId: 'e1', score: 1.0 }];
      const adjusted = feedback.adjustScores(results);

      // With 0% use rate, multiplier should be 0.5 (0.5 + 0)
      expect(adjusted[0].adjustment).toBeCloseTo(0.5);
      expect(adjusted[0].score).toBeCloseTo(0.5);
    });

    it('should boost scores for positive explicit feedback', () => {
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'explicit_positive' });
      }

      const results = [{ entityId: 'e1', score: 1.0 }];
      const adjusted = feedback.adjustScores(results);

      // Should have bonus from explicit positive
      expect(adjusted[0].adjustment).toBeGreaterThan(0.5);
    });

    it('should reduce scores for negative explicit feedback', () => {
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'explicit_negative' });
      }

      const results = [{ entityId: 'e1', score: 1.0 }];
      const adjusted = feedback.adjustScores(results);

      // Should have penalty from explicit negative
      expect(adjusted[0].adjustment).toBeLessThan(0.5);
    });

    it('should re-sort results after adjustment', () => {
      // Entity 1: frequently ignored
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}a`, entityId: 'e1', signal: 'ignored' });
      }
      // Entity 2: frequently used
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}b`, entityId: 'e2', signal: 'used' });
      }

      const results = [
        { entityId: 'e1', score: 1.0 },  // Higher original score
        { entityId: 'e2', score: 0.8 }   // Lower original score
      ];

      const adjusted = feedback.adjustScores(results);

      // After adjustment, e2 should be first (boosted) and e1 second (reduced)
      expect(adjusted[0].entityId).toBe('e2');
      expect(adjusted[1].entityId).toBe('e1');
    });

    it('should clamp multipliers to reasonable range', () => {
      // Extreme case: 10 positive and all used
      for (let i = 0; i < 10; i++) {
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'used' });
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'explicit_positive' });
      }

      const results = [{ entityId: 'e1', score: 1.0 }];
      const adjusted = feedback.adjustScores(results);

      // Should be clamped to max 1.7
      expect(adjusted[0].adjustment).toBeLessThanOrEqual(1.7);
    });
  });

  describe('Query Feedback Retrieval', () => {
    it('should retrieve feedback for a query', () => {
      feedback.recordBatch('query-1', [
        { entityId: 'e1', signal: 'used' },
        { entityId: 'e2', signal: 'ignored' }
      ]);

      const queryFeedback = feedback.getQueryFeedback('query-1');

      expect(queryFeedback.length).toBe(2);
      expect(queryFeedback[0].queryId).toBe('query-1');
    });

    it('should return empty for unknown query', () => {
      const queryFeedback = feedback.getQueryFeedback('unknown-query');
      expect(queryFeedback.length).toBe(0);
    });
  });

  describe('Usage Detection', () => {
    it('should detect usage when entity name appears in response', async () => {
      // Create an entity
      const entity = await entityStore.create({
        name: 'processUserData',
        type: 'function',
        content: 'function processUserData() { ... }'
      });

      const result = await feedback.detectUsage(
        'query-1',
        [entity.id],
        'The processUserData function handles all user data processing.'
      );

      expect(result.used).toContain(entity.id);
      expect(result.ignored.length).toBe(0);
    });

    it('should detect ignore when entity is not used', async () => {
      const entity = await entityStore.create({
        name: 'unusedFunction',
        type: 'function',
        content: 'function unusedFunction() { ... }'
      });

      const result = await feedback.detectUsage(
        'query-1',
        [entity.id],
        'This response does not mention any functions.'
      );

      expect(result.ignored).toContain(entity.id);
      expect(result.used.length).toBe(0);
    });

    it('should record feedback after detection', async () => {
      const entity = await entityStore.create({
        name: 'testFunc',
        type: 'function',
        content: 'function testFunc() { return 42; }'
      });

      await feedback.detectUsage(
        'query-1',
        [entity.id],
        'The testFunc returns the answer.'
      );

      expect(feedback.count()).toBe(1);
      const stats = feedback.getStats(entity.id);
      expect(stats.usedCount).toBe(1);
    });
  });

  describe('Top Entities', () => {
    it('should get most helpful entities', () => {
      // Entity 1: very helpful
      feedback.recordBatch('q1', [
        { entityId: 'e1', signal: 'used' },
        { entityId: 'e1', signal: 'explicit_positive' }
      ]);

      // Entity 2: somewhat helpful
      feedback.record({ queryId: 'q2', entityId: 'e2', signal: 'used' });

      // Entity 3: not helpful
      feedback.record({ queryId: 'q3', entityId: 'e3', signal: 'ignored' });

      const helpful = feedback.getMostHelpful(10);

      expect(helpful.length).toBeGreaterThanOrEqual(1);
      expect(helpful[0].entityId).toBe('e1'); // Most helpful first
    });

    it('should get most ignored entities', () => {
      // Entity 1: frequently ignored
      for (let i = 0; i < 5; i++) {
        feedback.record({ queryId: `q${i}`, entityId: 'e1', signal: 'ignored' });
      }

      // Entity 2: sometimes ignored
      for (let i = 0; i < 5; i++) {
        feedback.record({
          queryId: `q${i + 5}`,
          entityId: 'e2',
          signal: i < 2 ? 'ignored' : 'used'
        });
      }

      const ignored = feedback.getMostIgnored(10);

      expect(ignored.length).toBeGreaterThanOrEqual(1);
      expect(ignored[0].entityId).toBe('e1'); // Most ignored first
      expect(ignored[0].ignoreRate).toBe(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle clear operation', () => {
      feedback.record({ queryId: 'q1', entityId: 'e1', signal: 'used' });
      feedback.record({ queryId: 'q2', entityId: 'e2', signal: 'ignored' });

      expect(feedback.count()).toBe(2);

      feedback.clear();

      expect(feedback.count()).toBe(0);
    });

    it('should handle feedback without entity store', async () => {
      const feedbackWithoutStore = new RelevanceFeedback(db, projectId);

      const result = await feedbackWithoutStore.detectUsage(
        'query-1',
        ['entity-1'],
        'Some response content'
      );

      // Without entity store, assumes used
      expect(result.used).toContain('entity-1');
    });

    it('should handle empty batch', () => {
      feedback.recordBatch('query-1', []);
      expect(feedback.count()).toBe(0);
    });

    it('should handle detection with no entities', async () => {
      const result = await feedback.detectUsage('query-1', [], 'Response');
      expect(result.used.length).toBe(0);
      expect(result.ignored.length).toBe(0);
    });
  });
});
