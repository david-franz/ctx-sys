/**
 * Mock factories and utilities for testing
 * These mocks ensure tests don't write actual data
 */

import { EventEmitter } from 'events';

// ============================================================================
// Database Mocks (F1.1)
// ============================================================================

export interface MockDatabaseRow {
  [key: string]: unknown;
}

export class MockDatabase {
  private tables: Map<string, MockDatabaseRow[]> = new Map();
  private autoIncrement: Map<string, number> = new Map();

  // Use 'any' return types to allow type assertions in tests
  run = jest.fn((_sql: string, _params?: unknown[]): { changes: number; lastInsertRowid?: number } => {
    // Track SQL execution
    return { changes: 1, lastInsertRowid: 1 };
  });

  get = jest.fn((_sql: string, _params?: unknown[]): any => {
    return undefined;
  });

  all = jest.fn((_sql: string, _params?: unknown[]): any[] => {
    return [];
  });

  exec = jest.fn((_sql: string) => {
    // Execute multiple statements
  });

  prepare = jest.fn((_sql: string) => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    finalize: jest.fn()
  }));

  transaction = jest.fn(<T>(fn: () => T): T => {
    return fn();
  });

  pragma = jest.fn();

  loadExtension = jest.fn();

  close = jest.fn();

  // Helper to set up mock returns
  mockGet<T>(data: T): void {
    this.get.mockReturnValueOnce(data);
  }

  mockAll<T>(data: T[]): void {
    this.all.mockReturnValueOnce(data);
  }

  mockRun(data: { changes: number; lastInsertRowid?: number }): void {
    this.run.mockReturnValueOnce({ changes: data.changes, lastInsertRowid: data.lastInsertRowid });
  }

  reset(): void {
    this.tables.clear();
    this.autoIncrement.clear();
    jest.clearAllMocks();
  }
}

export function createMockDatabase(): MockDatabase {
  return new MockDatabase();
}

// ============================================================================
// Entity Mocks (F1.3)
// ============================================================================

export interface MockEntity {
  id: string;
  type: string;
  name: string;
  qualifiedName?: string;
  content?: string;
  summary?: string;
  metadata: Record<string, unknown>;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  hash?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createMockEntity(overrides: Partial<MockEntity> = {}): MockEntity {
  return {
    id: 'entity-' + Math.random().toString(36).slice(2, 10),
    type: 'function',
    name: 'testFunction',
    qualifiedName: 'src/test.ts::testFunction',
    content: 'function testFunction() {}',
    summary: 'A test function',
    metadata: {},
    filePath: 'src/test.ts',
    startLine: 1,
    endLine: 3,
    hash: 'abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// ============================================================================
// Project Mocks (F1.2)
// ============================================================================

export interface MockProject {
  id: string;
  name: string;
  path: string;
  config: MockProjectConfig;
  createdAt: Date;
  updatedAt: Date;
  lastIndexedAt?: Date;
  lastSyncCommit?: string;
}

export interface MockProjectConfig {
  indexing: {
    mode: 'full' | 'incremental' | 'manual';
    watch: boolean;
    ignore: string[];
    languages?: string[];
  };
  summarization: {
    enabled: boolean;
    provider: string;
    model: string;
  };
  embeddings: {
    provider: string;
    model: string;
  };
  sessions: {
    retention: number;
    autoSummarize: boolean;
  };
  retrieval: {
    defaultMaxTokens: number;
    strategies: string[];
  };
}

export function createMockProject(overrides: Partial<MockProject> = {}): MockProject {
  return {
    id: 'proj-' + Math.random().toString(36).slice(2, 10),
    name: 'test-project',
    path: '/home/user/test-project',
    config: createMockProjectConfig(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

export function createMockProjectConfig(overrides: Partial<MockProjectConfig> = {}): MockProjectConfig {
  return {
    indexing: {
      mode: 'incremental',
      watch: false,
      ignore: ['node_modules', '.git'],
      ...overrides.indexing
    },
    summarization: {
      enabled: true,
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
      ...overrides.summarization
    },
    embeddings: {
      provider: 'ollama',
      model: 'nomic-embed-text',
      ...overrides.embeddings
    },
    sessions: {
      retention: 30,
      autoSummarize: true,
      ...overrides.sessions
    },
    retrieval: {
      defaultMaxTokens: 4000,
      strategies: ['vector', 'graph', 'fts'],
      ...overrides.retrieval
    }
  };
}

// ============================================================================
// Embedding Mocks (F1.4)
// ============================================================================

export class MockEmbeddingProvider {
  readonly name = 'mock';
  readonly modelId = 'mock:test-model';
  readonly dimensions = 768;

  embed = jest.fn(async (text: string): Promise<number[] | Float32Array> => {
    // Return deterministic embedding based on text hash
    return this.generateEmbedding(text);
  });

  embedBatch = jest.fn(async (texts: string[]): Promise<Array<number[] | Float32Array>> => {
    return texts.map(text => this.generateEmbedding(text));
  });

  isAvailable = jest.fn(async (): Promise<boolean> => {
    return true;
  });

  findSimilar = jest.fn(async (_query: string, _options?: { limit?: number; threshold?: number; entityTypes?: string[] }): Promise<Array<{ entityId: string; score: number }>> => {
    return [];
  });

  // Helper to override embed behavior
  mockEmbed(fn: (text: string) => Promise<number[] | Float32Array>): void {
    this.embed.mockImplementation(fn);
  }

  private generateEmbedding(text: string): number[] {
    // Generate a deterministic pseudo-random embedding
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      embedding.push(Math.sin(seed * (i + 1)) * 0.5);
    }
    return embedding;
  }
}

export function createMockEmbeddingProvider(): MockEmbeddingProvider {
  return new MockEmbeddingProvider();
}

// ============================================================================
// Summarization Mocks (F2.2)
// ============================================================================

export class MockSummarizationProvider {
  readonly name = 'mock';
  readonly modelId = 'mock:summarizer';

  summarize = jest.fn(async (content: string): Promise<string> => {
    // Return a mock summary
    const words = content.split(/\s+/).slice(0, 5).join(' ');
    return `Summary of: ${words}...`;
  });

  summarizeBatch = jest.fn(async (items: Array<{ content: string }>): Promise<string[]> => {
    return items.map(item => {
      const words = item.content.split(/\s+/).slice(0, 5).join(' ');
      return `Summary of: ${words}...`;
    });
  });

  isAvailable = jest.fn(async (): Promise<boolean> => {
    return true;
  });
}

export function createMockSummarizationProvider(): MockSummarizationProvider {
  return new MockSummarizationProvider();
}

// ============================================================================
// AST/Symbol Mocks (F2.1)
// ============================================================================

export interface MockSymbol {
  type: string;
  name: string;
  qualifiedName: string;
  signature?: string;
  parameters?: Array<{ name: string; type?: string; isOptional?: boolean }>;
  returnType?: string;
  decorators?: string[];
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  isExported?: boolean;
  startLine: number;
  endLine: number;
  docstring?: string;
  children?: MockSymbol[];
}

export function createMockSymbol(overrides: Partial<MockSymbol> = {}): MockSymbol {
  return {
    type: 'function',
    name: 'testFunction',
    qualifiedName: 'src/test.ts::testFunction',
    signature: 'testFunction(arg: string): void',
    parameters: [{ name: 'arg', type: 'string' }],
    returnType: 'void',
    startLine: 1,
    endLine: 5,
    ...overrides
  };
}

export function createMockClass(name: string, methods: string[] = []): MockSymbol {
  return {
    type: 'class',
    name,
    qualifiedName: `src/${name}.ts::${name}`,
    startLine: 1,
    endLine: 20,
    children: methods.map((methodName, i) => ({
      type: 'method',
      name: methodName,
      qualifiedName: `src/${name}.ts::${name}::${methodName}`,
      signature: `${methodName}(): void`,
      startLine: 3 + i * 3,
      endLine: 5 + i * 3
    }))
  };
}

// ============================================================================
// Relationship Mocks (F2.4)
// ============================================================================

export interface MockRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  relationship: string;
  weight: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export function createMockRelationship(overrides: Partial<MockRelationship> = {}): MockRelationship {
  return {
    id: 'rel-' + Math.random().toString(36).slice(2, 10),
    sourceId: 'entity-1',
    targetId: 'entity-2',
    type: 'CALLS',
    relationship: 'CALLS',
    weight: 1.0,
    createdAt: new Date(),
    ...overrides
  };
}

// ============================================================================
// Message/Session Mocks (F3.1, F3.2)
// ============================================================================

export interface MockMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface MockSession {
  id: string;
  name?: string;
  status: 'active' | 'archived' | 'summarized';
  summary?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export function createMockMessage(overrides: Partial<MockMessage> = {}): MockMessage {
  return {
    id: 'msg-' + Math.random().toString(36).slice(2, 10),
    sessionId: 'session-1',
    role: 'user',
    content: 'Test message content',
    createdAt: new Date(),
    ...overrides
  };
}

export function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: 'session-' + Math.random().toString(36).slice(2, 10),
    status: 'active',
    messageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// ============================================================================
// Document Mocks (F4.1)
// ============================================================================

export interface MockMarkdownSection {
  id: string;
  title: string;
  level: number;
  content: string;
  codeBlocks: Array<{ language?: string; code: string; startLine: number }>;
  links: Array<{ text: string; url: string; isInternal: boolean }>;
  parent?: string;
  children: string[];
  startLine: number;
  endLine: number;
}

export function createMockMarkdownSection(overrides: Partial<MockMarkdownSection> = {}): MockMarkdownSection {
  return {
    id: 'section-' + Math.random().toString(36).slice(2, 10),
    title: 'Test Section',
    level: 2,
    content: 'This is test content for the section.',
    codeBlocks: [],
    links: [],
    children: [],
    startLine: 1,
    endLine: 10,
    ...overrides
  };
}

// ============================================================================
// Search Result Mocks (F6.2)
// ============================================================================

export interface MockSearchResult {
  entityId: string;
  entity: MockEntity;
  score: number;
  source: 'vector' | 'graph' | 'fts';
  rank: number;
  highlights?: string[];
}

export function createMockSearchResult(overrides: Partial<MockSearchResult> = {}): MockSearchResult {
  const entity = createMockEntity();
  return {
    entityId: entity.id,
    entity,
    score: 0.85,
    source: 'vector',
    rank: 1,
    ...overrides
  };
}

// ============================================================================
// File System Mocks
// ============================================================================

export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  readFile = jest.fn(async (path: string): Promise<string> => {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file: ${path}`);
    }
    return content;
  });

  writeFile = jest.fn(async (path: string, content: string): Promise<void> => {
    this.files.set(path, content);
  });

  mkdir = jest.fn(async (path: string): Promise<void> => {
    this.directories.add(path);
  });

  exists = jest.fn(async (path: string): Promise<boolean> => {
    return this.files.has(path) || this.directories.has(path);
  });

  // Setup helpers
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  setDirectory(path: string): void {
    this.directories.add(path);
  }

  mockFiles(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(path, content);
    }
  }

  reset(): void {
    this.files.clear();
    this.directories.clear();
    jest.clearAllMocks();
  }
}

export function createMockFileSystem(): MockFileSystem {
  return new MockFileSystem();
}

// ============================================================================
// HTTP/Fetch Mocks
// ============================================================================

export interface MockFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

export function createMockFetch(responses: Map<string, MockFetchResponse>): jest.Mock {
  return jest.fn(async (url: string): Promise<MockFetchResponse> => {
    const response = responses.get(url);
    if (response) {
      return response;
    }
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Not Found' }),
      text: async () => 'Not Found'
    };
  });
}

// ============================================================================
// Event Emitter Mocks (for file watching, etc.)
// ============================================================================

export class MockEventEmitter extends EventEmitter {
  emitEvent(event: string, ...args: unknown[]): void {
    this.emit(event, ...args);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function hashContent(content: string): string {
  // Simple hash for testing
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 16).padStart(16, '0');
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
