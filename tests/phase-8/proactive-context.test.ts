/**
 * Tests for ProactiveContextProvider (F8.4 - Proactive Context).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DatabaseConnection } from '../../src/db/connection';
import {
  ProactiveContextProvider,
  ProactiveContextSource,
  ProactiveQuery,
  SubscriptionInput
} from '../../src/agent';

describe('ProactiveContextProvider', () => {
  let db: DatabaseConnection;
  let provider: ProactiveContextProvider;
  let tempDir: string;
  const PROJECT_ID = 'test-proactive-project';
  const SESSION_ID = 'test-session-001';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-proactive-test-'));
    const dbPath = path.join(tempDir, 'test.db');

    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject(PROJECT_ID);

    provider = new ProactiveContextProvider(db, PROJECT_ID);
  });

  afterEach(async () => {
    await db.close();
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Suggestions', () => {
    it('should generate basic suggestions', async () => {
      const query: ProactiveQuery = {
        sessionId: SESSION_ID,
        currentFile: 'src/utils/helpers.ts'
      };

      const result = await provider.suggest(query);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^sug_/);
      expect(result.sessionId).toBe(SESSION_ID);
      expect(result.trigger.type).toBe('file_change');
      expect(result.trigger.source).toBe('src/utils/helpers.ts');
      expect(result.status).toBe('pending');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should use activity trigger when no file specified', async () => {
      const query: ProactiveQuery = {
        sessionId: SESSION_ID
      };

      const result = await provider.suggest(query);

      expect(result.trigger.type).toBe('activity');
      expect(result.trigger.source).toBe('session');
    });

    it('should generate suggestions from context source', async () => {
      const mockSource: ProactiveContextSource = {
        findRelated: jest.fn().mockResolvedValue([
          {
            id: 'dec_001',
            name: 'Use singleton pattern',
            type: 'decision',
            content: 'We decided to use singleton for config management',
            summary: 'Singleton pattern for config',
            score: 0.85
          },
          {
            id: 'doc_001',
            name: 'Config Guide',
            type: 'document',
            content: 'How to configure the application...',
            score: 0.75
          }
        ])
      };

      const providerWithSource = new ProactiveContextProvider(
        db,
        PROJECT_ID,
        mockSource,
        { minRelevanceScore: 0.6 }
      );

      const result = await providerWithSource.suggest({
        sessionId: SESSION_ID,
        currentFile: 'src/config/manager.ts',
        currentSymbol: 'ConfigManager'
      });

      expect(mockSource.findRelated).toHaveBeenCalled();
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should get suggestion by ID', async () => {
      const query: ProactiveQuery = {
        sessionId: SESSION_ID,
        currentFile: 'test.ts'
      };

      const created = await provider.suggest(query);
      const retrieved = await provider.getSuggestion(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.sessionId).toBe(SESSION_ID);
    });

    it('should return null for non-existent suggestion', async () => {
      const result = await provider.getSuggestion('sug_nonexistent');
      expect(result).toBeNull();
    });

    it('should get recent suggestions for session', async () => {
      // Create multiple suggestions
      await provider.suggest({ sessionId: SESSION_ID, currentFile: 'file1.ts' });
      await provider.suggest({ sessionId: SESSION_ID, currentFile: 'file2.ts' });
      await provider.suggest({ sessionId: SESSION_ID, currentFile: 'file3.ts' });

      const recent = await provider.getRecentSuggestions(SESSION_ID, 2);

      expect(recent.length).toBe(2);
      // Should limit to 2 results
      const sources = recent.map(r => r.trigger.source);
      expect(sources.every(s => ['file1.ts', 'file2.ts', 'file3.ts'].includes(s))).toBe(true);
    });
  });

  describe('Suggestion Status Updates', () => {
    let suggestionId: string;

    beforeEach(async () => {
      const result = await provider.suggest({
        sessionId: SESSION_ID,
        currentFile: 'test.ts'
      });
      suggestionId = result.id;
    });

    it('should mark suggestion as shown', async () => {
      const success = await provider.markShown(suggestionId);
      expect(success).toBe(true);

      const suggestion = await provider.getSuggestion(suggestionId);
      expect(suggestion!.status).toBe('shown');
    });

    it('should mark suggestion as used', async () => {
      const success = await provider.markUsed(suggestionId, 1);
      expect(success).toBe(true);

      const suggestion = await provider.getSuggestion(suggestionId);
      expect(suggestion!.status).toBe('used');
      expect(suggestion!.usedItemIndex).toBe(1);
    });

    it('should dismiss suggestion', async () => {
      const success = await provider.dismiss(suggestionId);
      expect(success).toBe(true);

      const suggestion = await provider.getSuggestion(suggestionId);
      expect(suggestion!.status).toBe('dismissed');
    });

    it('should return false for non-existent suggestion', async () => {
      const success = await provider.markShown('sug_nonexistent');
      expect(success).toBe(false);
    });
  });

  describe('Subscriptions', () => {
    it('should create a subscription', async () => {
      const input: SubscriptionInput = {
        sessionId: SESSION_ID,
        watchPatterns: [
          { type: 'file', pattern: 'src/**/*.ts', priority: 1 },
          { type: 'symbol', pattern: 'Config*', priority: 2 }
        ]
      };

      const subscription = await provider.subscribe(input);

      expect(subscription.id).toMatch(/^sub_/);
      expect(subscription.sessionId).toBe(SESSION_ID);
      expect(subscription.watchPatterns.length).toBe(2);
      expect(subscription.enabled).toBe(true);
      expect(subscription.callbackType).toBe('poll');
    });

    it('should get subscription by ID', async () => {
      const created = await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'file', pattern: '*.ts', priority: 1 }]
      });

      const retrieved = await provider.getSubscription(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return null for non-existent subscription', async () => {
      const result = await provider.getSubscription('sub_nonexistent');
      expect(result).toBeNull();
    });

    it('should get session subscriptions', async () => {
      await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'file', pattern: '*.ts', priority: 1 }]
      });
      await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'symbol', pattern: '*Manager', priority: 1 }]
      });
      await provider.subscribe({
        sessionId: 'other-session',
        watchPatterns: [{ type: 'file', pattern: '*.js', priority: 1 }]
      });

      const subscriptions = await provider.getSessionSubscriptions(SESSION_ID);

      expect(subscriptions.length).toBe(2);
      expect(subscriptions.every(s => s.sessionId === SESSION_ID)).toBe(true);
    });

    it('should update subscription', async () => {
      const subscription = await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'file', pattern: '*.ts', priority: 1 }]
      });

      const success = await provider.updateSubscription(subscription.id, {
        enabled: false,
        minRelevanceScore: 0.8
      });

      expect(success).toBe(true);

      const updated = await provider.getSubscription(subscription.id);
      expect(updated!.enabled).toBe(false);
      expect(updated!.minRelevanceScore).toBe(0.8);
    });

    it('should unsubscribe', async () => {
      const subscription = await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'file', pattern: '*.ts', priority: 1 }]
      });

      const success = await provider.unsubscribe(subscription.id);
      expect(success).toBe(true);

      const retrieved = await provider.getSubscription(subscription.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Trigger Checking', () => {
    it('should match file pattern triggers', async () => {
      await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'file', pattern: 'src/**/*.ts', priority: 1 }]
      });

      const matches = await provider.checkTrigger(SESSION_ID, {
        type: 'file',
        value: 'src/utils/helpers.ts'
      });

      expect(matches.length).toBe(1);
    });

    it('should not match non-matching patterns', async () => {
      await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'file', pattern: 'src/**/*.ts', priority: 1 }]
      });

      const matches = await provider.checkTrigger(SESSION_ID, {
        type: 'file',
        value: 'tests/test.js'
      });

      expect(matches.length).toBe(0);
    });

    it('should match symbol patterns', async () => {
      await provider.subscribe({
        sessionId: SESSION_ID,
        watchPatterns: [{ type: 'symbol', pattern: '*Manager', priority: 1 }]
      });

      const matches = await provider.checkTrigger(SESSION_ID, {
        type: 'symbol',
        value: 'ConfigManager'
      });

      expect(matches.length).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should track suggestion statistics', async () => {
      // Create suggestions with different statuses
      const sug1 = await provider.suggest({ sessionId: SESSION_ID, currentFile: 'a.ts' });
      const sug2 = await provider.suggest({ sessionId: SESSION_ID, currentFile: 'b.ts' });
      const sug3 = await provider.suggest({ sessionId: SESSION_ID, currentFile: 'c.ts' });
      await provider.suggest({ sessionId: SESSION_ID, currentFile: 'd.ts' });

      await provider.markShown(sug1.id);
      await provider.markUsed(sug2.id);
      await provider.dismiss(sug3.id);

      const stats = await provider.getStats(SESSION_ID);

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.shown).toBe(1);
      expect(stats.used).toBe(1);
      expect(stats.dismissed).toBe(1);
      expect(stats.useRate).toBeCloseTo(1 / 3, 2); // 1 used out of 3 interacted
    });

    it('should return empty stats for new session', async () => {
      const stats = await provider.getStats('new-session');

      expect(stats.total).toBe(0);
      expect(stats.useRate).toBe(0);
    });
  });

  describe('Clear Suggestions', () => {
    it('should clear suggestions for a session', async () => {
      await provider.suggest({ sessionId: SESSION_ID, currentFile: 'a.ts' });
      await provider.suggest({ sessionId: SESSION_ID, currentFile: 'b.ts' });
      await provider.suggest({ sessionId: 'other-session', currentFile: 'c.ts' });

      const cleared = await provider.clearSuggestions(SESSION_ID);

      expect(cleared).toBe(2);

      const remaining = await provider.getRecentSuggestions(SESSION_ID);
      expect(remaining.length).toBe(0);

      // Other session should still have its suggestions
      const otherRemaining = await provider.getRecentSuggestions('other-session');
      expect(otherRemaining.length).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async () => {
      const customProvider = new ProactiveContextProvider(
        db,
        PROJECT_ID,
        undefined,
        {
          maxSuggestions: 3,
          minRelevanceScore: 0.9,
          enableDecisions: false
        }
      );

      const result = await customProvider.suggest({
        sessionId: SESSION_ID,
        currentFile: 'test.ts'
      });

      // Should generate suggestion without errors
      expect(result).toBeDefined();
    });
  });
});
