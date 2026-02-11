/**
 * F10i.1: Conversation memory domain service.
 */

import { AppContext } from '../context';
import { SessionManager, MessageStore, DecisionStore } from '../conversation';
import { Session, Message, Decision } from '../conversation/types';
import {
  CreateMessageInput, SessionListOptions, HistoryOptions, DecisionSearchOptions
} from './types';

export class ConversationService {
  private sessionManagers = new Map<string, SessionManager>();
  private messageStores = new Map<string, MessageStore>();
  private decisionStores = new Map<string, DecisionStore>();

  constructor(private context: AppContext) {}

  private getSessionManager(projectId: string): SessionManager {
    if (!this.sessionManagers.has(projectId)) {
      this.sessionManagers.set(projectId, new SessionManager(this.context.db, projectId));
    }
    return this.sessionManagers.get(projectId)!;
  }

  private getMessageStore(projectId: string): MessageStore {
    if (!this.messageStores.has(projectId)) {
      this.messageStores.set(projectId, new MessageStore(this.context.db, projectId));
    }
    return this.messageStores.get(projectId)!;
  }

  private getDecisionStore(projectId: string): DecisionStore {
    if (!this.decisionStores.has(projectId)) {
      this.decisionStores.set(projectId, new DecisionStore(this.context.db, projectId));
    }
    return this.decisionStores.get(projectId)!;
  }

  async createSession(projectId: string, name?: string): Promise<Session> {
    const sessionManager = this.getSessionManager(projectId);
    return sessionManager.create(name);
  }

  async getSession(projectId: string, sessionId: string): Promise<Session | null> {
    const sessionManager = this.getSessionManager(projectId);
    return sessionManager.get(sessionId);
  }

  async listSessions(projectId: string, options?: SessionListOptions): Promise<Session[]> {
    const sessionManager = this.getSessionManager(projectId);
    return sessionManager.list(options?.status);
  }

  async archiveSession(projectId: string, sessionId: string): Promise<void> {
    const sessionManager = this.getSessionManager(projectId);
    sessionManager.archive(sessionId);
  }

  async storeMessage(projectId: string, sessionId: string, message: CreateMessageInput): Promise<Message> {
    const messageStore = this.getMessageStore(projectId);
    return messageStore.create({
      sessionId,
      role: message.role,
      content: message.content,
      metadata: message.metadata
    });
  }

  async getMessages(projectId: string, sessionId: string, options?: { limit?: number; before?: string }): Promise<Message[]> {
    const messageStore = this.getMessageStore(projectId);
    return messageStore.getBySession(sessionId, options);
  }

  async getHistory(projectId: string, options?: HistoryOptions): Promise<Message[]> {
    const messageStore = this.getMessageStore(projectId);
    if (options?.sessionId) {
      return messageStore.getBySession(options.sessionId, { limit: options.limit, before: options.before });
    }
    return messageStore.getRecent(options?.limit || 10);
  }

  async summarizeSession(projectId: string, sessionId: string): Promise<string> {
    const messageStore = this.getMessageStore(projectId);
    const messages = messageStore.getBySession(sessionId);

    if (messages.length === 0) return 'Empty session.';

    let summary: string;
    try {
      const { LLMSummarizationManager } = await import('../summarization/llm-manager.js');
      const manager = new LLMSummarizationManager();
      const provider = await manager.getProvider();

      if (provider) {
        const transcript = messages
          .map(m => `[${m.role}]: ${m.content}`)
          .join('\n\n');
        summary = await provider.summarize(
          `Summarize this conversation session concisely:\n\n${transcript.slice(0, 4000)}`,
          { entityType: 'session', name: sessionId, maxTokens: 200, temperature: 0.3 }
        );
      } else {
        summary = this.buildTemplateSummary(messages);
      }
    } catch {
      summary = this.buildTemplateSummary(messages);
    }

    const sessionManager = this.getSessionManager(projectId);
    sessionManager.markSummarized(sessionId, summary);

    return summary;
  }

  private buildTemplateSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const topics = messages.slice(0, 5).map(m => m.content.slice(0, 80)).join('; ');
    return `Session with ${userMessages} user messages and ${assistantMessages} assistant responses. ` +
      `Topics: ${topics}`;
  }

  async searchDecisions(projectId: string, query: string, options?: DecisionSearchOptions): Promise<Decision[]> {
    const decisionStore = this.getDecisionStore(projectId);
    const limit = options?.limit || 10;

    try {
      const decisions = decisionStore.search(query, {
        sessionId: options?.sessionId,
        limit
      });
      if (decisions.length > 0) {
        return decisions;
      }
    } catch {
      // Decisions table may not exist for legacy projects
    }

    const messageStore = this.getMessageStore(projectId);
    const seen = new Set<string>();
    const decisions: Decision[] = [];

    const toDecision = (m: Message): Decision => ({
      id: m.id,
      sessionId: m.sessionId,
      messageId: m.id,
      description: m.content,
      context: (m.metadata?.context as string) || '',
      relatedEntities: (m.metadata?.relatedEntities as string[]) || [],
      createdAt: m.createdAt
    });

    const allMessages = messageStore.getRecent(500);
    for (const m of allMessages) {
      if (m.metadata?.type === 'decision') {
        if (!query || m.content.toLowerCase().includes(query.toLowerCase())) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            decisions.push(toDecision(m));
          }
        }
      }
      if (decisions.length >= limit) return decisions;
    }

    if (query) {
      const searchResults = messageStore.search(query, { limit: limit * 3 });
      const decisionKeywords = ['decided', 'decision', 'agreed', 'will use', 'chose', 'choosing'];
      for (const m of searchResults) {
        if (!seen.has(m.id) && decisionKeywords.some(kw => m.content.toLowerCase().includes(kw))) {
          seen.add(m.id);
          decisions.push(toDecision(m));
          if (decisions.length >= limit) break;
        }
      }
    }

    return decisions;
  }

  async createDecision(projectId: string, input: { sessionId: string; messageId?: string; description: string; context?: string; alternatives?: string[]; relatedEntities?: string[] }): Promise<Decision> {
    const decisionStore = this.getDecisionStore(projectId);
    return decisionStore.create({
      sessionId: input.sessionId,
      messageId: input.messageId || '',
      description: input.description,
      context: input.context,
      alternatives: input.alternatives,
      relatedEntities: input.relatedEntities
    });
  }

  clearProjectCache(projectId: string): void {
    this.sessionManagers.delete(projectId);
    this.messageStores.delete(projectId);
    this.decisionStores.delete(projectId);
  }
}
