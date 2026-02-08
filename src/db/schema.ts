/**
 * Database schema definitions for ctx-sys.
 *
 * The database uses:
 * - Global tables for cross-project data
 * - Per-project tables (prefixed) for isolation
 * - FTS5 full-text search with BM25 ranking (F10.10)
 * - sqlite-vec vec0 virtual tables for native vector search (F10h.2)
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

-- Vector metadata (F10h.2: replaces JSON-based _vectors table)
-- Links entity_id/model_id/content_hash to vec0 rowids
CREATE TABLE IF NOT EXISTS ${prefix}_vector_meta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  content_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (entity_id) REFERENCES ${prefix}_entities(id) ON DELETE CASCADE,
  UNIQUE(entity_id, model_id)
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_vector_meta_entity ON ${prefix}_vector_meta(entity_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}_vector_meta_model ON ${prefix}_vector_meta(model_id);

-- Native vector storage via sqlite-vec (F10h.2)
-- 768 dimensions for nomic-embed-text, cosine distance metric
CREATE VIRTUAL TABLE IF NOT EXISTS ${prefix}_vec USING vec0(
  embedding float[768] distance_metric=cosine
);

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

-- Agent checkpoints for resumable execution
CREATE TABLE IF NOT EXISTS ${prefix}_checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Serialized state
  state_json TEXT NOT NULL,

  -- Metadata
  description TEXT,
  trigger_type TEXT NOT NULL,
  duration_ms INTEGER,
  token_usage INTEGER
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_checkpoints_session ON ${prefix}_checkpoints(session_id, step_number DESC);
CREATE INDEX IF NOT EXISTS idx_${prefix}_checkpoints_created ON ${prefix}_checkpoints(created_at DESC);

-- Memory items with tier tracking for hot/cold memory management
CREATE TABLE IF NOT EXISTS ${prefix}_memory_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'hot',

  -- Access tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TEXT,
  created_at TEXT NOT NULL,

  -- Scoring
  relevance_score REAL DEFAULT 0.5,
  token_count INTEGER,

  -- Metadata and embeddings
  metadata_json TEXT,
  embedding_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_memory_session_tier ON ${prefix}_memory_items(session_id, tier);
CREATE INDEX IF NOT EXISTS idx_${prefix}_memory_access ON ${prefix}_memory_items(session_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_${prefix}_memory_relevance ON ${prefix}_memory_items(session_id, relevance_score DESC);

-- Reflections for agent self-improvement
CREATE TABLE IF NOT EXISTS ${prefix}_reflections (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,

  -- Task context
  task_description TEXT NOT NULL,
  attempt_number INTEGER DEFAULT 1,

  -- Outcome
  outcome TEXT NOT NULL,

  -- Lessons (JSON arrays)
  what_worked_json TEXT,
  what_did_not_work_json TEXT,
  next_strategy TEXT NOT NULL,

  -- Retrieval
  tags_json TEXT,
  embedding_json TEXT,
  related_entity_ids_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_reflections_session ON ${prefix}_reflections(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_${prefix}_reflections_outcome ON ${prefix}_reflections(outcome, created_at DESC);

-- Context subscriptions for proactive suggestions
CREATE TABLE IF NOT EXISTS ${prefix}_context_subscriptions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  watch_patterns_json TEXT,
  callback_type TEXT NOT NULL,
  callback_url TEXT,
  min_relevance_score REAL DEFAULT 0.5,
  max_suggestions INTEGER DEFAULT 5,
  cooldown_ms INTEGER DEFAULT 5000,
  last_triggered_at TEXT,
  enabled INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_subscriptions_session ON ${prefix}_context_subscriptions(session_id, enabled);

-- Context suggestions for tracking and feedback
CREATE TABLE IF NOT EXISTS ${prefix}_context_suggestions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  trigger_json TEXT,
  suggestions_json TEXT,
  status TEXT DEFAULT 'pending',
  used_item_index INTEGER
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_suggestions_session ON ${prefix}_context_suggestions(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_${prefix}_suggestions_status ON ${prefix}_context_suggestions(status);

-- FTS5 full-text search index (F10.10: enabled by better-sqlite3)
CREATE VIRTUAL TABLE IF NOT EXISTS ${prefix}_entities_fts USING fts5(
  name, content, summary,
  content=${prefix}_entities,
  content_rowid=rowid
);

-- Triggers to keep FTS5 in sync with entity table
CREATE TRIGGER IF NOT EXISTS ${prefix}_entities_ai AFTER INSERT ON ${prefix}_entities BEGIN
  INSERT INTO ${prefix}_entities_fts(rowid, name, content, summary)
  VALUES (new.rowid, new.name, new.content, new.summary);
END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_entities_ad AFTER DELETE ON ${prefix}_entities BEGIN
  INSERT INTO ${prefix}_entities_fts(${prefix}_entities_fts, rowid, name, content, summary)
  VALUES ('delete', old.rowid, old.name, old.content, old.summary);
END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_entities_au AFTER UPDATE ON ${prefix}_entities BEGIN
  INSERT INTO ${prefix}_entities_fts(${prefix}_entities_fts, rowid, name, content, summary)
  VALUES ('delete', old.rowid, old.name, old.content, old.summary);
  INSERT INTO ${prefix}_entities_fts(rowid, name, content, summary)
  VALUES (new.rowid, new.name, new.content, new.summary);
END;

-- F10e.6: Session summary versions for incremental summarization
CREATE TABLE IF NOT EXISTS ${prefix}_session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  summary TEXT NOT NULL,
  topics TEXT,
  decisions TEXT,
  code_references TEXT,
  key_points TEXT,
  message_range_start TEXT,
  message_range_end TEXT,
  message_count INTEGER,
  model TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ${prefix}_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_summaries_session
  ON ${prefix}_session_summaries(session_id, version DESC);

-- F10e.5: FTS5 for message search with porter stemming
CREATE VIRTUAL TABLE IF NOT EXISTS ${prefix}_messages_fts USING fts5(
  content,
  content=${prefix}_messages,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS ${prefix}_messages_fts_insert
  AFTER INSERT ON ${prefix}_messages BEGIN
    INSERT INTO ${prefix}_messages_fts(rowid, content) VALUES (new.rowid, new.content);
  END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_messages_fts_delete
  AFTER DELETE ON ${prefix}_messages BEGIN
    INSERT INTO ${prefix}_messages_fts(${prefix}_messages_fts, rowid, content)
      VALUES('delete', old.rowid, old.content);
  END;

-- F10e.5: Persistent decisions table
CREATE TABLE IF NOT EXISTS ${prefix}_decisions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id TEXT,
  description TEXT NOT NULL,
  context TEXT,
  alternatives TEXT,
  related_entity_ids TEXT,
  status TEXT DEFAULT 'active',
  superseded_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ${prefix}_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_${prefix}_decisions_session ON ${prefix}_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_${prefix}_decisions_status ON ${prefix}_decisions(status);

-- FTS for decision search
CREATE VIRTUAL TABLE IF NOT EXISTS ${prefix}_decisions_fts USING fts5(
  description, context,
  content=${prefix}_decisions,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS ${prefix}_decisions_fts_insert
  AFTER INSERT ON ${prefix}_decisions BEGIN
    INSERT INTO ${prefix}_decisions_fts(rowid, description, context) VALUES (new.rowid, new.description, new.context);
  END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_decisions_fts_delete
  AFTER DELETE ON ${prefix}_decisions BEGIN
    INSERT INTO ${prefix}_decisions_fts(${prefix}_decisions_fts, rowid, description, context)
      VALUES('delete', old.rowid, old.description, old.context);
  END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_decisions_fts_update
  AFTER UPDATE ON ${prefix}_decisions BEGIN
    INSERT INTO ${prefix}_decisions_fts(${prefix}_decisions_fts, rowid, description, context)
      VALUES('delete', old.rowid, old.description, old.context);
    INSERT INTO ${prefix}_decisions_fts(rowid, description, context)
      VALUES (new.rowid, new.description, new.context);
  END
`;
}

/**
 * Generate SQL for dropping project-specific tables.
 */
export function dropProjectTables(projectId: string): string {
  const prefix = sanitizeProjectId(projectId);

  return `
DROP TRIGGER IF EXISTS ${prefix}_entities_ai;
DROP TRIGGER IF EXISTS ${prefix}_entities_ad;
DROP TRIGGER IF EXISTS ${prefix}_entities_au;
DROP TRIGGER IF EXISTS ${prefix}_messages_fts_insert;
DROP TRIGGER IF EXISTS ${prefix}_messages_fts_delete;
DROP TRIGGER IF EXISTS ${prefix}_decisions_fts_insert;
DROP TRIGGER IF EXISTS ${prefix}_decisions_fts_delete;
DROP TRIGGER IF EXISTS ${prefix}_decisions_fts_update;
DROP TABLE IF EXISTS ${prefix}_entities_fts;
DROP TABLE IF EXISTS ${prefix}_messages_fts;
DROP TABLE IF EXISTS ${prefix}_decisions_fts;
DROP TABLE IF EXISTS ${prefix}_decisions;
DROP TABLE IF EXISTS ${prefix}_session_summaries;
DROP TABLE IF EXISTS ${prefix}_context_suggestions;
DROP TABLE IF EXISTS ${prefix}_context_subscriptions;
DROP TABLE IF EXISTS ${prefix}_reflections;
DROP TABLE IF EXISTS ${prefix}_memory_items;
DROP TABLE IF EXISTS ${prefix}_checkpoints;
DROP TABLE IF EXISTS ${prefix}_messages;
DROP TABLE IF EXISTS ${prefix}_sessions;
DROP TABLE IF EXISTS ${prefix}_relationships;
DROP TABLE IF EXISTS ${prefix}_vec;
DROP TABLE IF EXISTS ${prefix}_vector_meta;
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
    `${prefix}_vector_meta`,
    `${prefix}_vec`,
    `${prefix}_relationships`,
    `${prefix}_sessions`,
    `${prefix}_messages`,
    `${prefix}_ast_cache`,
    `${prefix}_checkpoints`,
    `${prefix}_memory_items`,
    `${prefix}_reflections`,
    `${prefix}_decisions`,
    `${prefix}_session_summaries`,
    `${prefix}_context_subscriptions`,
    `${prefix}_context_suggestions`
  ];
}
