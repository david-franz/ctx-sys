/**
 * Phase 3: Summarization Provider (capital S path)
 * Provider for code/text summarization
 */

export interface SummarizationProvider {
  summarize(text: string, prompt?: string): Promise<string>;
  summarizeWithStructure?(text: string): Promise<any>;
}

export class OllamaSummarizationProvider implements SummarizationProvider {
  constructor(config?: any) {
    throw new Error('Not implemented');
  }

  async summarize(text: string, prompt?: string): Promise<string> {
    throw new Error('Not implemented');
  }

  async summarizeWithStructure(text: string): Promise<any> {
    throw new Error('Not implemented');
  }
}
