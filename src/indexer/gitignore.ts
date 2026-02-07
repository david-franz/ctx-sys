/**
 * Parse .gitignore files and convert patterns to picomatch-compatible globs.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Read and parse a .gitignore file, returning picomatch-compatible patterns.
 */
export function parseGitignore(gitignorePath: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    return [];
  }

  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .flatMap(pattern => gitignorePatternToGlobs(pattern));
}

/**
 * Convert a single .gitignore pattern to picomatch-compatible glob(s).
 *
 * .gitignore rules:
 *  - Trailing `/` means directory only → we match `dir` and `dir/**`
 *  - Leading `/` means relative to .gitignore location → strip it
 *  - `!` prefix means negation → skip (picomatch doesn't negate in our usage)
 *  - No slashes → matches anywhere in tree → prefix with `**​/`
 *  - Contains slashes → relative path match
 */
function gitignorePatternToGlobs(raw: string): string[] {
  // Skip negation patterns (not supported in our exclude-only model)
  if (raw.startsWith('!')) {
    return [];
  }

  let pattern = raw;

  // Trailing slash means directory — match dir name and everything inside
  const isDir = pattern.endsWith('/');
  if (isDir) {
    pattern = pattern.slice(0, -1);
  }

  // Leading slash means anchored to root — strip it
  const isAnchored = pattern.startsWith('/');
  if (isAnchored) {
    pattern = pattern.slice(1);
  }

  // If pattern has no slash (after stripping leading), it matches anywhere
  const hasSlash = pattern.includes('/');

  if (isDir) {
    if (hasSlash || isAnchored) {
      // Anchored directory: match exact path and contents
      return [pattern, `${pattern}/**`];
    }
    // Unanchored directory: match anywhere
    return [pattern, `${pattern}/**`, `**/${pattern}`, `**/${pattern}/**`];
  }

  if (hasSlash || isAnchored) {
    // Anchored file pattern
    return [pattern];
  }

  // Unanchored file pattern — match anywhere in tree
  return [pattern, `**/${pattern}`];
}

/**
 * Collect .gitignore patterns from a project root.
 * Only reads the root .gitignore for simplicity.
 */
export function loadGitignorePatterns(projectRoot: string): string[] {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  return parseGitignore(gitignorePath);
}
