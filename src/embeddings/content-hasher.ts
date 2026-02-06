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

  // Include code with whitespace stripped to maximize semantic content per token
  if (entity.content) {
    const stripped = entity.content
      .split('\n')
      .map(line => line.trimStart())       // remove indentation
      .filter(line => line.length > 0)     // remove blank lines
      .slice(0, 80)                        // more lines fit now
      .join('\n');
    parts.push(stripped);
  }

  return parts.join('\n\n');
}
