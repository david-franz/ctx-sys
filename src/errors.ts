/**
 * Structured error classes for ctx-sys.
 * Every error carries a user-facing message, error code, and optional fix suggestion.
 */

export type ErrorCode =
  | 'OLLAMA_UNAVAILABLE'
  | 'OLLAMA_MODEL_NOT_FOUND'
  | 'OLLAMA_REQUEST_FAILED'
  | 'EMBEDDING_FAILED'
  | 'DATABASE_ERROR'
  | 'DATABASE_LOCKED'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_EXISTS'
  | 'ENTITY_NOT_FOUND'
  | 'ENTITY_EXISTS'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'FILE_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'PROVIDER_UNAVAILABLE';

/**
 * Base error for all ctx-sys errors.
 */
export class CtxError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly fix?: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'CtxError';
  }

  /** Format for CLI output. */
  toUserString(): string {
    let msg = this.message;
    if (this.fix) msg += `\n  Fix: ${this.fix}`;
    return msg;
  }

  /** Format for MCP tool response. */
  toMcpResponse(): { error: string; code: string; fix?: string } {
    return {
      error: this.message,
      code: this.code,
      fix: this.fix,
    };
  }
}

/** Ollama is not reachable at the configured URL. */
export class OllamaUnavailableError extends CtxError {
  constructor(url: string, cause?: Error) {
    super(
      `Cannot connect to Ollama at ${url}`,
      'OLLAMA_UNAVAILABLE',
      'Start Ollama with: ollama serve\nOr check your config: ctx-sys status --check',
      cause,
    );
    this.name = 'OllamaUnavailableError';
  }
}

/** The requested model is not pulled in Ollama. */
export class OllamaModelNotFoundError extends CtxError {
  constructor(model: string, cause?: Error) {
    super(
      `Ollama model "${model}" is not available`,
      'OLLAMA_MODEL_NOT_FOUND',
      `Pull the model with: ollama pull ${model}`,
      cause,
    );
    this.name = 'OllamaModelNotFoundError';
  }
}

/** A resource (project, entity, session) was not found. */
export class NotFoundError extends CtxError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} not found: ${identifier}`,
      resource === 'Project' ? 'PROJECT_NOT_FOUND'
        : resource === 'Session' ? 'SESSION_NOT_FOUND'
        : 'ENTITY_NOT_FOUND',
    );
    this.name = 'NotFoundError';
  }
}

/** A resource already exists (duplicate name, etc.). */
export class AlreadyExistsError extends CtxError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} already exists: ${identifier}`,
      resource === 'Project' ? 'PROJECT_EXISTS' : 'ENTITY_EXISTS',
    );
    this.name = 'AlreadyExistsError';
  }
}

/** Database operation failed. */
export class DatabaseError extends CtxError {
  constructor(operation: string, cause?: Error) {
    const isLocked = cause?.message?.includes('database is locked');
    super(
      isLocked
        ? 'Database is locked — another process may be using it'
        : `Database error during ${operation}: ${cause?.message ?? 'unknown'}`,
      isLocked ? 'DATABASE_LOCKED' : 'DATABASE_ERROR',
      isLocked ? 'Close other ctx-sys processes and try again' : undefined,
      cause,
    );
    this.name = 'DatabaseError';
  }
}

/** No embedding or summarization provider is available. */
export class ProviderUnavailableError extends CtxError {
  constructor(type: 'embedding' | 'summarization', tried: string[]) {
    super(
      `No ${type} provider available (tried: ${tried.join(', ')})`,
      'PROVIDER_UNAVAILABLE',
      'Ensure Ollama is running: ollama serve\nOr configure an OpenAI API key in ~/.ctx-sys/config.yaml',
    );
    this.name = 'ProviderUnavailableError';
  }
}
