import { createHash } from 'crypto';

/**
 * Generate a truncated SHA-256 hash of content for change detection.
 * Returns first 16 characters of the hex digest.
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
