/**
 * Draft-Critique Loop for verifying LLM responses against context.
 * Identifies hallucinations, unsupported claims, and missing information.
 */

import { AssembledContext, ContextSource } from './context-assembler';
import { CritiqueResult, CritiqueIssue } from './types';

/**
 * Provider interface for model-based critique.
 */
export interface CritiqueModelProvider {
  /**
   * Generate a critique of the draft.
   */
  complete(options: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string }>;
}

/**
 * Configuration for the draft critique.
 */
export interface CritiqueConfig {
  /** Whether critique is enabled */
  enabled: boolean;
  /** Maximum critique iterations */
  maxIterations: number;
  /** Severity threshold to fail critique */
  failureThreshold: 'low' | 'medium' | 'high';
  /** Whether to track claim sources */
  trackClaims: boolean;
  /** Whether to suggest missing retrieval */
  suggestRetrieval: boolean;
}

/**
 * Default critique configuration.
 */
export const DEFAULT_CRITIQUE_CONFIG: CritiqueConfig = {
  enabled: true,
  maxIterations: 2,
  failureThreshold: 'medium',
  trackClaims: true,
  suggestRetrieval: true
};

/**
 * A claim extracted from a draft.
 */
export interface ExtractedClaim {
  /** The claim text */
  claim: string;
  /** Location in the draft */
  location: string;
  /** Whether the claim is supported by context */
  supported: boolean;
  /** Supporting source if found */
  source?: ContextSource;
  /** Type of claim */
  type: 'factual' | 'code' | 'reference' | 'opinion';
}

/**
 * Result of critique iteration.
 */
export interface CritiqueIteration {
  /** Iteration number */
  iteration: number;
  /** The draft being critiqued */
  draft: string;
  /** Critique result */
  result: CritiqueResult;
  /** Extracted claims */
  claims?: ExtractedClaim[];
}

/**
 * Final output of the draft-critique loop.
 */
export interface DraftCritiqueOutput {
  /** Final draft (possibly revised) */
  finalDraft: string;
  /** Whether the draft passed */
  passed: boolean;
  /** All critique iterations */
  iterations: CritiqueIteration[];
  /** Total issues found */
  totalIssues: number;
  /** High severity issues */
  criticalIssues: CritiqueIssue[];
  /** Additional context that might be needed */
  suggestedRetrieval?: string[];
}

/**
 * Options for running the critique loop.
 */
export interface CritiqueOptions {
  /** The draft to critique */
  draft: string;
  /** The query that produced the draft */
  query: string;
  /** The context used to generate the draft */
  context: AssembledContext;
  /** Optional revision callback */
  revisionCallback?: (draft: string, critique: CritiqueResult) => Promise<string>;
}

/**
 * Mock critique provider for testing.
 */
export class MockCritiqueModelProvider implements CritiqueModelProvider {
  async complete(options: { prompt: string }): Promise<{ text: string }> {
    const prompt = options.prompt.toLowerCase();

    // Simulate finding hallucination if draft mentions things not in context
    if (prompt.includes('unicorn') || prompt.includes('magic')) {
      return {
        text: JSON.stringify({
          passed: false,
          issues: [{
            type: 'hallucination',
            description: 'Draft contains claims not supported by context',
            severity: 'high',
            location: 'paragraph 1'
          }],
          suggestions: ['Remove unsupported claims', 'Cite sources for claims'],
          missingInfo: []
        })
      };
    }

    // Simulate incomplete response
    if (prompt.includes('incomplete') || prompt.includes('todo')) {
      return {
        text: JSON.stringify({
          passed: false,
          issues: [{
            type: 'incomplete',
            description: 'Response lacks complete implementation details',
            severity: 'medium',
            location: 'code section'
          }],
          suggestions: ['Add missing implementation details'],
          missingInfo: ['implementation details', 'error handling']
        })
      };
    }

    // Default: pass critique
    return {
      text: JSON.stringify({
        passed: true,
        issues: [],
        suggestions: [],
        missingInfo: []
      })
    };
  }
}

/**
 * Draft-Critique loop for verifying and improving LLM responses.
 */
export class DraftCritique {
  private config: CritiqueConfig;

  constructor(
    private modelProvider?: CritiqueModelProvider,
    config: Partial<CritiqueConfig> = {}
  ) {
    this.config = { ...DEFAULT_CRITIQUE_CONFIG, ...config };
  }

  /**
   * Run the full critique loop on a draft.
   */
  async critique(options: CritiqueOptions): Promise<DraftCritiqueOutput> {
    const iterations: CritiqueIteration[] = [];
    let currentDraft = options.draft;
    let passed = false;
    let allIssues: CritiqueIssue[] = [];

    for (let i = 0; i < this.config.maxIterations; i++) {
      // Run critique on current draft
      const result = await this.runCritique(
        currentDraft,
        options.query,
        options.context
      );

      // Extract claims if configured
      const claims = this.config.trackClaims
        ? this.extractClaims(currentDraft, options.context)
        : undefined;

      iterations.push({
        iteration: i + 1,
        draft: currentDraft,
        result,
        claims
      });

      allIssues = [...allIssues, ...result.issues];

      // Check if passed
      if (result.passed) {
        passed = true;
        break;
      }

      // Check if we should stop based on severity
      const hasCriticalIssue = result.issues.some(
        issue => this.isAboveThreshold(issue.severity)
      );

      if (!hasCriticalIssue) {
        passed = true;
        break;
      }

      // Try to revise if callback provided and not last iteration
      if (options.revisionCallback && i < this.config.maxIterations - 1) {
        try {
          currentDraft = await options.revisionCallback(currentDraft, result);
        } catch {
          // Revision failed, continue with current draft
          break;
        }
      } else {
        // No revision callback, stop loop
        break;
      }
    }

    const criticalIssues = allIssues.filter(
      issue => issue.severity === 'high'
    );

    const output: DraftCritiqueOutput = {
      finalDraft: currentDraft,
      passed,
      iterations,
      totalIssues: allIssues.length,
      criticalIssues
    };

    // Add retrieval suggestions if configured
    if (this.config.suggestRetrieval) {
      const lastIteration = iterations[iterations.length - 1];
      if (lastIteration?.result.missingInfo?.length) {
        output.suggestedRetrieval = lastIteration.result.missingInfo;
      }
    }

    return output;
  }

  /**
   * Run a single critique on a draft.
   */
  async runCritique(
    draft: string,
    query: string,
    context: AssembledContext
  ): Promise<CritiqueResult> {
    // Fast path: simple pattern-based checks
    const patternResult = this.patternBasedCritique(draft, context);
    if (patternResult) {
      return patternResult;
    }

    // Model-based critique if provider available
    if (this.modelProvider) {
      return this.modelBasedCritique(draft, query, context);
    }

    // No model, return basic pass
    return {
      passed: true,
      issues: [],
      suggestions: []
    };
  }

  /**
   * Pattern-based critique for common issues.
   */
  private patternBasedCritique(
    draft: string,
    context: AssembledContext
  ): CritiqueResult | null {
    const issues: CritiqueIssue[] = [];
    const suggestions: string[] = [];

    // Check for empty or too short response
    if (draft.trim().length < 10) {
      issues.push({
        type: 'incomplete',
        description: 'Response is too short',
        severity: 'high'
      });
      suggestions.push('Provide a more complete response');
    }

    // Check for "I don't know" when context exists
    if (context.sources.length > 0) {
      const dontKnowPatterns = [
        /i (don't|do not) (know|have|see)/i,
        /i('m| am) (not sure|uncertain|unsure)/i,
        /no information (available|found)/i
      ];

      const hasDontKnow = dontKnowPatterns.some(p => p.test(draft));
      if (hasDontKnow) {
        issues.push({
          type: 'incomplete',
          description: 'Response claims uncertainty despite available context',
          severity: 'medium'
        });
        suggestions.push('Review context for relevant information');
      }
    }

    // Check for file/code references not in context
    const codeRefs = this.extractCodeReferences(draft);
    const contextNames = new Set(context.sources.map(s => s.name.toLowerCase()));

    for (const ref of codeRefs) {
      if (!this.isReferenceInContext(ref, contextNames, context)) {
        issues.push({
          type: 'unsupported',
          description: `Reference to "${ref}" not found in context`,
          severity: 'medium',
          location: `Reference: ${ref}`
        });
      }
    }

    // Check for specific claim patterns without sources
    const unreferencedClaims = this.findUnreferencedClaims(draft, context);
    for (const claim of unreferencedClaims) {
      issues.push({
        type: 'unsupported',
        description: claim.description,
        severity: 'low',
        location: claim.location
      });
    }

    if (issues.length > 0) {
      return {
        passed: !issues.some(i => i.severity === 'high'),
        issues,
        suggestions
      };
    }

    return null; // No pattern issues found, need model critique
  }

  /**
   * Model-based critique for deeper analysis.
   */
  private async modelBasedCritique(
    draft: string,
    query: string,
    context: AssembledContext
  ): Promise<CritiqueResult> {
    const prompt = this.buildCritiquePrompt(draft, query, context);

    try {
      const response = await this.modelProvider!.complete({
        prompt,
        maxTokens: 500,
        temperature: 0.1
      });

      return this.parseCritiqueResponse(response.text);
    } catch (error) {
      // On error, return neutral result
      return {
        passed: true,
        issues: [],
        suggestions: [`Critique failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Build the critique prompt.
   */
  private buildCritiquePrompt(
    draft: string,
    query: string,
    context: AssembledContext
  ): string {
    const contextSummary = context.sources
      .slice(0, 10)
      .map(s => `- ${s.name} (${s.type})`)
      .join('\n');

    return `You are a critique model. Review this draft response for accuracy and completeness.

QUERY: "${query}"

AVAILABLE CONTEXT SOURCES:
${contextSummary}

CONTEXT CONTENT:
${context.context.slice(0, 2000)}

DRAFT RESPONSE:
${draft}

Analyze the draft for:
1. HALLUCINATIONS: Claims not supported by the context
2. UNSUPPORTED: References to code/files not in context
3. INCOMPLETE: Missing important information from context
4. INCONSISTENT: Contradictions with the context

Respond in JSON format:
{
  "passed": true/false,
  "issues": [
    {
      "type": "hallucination" | "unsupported" | "incomplete" | "inconsistent",
      "description": "description of issue",
      "severity": "low" | "medium" | "high",
      "location": "where in the draft"
    }
  ],
  "suggestions": ["improvement suggestions"],
  "missingInfo": ["what additional context might help"]
}

JSON response:`;
  }

  /**
   * Parse the critique response.
   */
  private parseCritiqueResponse(response: string): CritiqueResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        passed: Boolean(parsed.passed),
        issues: this.validateIssues(parsed.issues || []),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.map(String)
          : [],
        missingInfo: Array.isArray(parsed.missingInfo)
          ? parsed.missingInfo.map(String)
          : undefined
      };
    } catch {
      return {
        passed: true,
        issues: [],
        suggestions: ['Failed to parse critique response']
      };
    }
  }

  /**
   * Validate and normalize issues.
   */
  private validateIssues(issues: unknown[]): CritiqueIssue[] {
    if (!Array.isArray(issues)) return [];

    const validTypes = ['hallucination', 'unsupported', 'incomplete', 'inconsistent'];
    const validSeverities = ['low', 'medium', 'high'];

    return issues
      .filter((issue): issue is Record<string, unknown> =>
        typeof issue === 'object' && issue !== null
      )
      .map(issue => ({
        type: validTypes.includes(String(issue.type))
          ? (issue.type as CritiqueIssue['type'])
          : 'unsupported',
        description: String(issue.description || 'Unknown issue'),
        severity: validSeverities.includes(String(issue.severity))
          ? (issue.severity as CritiqueIssue['severity'])
          : 'medium',
        location: issue.location ? String(issue.location) : undefined
      }));
  }

  /**
   * Extract claims from the draft.
   */
  private extractClaims(
    draft: string,
    context: AssembledContext
  ): ExtractedClaim[] {
    const claims: ExtractedClaim[] = [];
    const sentences = draft.split(/[.!?]+/).filter(s => s.trim().length > 10);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();

      // Skip obvious non-claims
      if (this.isOpinion(sentence)) {
        claims.push({
          claim: sentence,
          location: `Sentence ${i + 1}`,
          supported: true, // Opinions don't need support
          type: 'opinion'
        });
        continue;
      }

      // Check if claim mentions code
      if (this.isCodeClaim(sentence)) {
        const supported = this.isClaimSupportedByContext(sentence, context);
        claims.push({
          claim: sentence,
          location: `Sentence ${i + 1}`,
          supported: supported.supported,
          source: supported.source,
          type: 'code'
        });
        continue;
      }

      // Factual claim
      const supported = this.isClaimSupportedByContext(sentence, context);
      claims.push({
        claim: sentence,
        location: `Sentence ${i + 1}`,
        supported: supported.supported,
        source: supported.source,
        type: 'factual'
      });
    }

    return claims;
  }

  /**
   * Check if a sentence is an opinion.
   */
  private isOpinion(sentence: string): boolean {
    const opinionPatterns = [
      /^i (think|believe|suggest|recommend)/i,
      /^(in my opinion|personally)/i,
      /^(you could|you might|consider)/i,
      /(would be better|might be helpful)/i
    ];

    return opinionPatterns.some(p => p.test(sentence));
  }

  /**
   * Check if a sentence is about code.
   */
  private isCodeClaim(sentence: string): boolean {
    const codePatterns = [
      /`[^`]+`/,  // Backtick code
      /function\s+\w+/i,
      /class\s+\w+/i,
      /the\s+\w+\s+(method|function|class|file)/i,
      /\w+\.(ts|js|py|go|rs|java)$/i
    ];

    return codePatterns.some(p => p.test(sentence));
  }

  /**
   * Check if a claim is supported by context.
   */
  private isClaimSupportedByContext(
    claim: string,
    context: AssembledContext
  ): { supported: boolean; source?: ContextSource } {
    const lowerClaim = claim.toLowerCase();

    // Check each source
    for (const source of context.sources) {
      const sourceName = source.name.toLowerCase();

      // If source name appears in claim, consider it supported
      if (lowerClaim.includes(sourceName)) {
        return { supported: true, source };
      }
    }

    // Check if claim content matches context
    const contextLower = context.context.toLowerCase();

    // Extract key terms from claim
    const keyTerms = claim
      .split(/\s+/)
      .filter(w => w.length > 4)
      .map(w => w.toLowerCase().replace(/[^a-z]/g, ''));

    // If most key terms appear in context, consider it supported
    const matchingTerms = keyTerms.filter(t => contextLower.includes(t));
    if (keyTerms.length > 0 && matchingTerms.length / keyTerms.length > 0.5) {
      return { supported: true };
    }

    return { supported: false };
  }

  /**
   * Extract code references from draft.
   */
  private extractCodeReferences(draft: string): string[] {
    const refs: string[] = [];

    // Backtick references
    const backtickMatches = draft.match(/`([^`]+)`/g);
    if (backtickMatches) {
      refs.push(...backtickMatches.map(m => m.slice(1, -1)));
    }

    // File references
    const fileMatches = draft.match(/\b[\w-]+\.(ts|js|py|go|rs|java|tsx|jsx)\b/g);
    if (fileMatches) {
      refs.push(...fileMatches);
    }

    return [...new Set(refs)];
  }

  /**
   * Check if a reference exists in context.
   */
  private isReferenceInContext(
    ref: string,
    contextNames: Set<string>,
    context: AssembledContext
  ): boolean {
    const lowerRef = ref.toLowerCase();

    // Check source names
    if (contextNames.has(lowerRef)) return true;

    // Check if reference appears in context content
    if (context.context.toLowerCase().includes(lowerRef)) return true;

    // Check partial matches for compound names
    for (const name of contextNames) {
      if (name.includes(lowerRef) || lowerRef.includes(name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find unreferenced claims in draft.
   */
  private findUnreferencedClaims(
    draft: string,
    context: AssembledContext
  ): Array<{ description: string; location: string }> {
    const unreferenced: Array<{ description: string; location: string }> = [];

    // Check for specific patterns that should have sources
    const claimPatterns = [
      { pattern: /\b(\d+%)\b/g, description: 'Percentage claim without source' },
      { pattern: /always|never|must|guaranteed/gi, description: 'Absolute claim without source' },
      { pattern: /the only (way|method|approach)/gi, description: 'Exclusivity claim without source' }
    ];

    for (const { pattern, description } of claimPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(draft)) !== null) {
        // Check if this claim area is supported by context
        const surrounding = draft.slice(
          Math.max(0, match.index - 50),
          Math.min(draft.length, match.index + match[0].length + 50)
        );

        if (!this.isClaimSupportedByContext(surrounding, context).supported) {
          unreferenced.push({
            description: `${description}: "${match[0]}"`,
            location: `Position ${match.index}`
          });
        }
      }
    }

    return unreferenced;
  }

  /**
   * Check if severity is above configured threshold.
   */
  private isAboveThreshold(severity: 'low' | 'medium' | 'high'): boolean {
    const levels = { low: 1, medium: 2, high: 3 };
    return levels[severity] >= levels[this.config.failureThreshold];
  }

  /**
   * Get current configuration.
   */
  getConfig(): CritiqueConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(updates: Partial<CritiqueConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Quick check if draft likely passes (without full critique).
   */
  quickCheck(draft: string, context: AssembledContext): boolean {
    // Basic length check
    if (draft.trim().length < 10) return false;

    // Check for obvious unsupported references
    const refs = this.extractCodeReferences(draft);
    const contextNames = new Set(context.sources.map(s => s.name.toLowerCase()));

    for (const ref of refs) {
      if (!this.isReferenceInContext(ref, contextNames, context)) {
        return false;
      }
    }

    return true;
  }
}
