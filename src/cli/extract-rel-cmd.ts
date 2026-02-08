/**
 * F10.9: CLI command for LLM relationship extraction.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { EntityStore } from '../entities';
import { RelationshipStore } from '../graph/relationship-store';
import { LLMRelationshipExtractor } from '../graph/llm-relationship-extractor';
import { CLIOutput, defaultOutput } from './init';

export function createExtractRelCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('extract-rel')
    .description('Use LLM to discover relationships between existing entities')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--type <type>', 'Only process entities of this type')
    .option('--limit <n>', 'Max entities to process', '50')
    .option('--dry-run', 'Show what would be extracted without saving', false)
    .option('-d, --db <path>', 'Custom database path')
    .option('-q, --quiet', 'Suppress output', false)
    .action(async (options) => {
      try {
        await runExtractRel(options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function runExtractRel(
  options: {
    project?: string;
    type?: string;
    limit?: string;
    dryRun?: boolean;
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
    const extractor = new LLMRelationshipExtractor({
      baseUrl: config.providers?.ollama?.base_url || 'http://localhost:11434',
    });

    const limit = parseInt(options.limit || '50', 10);
    const entities = await entityStore.list({
      limit,
      type: options.type as any,
    });

    if (!options.quiet) {
      output.log(`Processing ${entities.length} entities for relationship discovery...`);
    }

    const entityInfos = entities.map(e => ({
      name: e.name,
      type: e.type,
      description: e.summary || undefined,
    }));

    const relationships = await extractor.extractFromEntities(entityInfos);

    if (!options.quiet) {
      output.log(`Discovered ${relationships.length} relationships`);
    }

    if (options.dryRun) {
      for (const rel of relationships) {
        output.log(`  ${rel.source} -[${rel.relationship}]-> ${rel.target} (${(rel.confidence * 100).toFixed(0)}%)`);
      }
      return;
    }

    let created = 0;
    for (const rel of relationships) {
      const source = await entityStore.getByName(rel.source);
      const target = await entityStore.getByName(rel.target);
      if (source && target) {
        await relationshipStore.upsert({
          sourceId: source.id,
          targetId: target.id,
          relationship: rel.relationship as any,
          weight: rel.confidence,
          metadata: { llmDiscovered: true, reasoning: rel.reasoning },
        });
        created++;
      }
    }

    db.save();

    if (!options.quiet) {
      output.success(`Created ${created} relationships`);
    }
  } finally {
    db.close();
  }
}
