/**
 * Types for git hooks integration.
 */

/**
 * Configuration for git hooks.
 */
export interface HookConfig {
  // Which hooks are enabled
  enablePreCommit: boolean;
  enablePostMerge: boolean;
  enablePrePush: boolean;
  enablePostCheckout: boolean;

  // Behavior settings
  indexOnCommit: boolean;
  syncOnMerge: boolean;
  validateOnPush: boolean;
  generateImpactReport: boolean;

  // Performance tuning
  maxFilesToIndex: number;
  timeoutMs: number;
  asyncMode: boolean;

  // Integration
  serverUrl: string;
  projectId: string;

  // Reporting
  verbosity: 'silent' | 'normal' | 'verbose';
  notifyOnError: boolean;
  logPath?: string;
}

/**
 * Git hook event.
 */
export interface HookEvent {
  type: 'pre-commit' | 'post-merge' | 'pre-push' | 'post-checkout';
  timestamp: Date;

  // Git context
  repository: string;
  currentBranch: string;
  currentCommit: string;
  previousCommit?: string;

  // Changed files
  stagedFiles?: string[];
  mergedFiles?: string[];

  // Remote info
  remoteName?: string;
  remoteUrl?: string;
}

/**
 * Result of handling a hook.
 */
export interface HookResult {
  success: boolean;
  duration: number;

  // What was done
  filesIndexed: number;
  entitiesUpdated: number;
  decisionsLinked: number;

  // Output for user
  message?: string;
  warnings?: string[];
  errors?: string[];

  // Impact analysis (if generated)
  impactReport?: ImpactReport;
}

/**
 * Impact analysis report.
 */
export interface ImpactReport {
  generatedAt: Date;
  baseBranch: string;
  targetBranch: string;

  // Changed files summary
  filesAdded: string[];
  filesModified: string[];
  filesDeleted: string[];

  // Impact analysis
  affectedEntities: AffectedEntity[];
  affectedDecisions: AffectedDecision[];
  relatedContexts: RelatedContext[];

  // Risk indicators
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];

  // Recommendations
  suggestions: string[];
}

/**
 * Entity affected by changes.
 */
export interface AffectedEntity {
  entityId: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'module' | string;
  filePath: string;
  changeType: 'modified' | 'deleted' | 'signature-changed';
  usageCount: number;
}

/**
 * Decision affected by changes.
 */
export interface AffectedDecision {
  decisionId: string;
  summary: string;
  relatedFiles: string[];
  mightBeInvalidated: boolean;
}

/**
 * Related context for code review.
 */
export interface RelatedContext {
  title: string;
  summary: string;
  relevanceScore: number;
  filePaths: string[];
}

/**
 * Result of installing hooks.
 */
export interface InstallResult {
  success: boolean;
  installed: string[];
  configPath: string;
}

/**
 * Hook execution log entry.
 */
export interface HookExecution {
  id: string;
  projectId: string;
  hookType: string;
  timestamp: Date;
  repository: string;
  branch: string;
  commitHash?: string;
  durationMs: number;
  success: boolean;
  filesIndexed: number;
  entitiesUpdated: number;
  message?: string;
  warnings: string[];
  errors: string[];
}

/**
 * Changed files from git diff.
 */
export interface ChangedFiles {
  added: string[];
  modified: string[];
  deleted: string[];
}

/**
 * Default hook configuration.
 */
export const DEFAULT_HOOK_CONFIG: HookConfig = {
  enablePreCommit: true,
  enablePostMerge: true,
  enablePrePush: false,
  enablePostCheckout: false,

  indexOnCommit: true,
  syncOnMerge: true,
  validateOnPush: false,
  generateImpactReport: true,

  maxFilesToIndex: 100,
  timeoutMs: 10000,
  asyncMode: false,

  serverUrl: 'http://localhost:3000',
  projectId: '',

  verbosity: 'normal',
  notifyOnError: true
};
