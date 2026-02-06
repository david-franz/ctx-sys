/**
 * Git hooks module for ctx-sys.
 */

export {
  HookInstaller
} from './hook-installer';

export {
  HookHandler
} from './hook-handler';

export {
  ImpactAnalyzer,
  AnalyzeOptions,
  ToolClient
} from './impact-analyzer';

export {
  // Types
  HookConfig,
  HookEvent,
  HookResult,
  ImpactReport,
  AffectedEntity,
  AffectedDecision,
  RelatedContext,
  InstallResult,
  HookExecution,
  ChangedFiles,
  // Default config
  DEFAULT_HOOK_CONFIG
} from './types';
