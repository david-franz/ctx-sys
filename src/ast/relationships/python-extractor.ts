/**
 * F10.5: Python relationship extractor.
 * Extracts imports, inheritance, and type hint references from Python code.
 */

import {
  ExtractedRelationship,
  RelationshipExtractor,
  ParseResultLike,
  SymbolLike
} from './types';

/**
 * Primitive types in Python that should not create type reference relationships.
 */
const PYTHON_PRIMITIVES = new Set([
  'str', 'int', 'float', 'bool', 'None', 'bytes',
  'list', 'dict', 'set', 'tuple', 'Any', 'object',
  'List', 'Dict', 'Set', 'Tuple', 'Optional', 'Union'
]);

/**
 * Python relationship extractor.
 */
export class PythonRelationshipExtractor implements RelationshipExtractor {
  extract(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    // 1. Extract import relationships
    relationships.push(...this.extractImports(parseResult));

    // 2. Extract class relationships (inheritance, containment)
    relationships.push(...this.extractClassRelationships(parseResult));

    // 3. Extract type hint references
    relationships.push(...this.extractTypeHints(parseResult));

    return relationships;
  }

  /**
   * Extract Python import statements.
   */
  private extractImports(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    for (const imp of parseResult.imports) {
      // Module-level import
      relationships.push({
        source: parseResult.filePath,
        sourceType: 'file',
        target: imp.source,
        targetType: 'module',
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
   * Extract class inheritance relationships.
   */
  private extractClassRelationships(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    const processSymbol = (symbol: SymbolLike): void => {
      if (symbol.type === 'class') {
        // Methods are contained by class
        for (const child of symbol.children || []) {
          relationships.push({
            source: symbol.qualifiedName,
            sourceType: 'class',
            target: child.qualifiedName,
            targetType: child.type as any,
            type: 'contains',
            weight: 1.0
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
   * Extract type hint relationships (Python 3.5+).
   */
  private extractTypeHints(parseResult: ParseResultLike): ExtractedRelationship[] {
    const relationships: ExtractedRelationship[] = [];

    const processSymbol = (symbol: SymbolLike): void => {
      // Check parameter type hints
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

      // Check return type hint
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
   * Check if a type is a Python primitive after normalization.
   * For generic containers like List[User] or Optional[User], we check the inner type.
   */
  private isPrimitiveType(type: string): boolean {
    // First normalize to get the actual type being referenced
    const normalized = this.normalizeTypeName(type);

    // Check if the normalized type is a primitive
    return PYTHON_PRIMITIVES.has(normalized);
  }

  /**
   * Normalize a type name.
   */
  private normalizeTypeName(type: string): string {
    // Handle Optional[X] → X
    if (type.startsWith('Optional[') && type.endsWith(']')) {
      return type.slice(9, -1);
    }

    // Handle Union[X, Y] → X (take first)
    if (type.startsWith('Union[') && type.endsWith(']')) {
      const inner = type.slice(6, -1);
      return inner.split(',')[0].trim();
    }

    // Handle generic containers: List[User] → User
    const match = type.match(/\[([^\]]+)\]/);
    if (match) {
      return match[1].split(',')[0].trim();
    }

    return type.trim();
  }
}
