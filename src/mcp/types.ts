/**
 * MCP types and interfaces
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-1/F1.5-mcp-server.test.ts for expected behavior.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export type ToolHandler = (
  args: Record<string, any>,
  context: any
) => Promise<any>;

export interface ToolExecutionResult {
  success: boolean;
  [key: string]: any;
}

export class McpError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'McpError';
  }
}
