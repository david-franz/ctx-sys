/**
 * Impact analyzer for code changes.
 */

import { execSync } from 'child_process';
import {
  ImpactReport,
  AffectedEntity,
  AffectedDecision,
  RelatedContext,
  ChangedFiles
} from './types';

/**
 * Options for impact analysis.
 */
export interface AnalyzeOptions {
  projectId: string;
  baseBranch: string;
  targetBranch: string;
  previousCommit?: string;
  currentCommit?: string;
  repoPath?: string;
}

/**
 * Simple client interface for making tool calls.
 * This allows the analyzer to work with different backends.
 */
export interface ToolClient {
  callTool(name: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * Analyzes the impact of code changes between branches.
 */
export class ImpactAnalyzer {
  constructor(private client?: ToolClient) {}

  /**
   * Analyze the impact of changes between commits/branches.
   */
  async analyze(options: AnalyzeOptions): Promise<ImpactReport> {
    const { projectId, baseBranch, targetBranch } = options;
    const repoPath = options.repoPath || process.cwd();

    // Get changed files
    const changedFiles = this.getChangedFiles(repoPath, baseBranch, targetBranch);

    // Analyze each category
    let affectedEntities: AffectedEntity[] = [];
    let affectedDecisions: AffectedDecision[] = [];
    let relatedContexts: RelatedContext[] = [];

    if (this.client) {
      [affectedEntities, affectedDecisions, relatedContexts] = await Promise.all([
        this.findAffectedEntities(projectId, changedFiles),
        this.findAffectedDecisions(projectId, changedFiles),
        this.findRelatedContexts(projectId, changedFiles)
      ]);
    }

    // Calculate risk level
    const { riskLevel, reasons } = this.assessRisk(
      changedFiles,
      affectedEntities,
      affectedDecisions
    );

    // Generate suggestions
    const suggestions = this.generateSuggestions(
      changedFiles,
      affectedEntities,
      affectedDecisions
    );

    return {
      generatedAt: new Date(),
      baseBranch,
      targetBranch,

      filesAdded: changedFiles.added,
      filesModified: changedFiles.modified,
      filesDeleted: changedFiles.deleted,

      affectedEntities,
      affectedDecisions,
      relatedContexts,

      riskLevel,
      reasons,
      suggestions
    };
  }

  /**
   * Get changed files between two branches using git.
   */
  getChangedFiles(
    repoPath: string,
    base: string,
    target: string
  ): ChangedFiles {
    try {
      const output = execSync(`git diff --name-status ${base}...${target}`, {
        cwd: repoPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const added: string[] = [];
      const modified: string[] = [];
      const deleted: string[] = [];

      for (const line of output.trim().split('\n')) {
        if (!line) continue;

        const parts = line.split('\t');
        const status = parts[0];
        const file = parts[1];

        if (!file) continue;

        if (status === 'A' || status.startsWith('A')) {
          added.push(file);
        } else if (status === 'M' || status.startsWith('M')) {
          modified.push(file);
        } else if (status === 'D' || status.startsWith('D')) {
          deleted.push(file);
        } else if (status.startsWith('R')) {
          // Renamed: old file deleted, new file added
          const newFile = parts[2];
          deleted.push(file);
          if (newFile) added.push(newFile);
        }
      }

      return { added, modified, deleted };
    } catch {
      return { added: [], modified: [], deleted: [] };
    }
  }

  /**
   * Find entities affected by changes.
   */
  private async findAffectedEntities(
    projectId: string,
    changedFiles: ChangedFiles
  ): Promise<AffectedEntity[]> {
    if (!this.client) return [];

    const affected: AffectedEntity[] = [];
    const filesToCheck = [...changedFiles.modified, ...changedFiles.deleted];

    for (const filePath of filesToCheck.slice(0, 20)) { // Limit to first 20 files
      try {
        const result = await this.client.callTool('entity_search', {
          projectId,
          filters: { filePath }
        }) as { entities?: Array<{ id: string; name: string; type: string; filePath: string }> };

        for (const entity of (result.entities || [])) {
          // Check usage count
          let usageCount = 0;
          try {
            const usageResult = await this.client.callTool('entity_references', {
              projectId,
              entityId: entity.id
            }) as { references?: unknown[] };
            usageCount = (usageResult.references || []).length;
          } catch {
            // Ignore reference lookup errors
          }

          affected.push({
            entityId: entity.id,
            name: entity.name,
            type: entity.type,
            filePath: entity.filePath,
            changeType: changedFiles.deleted.includes(filePath) ? 'deleted' : 'modified',
            usageCount
          });
        }
      } catch {
        // Ignore entity lookup errors
      }
    }

    return affected;
  }

  /**
   * Find decisions affected by changes.
   */
  private async findAffectedDecisions(
    projectId: string,
    changedFiles: ChangedFiles
  ): Promise<AffectedDecision[]> {
    if (!this.client) return [];

    const affected: AffectedDecision[] = [];
    const allChangedFiles = [
      ...changedFiles.added,
      ...changedFiles.modified,
      ...changedFiles.deleted
    ];

    // Search for decisions mentioning these files
    const fileNames = allChangedFiles
      .map(f => f.split('/').pop())
      .filter((f): f is string => Boolean(f))
      .slice(0, 10);

    for (const fileName of fileNames) {
      try {
        const result = await this.client.callTool('decision_search', {
          projectId,
          query: fileName,
          limit: 5
        }) as { decisions?: Array<{ id: string; decision: string }> };

        for (const decision of (result.decisions || [])) {
          const filePath = allChangedFiles.find(f =>
            decision.decision.includes(f.split('/').pop() || '')
          );

          if (filePath) {
            affected.push({
              decisionId: decision.id,
              summary: decision.decision.substring(0, 100),
              relatedFiles: [filePath],
              mightBeInvalidated: changedFiles.deleted.includes(filePath)
            });
          }
        }
      } catch {
        // Ignore decision search errors
      }
    }

    return affected;
  }

  /**
   * Find related context for code review.
   */
  private async findRelatedContexts(
    projectId: string,
    changedFiles: ChangedFiles
  ): Promise<RelatedContext[]> {
    if (!this.client) return [];

    const fileNames = [...changedFiles.added, ...changedFiles.modified]
      .map(f => f.split('/').pop())
      .filter((f): f is string => Boolean(f))
      .slice(0, 5);

    if (fileNames.length === 0) return [];

    try {
      const query = `code related to ${fileNames.join(', ')}`;
      const result = await this.client.callTool('context_query', {
        projectId,
        query,
        maxTokens: 2000
      }) as { items?: Array<{ name?: string; summary?: string; relevanceScore?: number; filePath?: string }> };

      return (result.items || []).slice(0, 5).map(item => ({
        title: item.name || 'Unknown',
        summary: item.summary || '',
        relevanceScore: item.relevanceScore || 0,
        filePaths: item.filePath ? [item.filePath] : []
      }));
    } catch {
      return [];
    }
  }

  /**
   * Assess the risk level of changes.
   */
  assessRisk(
    changedFiles: ChangedFiles,
    affectedEntities: AffectedEntity[],
    affectedDecisions: AffectedDecision[]
  ): { riskLevel: 'low' | 'medium' | 'high'; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Deleted files increase risk
    if (changedFiles.deleted.length > 0) {
      score += changedFiles.deleted.length * 2;
      reasons.push(`${changedFiles.deleted.length} file(s) deleted`);
    }

    // Many modified files increase risk
    if (changedFiles.modified.length > 10) {
      score += Math.floor(changedFiles.modified.length / 5);
      reasons.push(`${changedFiles.modified.length} files modified`);
    }

    // Widely-used entities increase risk
    const highUsageEntities = affectedEntities.filter(e => e.usageCount > 5);
    if (highUsageEntities.length > 0) {
      score += highUsageEntities.length * 3;
      reasons.push(`${highUsageEntities.length} widely-used entities affected`);
    }

    // Decisions that might be invalidated
    const invalidatedDecisions = affectedDecisions.filter(d => d.mightBeInvalidated);
    if (invalidatedDecisions.length > 0) {
      score += invalidatedDecisions.length * 2;
      reasons.push(`${invalidatedDecisions.length} decisions may be invalidated`);
    }

    // Calculate level
    let riskLevel: 'low' | 'medium' | 'high';
    if (score >= 10) riskLevel = 'high';
    else if (score >= 5) riskLevel = 'medium';
    else riskLevel = 'low';

    return { riskLevel, reasons };
  }

  /**
   * Generate suggestions for the changes.
   */
  generateSuggestions(
    changedFiles: ChangedFiles,
    affectedEntities: AffectedEntity[],
    affectedDecisions: AffectedDecision[]
  ): string[] {
    const suggestions: string[] = [];

    // High-usage entities
    const criticalEntities = affectedEntities.filter(e => e.usageCount > 10);
    if (criticalEntities.length > 0) {
      suggestions.push(
        `Review usage of ${criticalEntities.map(e => e.name).slice(0, 3).join(', ')} (${criticalEntities.length} widely-used entities)`
      );
    }

    // Deleted entities
    const deletedEntities = affectedEntities.filter(e => e.changeType === 'deleted');
    if (deletedEntities.length > 0) {
      suggestions.push(
        `Verify ${deletedEntities.length} deleted entities are no longer referenced`
      );
    }

    // Invalidated decisions
    if (affectedDecisions.some(d => d.mightBeInvalidated)) {
      suggestions.push('Review decisions that may no longer apply');
    }

    // Large changesets
    const totalChanged = changedFiles.added.length +
                        changedFiles.modified.length +
                        changedFiles.deleted.length;
    if (totalChanged > 20) {
      suggestions.push('Consider splitting this large change into smaller PRs');
    }

    // New files without tests
    const codeFiles = changedFiles.added.filter(f =>
      /\.(ts|js|tsx|jsx|py|java|go|rs)$/.test(f) &&
      !f.includes('test') &&
      !f.includes('spec')
    );
    if (codeFiles.length > 0) {
      suggestions.push(`Add tests for ${codeFiles.length} new code files`);
    }

    return suggestions;
  }
}
