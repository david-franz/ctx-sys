/**
 * F10g.3: Natural language entity mention extractor.
 * Finds references to code entities in document text.
 */

export interface EntityMention {
  name: string;
  confidence: number;
  position: number;
}

/**
 * Extract entity mentions from natural language text.
 * Looks for backtick references, PascalCase names, and file paths.
 */
export class NLRelationshipExtractor {
  extractMentions(text: string, knownEntities: Set<string>): EntityMention[] {
    const mentions: EntityMention[] = [];
    const seen = new Set<string>();

    // 1. Backtick references: `EntityStore`, `findSimilar()`
    for (const match of text.matchAll(/`([A-Za-z_][\w.]*(?:\(\))?)`/g)) {
      const name = match[1].replace('()', '');
      if (knownEntities.has(name) && !seen.has(name)) {
        mentions.push({ name, confidence: 0.95, position: match.index! });
        seen.add(name);
      }
    }

    // 2. PascalCase names likely referencing classes/interfaces
    for (const match of text.matchAll(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g)) {
      if (knownEntities.has(match[1]) && !seen.has(match[1])) {
        mentions.push({ name: match[1], confidence: 0.8, position: match.index! });
        seen.add(match[1]);
      }
    }

    // 3. File path references: src/foo/bar.ts
    for (const match of text.matchAll(/\b((?:src|lib|test|tests)\/[\w/.-]+\.\w+)\b/g)) {
      if (knownEntities.has(match[1]) && !seen.has(match[1])) {
        mentions.push({ name: match[1], confidence: 0.9, position: match.index! });
        seen.add(match[1]);
      }
    }

    return mentions;
  }
}
