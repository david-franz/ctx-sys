/**
 * Jest setup file
 * Runs before all tests
 */

// Make this file a module
export {};

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`
    };
  },

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be within range ${floor} - ${ceiling}`
        : `expected ${received} to be within range ${floor} - ${ceiling}`
    };
  },

  toHaveBeenCalledWithMatch(received: jest.Mock, expected: Record<string, unknown>) {
    const calls = received.mock.calls;
    const pass = calls.some(call =>
      Object.entries(expected).every(([key, value]) =>
        call[0] && call[0][key] === value
      )
    );
    return {
      pass,
      message: () => pass
        ? `expected mock not to have been called with matching object`
        : `expected mock to have been called with object matching ${JSON.stringify(expected)}`
    };
  }
});

// Declare custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeWithinRange(floor: number, ceiling: number): R;
      toHaveBeenCalledWithMatch(expected: Record<string, unknown>): R;
    }
  }
}

// Silence console during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging failed tests
    error: console.error
  };
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
