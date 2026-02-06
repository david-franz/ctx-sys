/**
 * F10.6: Ollama (local) summarization provider.
 */

import {
  SummarizationProvider,
  SummarizeOptions,
  SummarizeItem,
  OllamaOptions
} from './types';

/**
 * Ollama-based local LLM summarization provider.
 */
export class OllamaSummarizationProvider implements SummarizationProvider {
  readonly id = 'ollama';
  readonly model: string;

  private baseUrl: string;
  private available: boolean | null = null;

  constructor(options: OllamaOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'qwen2.5-coder:7b';
  }

  async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.available = false;
        return false;
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models?.map(m => m.name) || [];

      // Check if our model is available
      this.available = models.some(m =>
        m === this.model || m.startsWith(this.model.split(':')[0])
      );

      return this.available;
    } catch {
      this.available = false;
      return false;
    }
  }

  async summarize(content: string, options: SummarizeOptions): Promise<string> {
    const prompt = this.buildPrompt(content, options);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.3,
          num_predict: options.maxTokens ?? 150
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json() as { response: string };
    return data.response.trim();
  }

  async summarizeBatch(items: SummarizeItem[]): Promise<string[]> {
    // Ollama doesn't have native batch API, process with concurrency limit
    const results: string[] = [];
    const concurrency = 3;

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
    const typePrompts: Record<string, string> = {
      function: `Summarize this ${options.name} function in 1-2 sentences.
Focus on: what it does, key parameters, return value, and any side effects.`,

      method: `Summarize this ${options.name} method in 1-2 sentences.
Focus on: its purpose within the class, parameters, return value.`,

      class: `Summarize this ${options.name} class in 2-3 sentences.
Focus on: its responsibility, key methods, and relationships.`,

      interface: `Summarize this ${options.name} interface in 1-2 sentences.
Focus on: what it defines and its purpose in the codebase.`,

      module: `Summarize this module in 2-3 sentences.
Focus on: what functionality it provides and its main exports.`,

      file: `Summarize this file in 2-3 sentences.
Focus on: its purpose, main exports, and how it fits in the codebase.`
    };

    const typePrompt = typePrompts[options.entityType] ||
      `Summarize this ${options.entityType} in 1-2 sentences.`;

    return `${typePrompt}

Be concise and technical. Don't start with "This function..." - just describe what it does.

Code:
\`\`\`
${content.slice(0, 2000)}
\`\`\`

Summary:`;
  }
}
