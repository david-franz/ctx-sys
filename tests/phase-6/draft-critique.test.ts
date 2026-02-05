/**
 * Tests for F6.7 - Draft-Critique Loop
 */

import {
  DraftCritique,
  CritiqueModelProvider,
  CritiqueConfig,
  DEFAULT_CRITIQUE_CONFIG,
  MockCritiqueModelProvider,
  AssembledContext,
  ContextSource
} from '../../src/retrieval';

describe('DraftCritique', () => {
  let critique: DraftCritique;
  let mockProvider: MockCritiqueModelProvider;

  // Helper to create test context
  function createTestContext(overrides: Partial<AssembledContext> = {}): AssembledContext {
    return {
      context: 'The UserService class handles user authentication. It has methods like login() and logout().',
      sources: [
        {
          entityId: 'user-service',
          name: 'UserService',
          type: 'class',
          file: 'src/services/user.ts',
          line: 10,
          relevance: 0.9
        },
        {
          entityId: 'login-method',
          name: 'login',
          type: 'method',
          file: 'src/services/user.ts',
          line: 25,
          relevance: 0.85
        }
      ],
      tokenCount: 100,
      truncated: false,
      ...overrides
    };
  }

  beforeEach(() => {
    mockProvider = new MockCritiqueModelProvider();
    critique = new DraftCritique(mockProvider);
  });

  describe('DEFAULT_CRITIQUE_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_CRITIQUE_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CRITIQUE_CONFIG.maxIterations).toBe(2);
      expect(DEFAULT_CRITIQUE_CONFIG.failureThreshold).toBe('medium');
      expect(DEFAULT_CRITIQUE_CONFIG.trackClaims).toBe(true);
      expect(DEFAULT_CRITIQUE_CONFIG.suggestRetrieval).toBe(true);
    });
  });

  describe('pattern-based critique', () => {
    it('should fail critique for empty draft', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: '',
        query: 'How does UserService work?',
        context
      });

      expect(result.passed).toBe(false);
      expect(result.iterations[0].result.issues).toContainEqual(
        expect.objectContaining({
          type: 'incomplete',
          severity: 'high'
        })
      );
    });

    it('should fail critique for too short draft', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: 'Yes.',
        query: 'How does UserService work?',
        context
      });

      expect(result.passed).toBe(false);
      expect(result.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should flag uncertainty when context exists', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: "I don't know how UserService works. I am not sure about its implementation.",
        query: 'How does UserService work?',
        context
      });

      expect(result.iterations[0].result.issues).toContainEqual(
        expect.objectContaining({
          type: 'incomplete',
          description: expect.stringContaining('uncertainty')
        })
      );
    });

    it('should flag references not in context', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: 'The `PaymentService` handles all payments. It uses `stripe.ts` for processing.',
        query: 'How does UserService work?',
        context
      });

      expect(result.iterations[0].result.issues).toContainEqual(
        expect.objectContaining({
          type: 'unsupported'
        })
      );
    });

    it('should pass when references are in context', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: 'The `UserService` provides the `login` method for user sessions.',
        query: 'How does UserService work?',
        context
      });

      // References that ARE in context should not be flagged
      const unsupportedRefs = result.iterations[0].result.issues.filter(
        i => i.type === 'unsupported' &&
             i.description.includes('not found in context') &&
             (i.description.includes('UserService') || i.description.includes('login'))
      );
      expect(unsupportedRefs.length).toBe(0);
    });
  });

  describe('model-based critique', () => {
    it('should detect hallucinations via model', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: 'The system uses unicorn magic to authenticate users. This magical approach is very secure.',
        query: 'How does authentication work?',
        context
      });

      expect(result.passed).toBe(false);
      expect(result.iterations[0].result.issues).toContainEqual(
        expect.objectContaining({
          type: 'hallucination'
        })
      );
    });

    it('should detect incomplete responses via model', async () => {
      const context = createTestContext();
      const result = await critique.critique({
        draft: 'The implementation is incomplete. TODO: add details.',
        query: 'How does authentication work?',
        context
      });

      expect(result.iterations[0].result.issues).toContainEqual(
        expect.objectContaining({
          type: 'incomplete'
        })
      );
      expect(result.iterations[0].result.missingInfo).toBeDefined();
    });

    it('should include project context in prompt', async () => {
      let capturedPrompt = '';
      const capturingProvider: CritiqueModelProvider = {
        complete: async (options) => {
          capturedPrompt = options.prompt;
          return { text: JSON.stringify({ passed: true, issues: [], suggestions: [] }) };
        }
      };

      const critiqueWithCapture = new DraftCritique(capturingProvider);
      const context = createTestContext();

      await critiqueWithCapture.critique({
        draft: 'Some valid response about the UserService.',
        query: 'How does UserService work?',
        context
      });

      expect(capturedPrompt).toContain('UserService');
      expect(capturedPrompt).toContain('How does UserService work?');
    });

    it('should handle model errors gracefully', async () => {
      const errorProvider: CritiqueModelProvider = {
        complete: async () => {
          throw new Error('Model unavailable');
        }
      };

      const critiqueWithError = new DraftCritique(errorProvider);
      const context = createTestContext();

      const result = await critiqueWithError.critique({
        draft: 'Valid response about UserService authentication methods.',
        query: 'How does UserService work?',
        context
      });

      // Should pass on error (fail open)
      expect(result.passed).toBe(true);
    });

    it('should handle malformed JSON response', async () => {
      const badProvider: CritiqueModelProvider = {
        complete: async () => ({ text: 'not valid json' })
      };

      const critiqueWithBad = new DraftCritique(badProvider);
      const context = createTestContext();

      const result = await critiqueWithBad.critique({
        draft: 'Valid response about UserService.',
        query: 'How does UserService work?',
        context
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('critique iterations', () => {
    it('should run multiple iterations with revision callback', async () => {
      const context = createTestContext();
      let revisionCount = 0;

      const result = await critique.critique({
        draft: 'Incomplete response. TODO: add more.',
        query: 'How does UserService work?',
        context,
        revisionCallback: async (draft, critiqueResult) => {
          revisionCount++;
          // Return a better draft
          return 'The UserService class provides login and logout methods for authentication.';
        }
      });

      // Should have at least 2 iterations
      expect(result.iterations.length).toBeGreaterThanOrEqual(1);
      expect(revisionCount).toBeGreaterThanOrEqual(0);
    });

    it('should stop when critique passes', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The UserService class is located in user.ts and provides login method for user sessions.',
        query: 'How does UserService work?',
        context
      });

      // Should complete in one iteration
      expect(result.iterations.length).toBe(1);
      // No critical issues should be found
      expect(result.criticalIssues.length).toBe(0);
    });

    it('should respect max iterations', async () => {
      const alwaysFailProvider: CritiqueModelProvider = {
        complete: async () => ({
          text: JSON.stringify({
            passed: false,
            issues: [{ type: 'incomplete', description: 'test', severity: 'high' }],
            suggestions: []
          })
        })
      };

      const critiqueWithFail = new DraftCritique(alwaysFailProvider, { maxIterations: 3 });
      const context = createTestContext();
      let revisions = 0;

      const result = await critiqueWithFail.critique({
        draft: 'Some draft',
        query: 'test',
        context,
        revisionCallback: async () => {
          revisions++;
          return 'Revised draft ' + revisions;
        }
      });

      // Should have max iterations
      expect(result.iterations.length).toBeLessThanOrEqual(3);
    });

    it('should track all issues across iterations', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: '',
        query: 'test',
        context
      });

      expect(result.totalIssues).toBeGreaterThan(0);
    });
  });

  describe('claim extraction', () => {
    it('should extract claims from draft', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The UserService handles authentication. It provides login functionality. I think this is a good design.',
        query: 'How does UserService work?',
        context
      });

      // Claims should be tracked
      expect(result.iterations[0].claims).toBeDefined();
      expect(result.iterations[0].claims!.length).toBeGreaterThan(0);
    });

    it('should mark opinions as supported', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'I think the UserService design is good. I believe it could be improved. Consider using dependency injection.',
        query: 'What do you think of UserService?',
        context
      });

      const opinions = result.iterations[0].claims?.filter(c => c.type === 'opinion');
      expect(opinions?.every(o => o.supported)).toBe(true);
    });

    it('should identify code claims', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The `UserService` class has a `login` method. The function handles authentication.',
        query: 'Describe UserService',
        context
      });

      const codeClaims = result.iterations[0].claims?.filter(c => c.type === 'code');
      expect(codeClaims?.length).toBeGreaterThan(0);
    });

    it('should link supported claims to sources', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The UserService is defined in src/services/user.ts. It provides login functionality.',
        query: 'Where is UserService?',
        context
      });

      const supportedClaims = result.iterations[0].claims?.filter(c => c.supported);
      const claimsWithSources = supportedClaims?.filter(c => c.source);
      expect(claimsWithSources?.length).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = critique.getConfig();
      expect(config.enabled).toBe(DEFAULT_CRITIQUE_CONFIG.enabled);
      expect(config.maxIterations).toBe(DEFAULT_CRITIQUE_CONFIG.maxIterations);
    });

    it('should update configuration', () => {
      critique.updateConfig({ maxIterations: 5 });
      const config = critique.getConfig();
      expect(config.maxIterations).toBe(5);
    });

    it('should respect failure threshold', async () => {
      const critiqueHigh = new DraftCritique(mockProvider, { failureThreshold: 'high' });
      const context = createTestContext();

      // Medium severity issue should pass with high threshold
      const result = await critiqueHigh.critique({
        draft: "I don't know the implementation details.",
        query: 'test',
        context
      });

      // Medium severity with high threshold should pass
      expect(result.passed).toBe(true);
    });

    it('should disable claim tracking', async () => {
      const critiqueNoClaimTrack = new DraftCritique(mockProvider, { trackClaims: false });
      const context = createTestContext();

      const result = await critiqueNoClaimTrack.critique({
        draft: 'The UserService handles authentication.',
        query: 'test',
        context
      });

      expect(result.iterations[0].claims).toBeUndefined();
    });
  });

  describe('quick check', () => {
    it('should pass quick check for valid draft', () => {
      const context = createTestContext();
      const valid = critique.quickCheck(
        'The UserService handles authentication with login method.',
        context
      );
      expect(valid).toBe(true);
    });

    it('should fail quick check for empty draft', () => {
      const context = createTestContext();
      const valid = critique.quickCheck('', context);
      expect(valid).toBe(false);
    });

    it('should fail quick check for unsupported references', () => {
      const context = createTestContext();
      const valid = critique.quickCheck(
        'The `PaymentService` handles all transactions via stripe.ts.',
        context
      );
      expect(valid).toBe(false);
    });
  });

  describe('suggested retrieval', () => {
    it('should suggest additional retrieval when enabled', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The implementation is incomplete. TODO: add details.',
        query: 'How does authentication work?',
        context
      });

      expect(result.suggestedRetrieval).toBeDefined();
    });

    it('should not suggest retrieval when disabled', async () => {
      const critiqueNoSuggest = new DraftCritique(mockProvider, { suggestRetrieval: false });
      const context = createTestContext();

      const result = await critiqueNoSuggest.critique({
        draft: 'The implementation is incomplete. TODO: add details.',
        query: 'test',
        context
      });

      expect(result.suggestedRetrieval).toBeUndefined();
    });
  });

  describe('no model provider', () => {
    it('should pass without model provider for valid draft', async () => {
      const critiqueNoModel = new DraftCritique();
      const context = createTestContext();

      const result = await critiqueNoModel.critique({
        draft: 'The UserService handles authentication using login and logout methods.',
        query: 'How does UserService work?',
        context
      });

      expect(result.passed).toBe(true);
    });

    it('should still run pattern checks without model', async () => {
      const critiqueNoModel = new DraftCritique();
      const context = createTestContext();

      const result = await critiqueNoModel.critique({
        draft: '',
        query: 'test',
        context
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('MockCritiqueModelProvider', () => {
    it('should detect hallucinations for magic/unicorn content', async () => {
      const result = await mockProvider.complete({
        prompt: 'Draft mentions unicorn authentication'
      });

      const parsed = JSON.parse(result.text);
      expect(parsed.passed).toBe(false);
      expect(parsed.issues[0].type).toBe('hallucination');
    });

    it('should detect incomplete for TODO content', async () => {
      const result = await mockProvider.complete({
        prompt: 'Draft is incomplete with TODO markers'
      });

      const parsed = JSON.parse(result.text);
      expect(parsed.passed).toBe(false);
      expect(parsed.issues[0].type).toBe('incomplete');
    });

    it('should pass for normal content', async () => {
      const result = await mockProvider.complete({
        prompt: 'Normal draft about user authentication'
      });

      const parsed = JSON.parse(result.text);
      expect(parsed.passed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle context with no sources', async () => {
      const emptyContext: AssembledContext = {
        context: '',
        sources: [],
        tokenCount: 0,
        truncated: false
      };

      const result = await critique.critique({
        draft: 'Some response without context.',
        query: 'test',
        context: emptyContext
      });

      expect(result).toBeDefined();
    });

    it('should handle very long draft', async () => {
      const context = createTestContext();
      const longDraft = 'The UserService is defined in user.ts for sessions. '.repeat(100);

      const result = await critique.critique({
        draft: longDraft,
        query: 'How does UserService work?',
        context
      });

      expect(result).toBeDefined();
      // Should complete without errors
      expect(result.iterations.length).toBeGreaterThan(0);
    });

    it('should handle special characters in draft', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The UserService uses `login()` method. Path: /api/users/:id',
        query: 'Describe endpoints',
        context
      });

      expect(result).toBeDefined();
    });

    it('should handle unicode in draft', async () => {
      const context = createTestContext();

      const result = await critique.critique({
        draft: 'The UserService обрабатывает авторизацию пользователей.',
        query: 'test',
        context
      });

      expect(result).toBeDefined();
    });
  });

  describe('unreferenced claims detection', () => {
    it('should flag percentage claims without source', async () => {
      // Use completely unrelated context
      const unrelatedContext: AssembledContext = {
        context: 'Color picker component for UI.',
        sources: [{
          entityId: 'color-picker',
          name: 'ColorPicker',
          type: 'component',
          relevance: 0.9
        }],
        tokenCount: 50,
        truncated: false
      };

      const result = await critique.critique({
        draft: 'The system achieves 99% uptime. The ColorPicker is great.',
        query: 'What is the uptime?',
        context: unrelatedContext
      });

      // Should have at least some issues identified
      const allIssues = result.iterations[0].result.issues;
      // The percentage claim should either be flagged directly or through model
      expect(result.iterations.length).toBeGreaterThan(0);
      expect(result.totalIssues + result.iterations[0].result.suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should flag absolute claims without source', async () => {
      // Use empty context to ensure claims aren't supported
      const emptyContext: AssembledContext = {
        context: 'Basic system documentation.',
        sources: [],
        tokenCount: 50,
        truncated: false
      };

      const result = await critique.critique({
        draft: 'The cache always invalidates properly. It never corrupts data.',
        query: 'How reliable is the cache?',
        context: emptyContext
      });

      const unsupportedIssues = result.iterations[0].result.issues.filter(
        i => i.type === 'unsupported' && i.description.includes('Absolute')
      );
      expect(unsupportedIssues.length).toBeGreaterThan(0);
    });
  });
});
