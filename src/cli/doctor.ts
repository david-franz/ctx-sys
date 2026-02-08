/**
 * F10h.1: ctx-sys doctor — Environment health check command.
 * Verifies Ollama, models, database, config, and project state.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../config/manager';
import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId } from '../db/schema';
import { colors } from './formatters';
import { CLIOutput, defaultOutput } from './init';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix?: string;
}

/**
 * Normalize localhost to 127.0.0.1 to avoid macOS IPv6 issues.
 */
function normalizeBaseUrl(url: string): string {
  return url.replace('://localhost', '://127.0.0.1');
}

/**
 * Check Ollama service connectivity.
 */
async function checkOllamaService(baseUrl: string): Promise<CheckResult & { models?: string[] }> {
  const url = normalizeBaseUrl(baseUrl);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return { name: 'Ollama Service', status: 'fail', detail: `HTTP ${response.status} at ${url}`, fix: 'ollama serve' };
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    const modelNames = data.models?.map(m => m.name) || [];
    return { name: 'Ollama Service', status: 'ok', detail: `${url} (${modelNames.length} models)`, models: modelNames };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort') || message.includes('timeout')) {
      return { name: 'Ollama Service', status: 'fail', detail: `Timeout connecting to ${url}`, fix: 'ollama serve' };
    }
    return { name: 'Ollama Service', status: 'fail', detail: `Cannot connect to ${url}`, fix: 'ollama serve' };
  }
}

/**
 * Check if a specific model is available in Ollama.
 */
function checkModel(
  label: string,
  model: string,
  models: string[] | undefined,
  ollamaOk: boolean,
  severity: 'fail' | 'warn'
): CheckResult {
  if (!ollamaOk) {
    return { name: label, status: 'warn', detail: 'Skipped (Ollama not available)' };
  }

  if (!models) {
    return { name: label, status: severity, detail: `${model} — cannot check`, fix: `ollama pull ${model}` };
  }

  const found = models.some(m => m === model || m.startsWith(model.split(':')[0]));
  if (found) {
    return { name: label, status: 'ok', detail: model };
  }
  return { name: label, status: severity, detail: `${model} not found`, fix: `ollama pull ${model}` };
}

/**
 * Check database connectivity and stats.
 */
async function checkDatabase(dbPath: string): Promise<CheckResult> {
  try {
    if (!fs.existsSync(dbPath)) {
      return { name: 'Database', status: 'fail', detail: `Not found at ${dbPath}`, fix: 'ctx-sys index .' };
    }

    const stats = fs.statSync(dbPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

    const db = new DatabaseConnection(dbPath);
    await db.initialize();
    try {
      const tables = db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'");
      return { name: 'Database', status: 'ok', detail: `${dbPath} (${sizeMB} MB, ${tables.length} tables)` };
    } finally {
      db.close();
    }
  } catch (err) {
    return { name: 'Database', status: 'fail', detail: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Check configuration files.
 */
async function checkConfig(projectPath: string): Promise<CheckResult> {
  try {
    const configManager = new ConfigManager({ inMemoryOnly: true });
    const parts: string[] = [];

    const globalExists = await configManager.globalConfigExists();
    if (globalExists) parts.push('global');

    const projectExists = await configManager.projectConfigExists(projectPath);
    if (projectExists) parts.push('project');

    if (parts.length === 0) {
      return { name: 'Configuration', status: 'warn', detail: 'No config files found (using defaults)', fix: 'ctx-sys init' };
    }

    return { name: 'Configuration', status: 'ok', detail: parts.join(' + ') + ' config' };
  } catch (err) {
    return { name: 'Configuration', status: 'warn', detail: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Check project state (indexed, embedding coverage).
 */
async function checkProject(dbPath: string, projectPath: string): Promise<CheckResult> {
  try {
    if (!fs.existsSync(dbPath)) {
      return { name: 'Project', status: 'warn', detail: 'No database — run: ctx-sys index .', fix: 'ctx-sys index .' };
    }

    const db = new DatabaseConnection(dbPath);
    await db.initialize();
    try {
      const projectName = path.basename(projectPath);

      // Look up project by name or path in the projects table
      const project = db.get<{ id: string; name: string; last_indexed_at: string | null }>(
        "SELECT id, name, last_indexed_at FROM projects WHERE name = ? OR path = ?",
        [projectName, projectPath]
      );
      if (!project) {
        return { name: 'Project', status: 'warn', detail: `"${projectName}" not indexed`, fix: 'ctx-sys index .' };
      }

      const prefix = sanitizeProjectId(project.id);

      // Check if entity table exists
      const tableCheck = db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [`${prefix}_entities`]
      );
      if (tableCheck.length === 0) {
        return { name: 'Project', status: 'warn', detail: `"${project.name}" tables missing`, fix: 'ctx-sys index .' };
      }

      // Count entities
      const entityRow = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${prefix}_entities`);
      const entities = entityRow?.count ?? 0;

      // Count vectors
      const vectorTable = `${prefix}_vectors`;
      const vecTableExists = db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [vectorTable]
      );

      let embeddingPct = 0;
      if (vecTableExists.length > 0 && entities > 0) {
        const vecRow = db.get<{ count: number }>(`SELECT COUNT(DISTINCT entity_id) as count FROM ${vectorTable}`);
        const vectors = vecRow?.count ?? 0;
        embeddingPct = Math.round((vectors / entities) * 100);
      }

      // Count relationships
      const relTable = `${prefix}_relationships`;
      const relTableExists = db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [relTable]
      );
      let relCount = 0;
      if (relTableExists.length > 0) {
        const relRow = db.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${relTable}`);
        relCount = relRow?.count ?? 0;
      }

      const detail = `${project.name}: ${entities} entities, ${relCount} relationships, ${embeddingPct}% embedded`;

      if (entities === 0) {
        return { name: 'Project', status: 'warn', detail: `${project.name}: no entities indexed`, fix: 'ctx-sys index .' };
      }
      if (embeddingPct < 50) {
        return { name: 'Project', status: 'warn', detail, fix: 'ctx-sys embed .' };
      }
      return { name: 'Project', status: 'ok', detail };
    } finally {
      db.close();
    }
  } catch (err) {
    return { name: 'Project', status: 'warn', detail: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Format a check result for display.
 */
function formatCheck(check: CheckResult, maxNameLen: number): string {
  const dots = '.'.repeat(Math.max(1, maxNameLen - check.name.length + 2));
  const statusLabel =
    check.status === 'ok' ? colors.green('OK') :
    check.status === 'warn' ? colors.yellow('WARN') :
    colors.red('FAIL');

  const padding = check.status === 'ok' ? '  ' : check.status === 'warn' ? '' : '';
  return `  ${check.name} ${colors.dim(dots)} ${statusLabel}${padding} ${check.detail}`;
}

/**
 * Create the doctor command.
 */
export function createDoctorCommand(output: CLIOutput = defaultOutput): Command {
  const command = new Command('doctor')
    .description('Check environment health and diagnose issues')
    .option('-p, --project <path>', 'Project directory', '.')
    .option('-d, --db <path>', 'Custom database path')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const projectPath = path.resolve(options.project);

      // Resolve config for Ollama URL and database path
      let ollamaUrl = 'http://localhost:11434';
      let dbPath = '';
      let embeddingModel = 'nomic-embed-text';
      let hydeModel = 'gemma3:4b';
      let summarizationModel = 'qwen2.5-coder:7b';

      try {
        const configManager = new ConfigManager({ inMemoryOnly: true });
        const resolved = await configManager.resolve(projectPath);
        ollamaUrl = resolved.providers?.ollama?.base_url || ollamaUrl;
        dbPath = options.db || resolved.database.path;
        embeddingModel = resolved.projectConfig?.embeddings?.model || embeddingModel;
        summarizationModel = resolved.projectConfig?.summarization?.model || summarizationModel;
      } catch {
        // Use defaults if config resolution fails
        if (options.db) {
          dbPath = options.db;
        } else {
          const homedir = require('os').homedir();
          dbPath = path.join(homedir, '.ctx-sys', 'ctx-sys.db');
        }
      }

      // Run all checks
      const checks: CheckResult[] = [];

      const ollamaResult = await checkOllamaService(ollamaUrl);
      checks.push(ollamaResult);
      const ollamaOk = ollamaResult.status === 'ok';

      checks.push(checkModel('Embedding Model', embeddingModel, ollamaResult.models, ollamaOk, 'fail'));
      checks.push(checkModel('HyDE Model', hydeModel, ollamaResult.models, ollamaOk, 'warn'));
      checks.push(checkModel('Summarization Model', summarizationModel, ollamaResult.models, ollamaOk, 'warn'));

      checks.push(await checkDatabase(dbPath));
      checks.push(await checkConfig(projectPath));
      checks.push(await checkProject(dbPath, projectPath));

      // Output
      if (options.json) {
        const passed = checks.filter(c => c.status === 'ok').length;
        const warned = checks.filter(c => c.status === 'warn').length;
        const failed = checks.filter(c => c.status === 'fail').length;
        const recommendations = checks.filter(c => c.fix).map(c => c.fix!);
        output.log(JSON.stringify({ checks, passed, warned, failed, recommendations }, null, 2));
      } else {
        output.log('');
        output.log(colors.bold('  ctx-sys Doctor'));
        output.log('');

        const maxNameLen = Math.max(...checks.map(c => c.name.length));
        for (const check of checks) {
          output.log(formatCheck(check, maxNameLen));
        }

        const passed = checks.filter(c => c.status === 'ok').length;
        const warned = checks.filter(c => c.status === 'warn').length;
        const failed = checks.filter(c => c.status === 'fail').length;

        output.log('');
        const parts = [`${passed}/${checks.length} checks passed`];
        if (warned > 0) parts.push(`${warned} warning${warned > 1 ? 's' : ''}`);
        if (failed > 0) parts.push(`${failed} failed`);
        output.log(`  ${parts.join(', ')}`);

        // Recommendations
        const fixes = checks.filter(c => c.fix);
        if (fixes.length > 0) {
          output.log('');
          output.log(colors.bold('  Recommendations:'));
          for (const check of fixes) {
            output.log(`    ${colors.cyan(check.fix!)}${colors.dim(`  # ${check.name}`)}`);
          }
        }
        output.log('');
      }

      // Exit code: 1 if any check failed
      if (checks.some(c => c.status === 'fail')) {
        process.exit(1);
      }
    });

  return command;
}
