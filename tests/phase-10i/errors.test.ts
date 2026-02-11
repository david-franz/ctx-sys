/**
 * Tests for structured error classes and ollamaFetch wrapper.
 */

import {
  CtxError,
  OllamaUnavailableError,
  OllamaModelNotFoundError,
  NotFoundError,
  AlreadyExistsError,
  DatabaseError,
  ProviderUnavailableError,
} from '../../src/errors';
import { ollamaFetch } from '../../src/utils/ollama-fetch';

// ─── CtxError base ──────────────────────────────────────────────────

describe('CtxError', () => {
  it('should store code and message', () => {
    const err = new CtxError('something broke', 'DATABASE_ERROR');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('DATABASE_ERROR');
    expect(err.name).toBe('CtxError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should include fix in toUserString()', () => {
    const err = new CtxError('bad', 'INVALID_INPUT', 'check your args');
    expect(err.toUserString()).toContain('bad');
    expect(err.toUserString()).toContain('Fix: check your args');
  });

  it('should return structured MCP response', () => {
    const err = new CtxError('bad', 'INVALID_INPUT', 'fix it');
    const mcp = err.toMcpResponse();
    expect(mcp).toEqual({ error: 'bad', code: 'INVALID_INPUT', fix: 'fix it' });
  });

  it('should omit fix from MCP response when absent', () => {
    const err = new CtxError('bad', 'INVALID_INPUT');
    const mcp = err.toMcpResponse();
    expect(mcp.fix).toBeUndefined();
  });
});

// ─── Subclasses ─────────────────────────────────────────────────────

describe('OllamaUnavailableError', () => {
  it('should set code and fix suggestion', () => {
    const err = new OllamaUnavailableError('http://127.0.0.1:11434');
    expect(err.code).toBe('OLLAMA_UNAVAILABLE');
    expect(err.message).toContain('127.0.0.1:11434');
    expect(err.fix).toContain('ollama serve');
    expect(err.name).toBe('OllamaUnavailableError');
    expect(err).toBeInstanceOf(CtxError);
  });

  it('should preserve cause', () => {
    const cause = new TypeError('fetch failed');
    const err = new OllamaUnavailableError('http://localhost:11434', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('OllamaModelNotFoundError', () => {
  it('should include model name in message and fix', () => {
    const err = new OllamaModelNotFoundError('mxbai-embed-large');
    expect(err.code).toBe('OLLAMA_MODEL_NOT_FOUND');
    expect(err.message).toContain('mxbai-embed-large');
    expect(err.fix).toContain('ollama pull mxbai-embed-large');
    expect(err.name).toBe('OllamaModelNotFoundError');
  });
});

describe('NotFoundError', () => {
  it('should set code based on resource type', () => {
    expect(new NotFoundError('Project', 'foo').code).toBe('PROJECT_NOT_FOUND');
    expect(new NotFoundError('Session', 'abc').code).toBe('SESSION_NOT_FOUND');
    expect(new NotFoundError('Entity', '123').code).toBe('ENTITY_NOT_FOUND');
  });
});

describe('AlreadyExistsError', () => {
  it('should set code based on resource type', () => {
    expect(new AlreadyExistsError('Project', 'foo').code).toBe('PROJECT_EXISTS');
    expect(new AlreadyExistsError('Entity', 'bar').code).toBe('ENTITY_EXISTS');
  });
});

describe('DatabaseError', () => {
  it('should detect locked database', () => {
    const cause = new Error('SQLITE_BUSY: database is locked');
    const err = new DatabaseError('insert', cause);
    expect(err.code).toBe('DATABASE_LOCKED');
    expect(err.fix).toContain('Close other');
  });

  it('should handle generic database error', () => {
    const cause = new Error('constraint failed');
    const err = new DatabaseError('upsert', cause);
    expect(err.code).toBe('DATABASE_ERROR');
    expect(err.message).toContain('constraint failed');
  });
});

describe('ProviderUnavailableError', () => {
  it('should list tried providers', () => {
    const err = new ProviderUnavailableError('embedding', ['ollama:mxbai', 'openai:ada']);
    expect(err.code).toBe('PROVIDER_UNAVAILABLE');
    expect(err.message).toContain('ollama:mxbai');
    expect(err.message).toContain('openai:ada');
    expect(err.fix).toContain('ollama serve');
  });
});

// ─── ollamaFetch wrapper ────────────────────────────────────────────

describe('ollamaFetch', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return response on success', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[1, 2, 3]] }),
    });

    const res = await ollamaFetch('http://127.0.0.1:11434/api/embed', {
      method: 'POST',
      body: JSON.stringify({ model: 'test', input: 'hello' }),
    });
    expect(res.ok).toBe(true);
  });

  it('should throw OllamaModelNotFoundError on 404', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'model "foo" not found',
    });

    await expect(
      ollamaFetch('http://127.0.0.1:11434/api/embed', {
        method: 'POST',
        body: JSON.stringify({ model: 'foo', input: 'hello' }),
      })
    ).rejects.toThrow(OllamaModelNotFoundError);
  });

  it('should throw OllamaUnavailableError on fetch failure', async () => {
    const fetchError = new TypeError('fetch failed');
    globalThis.fetch = jest.fn().mockRejectedValue(fetchError);

    await expect(
      ollamaFetch('http://127.0.0.1:11434/api/embed', {
        method: 'POST',
        body: JSON.stringify({ model: 'test', input: 'hello' }),
      })
    ).rejects.toThrow(OllamaUnavailableError);
  });

  it('should throw CtxError for other HTTP errors', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'server crash',
    });

    await expect(
      ollamaFetch('http://127.0.0.1:11434/api/embed', {
        method: 'POST',
        body: JSON.stringify({ model: 'test', input: 'hello' }),
      })
    ).rejects.toThrow(CtxError);
  });

  it('should extract model name from request body', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'model not found',
    });

    try {
      await ollamaFetch('http://127.0.0.1:11434/api/embed', {
        method: 'POST',
        body: JSON.stringify({ model: 'my-model' }),
      });
    } catch (err) {
      expect(err).toBeInstanceOf(OllamaModelNotFoundError);
      expect((err as OllamaModelNotFoundError).message).toContain('my-model');
    }
  });
});

// ─── CLI error handler ──────────────────────────────────────────────

describe('handleCliError', () => {
  const { handleCliError } = require('../../src/cli/error-handler');
  const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit');
  });
  const mockError = jest.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    mockExit.mockClear();
    mockError.mockClear();
  });

  afterAll(() => {
    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('should format CtxError with fix suggestion', () => {
    const err = new OllamaUnavailableError('http://localhost:11434');
    expect(() => handleCliError(err)).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Fix:'));
  });

  it('should format plain Error without fix', () => {
    expect(() => handleCliError(new Error('boom'))).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('Error: boom');
  });

  it('should handle non-Error values', () => {
    expect(() => handleCliError('string error')).toThrow('process.exit');
    expect(mockError).toHaveBeenCalledWith('Error: string error');
  });
});
