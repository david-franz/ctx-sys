/**
 * F10.5: Automatic Relationship Extraction
 * Exports for relationship extraction from code analysis.
 */

export {
  ExtractedRelationship,
  ExtractedRelationshipType,
  RelationshipExtractor,
  ExtractionResult,
  CallInfo,
  ParseResultLike,
  SymbolLike,
  ImportLike
} from './types';

export { TypeScriptRelationshipExtractor } from './typescript-extractor';
export { JavaScriptRelationshipExtractor } from './javascript-extractor';
export { PythonRelationshipExtractor } from './python-extractor';
export { RelationshipExtractorRegistry, defaultRegistry } from './registry';
