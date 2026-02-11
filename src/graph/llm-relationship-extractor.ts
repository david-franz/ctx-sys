/**
 * F10.9: LLM-powered relationship discovery between entities.
 * Uses Ollama (qwen3:0.6b) to find semantic relationships.
 */

import { ollamaFetch } from '../utils/ollama-fetch';

const VALID_RELATIONSHIPS = [
  'CONTAINS', 'CALLS', 'IMPORTS', 'IMPLEMENTS', 'EXTENDS',
  'MENTIONS', 'RELATES_TO', 'DEPENDS_ON', 'DEFINED_IN',
  'USES', 'REFERENCES', 'DOCUMENTS', 'CONFIGURES', 'TESTS'
] as const;

export interface ExtractedRelationship {
  source: string;
  target: string;
  relationship: string;
  confidence: number;
  reasoning?: string;
}

export interface EntityInfo {
  name: string;
  type: string;
  description?: string;
}

export interface LLMRelationshipExtractorOptions {
  baseUrl?: string;
  model?: string;
}

export class LLMRelationshipExtractor {
  private baseUrl: string;
  private model: string;

  constructor(options: LLMRelationshipExtractorOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'qwen3:0.6b';
  }

  async extractFromEntities(
    entities: EntityInfo[],
    context?: string
  ): Promise<ExtractedRelationship[]> {
    if (entities.length < 2) return [];

    const entityList = entities.slice(0, 20).map(
      (e, i) => `${i + 1}. ${e.name} (${e.type})${e.description ? ': ' + e.description.slice(0, 100) : ''}`
    ).join('\n');

    const prompt = `Given these entities, identify relationships between them.
Return a JSON array of relationships.
Each relationship: { source: "name", target: "name", relationship: "TYPE", confidence: 0-1, reasoning: "why" }
Valid relationship types: ${VALID_RELATIONSHIPS.join(', ')}

${context ? `Context: ${context}\n` : ''}
Entities:
${entityList}

Return ONLY a JSON array. Example: [{"source":"React","target":"Component","relationship":"CONTAINS","confidence":0.9,"reasoning":"React contains components"}]`;

    return this.callLLM(prompt);
  }

  async extractCrossDocument(
    newEntities: EntityInfo[],
    existingEntities: EntityInfo[],
    context?: string
  ): Promise<ExtractedRelationship[]> {
    if (newEntities.length === 0 || existingEntities.length === 0) return [];

    const newList = newEntities.slice(0, 10).map(
      (e, i) => `  ${i + 1}. ${e.name} (${e.type})${e.description ? ': ' + e.description.slice(0, 80) : ''}`
    ).join('\n');

    const existingList = existingEntities.slice(0, 15).map(
      (e, i) => `  ${i + 1}. ${e.name} (${e.type})${e.description ? ': ' + e.description.slice(0, 80) : ''}`
    ).join('\n');

    const prompt = `Find relationships between NEW entities and EXISTING entities.
Return a JSON array of relationships.
Each: { source: "name", target: "name", relationship: "TYPE", confidence: 0-1 }
Valid types: ${VALID_RELATIONSHIPS.join(', ')}

${context ? `Context: ${context}\n` : ''}
NEW entities:
${newList}

EXISTING entities:
${existingList}

Return ONLY a JSON array, no explanation.`;

    return this.callLLM(prompt);
  }

  private async callLLM(prompt: string): Promise<ExtractedRelationship[]> {
    try {
      const response = await ollamaFetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
      });

      const data = await response.json() as { response: string };
      return this.parseResponse(data.response);
    } catch {
      return [];
    }
  }

  private parseResponse(raw: string): ExtractedRelationship[] {
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];

    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((r: any) =>
          r.source && r.target && r.relationship &&
          VALID_RELATIONSHIPS.includes(r.relationship)
        )
        .map((r: any) => ({
          source: String(r.source),
          target: String(r.target),
          relationship: String(r.relationship),
          confidence: Math.min(1, Math.max(0, Number(r.confidence || 0.5))),
          reasoning: r.reasoning ? String(r.reasoning) : undefined,
        }));
    } catch {
      return [];
    }
  }
}
