import { Message, Decision, DecisionInput } from './types';
import { MessageStore } from './message-store';
import { SummaryProvider } from './summarizer';
import { generateId } from '../utils/id';

/**
 * Patterns that indicate a message might contain a decision.
 */
const DECISION_PATTERNS = [
  /we('ll| will| should| decided| agreed| chose)/i,
  /let's (go with|use|implement|do|try)/i,
  /the (decision|plan|approach|strategy) is/i,
  /i('ll| will) (use|implement|go with|choose)/i,
  /decided to/i,
  /agreed (on|to|that)/i,
  /going (to|with)/i,
  /settled on/i
];

/**
 * Extracts decisions from conversation messages.
 */
export class DecisionExtractor {
  constructor(
    private provider: SummaryProvider,
    private messageStore: MessageStore
  ) {}

  /**
   * Check if a message content might contain a decision.
   */
  mightContainDecision(content: string): boolean {
    return DECISION_PATTERNS.some(p => p.test(content));
  }

  /**
   * Extract decisions from a single message.
   */
  async extractFromMessage(message: Message): Promise<Decision[]> {
    // Quick check to avoid unnecessary LLM calls
    if (!this.mightContainDecision(message.content)) {
      return [];
    }

    const prompt = this.buildExtractionPrompt(message.content);
    const response = await this.provider.summarize(prompt);
    return this.parseDecisions(response, message);
  }

  /**
   * Extract decisions from all messages in a session.
   */
  async extractFromSession(sessionId: string): Promise<Decision[]> {
    const messages = this.messageStore.getBySession(sessionId);
    const decisions: Decision[] = [];

    for (const message of messages) {
      const messageDecisions = await this.extractFromMessage(message);
      decisions.push(...messageDecisions);
    }

    return decisions;
  }

  /**
   * Extract decisions from a list of messages.
   */
  async extractFromMessages(messages: Message[]): Promise<Decision[]> {
    const decisions: Decision[] = [];

    for (const message of messages) {
      const messageDecisions = await this.extractFromMessage(message);
      decisions.push(...messageDecisions);
    }

    return decisions;
  }

  /**
   * Create a decision from input.
   */
  createDecision(input: DecisionInput): Decision {
    return {
      id: generateId(),
      sessionId: input.sessionId,
      messageId: input.messageId,
      description: input.description,
      context: input.context,
      alternatives: input.alternatives,
      relatedEntities: input.relatedEntities || [],
      createdAt: new Date()
    };
  }

  /**
   * Build the extraction prompt.
   */
  private buildExtractionPrompt(content: string): string {
    return `Extract any decisions or agreements from this message.
For each decision found, provide:
- DECISION: (the decision itself, stated clearly)
- CONTEXT: (why it was made, if mentioned)
- ALTERNATIVES: (other options that were considered, if any, comma-separated)

If no decisions are present, respond with exactly "NO_DECISIONS".

MESSAGE:
${content}`;
  }

  /**
   * Parse the LLM response into Decision objects.
   */
  private parseDecisions(response: string, message: Message): Decision[] {
    if (response.includes('NO_DECISIONS')) {
      return [];
    }

    const decisions: Decision[] = [];
    const blocks = response.split(/DECISION:/i).slice(1);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      const decision: Partial<Decision> = {
        id: generateId(),
        sessionId: message.sessionId,
        messageId: message.id,
        relatedEntities: [],
        createdAt: new Date()
      };

      let descriptionLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('CONTEXT:')) {
          decision.context = trimmed.replace('CONTEXT:', '').trim();
        } else if (trimmed.startsWith('ALTERNATIVES:')) {
          const altsText = trimmed.replace('ALTERNATIVES:', '').trim();
          if (altsText.toLowerCase() !== 'none' && altsText.length > 0) {
            decision.alternatives = altsText
              .split(',')
              .map(a => a.trim())
              .filter(Boolean);
          }
        } else if (trimmed && !trimmed.startsWith('-')) {
          // Collect description lines until we hit CONTEXT or ALTERNATIVES
          if (!decision.context && !decision.alternatives) {
            descriptionLines.push(trimmed);
          }
        }
      }

      // Join description lines
      decision.description = descriptionLines.join(' ').trim();

      if (decision.description) {
        decisions.push(decision as Decision);
      }
    }

    return decisions;
  }

  /**
   * Get decision patterns for external use.
   */
  getPatterns(): RegExp[] {
    return [...DECISION_PATTERNS];
  }
}

/**
 * A mock provider for testing decision extraction.
 */
export class MockDecisionProvider implements SummaryProvider {
  private responses: Map<string, string> = new Map();
  private defaultResponse = 'NO_DECISIONS';

  setResponse(contentMatch: string, response: string): void {
    this.responses.set(contentMatch, response);
  }

  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  async summarize(prompt: string): Promise<string> {
    for (const [match, response] of this.responses) {
      if (prompt.includes(match)) {
        return response;
      }
    }
    return this.defaultResponse;
  }
}
