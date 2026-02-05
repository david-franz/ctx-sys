/**
 * Phase 7: Model Types
 * Type definitions for model abstraction
 */

export interface ModelConfig {
  model: string;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ModelCapabilities {
  embedding?: boolean;
  summarization?: boolean;
  generation?: boolean;
}

export interface ProviderConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface HealthStatus {
  healthy: boolean;
  message?: string;
  lastCheck?: Date;
}
