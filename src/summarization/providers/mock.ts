/**
 * F10.6: Mock summarization provider for testing.
 */

import {
  SummarizationProvider,
  SummarizeOptions,
  SummarizeItem
} from './types';

/**
 * Mock provider for testing summarization without actual LLM calls.
 */
export class MockSummarizationProvider implements SummarizationProvider {
  readonly id = 'mock';
  readonly model = 'mock-model';

  private isAvailableValue = true;
  private summarizeDelay = 0;
  private summaryPrefix = 'Summary of';
  private shouldFail = false;

  constructor(options: {
    isAvailable?: boolean;
    delay?: number;
    prefix?: string;
    shouldFail?: boolean;
  } = {}) {
    this.isAvailableValue = options.isAvailable ?? true;
    this.summarizeDelay = options.delay ?? 0;
    this.summaryPrefix = options.prefix ?? 'Summary of';
    this.shouldFail = options.shouldFail ?? false;
  }

  async isAvailable(): Promise<boolean> {
    return this.isAvailableValue;
  }

  async summarize(content: string, options: SummarizeOptions): Promise<string> {
    if (this.shouldFail) {
      throw new Error('Mock provider failure');
    }

    if (this.summarizeDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.summarizeDelay));
    }

    // Generate a predictable summary for testing
    return `${this.summaryPrefix} ${options.entityType} ${options.name}: Handles ${content.slice(0, 30).replace(/\n/g, ' ')}...`;
  }

  async summarizeBatch(items: SummarizeItem[]): Promise<string[]> {
    const results: string[] = [];
    for (const item of items) {
      try {
        const summary = await this.summarize(item.content, item.options);
        results.push(summary);
      } catch {
        results.push('');
      }
    }
    return results;
  }

  /**
   * Configure the mock provider.
   */
  configure(options: {
    isAvailable?: boolean;
    delay?: number;
    prefix?: string;
    shouldFail?: boolean;
  }): void {
    if (options.isAvailable !== undefined) {
      this.isAvailableValue = options.isAvailable;
    }
    if (options.delay !== undefined) {
      this.summarizeDelay = options.delay;
    }
    if (options.prefix !== undefined) {
      this.summaryPrefix = options.prefix;
    }
    if (options.shouldFail !== undefined) {
      this.shouldFail = options.shouldFail;
    }
  }
}
