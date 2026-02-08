/**
 * CLI command for indexing a codebase.
 */

import { Command } from 'commander';
import * as path from 'path';
import { CodebaseIndexer, IndexOptions, IndexResult } from '../indexer';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { ProjectManager } from '../project';
import { EntityStore } from '../entities';
import { RelationshipStore } from '../graph/relationship-store';
import { EmbeddingManager } from '../embeddings/manager';
import { OllamaEmbeddingProvider } from '../embeddings/ollama';
import { DocumentIndexer } from '../documents/document-indexer';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the index command.
 */
export function createIndexCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('index')
    .description('Index a codebase for context retrieval')
    .argument('[directory]', 'Project directory to index', '.')
    .option('-f, --force', 'Force reindex all files', false)
    .option('--full', 'Perform a full index (not incremental)', false)
    .option('--concurrency <n>', 'Number of concurrent files to process', '5')
    .option('--include <patterns>', 'Comma-separated glob patterns to include')
    .option('--exclude <patterns>', 'Comma-separated glob patterns to exclude')
    .option('-q, --quiet', 'Suppress progress output', false)
    .option('-d, --db <path>', 'Custom database path')
    .option('--doc', 'Also index documentation files (md, yaml, json, etc.)', false)
    .option('--embed', 'Generate embeddings for RAG (requires Ollama)', false)
    .option('--embed-batch-size <n>', 'Batch size for embedding generation', '50')
    .action(async (directory: string, options) => {
      try {
        const projectPath = path.resolve(directory);
        await runIndex(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Run the indexing operation.
 */
async function runIndex(
  projectPath: string,
  options: {
    force?: boolean;
    full?: boolean;
    concurrency?: string;
    include?: string;
    exclude?: string;
    quiet?: boolean;
    db?: string;
    doc?: boolean;
    embed?: boolean;
    embedBatchSize?: string;
  },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  // Set up database connection
  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  try {
    // Set up entity store (use project name as ID)
    const projectId = config.projectConfig.project.name || path.basename(projectPath);

    // Ensure project is registered and tables exist
    const projectManager = new ProjectManager(db);
    const existingProject = await projectManager.getByName(projectId);
    if (!existingProject) {
      try {
        await projectManager.create(projectId, projectPath);
      } catch {
        db.createProject(projectId);
      }
    }

    const entityStore = new EntityStore(db, projectId);
    const relationshipStore = new RelationshipStore(db, projectId);

    // Create indexer with relationship extraction
    const indexer = new CodebaseIndexer(projectPath, entityStore, undefined, undefined, relationshipStore);

    // Build index options
    const indexOptions: IndexOptions = {
      force: options.force,
      concurrency: parseInt(options.concurrency || '5', 10),
      include: options.include ? options.include.split(',').map(s => s.trim()) : undefined,
      exclude: options.exclude
        ? options.exclude.split(',').map(s => s.trim())
        : config.projectConfig.indexing.ignore
    };

    // Add progress callback if not quiet
    if (!options.quiet) {
      let lastPercent = -1;
      indexOptions.onProgress = (current: number, total: number, file: string) => {
        const percent = Math.floor((current / total) * 100);
        if (percent !== lastPercent && percent % 10 === 0) {
          output.log(`Progress: ${percent}% (${current}/${total}) - ${path.basename(file)}`);
          lastPercent = percent;
        }
      };
    }

    // Run indexing
    const startTime = Date.now();
    if (!options.quiet) {
      output.log(`Indexing ${projectPath}...`);
    }

    let result: IndexResult;
    if (options.full) {
      result = await indexer.indexAll(indexOptions);
    } else {
      result = await indexer.updateIndex(indexOptions);
    }

    // Display results
    const duration = (Date.now() - startTime) / 1000;

    if (!options.quiet) {
      output.log('');
      output.success(`Indexing complete in ${duration.toFixed(2)}s`);
      output.log(`  Added: ${result.added.length} files`);
      output.log(`  Modified: ${result.modified.length} files`);
      output.log(`  Deleted: ${result.deleted.length} files`);
      output.log(`  Unchanged: ${result.unchanged.length} files`);

      if (result.errors.length > 0) {
        output.log(`  Errors: ${result.errors.length}`);
        for (const err of result.errors.slice(0, 5)) {
          output.error(`    ${err.path}: ${err.error}`);
        }
        if (result.errors.length > 5) {
          output.log(`    ... and ${result.errors.length - 5} more errors`);
        }
      }

      output.log('');
      output.log('Statistics:');
      output.log(`  Total files: ${result.stats.totalFiles}`);
      output.log(`  Total symbols: ${result.stats.totalSymbols}`);
      if (result.stats.byLanguage) {
        output.log('  By language:');
        for (const [lang, count] of Object.entries(result.stats.byLanguage)) {
          output.log(`    ${lang}: ${count}`);
        }
      }
    }

    // Explicit save after indexing (before potentially slow embedding phase)
    db.save();

    // Index documentation files if requested
    if (options.doc) {
      if (!options.quiet) {
        output.log('');
        output.log('Indexing documentation files...');
      }

      const docIndexer = new DocumentIndexer(entityStore, relationshipStore);
      const docResult = await docIndexer.indexDirectory(projectPath);

      db.save();

      if (!options.quiet) {
        output.success(`Documentation indexed: ${docResult.filesProcessed} files (${docResult.filesSkipped} unchanged)`);
        output.log(`  Entities: ${docResult.totalEntities}, Relationships: ${docResult.totalRelationships}`);
        if (docResult.errors.length > 0) {
          output.log(`  Errors: ${docResult.errors.length}`);
          for (const err of docResult.errors.slice(0, 3)) {
            output.error(`    ${err}`);
          }
        }
      }
    }

    // Generate embeddings if requested
    if (options.embed) {
      if (!options.quiet) {
        output.log('');
        output.log('Generating embeddings...');
      }

      try {
        const ollamaProvider = new OllamaEmbeddingProvider({
          baseUrl: config.providers?.ollama?.base_url || 'http://localhost:11434',
          model: config.defaults?.embeddings?.model || 'nomic-embed-text'
        });
        const embeddingManager = new EmbeddingManager(db, projectId, ollamaProvider);

        const entities = await entityStore.list({ limit: 100000 });
        const batchSize = parseInt(options.embedBatchSize || '50', 10);

        const embedResult = await embeddingManager.embedIncremental(entities, {
          batchSize,
          onProgress: (completed, total, skipped) => {
            if (!options.quiet && completed % batchSize === 0) {
              output.log(`  Progress: ${completed}/${total} embedded (${skipped} unchanged)`);
            }
          }
        });

        if (!options.quiet) {
          let msg = `Embedded ${embedResult.embedded}, skipped ${embedResult.skipped} unchanged`;
          if (embedResult.errors) {
            msg += `, ${embedResult.errors} failed`;
          }
          msg += ` (${embedResult.total} total)`;
          output.success(msg);
        }
      } catch (err) {
        output.error(`Embedding generation failed: ${err instanceof Error ? err.message : String(err)}`);
        output.log('  Make sure Ollama is running: ollama serve');
      }
    }
  } finally {
    db.close();
  }
}

/**
 * Export for testing.
 */
export { runIndex };
