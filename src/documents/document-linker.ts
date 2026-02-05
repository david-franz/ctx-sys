import {
  MarkdownDocument,
  MarkdownSection,
  CodeReference,
  LinkingResult
} from './types';
import { EntityStore, Entity } from '../entities';

/**
 * Patterns to find code references in documentation.
 */
const CODE_PATTERNS = {
  // Code in backticks: `someCode`
  backtick: /`([^`]+)`/g,
  // File paths: src/file.ts, ./path/to/file.js
  filePath: /(?:^|[\s(,])((?:\.{1,2}\/)?[\w/-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|cpp|c|h|rb|php|swift|kt))(?=[\s),.]|$)/g,
  // Class-like names: AuthService, UserController, etc.
  className: /\b([A-Z][a-zA-Z0-9]+(?:Service|Controller|Manager|Handler|Provider|Factory|Store|Repository|Component|Module|Util|Helper|Config|Error|Exception|Interface|Type|Enum))\b/g,
  // Function calls: validateUser(), getConfig()
  functionCall: /\b([a-z][a-zA-Z0-9_]*)\(\)/g,
  // PascalCase identifiers (potential classes)
  pascalCase: /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g,
  // SCREAMING_CASE constants
  constant: /\b([A-Z][A-Z0-9_]+)\b/g
};

/**
 * Links documentation to code entities.
 */
export class DocumentLinker {
  constructor(private entityStore: EntityStore) {}

  /**
   * Find all code references in a document.
   */
  findCodeReferences(document: MarkdownDocument): CodeReference[] {
    const allRefs: CodeReference[] = [];

    for (const section of document.sections) {
      // Find references in content
      const contentRefs = this.findReferencesInText(section.content, section.title, false);
      allRefs.push(...contentRefs);

      // Find references in code blocks
      for (const codeBlock of section.codeBlocks) {
        const codeRefs = this.findReferencesInText(codeBlock.code, section.title, true);
        allRefs.push(...codeRefs);
      }
    }

    // Deduplicate by text
    const seen = new Set<string>();
    return allRefs.filter(ref => {
      if (seen.has(ref.text)) return false;
      seen.add(ref.text);
      return true;
    });
  }

  /**
   * Find code references in a text string.
   */
  findReferencesInText(
    text: string,
    section?: string,
    inCodeBlock: boolean = false
  ): CodeReference[] {
    const refs: CodeReference[] = [];

    // Find backtick code
    for (const match of text.matchAll(CODE_PATTERNS.backtick)) {
      refs.push({
        text: match[1],
        type: 'backtick',
        section,
        inCodeBlock
      });
    }

    // Find file paths
    for (const match of text.matchAll(CODE_PATTERNS.filePath)) {
      refs.push({
        text: match[1],
        type: 'filepath',
        section,
        inCodeBlock
      });
    }

    // Find class-like names (not in backticks to avoid duplication)
    const textWithoutBackticks = text.replace(CODE_PATTERNS.backtick, '');
    for (const match of textWithoutBackticks.matchAll(CODE_PATTERNS.className)) {
      if (!refs.some(r => r.text === match[1])) {
        refs.push({
          text: match[1],
          type: 'classname',
          section,
          inCodeBlock
        });
      }
    }

    // Find function calls
    for (const match of textWithoutBackticks.matchAll(CODE_PATTERNS.functionCall)) {
      if (!refs.some(r => r.text === match[1])) {
        refs.push({
          text: match[1],
          type: 'function',
          section,
          inCodeBlock
        });
      }
    }

    return refs;
  }

  /**
   * Resolve a code reference to an entity.
   */
  async resolveReference(ref: string): Promise<Entity | null> {
    // Try exact qualified name match
    let entity = await this.entityStore.getByQualifiedName(ref);
    if (entity) return entity;

    // Try as file path
    const results = await this.entityStore.search(ref, { type: 'file', limit: 1 });
    if (results.length > 0) return results[0];

    // Try as class/interface/type name
    for (const entityType of ['class', 'interface', 'type'] as const) {
      const typeResults = await this.entityStore.search(ref, { type: entityType, limit: 1 });
      if (typeResults.length > 0) return typeResults[0];
    }

    // Try as function name
    const funcResults = await this.entityStore.search(ref, { type: ['function', 'method'], limit: 1 });
    if (funcResults.length > 0) return funcResults[0];

    // Try general search
    const generalResults = await this.entityStore.search(ref, { limit: 1 });
    if (generalResults.length > 0) {
      // Only return if it's a good match (name contains the reference)
      const result = generalResults[0];
      if (result.name.toLowerCase().includes(ref.toLowerCase()) ||
          ref.toLowerCase().includes(result.name.toLowerCase())) {
        return result;
      }
    }

    return null;
  }

  /**
   * Resolve multiple references and return matches.
   */
  async resolveReferences(
    refs: CodeReference[]
  ): Promise<Map<string, Entity>> {
    const resolved = new Map<string, Entity>();

    for (const ref of refs) {
      if (resolved.has(ref.text)) continue;

      const entity = await this.resolveReference(ref.text);
      if (entity) {
        resolved.set(ref.text, entity);
      }
    }

    return resolved;
  }

  /**
   * Link a document to code entities.
   * Returns statistics about the linking.
   */
  async linkDocument(
    document: MarkdownDocument,
    _documentEntityId?: string
  ): Promise<LinkingResult> {
    const refs = this.findCodeReferences(document);
    const resolved = await this.resolveReferences(refs);

    const unresolvedReferences = refs
      .filter(r => !resolved.has(r.text))
      .map(r => r.text);

    return {
      documentId: _documentEntityId || document.filePath,
      linksCreated: resolved.size,
      unresolvedReferences
    };
  }

  /**
   * Get the patterns used for code reference detection.
   */
  getPatterns(): typeof CODE_PATTERNS {
    return { ...CODE_PATTERNS };
  }

  /**
   * Check if a string looks like a code reference.
   */
  looksLikeCode(text: string): boolean {
    // Check against all patterns
    return (
      CODE_PATTERNS.filePath.test(text) ||
      CODE_PATTERNS.className.test(text) ||
      CODE_PATTERNS.functionCall.test(text) ||
      CODE_PATTERNS.pascalCase.test(text) ||
      // Contains typical code characters
      /[._()]/.test(text) ||
      // camelCase
      /^[a-z]+[A-Z]/.test(text)
    );
  }
}
