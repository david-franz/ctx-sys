/**
 * Phase 7: Model Providers
 * Abstraction layer for different LLM providers
 */

export interface ModelProvider {
  modelId: string;
  isAvailable(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export class OllamaProvider implements ModelProvider {
  modelId: string;
  baseUrl: string;

  constructor(config: any) {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async connect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    throw new Error('Not implemented');
  }
}

export class OpenAIProvider implements ModelProvider {
  modelId: string;
  apiKey: string;

  constructor(config: any) {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async connect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    throw new Error('Not implemented');
  }
}

export class AnthropicProvider implements ModelProvider {
  modelId: string;
  apiKey: string;

  constructor(config: any) {
    throw new Error('Not implemented');
  }

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async connect(): Promise<void> {
    throw new Error('Not implemented');
  }

  async disconnect(): Promise<void> {
    throw new Error('Not implemented');
  }
}
