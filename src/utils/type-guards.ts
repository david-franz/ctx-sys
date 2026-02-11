/**
 * Runtime type guards for validating string inputs against union types.
 * Used to replace `as any` casts at system boundaries (MCP tools, CLI, AST parsers).
 */

import { EntityType } from '../entities/types';
import { GraphRelationshipType } from '../graph/types';

// ─────────────────────────────────────────────────────────
// EntityType
// ─────────────────────────────────────────────────────────

const ENTITY_TYPES: ReadonlySet<string> = new Set([
  'file', 'module', 'class', 'function', 'method', 'interface', 'type', 'variable',
  'property', 'enum', 'namespace',
  'document', 'section', 'requirement', 'feature', 'user-story',
  'session', 'message', 'decision', 'question',
  'person', 'concept', 'technology', 'pattern', 'component',
  'ticket', 'bug', 'task', 'milestone',
  'instruction',
]);

export function isEntityType(s: string): s is EntityType {
  return ENTITY_TYPES.has(s);
}

export function asEntityType(s: string): EntityType {
  if (!isEntityType(s)) throw new Error(`Invalid entity type: ${s}`);
  return s;
}

// ─────────────────────────────────────────────────────────
// GraphRelationshipType
// ─────────────────────────────────────────────────────────

const RELATIONSHIP_TYPES: ReadonlySet<string> = new Set([
  'CONTAINS', 'CALLS', 'IMPORTS', 'IMPLEMENTS', 'EXTENDS',
  'MENTIONS', 'RELATES_TO', 'DEPENDS_ON', 'DEFINED_IN',
  'USES', 'REFERENCES', 'DOCUMENTS', 'CONFIGURES', 'TESTS',
]);

export function isGraphRelationshipType(s: string): s is GraphRelationshipType {
  return RELATIONSHIP_TYPES.has(s);
}

export function asGraphRelationshipType(s: string): GraphRelationshipType {
  if (!isGraphRelationshipType(s)) throw new Error(`Invalid relationship type: ${s}`);
  return s;
}

// ─────────────────────────────────────────────────────────
// SearchStrategy
// ─────────────────────────────────────────────────────────

import { SearchStrategy } from '../retrieval/types';

const SEARCH_STRATEGIES: ReadonlySet<string> = new Set([
  'keyword', 'semantic', 'graph', 'structural', 'hybrid',
]);

export function isSearchStrategy(s: string): s is SearchStrategy {
  return SEARCH_STRATEGIES.has(s);
}

// ─────────────────────────────────────────────────────────
// Index depth
// ─────────────────────────────────────────────────────────

export type IndexDepth = 'full' | 'signatures' | 'selective';

const INDEX_DEPTHS: ReadonlySet<string> = new Set(['full', 'signatures', 'selective']);

export function isIndexDepth(s: string): s is IndexDepth {
  return INDEX_DEPTHS.has(s);
}

// ─────────────────────────────────────────────────────────
// Document type
// ─────────────────────────────────────────────────────────

export type DocumentType = 'markdown' | 'text' | 'requirements';

const DOCUMENT_TYPES: ReadonlySet<string> = new Set(['markdown', 'text', 'requirements']);

export function isDocumentType(s: string): s is DocumentType {
  return DOCUMENT_TYPES.has(s);
}

// ─────────────────────────────────────────────────────────
// Hook type
// ─────────────────────────────────────────────────────────

export type HookType = 'post-commit' | 'post-merge' | 'pre-push';

const HOOK_TYPES: ReadonlySet<string> = new Set(['post-commit', 'post-merge', 'pre-push']);

export function isHookType(s: string): s is HookType {
  return HOOK_TYPES.has(s);
}

// ─────────────────────────────────────────────────────────
// TriggerType (checkpoints)
// ─────────────────────────────────────────────────────────

import { TriggerType } from '../agent/checkpoints';

const TRIGGER_TYPES: ReadonlySet<string> = new Set(['auto', 'manual', 'error']);

export function isTriggerType(s: string): s is TriggerType {
  return TRIGGER_TYPES.has(s);
}
