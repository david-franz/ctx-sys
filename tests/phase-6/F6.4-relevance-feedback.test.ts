/**
 * F6.4 Relevance Feedback Tests
 *
 * IMPORTANT: These tests will fail until the following implementations are created:
 * - src/retrieval/feedback.ts (RelevanceFeedback, FeedbackTracker classes)
 * - src/retrieval/types.ts (Feedback, FeedbackType, FeedbackStats types)
 * - src/database/connection.ts (DatabaseConnection class)
 *
 * Tests for learning from context usefulness:
 * - Feedback signal recording
 * - Usage detection
 * - Score adjustment based on history
 * - Feedback statistics
 *
 * @see docs/phase-6/F6.4-relevance-feedback.md
 */

import { RelevanceFeedback, FeedbackTracker } from '../../src/retrieval/feedback';
import { Feedback, FeedbackType, FeedbackStats, ScoredResult } from '../../src/retrieval/types';
import { DatabaseConnection } from '../../src/db/connection';

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('../../src/db/connection');

const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;

describe('F6.4 Relevance Feedback', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let relevanceFeedback: RelevanceFeedback;
  let feedbackTracker: FeedbackTracker;
  const projectId = 'proj_123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked database instance
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<DatabaseConnection>;

    MockedDatabaseConnection.mockImplementation(() => mockDb);

    // Create real instances with mocked dependencies
    relevanceFeedback = new RelevanceFeedback(mockDb, projectId);
    feedbackTracker = new FeedbackTracker(mockDb, projectId);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // FeedbackSignal Interface Tests
  // ============================================================================

  describe('FeedbackSignal Interface', () => {
    it('should contain all required fields', () => {
      const signal: Feedback = {
        id: 'fb_123',
        queryId: 'query_123',
        entityId: 'entity_456',
        signal: 'used',
        timestamp: new Date()
      };

      expect(signal.id).toBeDefined();
      expect(signal.queryId).toBeDefined();
      expect(signal.entityId).toBeDefined();
      expect(signal.signal).toBe('used');
      expect(signal.timestamp).toBeInstanceOf(Date);
    });

    it('should support all feedback types', () => {
      const types: FeedbackType[] = ['used', 'ignored', 'explicit_positive', 'explicit_negative'];

      types.forEach(type => {
        const signal: Feedback = {
          id: `fb_${type}`,
          queryId: 'q1',
          entityId: 'e1',
          signal: type,
          timestamp: new Date()
        };

        expect(signal.signal).toBe(type);
      });
    });
  });

  // ============================================================================
  // FeedbackStats Interface Tests
  // ============================================================================

  describe('FeedbackStats Interface', () => {
    it('should contain all stats fields', () => {
      const stats: FeedbackStats = {
        entityId: 'entity_123',
        totalReturns: 100,
        usedCount: 70,
        ignoredCount: 25,
        positiveCount: 5,
        negativeCount: 2,
        useRate: 0.7
      };

      expect(stats.entityId).toBeDefined();
      expect(stats.totalReturns).toBe(100);
      expect(stats.usedCount).toBe(70);
      expect(stats.useRate).toBe(0.7);
    });

    it('should calculate use rate correctly', () => {
      const used = 70;
      const total = 100;
      const useRate = total > 0 ? used / total : 0.5;

      expect(useRate).toBe(0.7);
    });

    it('should handle zero total returns', () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 0,
        usedCount: 0,
        ignoredCount: 0,
        positiveCount: 0,
        negativeCount: 0,
        useRate: 0.5 // Default when no data
      };

      expect(stats.useRate).toBe(0.5);
    });
  });

  // ============================================================================
  // Feedback Recording Tests
  // ============================================================================

  describe('Feedback Recording', () => {
    it('should record a feedback signal', async () => {
      const signal = {
        queryId: 'query_123',
        entityId: 'entity_456',
        signal: 'used' as FeedbackType
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await relevanceFeedback.recordSignal(signal.queryId, signal.entityId, signal.signal);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining([signal.queryId, signal.entityId, signal.signal])
      );
    });

    it('should record batch of signals', async () => {
      const signals = [
        { entityId: 'e1', signal: 'used' as FeedbackType },
        { entityId: 'e2', signal: 'ignored' as FeedbackType },
        { entityId: 'e3', signal: 'used' as FeedbackType }
      ];

      mockDb.run.mockResolvedValue({ changes: 1 });

      await relevanceFeedback.recordBatch('query_1', signals);

      expect(mockDb.run).toHaveBeenCalledTimes(signals.length);
    });

    it('should store timestamp automatically', async () => {
      mockDb.get.mockResolvedValue({
        id: 'f1',
        query_id: 'q1',
        entity_id: 'e1',
        signal: 'used',
        created_at: new Date().toISOString()
      });

      const result = await relevanceFeedback.getSignal('f1');

      expect(result.created_at).toBeDefined();
    });
  });

  // ============================================================================
  // Feedback Statistics Tests
  // ============================================================================

  describe('Feedback Statistics', () => {
    it('should compute stats for an entity', async () => {
      mockDb.get.mockResolvedValue({
        total: 100,
        used: 70,
        ignored: 25,
        positive: 3,
        negative: 2
      });

      const stats = await feedbackTracker.getStats('entity_123');

      expect(stats.totalReturns).toBe(100);
      expect(stats.usedCount).toBe(70);
      expect(stats.useRate).toBe(0.7);
    });

    it('should handle entity with no feedback history', async () => {
      mockDb.get.mockResolvedValue({
        total: 0,
        used: 0,
        ignored: 0,
        positive: 0,
        negative: 0
      });

      const stats = await feedbackTracker.getStats('new_entity');

      expect(stats.totalReturns).toBe(0);
      expect(stats.useRate).toBe(0.5); // Default when no data
    });
  });

  // ============================================================================
  // Score Adjustment Tests
  // ============================================================================

  describe('Score Adjustment', () => {
    it('should boost score for high use rate', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 90,
        ignoredCount: 10,
        positiveCount: 0,
        negativeCount: 0,
        useRate: 0.9
      };

      mockDb.get.mockResolvedValue({
        total: 100,
        used: 90,
        ignored: 10,
        positive: 0,
        negative: 0
      });

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeCloseTo(1.4, 1); // 0.5 + 0.9
    });

    it('should reduce score for low use rate', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 20,
        ignoredCount: 80,
        positiveCount: 0,
        negativeCount: 0,
        useRate: 0.2
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      expect(multiplier).toBeLessThan(1.0);
      expect(multiplier).toBeCloseTo(0.7, 1); // 0.5 + 0.2
    });

    it('should boost for explicit positive feedback', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 50,
        usedCount: 25,
        ignoredCount: 22,
        positiveCount: 3,
        negativeCount: 0,
        useRate: 0.5
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      // Base: 0.5 + 0.5 = 1.0, plus 0.1 * 3 = 0.3
      expect(multiplier).toBeCloseTo(1.3, 1);
    });

    it('should reduce for explicit negative feedback', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 50,
        usedCount: 25,
        ignoredCount: 20,
        positiveCount: 0,
        negativeCount: 3,
        useRate: 0.5
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      // Base: 0.5 + 0.5 = 1.0, minus 0.15 * 3 = 0.45
      expect(multiplier).toBeCloseTo(0.55, 1);
    });

    it('should cap positive feedback effect', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 90,
        ignoredCount: 0,
        positiveCount: 10, // More than cap of 3
        negativeCount: 0,
        useRate: 0.9
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      // Should cap at 3 positive: 0.5 + 0.9 + 0.3 = 1.7 (max)
      expect(multiplier).toBe(1.7);
    });

    it('should cap negative feedback effect', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 10,
        ignoredCount: 80,
        positiveCount: 0,
        negativeCount: 10, // More than cap of 3
        useRate: 0.1
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      // 0.5 + 0.1 - 0.45 = 0.15, clamped to 0.3
      expect(multiplier).toBe(0.3);
    });

    it('should not adjust with insufficient data', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 3, // Less than threshold of 5
        usedCount: 1,
        ignoredCount: 2,
        positiveCount: 0,
        negativeCount: 0,
        useRate: 0.33
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      expect(multiplier).toBe(1.0);
    });

    it('should re-sort results after adjustment', async () => {
      const results: ScoredResult[] = [
        { entityId: 'e1', score: 0.9 },
        { entityId: 'e2', score: 0.8 },
        { entityId: 'e3', score: 0.7 }
      ];

      // Mock stats for each entity
      mockDb.get
        .mockResolvedValueOnce({ total: 10, used: 2, ignored: 8, positive: 0, negative: 0 })  // e1: low use
        .mockResolvedValueOnce({ total: 10, used: 9, ignored: 1, positive: 0, negative: 0 })  // e2: high use
        .mockResolvedValueOnce({ total: 10, used: 5, ignored: 5, positive: 0, negative: 0 }); // e3: medium use

      const adjusted = await relevanceFeedback.adjustScores(results);

      // e2 should now be first due to high use rate boost
      expect(adjusted[0].entityId).toBe('e2');
    });
  });

  // ============================================================================
  // Usage Detection Tests
  // ============================================================================

  describe('Usage Detection', () => {
    it('should detect entity name in response', () => {
      const entityNames = ['AuthService', 'UserService', 'login'];
      const response = 'The AuthService class handles user authentication. The login function validates credentials.';

      const usage = feedbackTracker.detectUsage(entityNames, response);

      expect(usage.get('AuthService')).toBe(true);
      expect(usage.get('login')).toBe(true);
      expect(usage.get('UserService')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const entityNames = ['AuthService'];
      const response = 'The authservice handles authentication';

      const usage = feedbackTracker.detectUsage(entityNames, response);

      expect(usage.get('AuthService')).toBe(true);
    });

    it('should handle empty response', () => {
      const entityNames = ['AuthService'];
      const response = '';

      const usage = feedbackTracker.detectUsage(entityNames, response);

      expect(usage.get('AuthService')).toBe(false);
    });

    it('should handle special characters in names', () => {
      const entityNames = ['get_user_by_id', 'validateInput'];
      const response = 'Call get_user_by_id to fetch user data, then validateInput for the form';

      const usage = feedbackTracker.detectUsage(entityNames, response);

      expect(usage.get('get_user_by_id')).toBe(true);
      expect(usage.get('validateInput')).toBe(true);
    });
  });

  // ============================================================================
  // Explicit Feedback Tests
  // ============================================================================

  describe('Explicit Feedback', () => {
    it('should record positive feedback', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await relevanceFeedback.recordExplicitFeedback('q1', 'e1', 'explicit_positive');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['q1', 'e1', 'explicit_positive'])
      );
    });

    it('should record negative feedback', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await relevanceFeedback.recordExplicitFeedback('q1', 'e1', 'explicit_negative');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.arrayContaining(['q1', 'e1', 'explicit_negative'])
      );
    });

    it('should distinguish explicit from implicit feedback', () => {
      const signals: FeedbackType[] = ['used', 'ignored', 'explicit_positive', 'explicit_negative'];

      const implicit = signals.filter(s => s === 'used' || s === 'ignored');
      const explicit = signals.filter(s => s.startsWith('explicit_'));

      expect(implicit).toHaveLength(2);
      expect(explicit).toHaveLength(2);
    });
  });

  // ============================================================================
  // Feedback Table Tests
  // ============================================================================

  describe('Feedback Table', () => {
    it('should create table with correct schema', async () => {
      mockDb.exec.mockResolvedValue(undefined);

      await relevanceFeedback.initialize();

      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS')
      );
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('id TEXT PRIMARY KEY')
      );
    });

    it('should create index on entity_id', async () => {
      mockDb.exec.mockResolvedValue(undefined);

      await relevanceFeedback.initialize();

      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX')
      );
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle entity with all positive feedback', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 100,
        ignoredCount: 0,
        positiveCount: 5,
        negativeCount: 0,
        useRate: 1.0
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      expect(multiplier).toBe(1.7); // Max clamped value
    });

    it('should handle entity with all negative feedback', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 0,
        ignoredCount: 95,
        positiveCount: 0,
        negativeCount: 5,
        useRate: 0.0
      };

      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      expect(multiplier).toBe(0.3); // Min clamped value
    });

    it('should handle mixed explicit feedback', async () => {
      const stats: FeedbackStats = {
        entityId: 'e1',
        totalReturns: 100,
        usedCount: 50,
        ignoredCount: 45,
        positiveCount: 3,
        negativeCount: 2,
        useRate: 0.5
      };

      // Base: 0.5 + 0.5 = 1.0
      // Plus positive: +0.3
      // Minus negative: -0.3
      // Net: 1.0
      const multiplier = relevanceFeedback.calculateMultiplier(stats);

      expect(multiplier).toBe(1.0);
    });

    it('should handle concurrent feedback recording', async () => {
      const signals = Array(10).fill(null).map((_, i) => ({
        entityId: `e${i % 3}`,
        signal: (i % 2 === 0 ? 'used' : 'ignored') as FeedbackType
      }));

      mockDb.run.mockResolvedValue({ changes: 1 });

      await relevanceFeedback.recordBatch('q1', signals);

      expect(mockDb.run).toHaveBeenCalledTimes(10);
    });

    it('should handle very old feedback', async () => {
      const oldDate = new Date('2020-01-01');

      mockDb.all.mockResolvedValue([
        { signal: 'used', created_at: oldDate.toISOString() },
        { signal: 'used', created_at: new Date().toISOString() }
      ]);

      const results = await feedbackTracker.getAllSignals('e1');

      expect(results).toHaveLength(2);
    });
  });
});
