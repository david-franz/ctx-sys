/**
 * CLI Types
 *
 * Type definitions for CLI commands and options.
 */

export interface CommandOptions {
  [key: string]: any;
}

export interface Command {
  name: string;
  description: string;
  execute(args: string[], options: CommandOptions): Promise<void>;
}

export interface CLIContext {
  dbPath: string;
  configPath?: string;
  verbose?: boolean;
  quiet?: boolean;
}

export interface InitCommandOptions extends CommandOptions {
  path?: string;
  name?: string;
  force?: boolean;
}

export interface ProjectCommandOptions extends CommandOptions {
  list?: boolean;
  active?: boolean;
  set?: string;
  delete?: string;
  info?: string;
}

export interface IndexCommandOptions extends CommandOptions {
  project?: string;
  force?: boolean;
  incremental?: boolean;
}

export interface QueryCommandOptions extends CommandOptions {
  project?: string;
  type?: string;
  limit?: number;
  format?: 'json' | 'table' | 'tree';
}

export interface ServeCommandOptions extends CommandOptions {
  port?: number;
  host?: string;
  development?: boolean;
}

export interface StatsCommandOptions extends CommandOptions {
  project?: string;
  detailed?: boolean;
}

export interface DoctorCommandOptions extends CommandOptions {
  fix?: boolean;
  project?: string;
}

export interface SearchCommandOptions extends CommandOptions {
  project?: string;
  type?: string;
  limit?: number;
  semantic?: boolean;
}

export interface SyncCommandOptions extends CommandOptions {
  project?: string;
  force?: boolean;
}

export interface WatchCommandOptions extends CommandOptions {
  project?: string;
  debounce?: number;
}

// Additional types for test compatibility
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
}

export interface ServerState {
  running: boolean;
  mode: 'stdio' | 'http';
  port?: number;
}
