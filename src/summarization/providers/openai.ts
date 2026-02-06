/**
 * F10.6: OpenAI summarization provider.
 */

import {
  SummarizationProvider,
  SummarizeOptions,
  SummarizeItem,
  OpenAIOptions
} from './types';

/**
 * OpenAI-based cloud LLM summarization provider.
 */
export class OpenAISummarizationProvider implements SummarizationProvider {
  readonly id = 'openai';
  readonly model: string;

  private apiKey: string;
  private baseUrl: string;

  constructor(options: OpenAIOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || 'gpt-4o-mini';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async summarize(content: string, options: SummarizeOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: this.buildUserPrompt(content, options)
          }
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 150
      })
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(`OpenAI error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    };
    return data.choices[0].message.content.trim();
  }

  async summarizeBatch(items: SummarizeItem[]): Promise<string[]> {
    // OpenAI supports concurrent requests
    const concurrency = 10;
    const results: string[] = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(item =>
          this.summarize(item.content, item.options).catch(() => '')
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  private getSystemPrompt(): string {
    return `You are a code documentation expert. Generate concise, technical summaries
of code entities. Focus on what the code does, not how it's implemented.
Be direct - don't start with phrases like "This function..." or "This class...".
Keep summaries to 1-3 sentences.`;
  }

  private buildUserPrompt(content: string, options: SummarizeOptions): string {
    return `Summarize this ${options.entityType} named "${options.name}":

\`\`\`
${content.slice(0, 2000)}
\`\`\``;
  }
}
