import { BaseExtractor, SyntaxNode } from './base';
import { Symbol, ImportStatement } from '../types';

/**
 * Generic extractor for unsupported languages.
 * Provides basic function/class detection based on common patterns.
 */
export class GenericExtractor extends BaseExtractor {
  extractSymbols(node: SyntaxNode, filePath?: string): Symbol[] {
    const symbols: Symbol[] = [];
    this.visitNode(node, symbols, filePath);
    return symbols;
  }

  private visitNode(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined
  ): void {
    // Look for common patterns that indicate function or class definitions
    const type = node.type.toLowerCase();

    if (type.includes('function') || type.includes('method')) {
      const symbol = this.extractGenericFunction(node, filePath);
      if (symbol) symbols.push(symbol);
    } else if (type.includes('class') || type.includes('struct')) {
      const symbol = this.extractGenericClass(node, filePath);
      if (symbol) symbols.push(symbol);
    }

    // Recurse
    for (const child of this.getChildren(node)) {
      this.visitNode(child, symbols, filePath);
    }
  }

  private extractGenericFunction(
    node: SyntaxNode,
    filePath: string | undefined
  ): Symbol | null {
    // Try to find name from common patterns
    const nameNode = this.findChild(node, 'identifier') ||
                     this.findChild(node, 'name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, name);

    return {
      type: 'function',
      name,
      qualifiedName,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    };
  }

  private extractGenericClass(
    node: SyntaxNode,
    filePath: string | undefined
  ): Symbol | null {
    // Try to find name from common patterns
    const nameNode = this.findChild(node, 'identifier') ||
                     this.findChild(node, 'type_identifier') ||
                     this.findChild(node, 'name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, name);

    return {
      type: 'class',
      name,
      qualifiedName,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    };
  }

  extractImports(node: SyntaxNode): ImportStatement[] {
    // Generic import detection - look for import/include statements
    const imports: ImportStatement[] = [];

    const visit = (n: SyntaxNode): void => {
      const type = n.type.toLowerCase();
      if (type.includes('import') || type.includes('include')) {
        // Try to extract source
        const stringNode = this.findChild(n, 'string') ||
                          this.findChild(n, 'string_literal');
        if (stringNode) {
          imports.push({
            source: stringNode.text.replace(/['"<>]/g, ''),
            specifiers: [],
            startLine: n.startPosition.row + 1
          });
        }
      }
      for (const child of this.getChildren(n)) {
        visit(child);
      }
    };

    visit(node);
    return imports;
  }

  extractExports(node: SyntaxNode): string[] {
    // Generic export detection is not reliable
    return [];
  }
}
