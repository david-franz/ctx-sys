/**
 * McpServer - MCP server implementation
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.5-mcp-server.test.ts for expected behavior.
 */

import { ToolRegistry } from './registry';
import { AppContext } from './context';
import { ToolDefinition } from './types';
import { DatabaseConnection } from '../db/connection';
import { ProjectManager } from '../project/manager';
import { EntityStore } from '../entities/store';
import { EmbeddingManager } from '../embeddings/manager';
import { RelationshipStore } from '../relationships/store';

export interface McpServerDependencies {
  db: DatabaseConnection;
  projectManager: ProjectManager;
  entityStore: EntityStore;
  embeddingManager: EmbeddingManager;
  relationshipStore: RelationshipStore;
}

export class McpServer {
  public name: string;
  public version: string;
  public capabilities: { tools: any };
  public registry: ToolRegistry;
  public isRunning: boolean = false;
  public transportType: string = 'stdio';

  constructor(nameOrDeps: string | McpServerDependencies, version?: string, context?: AppContext) {
    throw new Error('Not implemented');
  }

  async listTools(): Promise<ToolDefinition[]> {
    throw new Error('Not implemented');
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    throw new Error('Not implemented');
  }

  async handleToolCall(name: string, args: Record<string, any>): Promise<any> {
    throw new Error('Not implemented');
  }

  async handleRequest(request: any): Promise<any> {
    throw new Error('Not implemented');
  }

  async start(): Promise<void> {
    throw new Error('Not implemented');
  }

  async stop(): Promise<void> {
    throw new Error('Not implemented');
  }

  getClaudeCodeConfig(options?: { development?: boolean }): any {
    throw new Error('Not implemented');
  }
}
