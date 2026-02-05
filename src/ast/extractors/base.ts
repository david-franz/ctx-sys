import type { Node } from 'web-tree-sitter';
import { Symbol, ImportStatement, Parameter } from '../types';

/**
 * Syntax node type alias for clarity.
 */
export type SyntaxNode = Node;

/**
 * Language-specific symbol extractor interface.
 */
export interface LanguageExtractor {
  extractSymbols(node: SyntaxNode, filePath?: string): Symbol[];
  extractImports(node: SyntaxNode): ImportStatement[];
  extractExports(node: SyntaxNode): string[];
}

/**
 * Base class for language extractors with common utilities.
 */
export abstract class BaseExtractor implements LanguageExtractor {
  abstract extractSymbols(node: SyntaxNode, filePath?: string): Symbol[];
  abstract extractImports(node: SyntaxNode): ImportStatement[];
  abstract extractExports(node: SyntaxNode): string[];

  /**
   * Get the text content of a node.
   */
  protected getNodeText(node: SyntaxNode): string {
    return node.text;
  }

  /**
   * Find a child node by type.
   */
  protected findChild(
    node: SyntaxNode,
    type: string
  ): SyntaxNode | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === type) {
        return child;
      }
    }
    return null;
  }

  /**
   * Find all children of a given type.
   */
  protected findChildren(
    node: SyntaxNode,
    type: string
  ): SyntaxNode[] {
    const children: SyntaxNode[] = [];
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === type) {
        children.push(child);
      }
    }
    return children;
  }

  /**
   * Get all children of a node.
   */
  protected getChildren(node: SyntaxNode): SyntaxNode[] {
    const children: SyntaxNode[] = [];
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        children.push(child);
      }
    }
    return children;
  }

  /**
   * Extract docstring from a comment preceding the node.
   */
  protected getDocstring(node: SyntaxNode): string | undefined {
    const parent = node.parent;
    if (!parent) return undefined;

    // Find this node's index in parent
    let nodeIndex = -1;
    for (let i = 0; i < parent.childCount; i++) {
      if (parent.child(i)?.id === node.id) {
        nodeIndex = i;
        break;
      }
    }

    if (nodeIndex > 0) {
      const prev = parent.child(nodeIndex - 1);
      if (prev && (prev.type === 'comment' || prev.type === 'block_comment')) {
        return this.cleanDocstring(prev.text);
      }
    }
    return undefined;
  }

  /**
   * Clean up docstring text.
   */
  protected cleanDocstring(text: string): string {
    return text
      .replace(/^\/\*\*?|\*\/$/g, '')   // Remove /* */ or /** */
      .replace(/^\/\/\s?/gm, '')         // Remove //
      .replace(/^\s*\*\s?/gm, '')        // Remove leading *
      .trim();
  }

  /**
   * Build a qualified name from file path and symbol parts.
   */
  protected buildQualifiedName(
    filePath: string | undefined,
    ...parts: string[]
  ): string {
    const base = filePath || '<inline>';
    return [base, ...parts.filter(Boolean)].join('::');
  }

  /**
   * Build a function/method signature.
   */
  protected buildSignature(
    name: string,
    params: Parameter[],
    returnType?: string
  ): string {
    const paramStr = params
      .map(p => {
        let s = p.name;
        if (p.isOptional) s += '?';
        if (p.isRest) s = '...' + s;
        if (p.type) s += ': ' + p.type;
        return s;
      })
      .join(', ');

    let sig = `${name}(${paramStr})`;
    if (returnType) sig += `: ${returnType}`;
    return sig;
  }
}
