import { BaseExtractor, SyntaxNode } from './base';
import { Symbol, ImportStatement, ImportSpecifier, Parameter } from '../types';

/**
 * Python symbol extractor.
 */
export class PythonExtractor extends BaseExtractor {
  extractSymbols(node: SyntaxNode, filePath?: string): Symbol[] {
    const symbols: Symbol[] = [];
    this.visitNode(node, symbols, filePath, []);
    return symbols;
  }

  private visitNode(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    switch (node.type) {
      case 'class_definition':
        this.extractClass(node, symbols, filePath, context);
        return; // Don't recurse further (handled in extractClass)
      case 'function_definition':
        if (context.length === 0) {
          // Top-level function
          this.extractFunction(node, symbols, filePath, context);
        }
        break;
    }

    // Only recurse at module level
    if (context.length === 0) {
      for (const child of this.getChildren(node)) {
        this.visitNode(child, symbols, filePath, context);
      }
    }
  }

  private extractClass(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    const nameNode = this.findChild(node, 'identifier');
    if (!nameNode) return;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const docstring = this.extractPythonDocstring(node);
    const decorators = this.extractPythonDecorators(node);

    const methods: Symbol[] = [];
    const body = this.findChild(node, 'block');
    if (body) {
      for (const child of this.getChildren(body)) {
        if (child.type === 'function_definition') {
          const method = this.extractMethod(child, filePath, [...context, name]);
          if (method) methods.push(method);
        }
      }
    }

    symbols.push({
      type: 'class',
      name,
      qualifiedName,
      docstring,
      decorators: decorators.length > 0 ? decorators : undefined,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      children: methods.length > 0 ? methods : undefined
    });
  }

  private extractMethod(
    node: SyntaxNode,
    filePath: string | undefined,
    context: string[]
  ): Symbol | null {
    const nameNode = this.findChild(node, 'identifier');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const parameters = this.extractPythonParameters(node);
    const returnType = this.extractPythonReturnType(node);
    const signature = this.buildPythonSignature(name, parameters, returnType);
    const docstring = this.extractPythonDocstring(node);
    const decorators = this.extractPythonDecorators(node);

    const isStatic = decorators.includes('@staticmethod');
    const isClassMethod = decorators.includes('@classmethod');
    const isAsync = this.getChildren(node).some(c => c.type === 'async');

    // Determine visibility from name convention
    const visibility = name.startsWith('__') && !name.endsWith('__')
      ? 'private'
      : name.startsWith('_')
        ? 'protected'
        : 'public';

    return {
      type: 'method',
      name,
      qualifiedName,
      signature,
      parameters,
      returnType,
      docstring,
      decorators: decorators.length > 0 ? decorators : undefined,
      isStatic: isStatic || isClassMethod || undefined,
      isAsync: isAsync || undefined,
      visibility,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    };
  }

  private extractFunction(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    const nameNode = this.findChild(node, 'identifier');
    if (!nameNode) return;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const parameters = this.extractPythonParameters(node);
    const returnType = this.extractPythonReturnType(node);
    const signature = this.buildPythonSignature(name, parameters, returnType);
    const docstring = this.extractPythonDocstring(node);
    const decorators = this.extractPythonDecorators(node);
    const isAsync = this.getChildren(node).some(c => c.type === 'async');

    symbols.push({
      type: 'function',
      name,
      qualifiedName,
      signature,
      parameters,
      returnType,
      docstring,
      decorators: decorators.length > 0 ? decorators : undefined,
      isAsync: isAsync || undefined,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    });
  }

  private extractPythonParameters(node: SyntaxNode): Parameter[] {
    const params: Parameter[] = [];
    const paramsNode = this.findChild(node, 'parameters');
    if (!paramsNode) return params;

    for (const child of this.getChildren(paramsNode)) {
      if (child.type === 'identifier') {
        // Simple parameter (no type annotation)
        params.push({ name: child.text });
      } else if (child.type === 'typed_parameter') {
        const nameNode = this.findChild(child, 'identifier');
        const typeNode = this.findChild(child, 'type');
        params.push({
          name: nameNode?.text || 'unknown',
          type: typeNode?.text
        });
      } else if (child.type === 'default_parameter' || child.type === 'typed_default_parameter') {
        const nameNode = this.findChild(child, 'identifier');
        const typeNode = this.findChild(child, 'type');
        params.push({
          name: nameNode?.text || 'unknown',
          type: typeNode?.text,
          isOptional: true
        });
      } else if (child.type === 'list_splat_pattern' || child.type === 'dictionary_splat_pattern') {
        params.push({ name: child.text, isRest: true });
      }
    }

    return params;
  }

  private extractPythonReturnType(node: SyntaxNode): string | undefined {
    // Look for return type annotation: -> Type
    for (const child of this.getChildren(node)) {
      if (child.type === 'type') {
        return child.text;
      }
    }
    return undefined;
  }

  private extractPythonDocstring(node: SyntaxNode): string | undefined {
    const body = this.findChild(node, 'block');
    if (!body) return undefined;

    // First statement in block should be the docstring
    for (const child of this.getChildren(body)) {
      if (child.type === 'expression_statement') {
        const strNode = this.findChild(child, 'string');
        if (strNode) {
          // Clean up triple quotes
          return strNode.text.replace(/^['\"]{1,3}|['\"]{1,3}$/g, '').trim();
        }
        break; // Only check first statement
      } else if (child.type !== 'comment') {
        break; // Not a docstring if something else comes first
      }
    }
    return undefined;
  }

  private extractPythonDecorators(node: SyntaxNode): string[] {
    const decorators: string[] = [];
    let prev = node.previousSibling;
    while (prev && prev.type === 'decorator') {
      decorators.unshift(prev.text);
      prev = prev.previousSibling;
    }
    return decorators;
  }

  private buildPythonSignature(
    name: string,
    params: Parameter[],
    returnType?: string
  ): string {
    const paramStr = params
      .map(p => {
        let s = p.name;
        if (p.isRest) s = '*' + s;
        if (p.type) s += ': ' + p.type;
        if (p.isOptional) s += '=...';
        return s;
      })
      .join(', ');

    let sig = `def ${name}(${paramStr})`;
    if (returnType) sig += ` -> ${returnType}`;
    return sig;
  }

  extractImports(node: SyntaxNode): ImportStatement[] {
    const imports: ImportStatement[] = [];
    this.visitForImports(node, imports);
    return imports;
  }

  private visitForImports(node: SyntaxNode, imports: ImportStatement[]): void {
    if (node.type === 'import_statement' || node.type === 'import_from_statement') {
      const imp = this.parsePythonImport(node);
      if (imp) imports.push(imp);
    }
    for (const child of this.getChildren(node)) {
      this.visitForImports(child, imports);
    }
  }

  private parsePythonImport(node: SyntaxNode): ImportStatement | null {
    if (node.type === 'import_statement') {
      // import X, Y
      const names = this.findChildren(node, 'dotted_name');
      if (names.length === 0) return null;

      return {
        source: names[0].text,
        specifiers: names.map(n => ({ name: n.text })),
        startLine: node.startPosition.row + 1
      };
    } else {
      // from X import Y, Z
      const moduleNode = this.findChild(node, 'dotted_name') ||
                        this.findChild(node, 'relative_import');
      const source = moduleNode?.text || '';
      const specifiers: ImportSpecifier[] = [];

      for (const child of this.getChildren(node)) {
        if (child.type === 'dotted_name' && child !== moduleNode) {
          specifiers.push({ name: child.text });
        } else if (child.type === 'aliased_import') {
          const nameNode = this.findChild(child, 'dotted_name');
          const aliasNode = this.findChild(child, 'identifier');
          if (nameNode) specifiers.push({ name: nameNode.text, alias: aliasNode?.text });
        } else if (child.type === 'wildcard_import') {
          specifiers.push({ name: '*' });
        }
      }

      return {
        source,
        specifiers,
        startLine: node.startPosition.row + 1
      };
    }
  }

  extractExports(node: SyntaxNode): string[] {
    // Python doesn't have explicit exports; __all__ is convention
    const exports: string[] = [];
    this.visitForExports(node, exports);
    return exports;
  }

  private visitForExports(node: SyntaxNode, exports: string[]): void {
    if (node.type === 'assignment') {
      const children = this.getChildren(node);
      const left = children[0];
      if (left?.text === '__all__') {
        const list = this.findChild(node, 'list');
        if (list) {
          for (const child of this.getChildren(list)) {
            if (child.type === 'string') {
              exports.push(child.text.replace(/['"]/g, ''));
            }
          }
        }
      }
    }
    for (const child of this.getChildren(node)) {
      this.visitForExports(child, exports);
    }
  }
}
