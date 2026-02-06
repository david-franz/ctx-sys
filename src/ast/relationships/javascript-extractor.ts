/**
 * F10.5: JavaScript relationship extractor.
 * Extends TypeScript extractor with JavaScript-specific handling (CommonJS, no type refs).
 */

import {
  ExtractedRelationship,
  RelationshipExtractor,
  ParseResultLike,
  SymbolLike
} from './types';
import { TypeScriptRelationshipExtractor } from './typescript-extractor';

/**
 * JavaScript relationship extractor.
 * Similar to TypeScript but without type references.
 */
export class JavaScriptRelationshipExtractor implements RelationshipExtractor {
  private tsExtractor = new TypeScriptRelationshipExtractor();

  extract(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    // Use TypeScript extractor for imports and class relationships
    const tsRelationships = this.tsExtractor.extract(parseResult);

    // Filter out type references (not applicable to plain JS)
    relationships.push(
      ...tsRelationships.filter(r => r.type !== 'uses_type')
    );

    return relationships;
  }
}
