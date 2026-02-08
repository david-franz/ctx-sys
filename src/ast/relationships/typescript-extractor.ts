/**
 * F10.5: TypeScript/JavaScript relationship extractor.
 * Extracts imports, calls, inheritance, and type references from TypeScript/JavaScript code.
 */

import {
  ExtractedRelationship,
  RelationshipExtractor,
  ParseResultLike,
  SymbolLike,
  CallInfo
} from './types';

/**
 * Primitive types that should not create type reference relationships.
 */
const PRIMITIVE_TYPES = new Set([
  'string', 'number', 'boolean', 'void', 'null', 'undefined',
  'any', 'never', 'unknown', 'object', 'symbol', 'bigint'
]);

/**
 * TypeScript relationship extractor.
 * Handles TypeScript and JavaScript (with TypeScript-style analysis).
 */
export class TypeScriptRelationshipExtractor implements RelationshipExtractor {
  extract(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    // 1. Extract import relationships
    relationships.push(...this.extractImports(parseResult));

    // 2. Extract class relationships (extends, implements, contains)
    relationships.push(...this.extractClassRelationships(parseResult));

    // 3. Extract type usage relationships
    relationships.push(...this.extractTypeReferences(parseResult));

    return relationships;
  }

  /**
   * Extract import relationships from file.
   */
  private extractImports(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    for (const imp of parseResult.imports) {
      // File-level import relationship
      relationships.push({
        source: parseResult.filePath,
        sourceType: 'file',
        target: imp.source,
        targetType: 'file',
        type: 'imports',
        weight: 1.0,
        metadata: { line: imp.startLine }
      });

      // Named imports create references
      for (const spec of imp.specifiers) {
        if (spec.name !== '*') {
          relationships.push({
            source: parseResult.filePath,
            sourceType: 'file',
            target: spec.name,
            type: 'references',
            weight: 0.8,
            metadata: { line: imp.startLine }
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Extract class inheritance, interface implementation, and containment.
   */
  private extractClassRelationships(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    const processSymbol = (symbol: SymbolLike): void => {
      if (symbol.type === 'class' || symbol.type === 'interface') {
        // Methods/properties are contained by class/interface
        for (const child of symbol.children || []) {
          relationships.push({
            source: symbol.qualifiedName,
            sourceType: symbol.type as any,
            target: child.qualifiedName,
            targetType: child.type as any,
            type: 'contains',
            weight: 1.0
          });
        }

        // Extends relationship
        if (symbol.extends) {
          relationships.push({
            source: symbol.qualifiedName,
            sourceType: symbol.type as any,
            target: symbol.extends,
            targetType: symbol.type === 'interface' ? 'interface' : 'class',
            type: 'extends',
            weight: 1.0
          });
        }

        // Implements relationship (classes implementing interfaces)
        if (symbol.implements) {
          for (const iface of symbol.implements) {
            relationships.push({
              source: symbol.qualifiedName,
              sourceType: symbol.type as any,
              target: iface,
              targetType: 'interface',
              type: 'implements',
              weight: 1.0
            });
          }
        }
      }

      // Recurse into children
      for (const child of symbol.children || []) {
        processSymbol(child);
      }
    };

    for (const symbol of parseResult.symbols) {
      processSymbol(symbol);
    }

    return relationships;
  }

  /**
   * Extract type references from function signatures.
   */
  private extractTypeReferences(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    const processSymbol = (symbol: SymbolLike): void => {
      // Parameter types
      for (const param of symbol.parameters || []) {
        if (param.type && !this.isPrimitiveType(param.type)) {
          const normalizedType = this.normalizeTypeName(param.type);
          if (normalizedType) {
            relationships.push({
              source: symbol.qualifiedName,
              sourceType: symbol.type as any,
              target: normalizedType,
              targetType: 'type',
              type: 'uses_type',
              weight: 0.7
            });
          }
        }
      }

      // Return type
      if (symbol.returnType && !this.isPrimitiveType(symbol.returnType)) {
        const normalizedType = this.normalizeTypeName(symbol.returnType);
        if (normalizedType) {
          relationships.push({
            source: symbol.qualifiedName,
            sourceType: symbol.type as any,
            target: normalizedType,
            targetType: 'type',
            type: 'uses_type',
            weight: 0.7
          });
        }
      }

      // Recurse into children
      for (const child of symbol.children || []) {
        processSymbol(child);
      }
    };

    for (const symbol of parseResult.symbols) {
      processSymbol(symbol);
    }

    return relationships;
  }

  /**
   * Check if a type is a primitive.
   */
  private isPrimitiveType(type: string): boolean {
    const normalized = type.toLowerCase().trim();
    return PRIMITIVE_TYPES.has(normalized);
  }

  /**
   * Normalize a type name by removing generics, arrays, unions.
   */
  private normalizeTypeName(type: string): string {
    // Remove generics: Promise<User> → Promise
    // Remove arrays: User[] → User
    // Remove unions: User | null → User (take first)
    // Remove optional: User? → User
    return type
      .replace(/<[^>]+>/g, '')
      .replace(/\[\]/g, '')
      .replace(/\?$/g, '')
      .split('|')[0]
      .split('&')[0]
      .trim();
  }
}
