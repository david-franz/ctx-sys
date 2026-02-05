/**
 * Relevance Feedback
 *
 * Tracks and learns from user feedback on search results.
 */

import { DatabaseConnection } from '../db/connection';
import { Feedback, FeedbackType, FeedbackStats, ScoredResult } from './types';

export class RelevanceFeedback {
  constructor(
    private db: DatabaseConnection,
    private projectId: string
  ) {
    throw new Error('Not implemented');
  }

  async recordSignal(queryId: string, entityId: string, signal: FeedbackType): Promise<void> {
    throw new Error('Not implemented');
  }

  async recordBatch(queryId: string, signals: Array<{ entityId: string; signal: FeedbackType }>): Promise<void> {
    throw new Error('Not implemented');
  }

  async getSignal(signalId: string): Promise<any> {
    throw new Error('Not implemented');
  }

  async getStats(entityId: string): Promise<FeedbackStats> {
    throw new Error('Not implemented');
  }

  async adjustScores(results: ScoredResult[]): Promise<ScoredResult[]> {
    throw new Error('Not implemented');
  }
}

export class FeedbackTracker {
  constructor(
    private db: DatabaseConnection,
    private projectId: string
  ) {
    throw new Error('Not implemented');
  }

  async track(queryId: string, entityId: string, action: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async getHistory(entityId: string): Promise<any[]> {
    throw new Error('Not implemented');
  }
}
