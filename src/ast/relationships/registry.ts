/**
 * F10.5: Language extractor registry.
 * Automatically selects the appropriate relationship extractor based on language.
 */

import { RelationshipExtractor } from './types';
import { TypeScriptRelationshipExtractor } from './typescript-extractor';
import { JavaScriptRelationshipExtractor } from './javascript-extractor';
import { PythonRelationshipExtractor } from './python-extractor';

/**
 * Registry of language-specific relationship extractors.
 * Automatically selects the right extractor based on file extension or language.
 */
export class RelationshipExtractorRegistry {
  private extractors: Map<string, RelationshipExtractor> = new Map();

  constructor() {
    // Register all language extractors
    const tsExtractor = new TypeScriptRelationshipExtractor();
    const jsExtractor = new JavaScriptRelationshipExtractor();
    const pyExtractor = new PythonRelationshipExtractor();

    // TypeScript
    this.extractors.set('typescript', tsExtractor);
    this.extractors.set('tsx', tsExtractor);
    this.extractors.set('.ts', tsExtractor);
    this.extractors.set('.tsx', tsExtractor);

    // JavaScript
    this.extractors.set('javascript', jsExtractor);
    this.extractors.set('jsx', jsExtractor);
    this.extractors.set('.js', jsExtractor);
    this.extractors.set('.jsx', jsExtractor);
    this.extractors.set('.mjs', jsExtractor);
    this.extractors.set('.cjs', jsExtractor);

    // Python
    this.extractors.set('python', pyExtractor);
    this.extractors.set('.py', pyExtractor);
  }

  /**
   * Get extractor for a given language or file extension.
   */
  getExtractor(languageOrExt: string): RelationshipExtractor | null {
    return this.extractors.get(languageOrExt.toLowerCase()) || null;
  }

  /**
   * Get extractor by file path.
   */
  getExtractorForFile(filePath: string): RelationshipExtractor | null {
    const ext = this.getExtension(filePath);
    return ext ? this.getExtractor(ext) : null;
  }

  /**
   * Check if we support relationship extraction for this language.
   */
  supportsLanguage(languageOrExt: string): boolean {
    return this.extractors.has(languageOrExt.toLowerCase());
  }

  /**
   * Get all supported languages.
   */
  getSupportedLanguages(): string[] {
    return ['typescript', 'javascript', 'python'];
  }

  /**
   * Get all supported extensions.
   */
  getSupportedExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'];
  }

  /**
   * Extract file extension.
   */
  private getExtension(filePath: string): string | null {
    const match = filePath.match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() : null;
  }
}

// Default global registry instance
export const defaultRegistry = new RelationshipExtractorRegistry();
