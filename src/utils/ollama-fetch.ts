/**
 * Shared fetch wrapper for Ollama API calls.
 * Converts raw network errors into actionable CtxError subclasses.
 */

import { CtxError, OllamaUnavailableError, OllamaModelNotFoundError } from '../errors';

export async function ollamaFetch(
  url: string,
  options: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const body = await response.text().catch(() => '');

      if (response.status === 404 || (body.includes('model') && body.includes('not found'))) {
        const model = tryExtractModel(options.body);
        throw new OllamaModelNotFoundError(model ?? 'unknown');
      }

      throw new CtxError(
        `Ollama request failed (${response.status}): ${body || response.statusText}`,
        'OLLAMA_REQUEST_FAILED',
      );
    }

    return response;
  } catch (error) {
    if (error instanceof CtxError) throw error;

    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      const baseUrl = new URL(url).origin;
      throw new OllamaUnavailableError(baseUrl, error);
    }

    throw new CtxError(
      `Ollama request failed: ${error instanceof Error ? error.message : String(error)}`,
      'OLLAMA_REQUEST_FAILED',
      undefined,
      error instanceof Error ? error : undefined,
    );
  }
}

function tryExtractModel(body: RequestInit['body']): string | null {
  if (typeof body === 'string') {
    try { return JSON.parse(body).model ?? null; } catch { return null; }
  }
  return null;
}
