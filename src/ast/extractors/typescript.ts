import { BaseExtractor, SyntaxNode } from './base';
import { Symbol, ImportStatement, ImportSpecifier, Parameter } from '../types';

/**
 * TypeScript/JavaScript symbol extractor.
 */
export class TypeScriptExtractor extends BaseExtractor {
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
      case 'class_declaration':
      case 'abstract_class_declaration':
        this.extractClass(node, symbols, filePath, context);
        return; // Don't recurse into class children here (handled in extractClass)
      case 'interface_declaration':
        this.extractInterface(node, symbols, filePath, context);
        return;
      case 'type_alias_declaration':
        this.extractTypeAlias(node, symbols, filePath, context);
        break;
      case 'function_declaration':
        this.extractFunction(node, symbols, filePath, context);
        break;
      case 'lexical_declaration':
      case 'variable_declaration':
        this.extractVariables(node, symbols, filePath, context);
        break;
      case 'enum_declaration':
        this.extractEnum(node, symbols, filePath, context);
        break;
    }

    // Recurse into children
    for (const child of this.getChildren(node)) {
      this.visitNode(child, symbols, filePath, context);
    }
  }

  private extractClass(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    const nameNode = this.findChild(node, 'type_identifier');
    if (!nameNode) return;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const docstring = this.getDocstring(node);
    const decorators = this.extractDecorators(node);
    const isExported = this.isExported(node);

    const methods: Symbol[] = [];
    const properties: Symbol[] = [];

    // Extract class body
    const body = this.findChild(node, 'class_body');
    if (body) {
      for (const member of this.getChildren(body)) {
        if (member.type === 'method_definition' || member.type === 'public_field_definition') {
          if (member.type === 'method_definition') {
            const method = this.extractMethod(member, filePath, [...context, name]);
            if (method) methods.push(method);
          } else {
            const prop = this.extractProperty(member, filePath, [...context, name]);
            if (prop) properties.push(prop);
          }
        }
      }
    }

    symbols.push({
      type: 'class',
      name,
      qualifiedName,
      docstring,
      decorators,
      isExported,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      children: [...methods, ...properties]
    });
  }

  private extractInterface(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    const nameNode = this.findChild(node, 'type_identifier');
    if (!nameNode) return;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const docstring = this.getDocstring(node);
    const isExported = this.isExported(node);

    const properties: Symbol[] = [];
    const body = this.findChild(node, 'interface_body') || this.findChild(node, 'object_type');
    if (body) {
      for (const member of this.getChildren(body)) {
        if (member.type === 'property_signature' || member.type === 'method_signature') {
          const prop = this.extractInterfaceMember(member, filePath, [...context, name]);
          if (prop) properties.push(prop);
        }
      }
    }

    symbols.push({
      type: 'interface',
      name,
      qualifiedName,
      docstring,
      isExported,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      children: properties
    });
  }

  private extractInterfaceMember(
    node: SyntaxNode,
    filePath: string | undefined,
    context: string[]
  ): Symbol | null {
    const nameNode = this.findChild(node, 'property_identifier');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const typeAnnotation = this.findChild(node, 'type_annotation');
    const type = typeAnnotation ? this.extractTypeText(typeAnnotation) : undefined;

    return {
      type: node.type === 'method_signature' ? 'method' : 'property',
      name,
      qualifiedName,
      returnType: type,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    };
  }

  private extractTypeAlias(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    const nameNode = this.findChild(node, 'type_identifier');
    if (!nameNode) return;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const docstring = this.getDocstring(node);
    const isExported = this.isExported(node);

    symbols.push({
      type: 'type',
      name,
      qualifiedName,
      docstring,
      isExported,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    });
  }

  private extractMethod(
    node: SyntaxNode,
    filePath: string | undefined,
    context: string[]
  ): Symbol | null {
    const nameNode = this.findChild(node, 'property_identifier');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const parameters = this.extractParameters(node);
    const returnType = this.extractReturnType(node);
    const signature = this.buildSignature(name, parameters, returnType);
    const docstring = this.getDocstring(node);

    // Check modifiers
    const isStatic = this.getChildren(node).some(c => c.type === 'static');
    const isAsync = this.getChildren(node).some(c => c.type === 'async');
    const visibility = this.extractVisibility(node);

    return {
      type: 'method',
      name,
      qualifiedName,
      signature,
      parameters,
      returnType,
      docstring,
      isStatic,
      isAsync,
      visibility,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    };
  }

  private extractProperty(
    node: SyntaxNode,
    filePath: string | undefined,
    context: string[]
  ): Symbol | null {
    const nameNode = this.findChild(node, 'property_identifier');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const typeAnnotation = this.findChild(node, 'type_annotation');
    const returnType = typeAnnotation ? this.extractTypeText(typeAnnotation) : undefined;
    const visibility = this.extractVisibility(node);

    return {
      type: 'property',
      name,
      qualifiedName,
      returnType,
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
    const parameters = this.extractParameters(node);
    const returnType = this.extractReturnType(node);
    const signature = this.buildSignature(name, parameters, returnType);
    const docstring = this.getDocstring(node);
    const isAsync = this.getChildren(node).some(c => c.type === 'async');
    const isExported = this.isExported(node);

    symbols.push({
      type: 'function',
      name,
      qualifiedName,
      signature,
      parameters,
      returnType,
      docstring,
      isAsync,
      isExported,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    });
  }

  private extractVariables(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    // Look for arrow functions assigned to variables
    for (const child of this.getChildren(node)) {
      if (child.type === 'variable_declarator') {
        const nameNode = this.findChild(child, 'identifier');
        const valueNode = this.findChild(child, 'arrow_function');

        if (nameNode && valueNode) {
          const name = nameNode.text;
          const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
          const parameters = this.extractParameters(valueNode);
          const returnType = this.extractReturnType(valueNode);
          const signature = this.buildSignature(name, parameters, returnType);
          const docstring = this.getDocstring(node);
          const isAsync = this.getChildren(valueNode).some(c => c.type === 'async');
          const isExported = this.isExported(node);

          symbols.push({
            type: 'function',
            name,
            qualifiedName,
            signature,
            parameters,
            returnType,
            docstring,
            isAsync,
            isExported,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1
          });
        }
      }
    }
  }

  private extractEnum(
    node: SyntaxNode,
    symbols: Symbol[],
    filePath: string | undefined,
    context: string[]
  ): void {
    const nameNode = this.findChild(node, 'identifier');
    if (!nameNode) return;

    const name = nameNode.text;
    const qualifiedName = this.buildQualifiedName(filePath, ...context, name);
    const docstring = this.getDocstring(node);
    const isExported = this.isExported(node);

    symbols.push({
      type: 'enum',
      name,
      qualifiedName,
      docstring,
      isExported,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    });
  }

  private extractParameters(node: SyntaxNode): Parameter[] {
    const params: Parameter[] = [];
    const paramsNode = this.findChild(node, 'formal_parameters');
    if (!paramsNode) return params;

    for (const child of this.getChildren(paramsNode)) {
      if (child.type === 'required_parameter' || child.type === 'optional_parameter') {
        const nameNode = this.findChild(child, 'identifier');
        const typeNode = this.findChild(child, 'type_annotation');

        params.push({
          name: nameNode?.text || 'unknown',
          type: typeNode ? this.extractTypeText(typeNode) : undefined,
          isOptional: child.type === 'optional_parameter'
        });
      } else if (child.type === 'rest_parameter') {
        const nameNode = this.findChild(child, 'identifier');
        const typeNode = this.findChild(child, 'type_annotation');
        params.push({
          name: nameNode?.text || 'args',
          type: typeNode ? this.extractTypeText(typeNode) : undefined,
          isRest: true
        });
      }
    }

    return params;
  }

  private extractReturnType(node: SyntaxNode): string | undefined {
    // Find the type annotation that comes after the parameters
    for (const child of this.getChildren(node)) {
      if (child.type === 'type_annotation') {
        // Make sure this is the return type, not a parameter type
        const prevSibling = child.previousSibling;
        if (prevSibling && prevSibling.type === 'formal_parameters') {
          return this.extractTypeText(child);
        }
      }
    }
    return undefined;
  }

  private extractTypeText(node: SyntaxNode): string {
    // Skip the ': ' prefix
    const text = node.text;
    return text.replace(/^:\s*/, '');
  }

  private extractDecorators(node: SyntaxNode): string[] {
    const decorators: string[] = [];
    let prev = node.previousSibling;
    while (prev && prev.type === 'decorator') {
      decorators.unshift(prev.text);
      prev = prev.previousSibling;
    }
    return decorators.length > 0 ? decorators : undefined as unknown as string[];
  }

  private extractVisibility(
    node: SyntaxNode
  ): 'public' | 'private' | 'protected' | undefined {
    for (const child of this.getChildren(node)) {
      if (child.type === 'accessibility_modifier') {
        return child.text as 'public' | 'private' | 'protected';
      }
    }
    return undefined;
  }

  private isExported(node: SyntaxNode): boolean {
    // Check if parent is export_statement
    if (node.parent?.type === 'export_statement') {
      return true;
    }
    // Check for export keyword in children
    return this.getChildren(node).some(c => c.type === 'export');
  }

  extractImports(node: SyntaxNode): ImportStatement[] {
    const imports: ImportStatement[] = [];
    this.visitForImports(node, imports);
    return imports;
  }

  private visitForImports(node: SyntaxNode, imports: ImportStatement[]): void {
    if (node.type === 'import_statement') {
      const imp = this.parseImport(node);
      if (imp) imports.push(imp);
    }
    for (const child of this.getChildren(node)) {
      this.visitForImports(child, imports);
    }
  }

  private parseImport(node: SyntaxNode): ImportStatement | null {
    const sourceNode = this.findChild(node, 'string');
    if (!sourceNode) return null;

    const source = sourceNode.text.replace(/['"]/g, '');
    const specifiers: ImportSpecifier[] = [];
    let isDefault = false;
    let isNamespace = false;

    const clause = this.findChild(node, 'import_clause');
    if (clause) {
      for (const child of this.getChildren(clause)) {
        if (child.type === 'identifier') {
          // Default import
          specifiers.push({ name: child.text });
          isDefault = true;
        } else if (child.type === 'namespace_import') {
          // import * as X
          const asNode = this.findChild(child, 'identifier');
          if (asNode) {
            specifiers.push({ name: '*', alias: asNode.text });
            isNamespace = true;
          }
        } else if (child.type === 'named_imports') {
          // import { X, Y as Z }
          for (const spec of this.getChildren(child)) {
            if (spec.type === 'import_specifier') {
              const children = this.getChildren(spec);
              const nameNode = children[0];
              const aliasNode = children.find((c, i) => i > 0 && c.type === 'identifier');
              if (nameNode) {
                specifiers.push({
                  name: nameNode.text,
                  alias: aliasNode?.text
                });
              }
            }
          }
        }
      }
    }

    return {
      source,
      specifiers,
      isDefault: isDefault || undefined,
      isNamespace: isNamespace || undefined,
      startLine: node.startPosition.row + 1
    };
  }

  extractExports(node: SyntaxNode): string[] {
    const exports: string[] = [];
    this.visitForExports(node, exports);
    return exports;
  }

  private visitForExports(node: SyntaxNode, exports: string[]): void {
    if (node.type === 'export_statement') {
      // Named export
      const decl = this.getChildren(node).find(c =>
        ['class_declaration', 'function_declaration', 'lexical_declaration', 'interface_declaration', 'type_alias_declaration'].includes(c.type)
      );
      if (decl) {
        const nameNode = this.findChild(decl, 'identifier') ||
                        this.findChild(decl, 'type_identifier');
        if (nameNode) exports.push(nameNode.text);
      }

      // Export clause: export { X, Y }
      const clause = this.findChild(node, 'export_clause');
      if (clause) {
        for (const spec of this.getChildren(clause)) {
          if (spec.type === 'export_specifier') {
            const nameNode = this.getChildren(spec)[0];
            if (nameNode) exports.push(nameNode.text);
          }
        }
      }
    }
    for (const child of this.getChildren(node)) {
      this.visitForExports(child, exports);
    }
  }
}
