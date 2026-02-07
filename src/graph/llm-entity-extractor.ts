/**
 * F10.9: LLM-powered entity extraction from free text.
 * Uses Ollama (qwen3:0.6b) to discover entities in documents.
 */

export interface ExtractedEntity {
  name: string;
  type: string;
  description: string;
  confidence: number;
}

export interface LLMEntityExtractorOptions {
  baseUrl?: string;
  model?: string;
}

export class LLMEntityExtractor {
  private baseUrl: string;
  private model: string;

  constructor(options: LLMEntityExtractorOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'qwen3:0.6b';
  }

  async extract(text: string, context?: string): Promise<ExtractedEntity[]> {
    const truncated = text.slice(0, 3000);

    const prompt = `Extract named entities from the following text. Return a JSON array of entities.
Each entity should have: name, type (one of: concept, technology, pattern, component, person, api), description, confidence (0-1).
Only return entities that are clearly identifiable. Be precise.

${context ? `Context: ${context}\n` : ''}
Text:
${truncated}

Return ONLY a JSON array, no other text. Example: [{"name":"React","type":"technology","description":"Frontend framework","confidence":0.95}]`;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
      });

      if (!response.ok) return [];

      const data = await response.json() as { response: string };
      return this.parseResponse(data.response);
    } catch {
      return [];
    }
  }

  private parseResponse(raw: string): ExtractedEntity[] {
    // Strip <think> tags
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Extract JSON array
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];

    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((e: any) => e.name && e.type && typeof e.confidence === 'number')
        .map((e: any) => ({
          name: String(e.name),
          type: String(e.type),
          description: String(e.description || ''),
          confidence: Math.min(1, Math.max(0, Number(e.confidence))),
        }));
    } catch {
      return [];
    }
  }
}
