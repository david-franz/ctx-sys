/**
 * F10.2: Content hashing for incremental embedding.
 * Generates stable hashes for entity content to detect changes.
 */

import { createHash } from 'crypto';
import { Entity } from '../entities';

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

  // Always include name and type
  parts.push(`${entity.type}: ${entity.name}`);

  // Include summary if available
  if (entity.summary) {
    parts.push(entity.summary);
  }

  // Include first 50 lines of code for semantic matching
  if (entity.content) {
    const codePreview = entity.content.split('\n').slice(0, 50).join('\n');
    parts.push(codePreview);
  }

  return parts.join('\n\n');
}
