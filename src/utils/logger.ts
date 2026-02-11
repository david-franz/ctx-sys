/**
 * Injectable logger interface replacing bare console.* calls in library code.
 * CLI files intentionally keep console.* for terminal output.
 */

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Default logger that writes to console. Debug is silent by default. */
export const consoleLogger: Logger = {
  debug: () => {},
  info: (msg, ...args) => console.log(msg, ...args),
  warn: (msg, ...args) => console.warn(msg, ...args),
  error: (msg, ...args) => console.error(msg, ...args),
};

/** Silent logger for tests and library consumers who want no output. */
export const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Log level names in ascending severity order. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, silent: 4
};

/** Create a logger that filters messages below the given minimum level. */
export function createLogger(minLevel: LogLevel = 'warn'): Logger {
  const min = LEVEL_ORDER[minLevel];
  return {
    debug: min <= 0 ? (msg, ...a) => console.debug(msg, ...a) : () => {},
    info:  min <= 1 ? (msg, ...a) => console.log(msg, ...a) : () => {},
    warn:  min <= 2 ? (msg, ...a) => console.warn(msg, ...a) : () => {},
    error: min <= 3 ? (msg, ...a) => console.error(msg, ...a) : () => {},
  };
}
