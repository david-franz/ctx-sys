/**
 * Database schema definitions for ctx-sys.
 *
 * The database uses:
 * - Global tables for cross-project data
 * - Per-project tables (prefixed) for isolation
 * - LIKE-based search (sql.js doesn't support FTS5)
 * - JSON columns for vector storage (since sql.js doesn't support sqlite-vec)
 */

export const GLOBAL_SCHEMA = `
-- Projects registry
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  path TEXT NOT NULL,
  config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_indexed_at DATETIME,
  last_sync_commit TEXT
);

-- Embedding model registry (for model-agnostic vectors)
CREATE TABLE IF NOT EXISTS embedding_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Global config
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSON
);

-- Shared entities (common libraries, patterns)
CREATE TABLE IF NOT EXISTS shared_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cross-project links (explicit only)
CREATE TABLE IF NOT EXISTS cross_project_links (
  id TEXT PRIMARY KEY,
  source_project TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  target_project TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_project) REFERENCES projects(id),
  FOREIGN KEY (target_project) REFERENCES projects(id)
);

-- Schema version tracking for migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

/**
 * Generate SQL for creating project-specific tables.
 * Tables are prefixed with a sanitized project ID.
 */
export function createProjectTables(projectId: string): string {
  const prefix = sanitizeProjectId(projectId);

  return `
-- Entities (all types: code, docs, concepts, etc.)
CREATE TABLE IF NOT EXISTS ${prefix}_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT,
  content TEXT,
  summary TEXT,
  metadata JSON,
  file_path TEXT,
  start_line INTEGER,
  end_line INTEGER,
  hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_${prefix}_entities_type ON ${prefix}_entities(type);
CREATE INDEX IF NOT EXISTS idx_${prefix}_entities_file ON ${prefix}_entities(file_path);
CREATE INDEX IF NOT EXISTS idx_${prefix}_entities_name ON ${prefix}_entities(name);
CREATE INDEX IF NOT EXISTS idx_${prefix}_entities_qualified ON ${prefix}_entities(qualified_name);
CREATE INDEX IF NOT EXISTS idx_${prefix}_entities_hash ON ${prefix}_entities(hash);

-- Vector embeddings (stored as JSON since sql.js doesn't support sqlite-vec)
CREATE TABLE IF NOT EXISTS ${prefix}_vectors (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  embedding JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES ${prefix}_entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_vectors_entity ON ${prefix}_vectors(entity_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}_vectors_model ON ${prefix}_vectors(model_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_${prefix}_vectors_entity_model ON ${prefix}_vectors(entity_id, model_id);

-- Graph relationships
CREATE TABLE IF NOT EXISTS ${prefix}_relationships (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES ${prefix}_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES ${prefix}_entities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_rel_source ON ${prefix}_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}_rel_target ON ${prefix}_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}_rel_type ON ${prefix}_relationships(relationship);

-- Conversation sessions
CREATE TABLE IF NOT EXISTS ${prefix}_sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'active',
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS ${prefix}_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ${prefix}_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_msg_session ON ${prefix}_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}_msg_created ON ${prefix}_messages(created_at);

-- AST cache (for incremental updates)
CREATE TABLE IF NOT EXISTS ${prefix}_ast_cache (
  file_path TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  ast_json JSON,
  symbols JSON,
  parsed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note: Full-text search is implemented via LIKE queries since sql.js doesn't support FTS5
-- In production with native SQLite, FTS5 can be added for better performance
`;
}

/**
 * Generate SQL for dropping project-specific tables.
 */
export function dropProjectTables(projectId: string): string {
  const prefix = sanitizeProjectId(projectId);

  return `
DROP TABLE IF EXISTS ${prefix}_messages;
DROP TABLE IF EXISTS ${prefix}_sessions;
DROP TABLE IF EXISTS ${prefix}_relationships;
DROP TABLE IF EXISTS ${prefix}_vectors;
DROP TABLE IF EXISTS ${prefix}_ast_cache;
DROP TABLE IF EXISTS ${prefix}_entities;
`;
}

/**
 * Sanitize project ID for use as table prefix.
 * Replaces non-alphanumeric characters with underscores and
 * prefixes with 'p_' to ensure valid SQL identifiers (can't start with digit).
 */
export function sanitizeProjectId(projectId: string): string {
  const sanitized = projectId.replace(/[^a-zA-Z0-9]/g, '_');
  // Prefix with 'p_' to ensure table names don't start with a digit
  return `p_${sanitized}`;
}

/**
 * Get list of project table names for a given project ID.
 */
export function getProjectTableNames(projectId: string): string[] {
  const prefix = sanitizeProjectId(projectId);
  return [
    `${prefix}_entities`,
    `${prefix}_vectors`,
    `${prefix}_relationships`,
    `${prefix}_sessions`,
    `${prefix}_messages`,
    `${prefix}_ast_cache`
  ];
}
