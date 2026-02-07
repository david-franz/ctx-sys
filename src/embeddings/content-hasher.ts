/**
 * F10.2: Content hashing for incremental embedding.
 * Generates stable hashes for entity content to detect changes.
 */

import { createHash } from 'crypto';
import { Entity } from '../entities';
import { splitIdentifier } from '../utils/identifier-splitter';

/**
 * Generate a stable hash for entity content.
 * Uses first 16 characters of SHA256 for a good balance of collision resistance and storage.
 */
export function hashEntityContent(entity: Entity): string {
  const content = buildEmbeddingContent(entity);
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Hash a raw content string.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Build the content string that will be embedded.
 * This must be deterministic and match what's passed to the embedding API.
 */
export function buildEmbeddingContent(entity: Entity): string {
  const parts: string[] = [];

  // Include type and split name for better semantic matching
  parts.push(`${entity.type}: ${splitIdentifier(entity.name)}`);

  // Include file context for code entities
  if (entity.filePath) {
    const pathParts = entity.filePath.split('/').slice(-2);
    parts.push(`in ${pathParts.join('/')}`);
  }

  // Include summary if available
  if (entity.summary) {
    parts.push(entity.summary);
  }

  // Include code with meaningful extraction
  if (entity.content) {
    const meaningful = extractMeaningfulCode(entity.content);
    parts.push(meaningful);
  }

  return parts.join('\n\n');
}

/**
 * Extract meaningful code: signatures, doc comments, exports.
 * Strips implementation details to focus on what the code does, not how.
 */
function extractMeaningfulCode(code: string): string {
  const lines = code.split('\n');
  const meaningful: string[] = [];
  let inDocComment = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    // Keep doc comments
    if (trimmed.startsWith('/**')) inDocComment = true;
    if (inDocComment || trimmed.startsWith('//') || trimmed.startsWith('*')) {
      meaningful.push(trimmed);
      if (trimmed.endsWith('*/')) inDocComment = false;
      continue;
    }
    // Keep signatures (function, class, interface, type, export)
    if (/^(export|async|function|class|interface|type|const|let|var|import)\b/.test(trimmed)) {
      meaningful.push(trimmed);
    }
  }

  return meaningful.slice(0, 60).join('\n');
}
