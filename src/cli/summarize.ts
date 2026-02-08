/**
 * F10.7: CLI commands for LLM summarization.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { LLMSummarizationManager, EntityForSummary } from '../summarization/llm-manager';
import { formatTable, colors } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the summarize command.
 */
export function createSummarizeCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('run')
    .description('Generate LLM summaries for entities')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --type <type>', 'Only summarize entities of this type')
    .option('-f, --force', 'Regenerate all summaries')
    .option('-l, --limit <n>', 'Max entities to summarize (default: all)')
    .option('--provider <name>', 'LLM provider: ollama, openai, anthropic')
    .option('--batch-size <n>', 'Entities per batch', '20')
    .option('--concurrency <n>', 'Concurrent requests per batch', '5')
    .option('--dry-run', 'Show what would be summarized')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await generateSummaries(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the summarize-status command.
 */
export function createSummarizeStatusCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('status')
    .description('Show summarization status')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showSummarizeStatus(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the providers command.
 */
export function createProvidersCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('providers')
    .description('Show available LLM providers')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await showProviders(options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function generateSummaries(
  projectPath: string,
  options: {
    type?: string;
    force?: boolean;
    limit?: string;
    provider?: string;
    batchSize?: string;
    concurrency?: string;
    dryRun?: boolean;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  const projectId = config.projectConfig.project.name || path.basename(projectPath);
  const prefix = sanitizeProjectId(projectId);

  const limit = options.limit ? parseInt(options.limit, 10) : undefined;

  // Find entities needing summaries
  let sql = `
    SELECT id, name, type, content, file_path as filePath, hash as contentHash
    FROM ${prefix}_entities
    WHERE content IS NOT NULL
  `;

  const params: unknown[] = [];

  if (options.type) {
    sql += ' AND type = ?';
    params.push(options.type);
  }

  if (!options.force) {
    sql += ' AND summary IS NULL';
  }

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const entities = db.all<EntityForSummary>(sql, params);

  if (entities.length === 0) {
    output.log('All entities have summaries.');
    await db.close();
    return;
  }

  if (options.dryRun) {
    output.log(colors.bold('Would summarize:\n'));
    output.log(formatTable(entities, [
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'File', key: 'filePath', format: (f) => f ? path.basename(f as string) : '-', width: 25 }
    ]));
    output.log(`\n${entities.length} entities would be summarized`);
    await db.close();
    return;
  }

  // Initialize LLM manager
  const batchSize = parseInt(options.batchSize || '20', 10);
  const concurrency = parseInt(options.concurrency || '5', 10);

  const managerConfig: Record<string, unknown> = {
    batchSize,
    ollama: { concurrency }
  };
  if (options.provider) {
    managerConfig.providers = [options.provider];
  }

  const manager = new LLMSummarizationManager(managerConfig);
  const provider = await manager.getProvider();

  if (!provider) {
    output.error('No LLM provider available. Install Ollama or configure OpenAI/Anthropic API keys.');
    await db.close();
    process.exit(1);
  }

  output.log(`Using provider: ${provider.id} (model: ${provider.model})`);
  output.log(`Batch size: ${batchSize}, Concurrency: ${concurrency}`);
  output.log(`Summarizing ${entities.length} entities...\n`);

  let completed = 0;
  let failed = 0;

  // Process with progress reporting
  const result = await manager.summarizeEntities(entities, {
    force: options.force,
    onProgress: (done, total) => {
      process.stdout.write(`\rProgress: ${done}/${total}`);
    }
  });

  completed = result.summarized;
  failed = result.failed;

  // Persist summaries back to database
  for (const [entityId, summary] of result.summaries) {
    db.run(
      `UPDATE ${prefix}_entities SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [summary, entityId]
    );
  }
  db.save();

  output.log('\n');
  await db.close();

  output.log(colors.bold('Summary Generation Complete'));
  output.log(`  Summarized: ${completed}`);
  output.log(`  Failed:     ${failed}`);
  output.log(`  Provider:   ${result.provider || 'none'}`);
}

async function showSummarizeStatus(
  projectPath: string,
  options: {
    json?: boolean;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  const projectId = config.projectConfig.project.name || path.basename(projectPath);
  const prefix = sanitizeProjectId(projectId);

  const stats = db.get<{
    total: number;
    with_summary: number;
    without_summary: number;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN summary IS NOT NULL THEN 1 ELSE 0 END) as with_summary,
      SUM(CASE WHEN summary IS NULL THEN 1 ELSE 0 END) as without_summary
    FROM ${prefix}_entities
    WHERE hash IS NOT NULL
  `);

  const byType = db.all<{ type: string; total: number; summarized: number }>(`
    SELECT
      type,
      COUNT(*) as total,
      SUM(CASE WHEN summary IS NOT NULL THEN 1 ELSE 0 END) as summarized
    FROM ${prefix}_entities
    WHERE hash IS NOT NULL
    GROUP BY type
    ORDER BY total DESC
  `);

  await db.close();

  const result = { stats, byType };

  if (options.json) {
    output.log(JSON.stringify(result, null, 2));
    return;
  }

  output.log(colors.bold('Summarization Status\n'));
  output.log(`  Total entities:    ${stats?.total || 0}`);
  output.log(`  With summary:      ${stats?.with_summary || 0}`);
  output.log(`  Without summary:   ${stats?.without_summary || 0}`);

  const coverage = stats?.total
    ? ((stats.with_summary / stats.total) * 100).toFixed(1)
    : '0.0';
  output.log(`  Coverage:          ${coverage}%`);

  if (byType.length > 0) {
    output.log(`\n${colors.bold('By Type:')}`);
    output.log(formatTable(byType, [
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Summarized', key: 'summarized', width: 12 },
      { header: 'Coverage', key: 'total', format: (_, row) =>
        row.total > 0 ? `${((row.summarized / row.total) * 100).toFixed(0)}%` : '-', width: 10 }
    ]));
  }
}

async function showProviders(
  options: { json?: boolean },
  output: CLIOutput
): Promise<void> {
  const manager = new LLMSummarizationManager();
  const available = await manager.getAvailableProviders();

  const providers = [
    { id: 'ollama', name: 'Ollama', available: available.includes('ollama'), description: 'Local LLM' },
    { id: 'openai', name: 'OpenAI', available: available.includes('openai'), description: 'GPT-4o-mini' },
    { id: 'anthropic', name: 'Anthropic', available: available.includes('anthropic'), description: 'Claude 3 Haiku' }
  ];

  if (options.json) {
    output.log(JSON.stringify(providers, null, 2));
    return;
  }

  output.log(colors.bold('LLM Providers\n'));

  for (const p of providers) {
    const status = p.available ? colors.green('✓') : colors.red('✗');
    output.log(`  ${status} ${p.name.padEnd(12)} ${p.description}`);
  }

  output.log('');
  if (available.length === 0) {
    output.log(colors.yellow('No providers available.'));
    output.log('To use summarization:');
    output.log('  - Install Ollama: https://ollama.ai');
    output.log('  - Or set OPENAI_API_KEY for OpenAI');
    output.log('  - Or set ANTHROPIC_API_KEY for Anthropic');
  } else {
    output.log(`Active provider: ${available[0]}`);
  }
}
