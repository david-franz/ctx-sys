/**
 * F10d.7: CLI command for context retrieval.
 * Mirrors the MCP context_query tool using CoreService.queryContext().
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { AppContext } from '../context';
import { CoreService } from '../services/core-service';
import { SearchStrategy } from '../retrieval/types';
import { formatTable, colors } from './formatters';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the context command.
 */
export function createContextCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('context')
    .description('Query assembled context (like MCP context_query)')
    .argument('<query>', 'Context query')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --tokens <n>', 'Max tokens for context', '4000')
    .option('--type <types>', 'Entity types to include (comma-separated)')
    .option('--strategy <strategies>', 'Search strategies: keyword,semantic,graph (comma-separated)')
    .option('--min-score <n>', 'Minimum relevance score', '0')
    .option('--no-sources', 'Omit source attribution')
    .option('--expand', 'Auto-include parent classes, imports, type definitions')
    .option('--expand-tokens <n>', 'Token budget for expansion (default: 2000)')
    .option('--decompose', 'Break complex queries into sub-queries')
    .option('--gate', 'Skip retrieval for trivial queries')
    .option('--hyde', 'Use HyDE (Hypothetical Document Embeddings) for better semantic search')
    .option('--format <format>', 'Output format (markdown, json, text)', 'markdown')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (query: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await runContext(query, projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Run the context query operation.
 */
async function runContext(
  query: string,
  projectPath: string,
  options: {
    tokens?: string;
    type?: string;
    strategy?: string;
    minScore?: string;
    sources?: boolean;
    expand?: boolean;
    expandTokens?: string;
    decompose?: boolean;
    gate?: boolean;
    hyde?: boolean;
    format?: string;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const dbPath = options.db || config.database.path;
  const appContext = new AppContext(dbPath);
  await appContext.initialize();

  try {
    const projectId = config.projectConfig.project.name || path.basename(projectPath);
    const coreService = new CoreService(appContext);

    const maxTokens = parseInt(options.tokens || '4000', 10);
    const minScore = parseFloat(options.minScore || '0');
    const includeTypes = options.type ? options.type.split(',').map((t: string) => t.trim()) : undefined;
    const strategies = options.strategy
      ? options.strategy.split(',').map((s: string) => s.trim()) as SearchStrategy[]
      : undefined;
    const includeSources = options.sources !== false;

    const expandTokens = options.expandTokens ? parseInt(options.expandTokens, 10) : undefined;

    const result = await coreService.queryContext(projectId, query, {
      maxTokens,
      includeTypes,
      includeSources,
      strategies,
      minScore,
      expand: options.expand,
      expandTokens,
      decompose: options.decompose,
      gate: options.gate,
      hyde: options.hyde
    });

    // JSON output
    if (options.format === 'json') {
      output.log(JSON.stringify({
        context: result.context,
        sources: result.sources,
        confidence: result.confidence,
        tokensUsed: result.tokensUsed,
        truncated: result.truncated
      }, null, 2));
      return;
    }

    // No results
    if (!result.context || result.context.trim().length === 0) {
      output.log('No relevant context found for this query.');
      return;
    }

    // Text output: strip markdown
    if (options.format === 'text') {
      const plainText = result.context
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').replace(/```/g, ''));
      output.log(plainText);
    } else {
      // Default: markdown
      output.log(result.context);
    }

    // Footer
    output.log(`\n${colors.dim('---')}`);
    const statsLine = [
      `${result.sources.length} sources`,
      `Confidence: ${(result.confidence * 100).toFixed(0)}%`,
      `Tokens: ${result.tokensUsed}/${maxTokens}`,
      result.truncated ? '(truncated)' : ''
    ].filter(Boolean).join(' | ');
    output.log(colors.dim(statsLine));

    // Source table
    if (includeSources && result.sources.length > 0) {
      output.log('');
      output.log(formatTable(result.sources, [
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Name', key: 'name', width: 40 },
        { header: 'Relevance', key: 'relevance', format: (v) => `${((v as number) * 100).toFixed(0)}%`, width: 10 },
        { header: 'File', key: 'filePath', format: (v) => v ? String(v) : '-', width: 30 }
      ]));
    }
  } finally {
    await appContext.close();
  }
}
