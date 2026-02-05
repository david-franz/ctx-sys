/**
 * Summarization providers
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-2/F2.2-symbol-summarization.test.ts for expected behavior.
 */

export interface SummarizationContext {
  symbolType?: string;
  parentClass?: string;
  docstring?: string;
  language?: string;
}

export interface SummarizationOptions {
  onProgress?: (current: number, total: number) => void;
}

export interface SummarizationProvider {
  name: string;
  modelId: string;
  options?: any;
  summarize(content: string, context?: SummarizationContext): Promise<string>;
  summarizeBatch(
    items: Array<{ content: string; context?: SummarizationContext }>,
    options?: SummarizationOptions
  ): Promise<string[]>;
  isAvailable(): Promise<boolean>;
  getModelInfo?(): Promise<{ name: string; modelId: string }>;
}

export class OllamaSummarizationProvider implements SummarizationProvider {
  public name: string = 'ollama';
  public modelId: string;
  public baseUrl: string;
  public options?: any;

  constructor(config: { model: string; baseUrl?: string }) {
    throw new Error('Not implemented');
  }

  async summarize(content: string, context?: SummarizationContext): Promise<string> {
    throw new Error('Not implemented');
  }

  async summarizeBatch(
    items: Array<{ content: string; context?: SummarizationContext }>,
    options?: SummarizationOptions
  ): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  buildPrompt(content: string, context?: SummarizationContext): string {
    throw new Error('Not implemented');
  }

  cleanSummary(summary: string): string {
    throw new Error('Not implemented');
  }
}

export class OpenAISummarizationProvider implements SummarizationProvider {
  public name: string = 'openai';
  public modelId: string;
  public apiKey: string;
  public options?: any;

  constructor(config: { model: string; apiKey: string }) {
    throw new Error('Not implemented');
  }

  async summarize(content: string, context?: SummarizationContext): Promise<string> {
    throw new Error('Not implemented');
  }

  async summarizeBatch(
    items: Array<{ content: string; context?: SummarizationContext }>,
    options?: SummarizationOptions
  ): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  buildChatMessages(content: string, context?: SummarizationContext): Array<{ role: string; content: string }> {
    throw new Error('Not implemented');
  }
}
