/**
 * F10.7: CLI commands for graph operations.
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../config';
import { DatabaseConnection } from '../db/connection';
import { formatTable, colors } from './formatters';
import { sanitizeProjectId } from '../db/schema';
import { CLIOutput, defaultOutput } from './init';

interface RelationshipRow {
  id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  target_id: string;
  target_name: string;
  target_type: string;
  type: string;
  weight: number;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  depth: number;
}

/**
 * Create the graph traversal command.
 */
export function createGraphCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('graph')
    .description('Traverse entity relationship graph')
    .argument('<entity>', 'Starting entity ID or name')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-d, --depth <n>', 'Max traversal depth', '2')
    .option('-t, --types <types>', 'Filter relationship types (comma-separated)')
    .option('--direction <dir>', 'Traversal direction: outgoing, incoming, both', 'both')
    .option('--json', 'Output as JSON')
    .option('--db <path>', 'Custom database path')
    .action(async (entity: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await traverseGraph(projectPath, entity, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the graph stats command.
 */
export function createGraphStatsCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('graph-stats')
    .description('Show graph statistics')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await showGraphStats(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the relationships list command.
 */
export function createRelationshipsCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('relationships')
    .description('List relationships')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-t, --type <type>', 'Filter by relationship type')
    .option('-s, --source <id>', 'Filter by source entity')
    .option('--target <id>', 'Filter by target entity')
    .option('-l, --limit <n>', 'Max relationships to show', '50')
    .option('--json', 'Output as JSON')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (options) => {
      try {
        const projectPath = path.resolve(options.project);
        await listRelationships(projectPath, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the link command.
 */
export function createLinkCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('link')
    .description('Create a relationship between entities')
    .argument('<source>', 'Source entity ID')
    .argument('<type>', 'Relationship type')
    .argument('<target>', 'Target entity ID')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-w, --weight <n>', 'Relationship weight (0-1)', '1.0')
    .option('-d, --db <path>', 'Custom database path')
    .action(async (source: string, type: string, target: string, options) => {
      try {
        const projectPath = path.resolve(options.project);
        await createLink(projectPath, source, type, target, options, output);
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

async function traverseGraph(
  projectPath: string,
  entityId: string,
  options: {
    depth?: string;
    types?: string;
    direction?: string;
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

  const maxDepth = parseInt(options.depth || '2', 10);
  const direction = options.direction || 'both';
  const typeFilter = options.types?.split(',').map(t => t.trim()) || null;

  // Find starting entity
  let startEntity = db.get<{ id: string; name: string; type: string }>(
    `SELECT id, name, type FROM ${prefix}_entities WHERE id = ? OR name = ? OR qualified_name = ?`,
    [entityId, entityId, entityId]
  );

  if (!startEntity) {
    output.error(`Entity not found: ${entityId}`);
    await db.close();
    process.exit(1);
  }

  // BFS traversal
  const visited = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: { from: string; to: string; type: string }[] = [];

  const queue: { id: string; depth: number }[] = [{ id: startEntity.id, depth: 0 }];
  visited.add(startEntity.id);
  nodes.push({ id: startEntity.id, name: startEntity.name, type: startEntity.type, depth: 0 });

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    // Get outgoing relationships
    if (direction === 'outgoing' || direction === 'both') {
      let sql = `
        SELECT r.relationship as type, r.target_id, e.name, e.type as entity_type
        FROM ${prefix}_relationships r
        JOIN ${prefix}_entities e ON r.target_id = e.id
        WHERE r.source_id = ?
      `;
      const params: unknown[] = [id];

      if (typeFilter) {
        sql += ` AND r.relationship IN (${typeFilter.map(() => '?').join(',')})`;
        params.push(...typeFilter);
      }

      const outgoing = db.all<{ type: string; target_id: string; name: string; entity_type: string }>(sql, params);

      for (const rel of outgoing) {
        edges.push({ from: id, to: rel.target_id, type: rel.type });
        if (!visited.has(rel.target_id)) {
          visited.add(rel.target_id);
          nodes.push({ id: rel.target_id, name: rel.name, type: rel.entity_type, depth: depth + 1 });
          queue.push({ id: rel.target_id, depth: depth + 1 });
        }
      }
    }

    // Get incoming relationships
    if (direction === 'incoming' || direction === 'both') {
      let sql = `
        SELECT r.relationship as type, r.source_id, e.name, e.type as entity_type
        FROM ${prefix}_relationships r
        JOIN ${prefix}_entities e ON r.source_id = e.id
        WHERE r.target_id = ?
      `;
      const params: unknown[] = [id];

      if (typeFilter) {
        sql += ` AND r.relationship IN (${typeFilter.map(() => '?').join(',')})`;
        params.push(...typeFilter);
      }

      const incoming = db.all<{ type: string; source_id: string; name: string; entity_type: string }>(sql, params);

      for (const rel of incoming) {
        edges.push({ from: rel.source_id, to: id, type: rel.type });
        if (!visited.has(rel.source_id)) {
          visited.add(rel.source_id);
          nodes.push({ id: rel.source_id, name: rel.name, type: rel.entity_type, depth: depth + 1 });
          queue.push({ id: rel.source_id, depth: depth + 1 });
        }
      }
    }
  }

  await db.close();

  if (options.json) {
    output.log(JSON.stringify({ nodes, edges }, null, 2));
    return;
  }

  output.log(colors.bold(`Graph from: ${startEntity.name}\n`));

  // Display as tree-like structure
  const nodesByDepth = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    if (!nodesByDepth.has(node.depth)) {
      nodesByDepth.set(node.depth, []);
    }
    nodesByDepth.get(node.depth)!.push(node);
  }

  for (let d = 0; d <= maxDepth; d++) {
    const depthNodes = nodesByDepth.get(d) || [];
    if (depthNodes.length === 0) continue;

    const indent = '  '.repeat(d);
    for (const node of depthNodes) {
      const prefix = d === 0 ? '●' : '├─';
      output.log(`${indent}${prefix} ${colors.cyan(node.name)} ${colors.dim(`(${node.type})`)}`);
    }
  }

  output.log(`\n${nodes.length} nodes, ${edges.length} edges`);
}

async function showGraphStats(
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

  const entityCount = db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${prefix}_entities`
  );

  const relationshipCount = db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${prefix}_relationships`
  );

  const typeStats = db.all<{ type: string; count: number }>(`
    SELECT relationship as type, COUNT(*) as count
    FROM ${prefix}_relationships
    GROUP BY relationship
    ORDER BY count DESC
  `);

  const topConnected = db.all<{ name: string; type: string; connections: number }>(`
    SELECT e.name, e.type, COUNT(*) as connections
    FROM ${prefix}_entities e
    JOIN ${prefix}_relationships r ON e.id = r.source_id OR e.id = r.target_id
    GROUP BY e.id
    ORDER BY connections DESC
    LIMIT 10
  `);

  await db.close();

  const stats = {
    entities: entityCount?.count || 0,
    relationships: relationshipCount?.count || 0,
    typeStats,
    topConnected
  };

  if (options.json) {
    output.log(JSON.stringify(stats, null, 2));
    return;
  }

  output.log(colors.bold('Graph Statistics\n'));
  output.log(`  Entities:      ${stats.entities}`);
  output.log(`  Relationships: ${stats.relationships}`);

  if (typeStats.length > 0) {
    output.log(`\n${colors.bold('Relationship Types:')}`);
    for (const stat of typeStats) {
      output.log(`  ${stat.type.padEnd(15)} ${stat.count}`);
    }
  }

  if (topConnected.length > 0) {
    output.log(`\n${colors.bold('Most Connected Entities:')}`);
    output.log(formatTable(topConnected, [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Connections', key: 'connections', width: 12 }
    ]));
  }
}

async function listRelationships(
  projectPath: string,
  options: {
    type?: string;
    source?: string;
    target?: string;
    limit?: string;
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

  const limit = parseInt(options.limit || '50', 10);

  let sql = `
    SELECT
      r.id, r.source_id, r.target_id, r.relationship as type, r.weight,
      s.name as source_name, s.type as source_type,
      t.name as target_name, t.type as target_type
    FROM ${prefix}_relationships r
    JOIN ${prefix}_entities s ON r.source_id = s.id
    JOIN ${prefix}_entities t ON r.target_id = t.id
    WHERE 1=1
  `;

  const params: unknown[] = [];

  if (options.type) {
    sql += ' AND r.relationship = ?';
    params.push(options.type);
  }

  if (options.source) {
    sql += ' AND (r.source_id = ? OR s.name = ?)';
    params.push(options.source, options.source);
  }

  if (options.target) {
    sql += ' AND (r.target_id = ? OR t.name = ?)';
    params.push(options.target, options.target);
  }

  sql += ' ORDER BY r.relationship, s.name LIMIT ?';
  params.push(limit);

  const relationships = db.all<RelationshipRow>(sql, params);

  await db.close();

  if (options.json) {
    output.log(JSON.stringify(relationships, null, 2));
    return;
  }

  if (relationships.length === 0) {
    output.log('No relationships found.');
    return;
  }

  output.log(formatTable(relationships, [
    { header: 'Source', key: 'source_name', width: 25 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Target', key: 'target_name', width: 25 },
    { header: 'Weight', key: 'weight', format: (w) => (w as number).toFixed(2), width: 8 }
  ]));

  output.log(`\nShowing ${relationships.length} relationships`);
}

async function createLink(
  projectPath: string,
  sourceId: string,
  type: string,
  targetId: string,
  options: {
    weight?: string;
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

  const weight = parseFloat(options.weight || '1.0');

  // Verify entities exist
  const source = db.get<{ id: string; name: string }>(
    `SELECT id, name FROM ${prefix}_entities WHERE id = ? OR name = ?`,
    [sourceId, sourceId]
  );

  const target = db.get<{ id: string; name: string }>(
    `SELECT id, name FROM ${prefix}_entities WHERE id = ? OR name = ?`,
    [targetId, targetId]
  );

  if (!source) {
    output.error(`Source entity not found: ${sourceId}`);
    await db.close();
    process.exit(1);
  }

  if (!target) {
    output.error(`Target entity not found: ${targetId}`);
    await db.close();
    process.exit(1);
  }

  // Create relationship
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO ${prefix}_relationships (id, source_id, target_id, relationship, weight, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, source.id, target.id, type, weight]
  );

  await db.close();

  output.log(`Created relationship: ${source.name} --[${type}]--> ${target.name}`);
}
