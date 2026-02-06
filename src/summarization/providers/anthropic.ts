/**
 * F10.6: Anthropic summarization provider.
 */

import {
  SummarizationProvider,
  SummarizeOptions,
  SummarizeItem,
  AnthropicOptions
} from './types';

/**
 * Anthropic-based cloud LLM summarization provider.
 */
export class AnthropicSummarizationProvider implements SummarizationProvider {
  readonly id = 'anthropic';
  readonly model: string;

  private apiKey: string;

  constructor(options: AnthropicOptions = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = options.model || 'claude-3-haiku-20240307';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async summarize(content: string, options: SummarizeOptions): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options.maxTokens ?? 150,
        messages: [
          {
            role: 'user',
            content: this.buildPrompt(content, options)
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(`Anthropic error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>
    };
    return data.content[0].text.trim();
  }

  async summarizeBatch(items: SummarizeItem[]): Promise<string[]> {
    const concurrency = 5;
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

  private buildPrompt(content: string, options: SummarizeOptions): string {
    return `Summarize this ${options.entityType} named "${options.name}" in 1-3 concise sentences.
Focus on what it does, not implementation details. Be direct.

\`\`\`
${content.slice(0, 2000)}
\`\`\``;
  }
}
