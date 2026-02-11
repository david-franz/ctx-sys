/**
 * CLI error handler — formats CtxError subclasses into actionable terminal output.
 */

import { CtxError } from '../errors';

/**
 * Format an error for CLI output and exit.
 * CtxError instances get their fix suggestion printed; other errors get a plain message.
 */
export function handleCliError(error: unknown): never {
  if (error instanceof CtxError) {
    console.error(`Error: ${error.toUserString()}`);
  } else {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}
