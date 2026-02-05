/**
 * Phase 3: Summarization Provider
 * Interface for LLM-based summarization
 */

export interface SummarizationProvider {
  summarize(content: string, prompt?: string): Promise<string>;
  extractDecisions?(content: string): Promise<any[]>;
  summarizeWithStructure?(content: string): Promise<any>;
}
