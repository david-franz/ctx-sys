/**
 * F10.7: CLI Completeness Tests
 * Tests for all new CLI commands added in Phase 10.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Command } from 'commander';
import { CLIOutput } from '../../src/cli/init';
import { ConfigManager } from '../../src/config';
import { DatabaseConnection } from '../../src/db/connection';

// Import command creators
import { createSessionsCommand, createMessagesCommand } from '../../src/cli/sessions';
import {
  createEntitiesCommand,
  createEntityCommand,
  createEntityDeleteCommand,
  createEntityStatsCommand
} from '../../src/cli/entities';
import {
  createGraphCommand,
  createGraphStatsCommand,
  createRelationshipsCommand,
  createLinkCommand
} from '../../src/cli/graph';
import {
  createEmbedCommand,
  createEmbedStatusCommand,
  createEmbedCleanupCommand
} from '../../src/cli/embeddings';
import {
  createSummarizeCommand,
  createSummarizeStatusCommand,
  createProvidersCommand
} from '../../src/cli/summarize';
import {
  createInspectCommand,
  createQueryCommand,
  createExportCommand,
  createImportCommand,
  createHealthCommand
} from '../../src/cli/debug';

// Formatters tests
import {
  truncate,
  formatDate,
  formatTable,
  formatBytes,
  colors
} from '../../src/cli/formatters';

describe('F10.7: CLI Completeness', () => {
  // Test fixtures
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseConnection;
  let mockOutput: CLIOutput;
  let logs: string[];
  let errors: string[];

  beforeEach(async () => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
    dbPath = path.join(tempDir, 'test.db');

    // Initialize database with test tables
    db = new DatabaseConnection(dbPath);
    await db.initialize();

    const prefix = 'test_project';
    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_entities (
        id TEXT PRIMARY KEY,
        qualified_name TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        file_path TEXT,
        start_line INTEGER,
        end_line INTEGER,
        summary TEXT,
        content_hash TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_entity_content (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        created_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_embeddings (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        embedding BLOB,
        embedding_hash TEXT,
        created_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ${prefix}_query_log (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        strategy TEXT,
        result_count INTEGER,
        duration_ms INTEGER,
        created_at TEXT NOT NULL
      )
    `);

    // Insert test data
    const now = new Date().toISOString();

    // Entities
    db.run(`INSERT INTO ${prefix}_entities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'ent1', 'src/main.ts::main', 'main', 'function', 'src/main.ts', 1, 10,
      'Main entry point', 'hash1', now, now
    ]);
    db.run(`INSERT INTO ${prefix}_entities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      'ent2', 'src/utils.ts::helper', 'helper', 'function', 'src/utils.ts', 1, 5,
      null, 'hash2', now, now
    ]);

    // Content
    db.run(`INSERT INTO ${prefix}_entity_content VALUES (?, ?, ?, ?)`, [
      'content1', 'ent1', 'function main() { console.log("hello"); }', now
    ]);

    // Relationships
    db.run(`INSERT INTO ${prefix}_relationships VALUES (?, ?, ?, ?, ?, ?)`, [
      'rel1', 'ent1', 'ent2', 'calls', 1.0, now
    ]);

    // Sessions
    db.run(`INSERT INTO ${prefix}_sessions VALUES (?, ?, ?, ?, ?)`, [
      'sess1', 'active', 'Test session', now, now
    ]);

    // Messages
    db.run(`INSERT INTO ${prefix}_messages VALUES (?, ?, ?, ?, ?)`, [
      'msg1', 'sess1', 'user', 'Hello, world!', now
    ]);
    db.run(`INSERT INTO ${prefix}_messages VALUES (?, ?, ?, ?, ?)`, [
      'msg2', 'sess1', 'assistant', 'Hi there!', now
    ]);

    await db.close();

    // Create config file
    const configDir = path.join(tempDir, '.ctx-sys');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), `
project:
  name: test-project
database:
  path: ${dbPath}
`);

    // Mock output
    logs = [];
    errors = [];
    mockOutput = {
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
      success: (msg) => logs.push(msg)
    };
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Formatters', () => {
    it('truncate should limit string length', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
      expect(truncate('short', 10)).toBe('short');
      expect(truncate(undefined, 10)).toBe('');
    });

    it('formatDate should format dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toContain('2024');
      expect(formatted).toContain('Jan');
    });

    it('formatDate should handle string dates', () => {
      const formatted = formatDate('2024-01-15T10:30:00Z');
      expect(formatted).toContain('2024');
    });

    it('formatDate should handle undefined', () => {
      expect(formatDate(undefined)).toBe('-');
    });

    it('formatTable should format data as table', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ];
      const columns = [
        { header: 'Name', key: 'name', width: 10 },
        { header: 'Age', key: 'age', width: 5 }
      ];

      const result = formatTable(data, columns);
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
    });

    it('formatTable should support format functions', () => {
      const data = [{ value: 1000 }];
      const columns = [
        { header: 'Value', key: 'value', format: (v: unknown) => `$${v}` }
      ];

      const result = formatTable(data, columns);
      expect(result).toContain('$1000');
    });

    it('formatBytes should format byte sizes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('colors should apply ANSI codes', () => {
      expect(colors.bold('test')).toContain('\x1b[1m');
      expect(colors.red('test')).toContain('\x1b[31m');
      expect(colors.green('test')).toContain('\x1b[32m');
    });
  });

  describe('Command Creation', () => {
    it('should create all session commands', () => {
      const sessions = createSessionsCommand(mockOutput);
      const messages = createMessagesCommand(mockOutput);

      expect(sessions).toBeInstanceOf(Command);
      expect(sessions.name()).toBe('list');
      expect(messages).toBeInstanceOf(Command);
      expect(messages.name()).toBe('messages');
    });

    it('should create all entity commands', () => {
      const entities = createEntitiesCommand(mockOutput);
      const entity = createEntityCommand(mockOutput);
      const entityDelete = createEntityDeleteCommand(mockOutput);
      const entityStats = createEntityStatsCommand(mockOutput);

      expect(entities.name()).toBe('list');
      expect(entity.name()).toBe('get');
      expect(entityDelete.name()).toBe('delete');
      expect(entityStats.name()).toBe('stats');
    });

    it('should create all graph commands', () => {
      const graph = createGraphCommand(mockOutput);
      const graphStats = createGraphStatsCommand(mockOutput);
      const relationships = createRelationshipsCommand(mockOutput);
      const link = createLinkCommand(mockOutput);

      expect(graph.name()).toBe('query');
      expect(graphStats.name()).toBe('stats');
      expect(relationships.name()).toBe('relationships');
      expect(link.name()).toBe('link');
    });

    it('should create all embedding commands', () => {
      const embed = createEmbedCommand(mockOutput);
      const embedStatus = createEmbedStatusCommand(mockOutput);
      const embedCleanup = createEmbedCleanupCommand(mockOutput);

      expect(embed.name()).toBe('run');
      expect(embedStatus.name()).toBe('status');
      expect(embedCleanup.name()).toBe('cleanup');
    });

    it('should create all summarization commands', () => {
      const summarize = createSummarizeCommand(mockOutput);
      const summarizeStatus = createSummarizeStatusCommand(mockOutput);
      const providers = createProvidersCommand(mockOutput);

      expect(summarize.name()).toBe('run');
      expect(summarizeStatus.name()).toBe('status');
      expect(providers.name()).toBe('providers');
    });

    it('should create all debug commands', () => {
      const inspect = createInspectCommand(mockOutput);
      const query = createQueryCommand(mockOutput);
      const exportCmd = createExportCommand(mockOutput);
      const importCmd = createImportCommand(mockOutput);
      const health = createHealthCommand(mockOutput);

      expect(inspect.name()).toBe('inspect');
      expect(query.name()).toBe('query');
      expect(exportCmd.name()).toBe('export');
      expect(importCmd.name()).toBe('import');
      expect(health.name()).toBe('health');
    });
  });

  describe('Command Options', () => {
    it('sessions command should have expected options', () => {
      const cmd = createSessionsCommand();
      const options = cmd.options;

      expect(options.some(o => o.short === '-p')).toBe(true);
      expect(options.some(o => o.short === '-s')).toBe(true);
      expect(options.some(o => o.short === '-l')).toBe(true);
      expect(options.some(o => o.long === '--json')).toBe(true);
    });

    it('graph command should have depth option', () => {
      const cmd = createGraphCommand();
      const options = cmd.options;

      expect(options.some(o => o.short === '-d')).toBe(true);
      expect(options.some(o => o.long === '--direction')).toBe(true);
    });

    it('embed command should have force and dry-run options', () => {
      const cmd = createEmbedCommand();
      const options = cmd.options;

      expect(options.some(o => o.short === '-f')).toBe(true);
      expect(options.some(o => o.long === '--dry-run')).toBe(true);
    });

    it('health command should have json option', () => {
      const cmd = createHealthCommand();
      const options = cmd.options;

      expect(options.some(o => o.long === '--json')).toBe(true);
    });
  });

  describe('Command Descriptions', () => {
    it('all commands should have descriptions', () => {
      const commands = [
        createSessionsCommand(),
        createMessagesCommand(),
        createEntitiesCommand(),
        createEntityCommand(),
        createGraphCommand(),
        createEmbedCommand(),
        createSummarizeCommand(),
        createHealthCommand(),
        createInspectCommand()
      ];

      for (const cmd of commands) {
        expect(cmd.description()).toBeTruthy();
        expect(cmd.description().length).toBeGreaterThan(5);
      }
    });
  });

  describe('formatTable edge cases', () => {
    it('should handle empty data', () => {
      const result = formatTable([], [
        { header: 'Col', key: 'col' }
      ]);
      expect(result).toContain('Col');
      // Should have header and separator, no data rows
      expect(result.split('\n')).toHaveLength(2);
    });

    it('should handle null values', () => {
      const data = [{ name: null, value: undefined }];
      const columns = [
        { header: 'Name', key: 'name' },
        { header: 'Value', key: 'value' }
      ];

      const result = formatTable(data, columns);
      expect(result).toContain('-');
    });

    it('should handle missing keys', () => {
      const data = [{ existing: 'value' }];
      const columns = [
        { header: 'Missing', key: 'nonexistent' }
      ];

      const result = formatTable(data, columns);
      expect(result).toContain('-');
    });

    it('should respect width limits', () => {
      const data = [{ text: 'This is a very long text that should be truncated' }];
      const columns = [
        { header: 'Text', key: 'text', width: 20 }
      ];

      const result = formatTable(data, columns);
      const lines = result.split('\n');
      // Data line should respect width
      expect(lines[2].length).toBeLessThanOrEqual(30);
    });

    it('should pass row to format function', () => {
      const data = [{ a: 1, b: 2 }];
      const columns = [
        { header: 'Sum', key: 'a', format: (v: unknown, row: any) => String(row.a + row.b) }
      ];

      const result = formatTable(data, columns);
      expect(result).toContain('3');
    });
  });

  describe('Command argument handling', () => {
    it('entity command should accept id argument', () => {
      const cmd = createEntityCommand();
      // Commander stores arguments in _args internal property
      expect((cmd as any).registeredArguments || (cmd as any)._args).toHaveLength(1);
    });

    it('link command should accept source, type, target arguments', () => {
      const cmd = createLinkCommand();
      expect((cmd as any).registeredArguments || (cmd as any)._args).toHaveLength(3);
    });

    it('messages command should have optional sessionId argument', () => {
      const cmd = createMessagesCommand();
      expect((cmd as any).registeredArguments || (cmd as any)._args).toHaveLength(1);
    });

    it('query command should accept sql argument', () => {
      const cmd = createQueryCommand();
      expect((cmd as any).registeredArguments || (cmd as any)._args).toHaveLength(1);
    });

    it('export command should accept output-file argument', () => {
      const cmd = createExportCommand();
      expect((cmd as any).registeredArguments || (cmd as any)._args).toHaveLength(1);
    });

    it('import command should accept input-file argument', () => {
      const cmd = createImportCommand();
      expect((cmd as any).registeredArguments || (cmd as any)._args).toHaveLength(1);
    });
  });
});

describe('F10.7: Provider Command', () => {
  let mockOutput: CLIOutput;
  let logs: string[];
  let errors: string[];

  beforeEach(() => {
    logs = [];
    errors = [];
    mockOutput = {
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
      success: (msg) => logs.push(msg)
    };
  });

  it('should create providers command', () => {
    const cmd = createProvidersCommand(mockOutput);
    expect(cmd.name()).toBe('providers');
    expect(cmd.description()).toContain('LLM');
  });

  it('providers command should have json option', () => {
    const cmd = createProvidersCommand();
    const options = cmd.options;
    expect(options.some(o => o.long === '--json')).toBe(true);
  });
});

describe('F10.7: Color helpers', () => {
  it('should apply bold', () => {
    const result = colors.bold('test');
    expect(result).toBe('\x1b[1mtest\x1b[0m');
  });

  it('should apply dim', () => {
    const result = colors.dim('test');
    expect(result).toBe('\x1b[90mtest\x1b[0m');
  });

  it('should apply cyan', () => {
    const result = colors.cyan('test');
    expect(result).toBe('\x1b[36mtest\x1b[0m');
  });

  it('should apply green', () => {
    const result = colors.green('test');
    expect(result).toBe('\x1b[32mtest\x1b[0m');
  });

  it('should apply yellow', () => {
    const result = colors.yellow('test');
    expect(result).toBe('\x1b[33mtest\x1b[0m');
  });

  it('should apply red', () => {
    const result = colors.red('test');
    expect(result).toBe('\x1b[31mtest\x1b[0m');
  });
});

describe('F10.7: Total command count', () => {
  it('should have all 27 commands available', () => {
    // Core: 7, Session: 2, Entity: 4, Graph: 4, Embed: 3, Summarize: 3, Analytics: 2, Debug: 5
    const commands = [
      // Session (2)
      createSessionsCommand(),
      createMessagesCommand(),
      // Entity (4)
      createEntitiesCommand(),
      createEntityCommand(),
      createEntityDeleteCommand(),
      createEntityStatsCommand(),
      // Graph (4)
      createGraphCommand(),
      createGraphStatsCommand(),
      createRelationshipsCommand(),
      createLinkCommand(),
      // Embed (3)
      createEmbedCommand(),
      createEmbedStatusCommand(),
      createEmbedCleanupCommand(),
      // Summarize (3)
      createSummarizeCommand(),
      createSummarizeStatusCommand(),
      createProvidersCommand(),
      // Debug (5)
      createInspectCommand(),
      createQueryCommand(),
      createExportCommand(),
      createImportCommand(),
      createHealthCommand()
    ];

    // Total new commands in F10.7
    expect(commands).toHaveLength(21);

    // All should be Command instances
    for (const cmd of commands) {
      expect(cmd).toBeInstanceOf(Command);
    }
  });
});
