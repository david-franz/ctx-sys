/**
 * F10g.1: Centralized ignore pattern resolution.
 * Combines DEFAULT_EXCLUDE + .gitignore + .ctxignore patterns.
 */

import * as fs from 'fs';
import * as path from 'path';
import picomatch from 'picomatch';
import { parseGitignore } from './gitignore';

/**
 * Default patterns always excluded from indexing.
 */
const DEFAULT_EXCLUDE = [
  'node_modules/**',
  '.git/**',
  '.ctx-sys/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '__pycache__/**',
  '.next/**',
  '.cache/**',
  '*.min.js',
  '*.bundle.js',
  '.env*',
  '*.lock',
  'package-lock.json'
];

export interface IgnoreResolverOptions {
  /** Extra patterns to exclude (from CLI or config). */
  extraExclude?: string[];
  /** Whether to respect .gitignore (default: true). */
  useGitignore?: boolean;
  /** Whether to respect .ctxignore (default: true). */
  useCtxignore?: boolean;
}

/**
 * Centralized ignore pattern resolver.
 * Merges DEFAULT_EXCLUDE + .gitignore + .ctxignore + user patterns.
 */
export class IgnoreResolver {
  private matcher: (path: string) => boolean;
  private patterns: string[];

  constructor(projectRoot: string, options: IgnoreResolverOptions = {}) {
    const patterns: string[] = [...DEFAULT_EXCLUDE];

    // Load .gitignore patterns
    if (options.useGitignore !== false) {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      patterns.push(...parseGitignore(gitignorePath));
    }

    // Load .ctxignore patterns
    if (options.useCtxignore !== false) {
      const ctxignorePath = path.join(projectRoot, '.ctxignore');
      patterns.push(...parseCtxignore(ctxignorePath));
    }

    // Add user-specified extra patterns
    if (options.extraExclude) {
      patterns.push(...options.extraExclude);
    }

    this.patterns = patterns;
    this.matcher = picomatch(patterns, { dot: true });
  }

  /**
   * Check if a relative path should be ignored.
   */
  isIgnored(relativePath: string): boolean {
    return this.matcher(relativePath);
  }

  /**
   * Get all resolved patterns (for debugging/logging).
   */
  getPatterns(): string[] {
    return [...this.patterns];
  }
}

/**
 * Parse a .ctxignore file. Same format as .gitignore:
 * one pattern per line, # comments, blank lines ignored.
 */
function parseCtxignore(ctxignorePath: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(ctxignorePath, 'utf-8');
  } catch {
    return [];
  }

  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .flatMap(pattern => {
      // Same conversion as gitignore: unanchored patterns match anywhere
      if (pattern.startsWith('!')) return [];

      const isDir = pattern.endsWith('/');
      if (isDir) pattern = pattern.slice(0, -1);

      const isAnchored = pattern.startsWith('/');
      if (isAnchored) pattern = pattern.slice(1);

      const hasSlash = pattern.includes('/');

      if (isDir) {
        if (hasSlash || isAnchored) {
          return [pattern, `${pattern}/**`];
        }
        return [pattern, `${pattern}/**`, `**/${pattern}`, `**/${pattern}/**`];
      }

      if (hasSlash || isAnchored) return [pattern];

      return [pattern, `**/${pattern}`];
    });
}
