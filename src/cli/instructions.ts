/**
 * F10e.7: CLI commands for managing team instructions.
 * Instructions are entities with type 'instruction' and scope/priority metadata.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config';
import { AppContext } from '../context';
import { formatTable, colors } from './formatters';
import { CLIOutput, defaultOutput } from './init';

/**
 * Create the instruction command with subcommands.
 */
export function createInstructionCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('instruction')
    .description('Manage team instructions');

  // instruction add
  command
    .command('add <name>')
    .description('Add a new instruction')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-c, --content <text>', 'Instruction content')
    .option('-f, --file <path>', 'Read content from file')
    .option('--scope <json>', 'Scope as JSON: {"fileTypes":[".tsx"], "directories":["src/"]}')
    .option('--priority <level>', 'Priority: high, normal, low', 'normal')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (name: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await addInstruction(name, projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // instruction list
  command
    .command('list')
    .description('List all instructions')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--tag <tag>', 'Filter by tag')
    .option('--priority <level>', 'Filter by priority')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await listInstructions(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // instruction edit
  command
    .command('edit <id>')
    .description('Edit an instruction')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-c, --content <text>', 'New content')
    .option('--priority <level>', 'New priority')
    .option('--active <bool>', 'Set active status (true/false)')
    .option('--tags <tags>', 'New tags (comma-separated)')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (id: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await editInstruction(id, projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // instruction remove
  command
    .command('remove <id>')
    .description('Remove an instruction')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (id: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await removeInstruction(id, projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function addInstruction(
  name: string,
  projectPath: string,
  options: {
    content?: string;
    file?: string;
    scope?: string;
    priority?: string;
    tags?: string;
    db?: string;
  },
  output: CLIOutput
): Promise<void> {
  let content = options.content;
  if (options.file) {
    content = fs.readFileSync(path.resolve(options.file), 'utf-8');
  }
  if (!content) {
    throw new Error('Either --content or --file is required');
  }

  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);
  const dbPath = options.db || config.database.path;
  const appContext = new AppContext(dbPath);
  await appContext.initialize();

  try {
    const projectId = config.projectConfig.project.name || path.basename(projectPath);
    const entityStore = appContext.getEntityStore(projectId);

    const scope = options.scope ? JSON.parse(options.scope) : { global: true };
    const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
    const priority = options.priority || 'normal';

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const qualifiedName = `instruction::${slug}`;

    const entity = await entityStore.upsert({
      type: 'instruction',
      name,
      qualifiedName,
      content,
      summary: content.length > 100 ? content.substring(0, 100) + '...' : content,
      metadata: {
        scope,
        priority,
        tags,
        active: true
      }
    });

    output.log(colors.bold(`Added instruction: ${name}`));
    output.log(`  ID: ${entity.id}`);
    output.log(`  Priority: ${priority}`);
    output.log(`  Scope: ${JSON.stringify(scope)}`);
    if (tags.length > 0) output.log(`  Tags: ${tags.join(', ')}`);
  } finally {
    await appContext.close();
  }
}

async function listInstructions(
  projectPath: string,
  options: {
    tag?: string;
    priority?: string;
    json?: boolean;
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
    const entityStore = appContext.getEntityStore(projectId);

    const results = await entityStore.search('', { type: 'instruction', limit: 100 });

    // Filter
    let instructions = results.map(r => {
      const meta = r.metadata as Record<string, unknown> || {};
      return {
        id: r.id,
        name: r.name,
        priority: (meta.priority as string) || 'normal',
        active: meta.active !== false,
        tags: (meta.tags as string[]) || [],
        scope: meta.scope as Record<string, unknown> || {},
        content: r.content || '',
        summary: r.summary || ''
      };
    });

    if (options.tag) {
      instructions = instructions.filter(i => i.tags.includes(options.tag!));
    }
    if (options.priority) {
      instructions = instructions.filter(i => i.priority === options.priority);
    }

    if (options.json) {
      output.log(JSON.stringify(instructions, null, 2));
      return;
    }

    if (instructions.length === 0) {
      output.log('No instructions found.');
      return;
    }

    output.log(colors.bold(`Instructions (${instructions.length})\n`));
    output.log(formatTable(instructions, [
      { header: 'ID', key: 'id', format: (v) => String(v).substring(0, 8), width: 10 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Active', key: 'active', format: (v) => v ? 'yes' : 'no', width: 8 },
      { header: 'Tags', key: 'tags', format: (v) => Array.isArray(v) ? v.join(', ') : '-', width: 20 }
    ]));
  } finally {
    await appContext.close();
  }
}

async function editInstruction(
  id: string,
  projectPath: string,
  options: {
    content?: string;
    priority?: string;
    active?: string;
    tags?: string;
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
    const entityStore = appContext.getEntityStore(projectId);

    const entity = await entityStore.get(id);
    if (!entity || entity.type !== 'instruction') {
      throw new Error(`Instruction not found: ${id}`);
    }

    const meta = (entity.metadata as Record<string, unknown>) || {};

    if (options.content) {
      entity.content = options.content;
      entity.summary = options.content.length > 100 ? options.content.substring(0, 100) + '...' : options.content;
    }
    if (options.priority) {
      meta.priority = options.priority;
    }
    if (options.active !== undefined) {
      meta.active = options.active === 'true';
    }
    if (options.tags) {
      meta.tags = options.tags.split(',').map(t => t.trim());
    }

    await entityStore.upsert({
      type: entity.type as any,
      name: entity.name,
      qualifiedName: entity.qualifiedName || `instruction::${entity.name}`,
      content: entity.content,
      summary: entity.summary,
      metadata: meta
    });

    output.log(`Updated instruction: ${entity.name}`);
  } finally {
    await appContext.close();
  }
}

async function removeInstruction(
  id: string,
  projectPath: string,
  options: { db?: string },
  output: CLIOutput
): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.resolve(projectPath);
  const dbPath = options.db || config.database.path;
  const appContext = new AppContext(dbPath);
  await appContext.initialize();

  try {
    const projectId = config.projectConfig.project.name || path.basename(projectPath);
    const entityStore = appContext.getEntityStore(projectId);

    const entity = await entityStore.get(id);
    if (!entity || entity.type !== 'instruction') {
      throw new Error(`Instruction not found: ${id}`);
    }

    await entityStore.delete(id);
    output.log(`Removed instruction: ${entity.name}`);
  } finally {
    await appContext.close();
  }
}
