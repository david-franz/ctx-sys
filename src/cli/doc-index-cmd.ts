/**
 * F10.9: CLI command for indexing documents.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { EntityStore } from '../entities';
import { RelationshipStore } from '../graph/relationship-store';
import { DocumentIndexer } from '../documents/document-indexer';
import { CLIOutput, defaultOutput } from './init';

export function createDocIndexCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('doc-index')
    .description('Index document files or directories for context retrieval')
    .argument('<path>', 'Path to document file or directory')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--extract-entities', 'Use LLM to extract entities from text', false)
    .option('--extract-relationships', 'Use LLM to discover relationships', false)
    .option('--embed', 'Generate embeddings for new entities', false)
    .option('-d, --db <path>', 'Custom database path')
    .option('-q, --quiet', 'Suppress output', false)
    .action(async (filePath: string, options) => {
      try {
        await runDocIndex(filePath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function runDocIndex(
  targetPath: string,
  options: {
    project?: string;
    extractEntities?: boolean;
    extractRelationships?: boolean;
    embed?: boolean;
    db?: string;
    quiet?: boolean;
  },
  output: CLIOutput
): Promise<void> {
  const projectPath = path.resolve(options.project || '.');
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);

  const dbPath = options.db || config.database.path;
  const db = new DatabaseConnection(dbPath);
  await db.initialize();

  try {
    const projectId = config.projectConfig.project.name || path.basename(projectPath);
    db.createProject(projectId);

    const entityStore = new EntityStore(db, projectId);
    const relationshipStore = new RelationshipStore(db, projectId);
    const indexer = new DocumentIndexer(entityStore, relationshipStore);

    const absolutePath = path.resolve(targetPath);
    const stat = fs.statSync(absolutePath);

    if (stat.isDirectory()) {
      // Directory mode
      if (!options.quiet) {
        output.log(`Indexing documents in: ${absolutePath}`);
      }

      const result = await indexer.indexDirectory(absolutePath, {
        extractEntities: options.extractEntities,
        extractRelationships: options.extractRelationships,
        generateEmbeddings: options.embed,
      });

      db.save();

      if (!options.quiet) {
        output.success('Directory indexed successfully');
        output.log(`  Files processed: ${result.filesProcessed}`);
        output.log(`  Files skipped (unchanged): ${result.filesSkipped}`);
        output.log(`  Entities created: ${result.totalEntities}`);
        output.log(`  Relationships created: ${result.totalRelationships}`);
        if (result.errors.length > 0) {
          output.log(`  Errors: ${result.errors.length}`);
          for (const err of result.errors.slice(0, 5)) {
            output.error(`    ${err}`);
          }
        }
      }
    } else {
      // Single file mode
      if (!options.quiet) {
        output.log(`Indexing document: ${absolutePath}`);
      }

      const result = await indexer.indexFile(absolutePath, {
        extractEntities: options.extractEntities,
        extractRelationships: options.extractRelationships,
        generateEmbeddings: options.embed,
      });

      db.save();

      if (!options.quiet) {
        if (result.skipped) {
          output.log('Document unchanged, skipped.');
        } else {
          output.success('Document indexed successfully');
          output.log(`  Entities created: ${result.entitiesCreated}`);
          output.log(`  Relationships created: ${result.relationshipsCreated}`);
          output.log(`  Cross-document links: ${result.crossDocLinks}`);
        }
      }
    }
  } finally {
    db.close();
  }
}
