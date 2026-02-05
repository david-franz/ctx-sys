/**
 * Summarization Provider
 *
 * Interface for code summarization providers.
 */

export interface SummarizationProvider {
  summarize(content: string): Promise<string>;

  summarizeBatch(items: Array<{ content: string }>): Promise<string[]>;

  isAvailable(): Promise<boolean>;

  getModelInfo(): { name: string };
}
