/**
 * Tests for F7.4 - CLI Interface
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import { createInitCommand, CLIOutput, defaultOutput } from '../../src/cli/init';
import { createIndexCommand } from '../../src/cli/index-cmd';
import { createSearchCommand } from '../../src/cli/search';
import { createWatchCommand } from '../../src/cli/watch';
import { createConfigCommand } from '../../src/cli/config';
import { createStatusCommand } from '../../src/cli/status';
import { ConfigManager } from '../../src/config';

/**
 * Create a mock CLI output for testing.
 */
function createMockOutput(): CLIOutput & { logs: string[]; errors: string[] } {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    log: (msg: string) => logs.push(msg),
    error: (msg: string) => errors.push(msg),
    success: (msg: string) => logs.push(`✓ ${msg}`)
  };
}

describe('CLI Commands', () => {
  describe('createInitCommand', () => {
    it('should create init command', () => {
      const command = createInitCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('init');
    });

    it('should have expected options', () => {
      const command = createInitCommand();
      const options = command.options.map(o => o.long || o.short);

      expect(options).toContain('--name');
      expect(options).toContain('--force');
      expect(options).toContain('--global');
    });

    it('should accept directory argument', () => {
      const command = createInitCommand();
      const args = command.registeredArguments;
      expect(args.length).toBeGreaterThan(0);
    });

    it('should have description', () => {
      const command = createInitCommand();
      expect(command.description()).toContain('Initialize');
    });
  });

  describe('createIndexCommand', () => {
    it('should create index command', () => {
      const command = createIndexCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('index');
    });

    it('should have expected options', () => {
      const command = createIndexCommand();
      const options = command.options.map(o => o.long || o.short);

      expect(options).toContain('--force');
      expect(options).toContain('--full');
      expect(options).toContain('--concurrency');
      expect(options).toContain('--include');
      expect(options).toContain('--exclude');
      expect(options).toContain('--quiet');
      expect(options).toContain('--db');
    });

    it('should have description', () => {
      const command = createIndexCommand();
      expect(command.description()).toContain('Index');
    });
  });

  describe('createSearchCommand', () => {
    it('should create search command', () => {
      const command = createSearchCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('search');
    });

    it('should have expected options', () => {
      const command = createSearchCommand();
      const options = command.options.map(o => o.long || o.short);

      expect(options).toContain('--project');
      expect(options).toContain('--limit');
      expect(options).toContain('--type');
      expect(options).toContain('--format');
      expect(options).toContain('--db');
    });

    it('should require query argument', () => {
      const command = createSearchCommand();
      const args = command.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].required).toBe(true);
    });

    it('should have description', () => {
      const command = createSearchCommand();
      expect(command.description()).toContain('Search');
    });
  });

  describe('createWatchCommand', () => {
    it('should create watch command', () => {
      const command = createWatchCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('watch');
    });

    it('should have expected options', () => {
      const command = createWatchCommand();
      const options = command.options.map(o => o.long || o.short);

      expect(options).toContain('--db');
      expect(options).toContain('--debounce');
      expect(options).toContain('--include');
      expect(options).toContain('--exclude');
      expect(options).toContain('--quiet');
    });

    it('should have description', () => {
      const command = createWatchCommand();
      expect(command.description()).toContain('Watch');
    });
  });

  describe('createConfigCommand', () => {
    it('should create config command', () => {
      const command = createConfigCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('config');
    });

    it('should have subcommands', () => {
      const command = createConfigCommand();
      const subcommands = command.commands.map(c => c.name());

      expect(subcommands).toContain('get');
      expect(subcommands).toContain('set');
      expect(subcommands).toContain('list');
      expect(subcommands).toContain('path');
    });

    it('should have description', () => {
      const command = createConfigCommand();
      expect(command.description()).toContain('config');
    });
  });

  describe('createStatusCommand', () => {
    it('should create status command', () => {
      const command = createStatusCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('status');
    });

    it('should have expected options', () => {
      const command = createStatusCommand();
      const options = command.options.map(o => o.long || o.short);

      expect(options).toContain('--db');
      expect(options).toContain('--json');
    });

    it('should have description', () => {
      const command = createStatusCommand();
      expect(command.description()).toContain('status');
    });
  });
});

describe('Init Command Integration', () => {
  let testDir: string;
  let mockOutput: CLIOutput & { logs: string[]; errors: string[] };

  beforeEach(async () => {
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ctx-sys-cli-test-'));
    mockOutput = createMockOutput();
  });

  afterEach(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('should initialize project config', async () => {
    const configManager = new ConfigManager();

    // Project config should not exist initially
    expect(await configManager.projectConfigExists(testDir)).toBe(false);

    // Initialize
    const command = createInitCommand(mockOutput);
    await command.parseAsync(['node', 'test', testDir]);

    // Project config should now exist
    expect(await configManager.projectConfigExists(testDir)).toBe(true);
    expect(mockOutput.logs.some(l => l.includes('initialized'))).toBe(true);
  });

  it('should initialize with custom project name', async () => {
    const command = createInitCommand(mockOutput);
    await command.parseAsync(['node', 'test', testDir, '--name', 'my-project']);

    const configManager = new ConfigManager();
    const config = await configManager.loadProject(testDir);

    expect(config.project.name).toBe('my-project');
  });

  it('should show next steps after init', async () => {
    const command = createInitCommand(mockOutput);
    await command.parseAsync(['node', 'test', testDir]);

    expect(mockOutput.logs.some(l => l.includes('Next steps'))).toBe(true);
  });
});

describe('Status Command Integration', () => {
  let testDir: string;
  let mockOutput: CLIOutput & { logs: string[]; errors: string[] };

  beforeEach(async () => {
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ctx-sys-cli-test-'));
    mockOutput = createMockOutput();
  });

  afterEach(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  it('should show status for uninitialized project', async () => {
    const command = createStatusCommand(mockOutput);
    await command.parseAsync(['node', 'test', testDir]);

    expect(mockOutput.logs.some(l => l.includes('not initialized'))).toBe(true);
  });

  it('should show status as JSON', async () => {
    const command = createStatusCommand(mockOutput);
    await command.parseAsync(['node', 'test', testDir, '--json']);

    // Should have output valid JSON
    const jsonOutput = mockOutput.logs.join('');
    expect(() => JSON.parse(jsonOutput)).not.toThrow();
  });

  it('should show database status', async () => {
    const command = createStatusCommand(mockOutput);
    await command.parseAsync(['node', 'test', testDir]);

    expect(mockOutput.logs.some(l => l.includes('Database'))).toBe(true);
  });
});

describe('Mock Output', () => {
  it('should capture log messages', () => {
    const output = createMockOutput();

    output.log('test message');
    output.log('another message');

    expect(output.logs).toContain('test message');
    expect(output.logs).toContain('another message');
  });

  it('should capture error messages', () => {
    const output = createMockOutput();

    output.error('error message');

    expect(output.errors).toContain('error message');
  });

  it('should capture success messages with checkmark', () => {
    const output = createMockOutput();

    output.success('success message');

    expect(output.logs).toContain('✓ success message');
  });
});

describe('CLI Output Interface', () => {
  it('should export CLIOutput interface', () => {
    const output: CLIOutput = {
      log: () => {},
      error: () => {},
      success: () => {}
    };

    expect(output.log).toBeDefined();
    expect(output.error).toBeDefined();
    expect(output.success).toBeDefined();
  });

  it('should export defaultOutput', () => {
    expect(defaultOutput).toBeDefined();
    expect(defaultOutput.log).toBeDefined();
    expect(defaultOutput.error).toBeDefined();
    expect(defaultOutput.success).toBeDefined();
  });
});

describe('Command Options Defaults', () => {
  it('should have default concurrency for index', () => {
    const command = createIndexCommand();
    const concurrencyOption = command.options.find(o => o.long === '--concurrency');
    expect(concurrencyOption?.defaultValue).toBe('5');
  });

  it('should have default limit for search', () => {
    const command = createSearchCommand();
    const limitOption = command.options.find(o => o.long === '--limit');
    expect(limitOption?.defaultValue).toBe('10');
  });

  it('should have default format for search', () => {
    const command = createSearchCommand();
    const formatOption = command.options.find(o => o.long === '--format');
    expect(formatOption?.defaultValue).toBe('text');
  });

  it('should have default debounce for watch', () => {
    const command = createWatchCommand();
    const debounceOption = command.options.find(o => o.long === '--debounce');
    expect(debounceOption?.defaultValue).toBe('300');
  });
});
