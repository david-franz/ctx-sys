import { Message, ConversationSummary, Session } from './types';
import { MessageStore } from './message-store';
import { SessionManager } from './session-manager';

/**
 * Provider interface for generating summaries.
 * Implementations should use environment variables for API keys:
 * - OPENAI_API_KEY for OpenAI
 * - ANTHROPIC_API_KEY for Anthropic
 * - OLLAMA_BASE_URL for Ollama (defaults to http://localhost:11434)
 */
export interface SummaryProvider {
  /**
   * Generate a summary from the given prompt/content.
   */
  summarize(prompt: string): Promise<string>;
}

/**
 * A mock provider for testing.
 */
export class MockSummaryProvider implements SummaryProvider {
  async summarize(prompt: string): Promise<string> {
    // Return a structured mock response
    return `OVERVIEW: This is a mock summary of the conversation.

TOPICS:
- topic 1
- topic 2

DECISIONS:
- mock decision 1

CODE_REFERENCES:
- file.ts

KEY_POINTS:
- key point 1
- key point 2`;
  }
}

/**
 * Options for the conversation summarizer.
 */
export interface SummarizerOptions {
  /** Maximum characters to include in the transcript */
  maxTranscriptLength?: number;
}

/**
 * Summarizes conversation sessions.
 */
export class ConversationSummarizer {
  private maxTranscriptLength: number;

  constructor(
    private provider: SummaryProvider,
    private messageStore: MessageStore,
    private sessionManager: SessionManager,
    options?: SummarizerOptions
  ) {
    this.maxTranscriptLength = options?.maxTranscriptLength ?? 8000;
  }

  /**
   * Summarize a session's messages.
   */
  async summarizeSession(sessionId: string): Promise<ConversationSummary> {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const messages = this.messageStore.getBySession(sessionId);
    if (messages.length === 0) {
      return this.emptySummary();
    }

    // Build conversation transcript
    const transcript = this.buildTranscript(messages);

    // Generate summary
    const summary = await this.generateSummary(transcript);

    // Update session with summary and mark as summarized
    this.sessionManager.markSummarized(sessionId, summary.overview);

    return summary;
  }

  /**
   * Generate a summary without updating the session.
   * Useful for previewing summaries.
   */
  async previewSummary(sessionId: string): Promise<ConversationSummary> {
    const messages = this.messageStore.getBySession(sessionId);
    if (messages.length === 0) {
      return this.emptySummary();
    }

    const transcript = this.buildTranscript(messages);
    return this.generateSummary(transcript);
  }

  /**
   * Generate a summary from raw messages.
   */
  async summarizeMessages(messages: Message[]): Promise<ConversationSummary> {
    if (messages.length === 0) {
      return this.emptySummary();
    }

    const transcript = this.buildTranscript(messages);
    return this.generateSummary(transcript);
  }

  /**
   * Build a transcript from messages.
   */
  private buildTranscript(messages: Message[]): string {
    const transcript = messages
      .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    // Truncate if too long
    if (transcript.length > this.maxTranscriptLength) {
      return transcript.slice(0, this.maxTranscriptLength) + '\n\n[TRUNCATED]';
    }

    return transcript;
  }

  /**
   * Generate a summary using the provider.
   */
  private async generateSummary(transcript: string): Promise<ConversationSummary> {
    const prompt = this.buildPrompt(transcript);
    const response = await this.provider.summarize(prompt);
    return this.parseResponse(response);
  }

  /**
   * Build the summarization prompt.
   */
  private buildPrompt(transcript: string): string {
    return `Analyze this conversation and provide a structured summary.

CONVERSATION:
${transcript}

Provide your response in this exact format:

OVERVIEW: (2-3 sentence summary of the conversation)

TOPICS:
- topic 1
- topic 2

DECISIONS:
- decision 1
- decision 2

CODE_REFERENCES:
- file or function mentioned 1
- file or function mentioned 2

KEY_POINTS:
- important point 1
- important point 2

If a section has no items, write "none" for that section.`;
  }

  /**
   * Parse the provider's response into a structured summary.
   */
  private parseResponse(response: string): ConversationSummary {
    const sections: ConversationSummary = {
      overview: '',
      topics: [],
      decisions: [],
      codeReferences: [],
      keyPoints: []
    };

    let currentSection: keyof ConversationSummary | '' = '';

    for (const line of response.split('\n')) {
      const trimmed = line.trim();

      if (trimmed.startsWith('OVERVIEW:')) {
        currentSection = 'overview';
        sections.overview = trimmed.replace('OVERVIEW:', '').trim();
      } else if (trimmed === 'TOPICS:') {
        currentSection = 'topics';
      } else if (trimmed === 'DECISIONS:') {
        currentSection = 'decisions';
      } else if (trimmed === 'CODE_REFERENCES:') {
        currentSection = 'codeReferences';
      } else if (trimmed === 'KEY_POINTS:') {
        currentSection = 'keyPoints';
      } else if (trimmed.startsWith('-') && currentSection && currentSection !== 'overview') {
        const item = trimmed.slice(1).trim();
        if (item && item.toLowerCase() !== 'none') {
          (sections[currentSection] as string[]).push(item);
        }
      } else if (currentSection === 'overview' && trimmed) {
        sections.overview += ' ' + trimmed;
      }
    }

    // Clean up overview
    sections.overview = sections.overview.trim();

    return sections;
  }

  /**
   * Return an empty summary for sessions with no messages.
   */
  private emptySummary(): ConversationSummary {
    return {
      overview: 'Empty session with no messages.',
      topics: [],
      decisions: [],
      codeReferences: [],
      keyPoints: []
    };
  }
}
