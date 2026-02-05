/**
 * Project types and interfaces
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.2-project-management.test.ts for expected behavior.
 */

// Helper type for deep partial
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface Project {
  id: string;
  name: string;
  path: string;
  config: ProjectConfig;
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt?: Date;
  lastSyncCommit?: string;
}

export interface ProjectConfig {
  indexing: {
    mode: 'full' | 'manual' | 'auto';
    watch: boolean;
    ignore: string[];
  };
  summarization: {
    enabled: boolean;
    provider: 'ollama' | 'openai';
    model: string;
  };
  embeddings: {
    enabled?: boolean;
    provider: 'ollama' | 'openai';
    model: string;
  };
}
