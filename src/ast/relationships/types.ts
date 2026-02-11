/**
 * F10.5: Types for automatic relationship extraction.
 * Defines the structure of relationships extracted from AST analysis.
 */

import { EntityType } from '../../entities';

/**
 * Types of relationships that can be extracted from code.
 */
export type ExtractedRelationshipType =
  | 'imports'      // File imports from another file
  | 'exports'      // File exports a symbol
  | 'calls'        // Function/method calls another
  | 'extends'      // Class extends another class
  | 'implements'   // Class implements interface
  | 'uses_type'    // Function uses a type
  | 'contains'     // Class contains method/property
  | 'instantiates' // Code creates instance of class
  | 'references';  // General reference to symbol

/**
 * A relationship extracted from code analysis.
 */
export interface ExtractedRelationship {
  /** Source symbol name or qualified name */
  source: string;
  sourceType: EntityType;

  /** Target symbol name or qualified name */
  target: string;
  targetType?: EntityType;

  /** Relationship type */
  type: ExtractedRelationshipType;

  /** Relationship weight (0-1) */
  weight?: number;

  /** Additional metadata */
  metadata?: {
    line?: number;
    isOptional?: boolean;
    isDynamic?: boolean;
  };
}

/**
 * Result of relationship extraction from a file.
 */
export interface ExtractionResult {
  /** File path that was analyzed */
  filePath: string;
  /** Extracted relationships */
  relationships: ExtractedRelationship[];
  /** Number of imports extracted */
  importCount: number;
  /** Number of call relationships extracted */
  callCount: number;
  /** Number of inheritance relationships extracted */
  inheritanceCount: number;
  /** Number of type references extracted */
  typeRefCount: number;
}

/**
 * Information about a function/method call.
 */
export interface CallInfo {
  name: string;
  line: number;
  isDynamic: boolean;
}

/**
 * Interface for language-specific relationship extractors.
 */
export interface RelationshipExtractor {
  /**
   * Extract relationships from a parse result.
   */
  extract(parseResult: ParseResultLike): ExtractedRelationship[];
}

/**
 * Minimal parse result interface for extraction.
 * This avoids circular dependencies with the full ParseResult type.
 */
export interface ParseResultLike {
  filePath: string;
  language: string;
  symbols: SymbolLike[];
  imports: ImportLike[];
  exports: string[];
}

/**
 * Minimal symbol interface for extraction.
 */
export interface SymbolLike {
  type: EntityType;
  name: string;
  qualifiedName: string;
  parameters?: Array<{ name: string; type?: string }>;
  returnType?: string;
  startLine: number;
  endLine: number;
  children?: SymbolLike[];
  extends?: string;
  implements?: string[];
}

/**
 * Minimal import interface for extraction.
 */
export interface ImportLike {
  source: string;
  specifiers: Array<{ name: string; alias?: string }>;
  startLine: number;
}
