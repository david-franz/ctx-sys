/**
 * F10i.1: Git hooks domain service.
 */

import { AppContext } from '../context';
import { HookConfig, ImpactReport } from './types';

export class HooksService {
  constructor(private context: AppContext) {}

  private async getProjectPath(projectId: string): Promise<string> {
    const project = await this.context.projectManager.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project.path;
  }

  async installHooks(projectId: string, repoPath: string, config?: HookConfig): Promise<string[]> {
    const fs = await import('fs');
    const path = await import('path');

    const hooksDir = path.join(repoPath, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) {
      throw new Error('Not a git repository or .git/hooks directory not found');
    }

    const hookNames = config?.hooks || ['post-commit'];
    const installed: string[] = [];

    for (const hookName of hookNames) {
      const hookPath = path.join(hooksDir, hookName as string);

      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');
        if (content.includes('ctx-sys')) continue;
      }

      const script = `#!/bin/sh\n# ctx-sys-hook: ${hookName}\nctx-sys sync --project ${projectId} 2>/dev/null &\n`;
      fs.writeFileSync(hookPath, script, { mode: 0o755 });
      installed.push(hookName as string);
    }

    return installed;
  }

  async getImpactReport(projectId: string, baseBranch: string, targetBranch: string): Promise<ImpactReport> {
    const projectPath = await this.getProjectPath(projectId);
    const entityStore = this.context.getEntityStore(projectId);

    const { execSync } = await import('child_process');
    let changedFiles: string[];
    try {
      const diff = execSync(
        `git diff --name-only ${baseBranch}...${targetBranch}`,
        { cwd: projectPath, encoding: 'utf-8' }
      );
      changedFiles = diff.trim().split('\n').filter(Boolean);
    } catch {
      try {
        const diff = execSync(
          `git diff --name-only ${baseBranch} ${targetBranch}`,
          { cwd: projectPath, encoding: 'utf-8' }
        );
        changedFiles = diff.trim().split('\n').filter(Boolean);
      } catch {
        changedFiles = [];
      }
    }

    const affectedEntities: Array<{ id: string; name: string; type: string }> = [];
    for (const file of changedFiles) {
      const entities = await entityStore.getByFile(file);
      for (const entity of entities) {
        affectedEntities.push({
          id: entity.id,
          name: entity.name,
          type: entity.type,
        });
      }
    }

    const riskLevel = changedFiles.length > 20 ? 'high'
      : changedFiles.length > 5 ? 'medium'
      : 'low';

    const suggestions = this.generateImpactSuggestions(changedFiles, affectedEntities);

    return {
      riskLevel,
      filesChanged: changedFiles.length,
      entitiesAffected: affectedEntities.length,
      decisionsAffected: 0,
      suggestions,
      affectedEntities
    };
  }

  private generateImpactSuggestions(
    files: string[],
    entities: Array<{ type: string }>
  ): string[] {
    const suggestions: string[] = [];
    if (files.some(f => f.includes('test'))) {
      suggestions.push('Test files modified - ensure test suite passes');
    }
    if (files.some(f => f.endsWith('.sql') || f.includes('migration'))) {
      suggestions.push('Database changes detected - review migration strategy');
    }
    if (entities.filter(e => e.type === 'class').length > 3) {
      suggestions.push('Multiple class changes - consider integration testing');
    }
    if (files.some(f => f.includes('package.json') || f.includes('tsconfig'))) {
      suggestions.push('Configuration files changed - verify build compatibility');
    }
    return suggestions;
  }
}
