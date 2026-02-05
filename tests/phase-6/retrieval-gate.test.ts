/**
 * Tests for F6.6 - Retrieval Gating
 */

import {
  RetrievalGate,
  GateModelProvider,
  GateDecision,
  GateContext,
  GateConfig,
  MockGateModelProvider,
  DEFAULT_GATE_CONFIG
} from '../../src/retrieval';

describe('RetrievalGate', () => {
  let gate: RetrievalGate;
  let mockProvider: MockGateModelProvider;

  beforeEach(() => {
    mockProvider = new MockGateModelProvider();
    gate = new RetrievalGate(mockProvider);
  });

  describe('DEFAULT_GATE_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_GATE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_GATE_CONFIG.confidenceThreshold).toBe(0.7);
      expect(DEFAULT_GATE_CONFIG.maxInputTokens).toBe(500);
      expect(DEFAULT_GATE_CONFIG.cacheDecisions).toBe(true);
      expect(DEFAULT_GATE_CONFIG.cacheTTLSeconds).toBe(300);
    });
  });

  describe('gate disabled', () => {
    it('should always retrieve when gate is disabled', async () => {
      const disabledGate = new RetrievalGate(mockProvider, {
        ...DEFAULT_GATE_CONFIG,
        enabled: false
      });

      const decision = await disabledGate.shouldRetrieve({
        query: 'hello'
      });

      expect(decision.shouldRetrieve).toBe(true);
      expect(decision.confidence).toBe(1);
      expect(decision.reason).toContain('disabled');
    });
  });

  describe('fast path decisions', () => {
    describe('entity mentions', () => {
      it('should retrieve when query mentions specific code entities', async () => {
        const decision = await gate.shouldRetrieve({
          query: 'How does `UserService` work?'
        });

        expect(decision.shouldRetrieve).toBe(true);
        expect(decision.confidence).toBeGreaterThanOrEqual(0.9);
        expect(decision.suggestedStrategy).toBe('keyword');
      });

      it('should retrieve when query mentions files', async () => {
        const decision = await gate.shouldRetrieve({
          query: 'What is in `config.ts`?'
        });

        expect(decision.shouldRetrieve).toBe(true);
        expect(decision.suggestedStrategy).toBe('keyword');
      });
    });

    describe('project-specific intents', () => {
      it('should retrieve for find intent', async () => {
        const decision = await gate.shouldRetrieve({
          query: 'Find all authentication handlers'
        });

        expect(decision.shouldRetrieve).toBe(true);
        expect(decision.confidence).toBeGreaterThanOrEqual(0.9);
        expect(decision.reason).toContain('find');
      });

      it('should retrieve for list intent', async () => {
        const decision = await gate.shouldRetrieve({
          query: 'List all exported functions'
        });

        expect(decision.shouldRetrieve).toBe(true);
        expect(decision.suggestedStrategy).toBe('semantic');
      });

      it('should retrieve for debug intent with graph strategy', async () => {
        const decision = await gate.shouldRetrieve({
          query: 'Debug why this crashes'
        });

        expect(decision.shouldRetrieve).toBe(true);
        expect(decision.suggestedStrategy).toBe('graph');
      });
    });

    describe('greetings', () => {
      it('should not retrieve for simple greetings', async () => {
        const greetings = ['hi', 'Hello', 'hey', 'good morning', 'Good afternoon'];

        for (const greeting of greetings) {
          const decision = await gate.shouldRetrieve({ query: greeting });
          expect(decision.shouldRetrieve).toBe(false);
          expect(decision.confidence).toBeGreaterThanOrEqual(0.99);
          expect(decision.reason).toContain('Greeting');
        }
      });

      it('should not retrieve for thanks', async () => {
        const thanks = ['thanks', 'thank you', 'ty', 'thx'];

        for (const thank of thanks) {
          const decision = await gate.shouldRetrieve({ query: thank });
          expect(decision.shouldRetrieve).toBe(false);
        }
      });
    });

    describe('confirmations', () => {
      it('should not retrieve for yes/no confirmations', async () => {
        const confirmations = ['yes', 'no', 'okay', 'ok', 'sure', 'yep', 'nope'];

        for (const confirmation of confirmations) {
          const decision = await gate.shouldRetrieve({ query: confirmation });
          expect(decision.shouldRetrieve).toBe(false);
          expect(decision.reason).toContain('Confirmation');
        }
      });
    });

    describe('basic queries', () => {
      it('should not retrieve for math questions', async () => {
        const decision = await gate.shouldRetrieve({
          query: "what's 2 + 2"
        });

        expect(decision.shouldRetrieve).toBe(false);
        expect(decision.reason).toContain('Basic query');
      });

      it('should not retrieve for math expressions', async () => {
        const decision = await gate.shouldRetrieve({
          query: '5 + 3 * 2'
        });

        expect(decision.shouldRetrieve).toBe(false);
      });
    });

    describe('general programming questions', () => {
      it('should not retrieve for concept explanations', async () => {
        const decision = await gate.shouldRetrieve({
          query: "What's the difference between var, let, and const?"
        });

        expect(decision.shouldRetrieve).toBe(false);
      });

      it('should not retrieve for general language questions', async () => {
        const decision = await gate.shouldRetrieve({
          query: 'What is the difference between let and const?'
        });

        expect(decision.shouldRetrieve).toBe(false);
      });

      it('should handle project references via model', async () => {
        // When a query has project references, it goes to model
        // MockGateModelProvider returns based on patterns
        const decision = await gate.shouldRetrieve({
          query: 'How does authentication work in our codebase?'
        });

        // MockGateModelProvider returns true for "auth" queries
        expect(decision.shouldRetrieve).toBe(true);
        expect(decision.reason).toContain('authentication');
      });
    });
  });

  describe('model-based decisions', () => {
    it('should use model provider for ambiguous queries', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'How does the authentication system work?'
      });

      // MockGateModelProvider returns shouldRetrieve=true for auth queries
      expect(decision.shouldRetrieve).toBe(true);
      expect(decision.reason).toContain('authentication');
    });

    it('should not retrieve for general questions via model', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'What is a general programming concept?'
      });

      // MockGateModelProvider returns shouldRetrieve=false for general questions
      expect(decision.shouldRetrieve).toBe(false);
    });

    it('should include project context in prompt', async () => {
      let capturedPrompt = '';
      const capturingProvider: GateModelProvider = {
        complete: async (options) => {
          capturedPrompt = options.prompt;
          return { text: JSON.stringify({ shouldRetrieve: true, confidence: 0.8, reason: 'test' }) };
        }
      };

      const gateWithCapture = new RetrievalGate(capturingProvider);
      await gateWithCapture.shouldRetrieve({
        query: 'test query',
        projectDescription: 'A code indexing system',
        availableEntityTypes: ['function', 'class', 'file']
      });

      expect(capturedPrompt).toContain('A code indexing system');
      expect(capturedPrompt).toContain('function, class, file');
    });

    it('should handle model errors gracefully', async () => {
      const errorProvider: GateModelProvider = {
        complete: async () => {
          throw new Error('Model unavailable');
        }
      };

      const gateWithError = new RetrievalGate(errorProvider);
      const decision = await gateWithError.shouldRetrieve({
        query: 'How does auth work?'
      });

      // Should default to retrieving on error
      expect(decision.shouldRetrieve).toBe(true);
      expect(decision.confidence).toBe(0.5);
      expect(decision.reason).toContain('Model error');
    });

    it('should handle malformed JSON response', async () => {
      const badProvider: GateModelProvider = {
        complete: async () => ({ text: 'not valid json' })
      };

      const gateWithBad = new RetrievalGate(badProvider);
      const decision = await gateWithBad.shouldRetrieve({
        query: 'How does auth work?'
      });

      expect(decision.shouldRetrieve).toBe(true);
      expect(decision.reason).toContain('Failed to parse');
    });
  });

  describe('caching', () => {
    it('should cache decisions', async () => {
      let callCount = 0;
      const countingProvider: GateModelProvider = {
        complete: async () => {
          callCount++;
          return { text: JSON.stringify({ shouldRetrieve: true, confidence: 0.8, reason: 'test' }) };
        }
      };

      const cachingGate = new RetrievalGate(countingProvider);

      await cachingGate.shouldRetrieve({ query: 'test query' });
      await cachingGate.shouldRetrieve({ query: 'test query' });
      await cachingGate.shouldRetrieve({ query: 'test query' });

      // Should only call model once due to caching
      expect(callCount).toBe(1);
    });

    it('should return cached decision', async () => {
      const decision1 = await gate.shouldRetrieve({
        query: 'How does authentication work?'
      });

      const decision2 = await gate.shouldRetrieve({
        query: 'How does authentication work?'
      });

      expect(decision1).toEqual(decision2);
    });

    it('should respect cache TTL', async () => {
      const shortTTLConfig: GateConfig = {
        ...DEFAULT_GATE_CONFIG,
        cacheTTLSeconds: 0.001 // Very short TTL for testing
      };

      let callCount = 0;
      const countingProvider: GateModelProvider = {
        complete: async () => {
          callCount++;
          return { text: JSON.stringify({ shouldRetrieve: true, confidence: 0.8, reason: 'test' }) };
        }
      };

      const shortTTLGate = new RetrievalGate(countingProvider, shortTTLConfig);

      await shortTTLGate.shouldRetrieve({ query: 'test query' });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await shortTTLGate.shouldRetrieve({ query: 'test query' });

      expect(callCount).toBe(2);
    });

    it('should not cache when disabled', async () => {
      let callCount = 0;
      const countingProvider: GateModelProvider = {
        complete: async () => {
          callCount++;
          return { text: JSON.stringify({ shouldRetrieve: true, confidence: 0.8, reason: 'test' }) };
        }
      };

      const noCacheGate = new RetrievalGate(countingProvider, {
        ...DEFAULT_GATE_CONFIG,
        cacheDecisions: false
      });

      await noCacheGate.shouldRetrieve({ query: 'test query' });
      await noCacheGate.shouldRetrieve({ query: 'test query' });

      expect(callCount).toBe(2);
    });

    it('should clear cache', async () => {
      await gate.shouldRetrieve({ query: 'test1' });
      await gate.shouldRetrieve({ query: 'test2' });

      const statsBefore = gate.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);

      gate.clearCache();

      const statsAfter = gate.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    it('should report cache statistics', async () => {
      // Start with empty cache
      gate.clearCache();

      await gate.shouldRetrieve({ query: 'query1' });
      await gate.shouldRetrieve({ query: 'query2' });

      const stats = gate.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
      expect(stats.entries).toContain('query1');
      expect(stats.entries).toContain('query2');
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = gate.getConfig();
      expect(config.enabled).toBe(DEFAULT_GATE_CONFIG.enabled);
      expect(config.confidenceThreshold).toBe(DEFAULT_GATE_CONFIG.confidenceThreshold);
    });

    it('should update configuration', () => {
      gate.updateConfig({ confidenceThreshold: 0.9 });
      const config = gate.getConfig();
      expect(config.confidenceThreshold).toBe(0.9);
    });

    it('should not allow mutation through getConfig', () => {
      const config = gate.getConfig();
      config.confidenceThreshold = 0.1;

      const freshConfig = gate.getConfig();
      expect(freshConfig.confidenceThreshold).toBe(DEFAULT_GATE_CONFIG.confidenceThreshold);
    });
  });

  describe('no model provider', () => {
    it('should default to retrieve without model provider', async () => {
      const noModelGate = new RetrievalGate();

      const decision = await noModelGate.shouldRetrieve({
        query: 'How does this complex system work?'
      });

      expect(decision.shouldRetrieve).toBe(true);
      expect(decision.confidence).toBe(0.5);
      expect(decision.reason).toContain('No model provider');
    });

    it('should still use fast path without model provider', async () => {
      const noModelGate = new RetrievalGate();

      // Greeting should use fast path
      const greetingDecision = await noModelGate.shouldRetrieve({
        query: 'hello'
      });
      expect(greetingDecision.shouldRetrieve).toBe(false);

      // Entity mention should use fast path
      const entityDecision = await noModelGate.shouldRetrieve({
        query: 'What does `MyClass` do?'
      });
      expect(entityDecision.shouldRetrieve).toBe(true);
    });
  });

  describe('MockGateModelProvider', () => {
    it('should return retrieve=true for authentication queries', async () => {
      const result = await mockProvider.complete({
        prompt: 'Query about authentication handling'
      });

      const parsed = JSON.parse(result.text);
      expect(parsed.shouldRetrieve).toBe(true);
      expect(parsed.suggestedStrategy).toBe('semantic');
    });

    it('should return retrieve=false for general questions', async () => {
      const result = await mockProvider.complete({
        prompt: 'general JavaScript question'
      });

      const parsed = JSON.parse(result.text);
      expect(parsed.shouldRetrieve).toBe(false);
    });

    it('should return low confidence for ambiguous queries', async () => {
      const result = await mockProvider.complete({
        prompt: 'some ambiguous query'
      });

      const parsed = JSON.parse(result.text);
      expect(parsed.confidence).toBeLessThan(0.7);
    });
  });

  describe('strategy suggestions', () => {
    it('should suggest keyword strategy for entity mentions', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'Show me `DatabaseConnection`'
      });

      expect(decision.suggestedStrategy).toBe('keyword');
    });

    it('should suggest semantic strategy for find/list intents', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'List all utility functions'
      });

      expect(decision.suggestedStrategy).toBe('semantic');
    });

    it('should suggest graph strategy for debug intent', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'Debug the connection issue'
      });

      expect(decision.suggestedStrategy).toBe('graph');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', async () => {
      const decision = await gate.shouldRetrieve({ query: '' });

      // Empty query should go to model (or default) since it doesn't match patterns
      expect(decision).toBeDefined();
    });

    it('should handle very long query', async () => {
      const longQuery = 'How does '.repeat(100) + 'authentication work?';
      const decision = await gate.shouldRetrieve({ query: longQuery });

      expect(decision).toBeDefined();
      expect(decision.shouldRetrieve).toBe(true);
    });

    it('should handle special characters in query', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'What does `/api/users/:id` endpoint do?'
      });

      expect(decision).toBeDefined();
    });

    it('should handle unicode in query', async () => {
      const decision = await gate.shouldRetrieve({
        query: 'Где находится функция авторизации?'
      });

      expect(decision).toBeDefined();
    });
  });
});
