/**
 * C/C++ AST extractor using tree-sitter-cpp grammar.
 * Handles both C and C++ code (they share the same grammar).
 */

import { BaseExtractor, SyntaxNode } from './base';
import { Symbol, ImportStatement, Parameter } from '../types';

/**
 * Dedicated extractor for C and C++ source files.
 */
export class CppExtractor extends BaseExtractor {
  extractSymbols(node: SyntaxNode, filePath?: string): Symbol[] {
    const symbols: Symbol[] = [];
    this.visitNode(node, [], symbols, filePath);
    return symbols;
  }

  private visitNode(
    node: SyntaxNode,
    context: string[],
    symbols: Symbol[],
    filePath?: string
  ): void {
    switch (node.type) {
      case 'function_definition': {
        const isInsideClass = context.length > 0 && this.isClassContext(node);
        const sym = this.extractFunction(node, context, filePath, isInsideClass);
        if (sym) symbols.push(sym);
        return; // Don't recurse into function body
      }
      case 'declaration': {
        // Could be a forward declaration or variable - check for function declarator
        const funcDecl = this.findDescendant(node, 'function_declarator');
        if (funcDecl) {
          const sym = this.extractForwardDeclaration(node, context, filePath);
          if (sym) symbols.push(sym);
          return;
        }
        break; // Fall through to recurse for other declarations
      }
      case 'class_specifier': {
        const sym = this.extractClassOrStruct(node, context, filePath, 'class');
        if (sym) symbols.push(sym);
        return;
      }
      case 'struct_specifier': {
        const sym = this.extractClassOrStruct(node, context, filePath, 'struct');
        if (sym) symbols.push(sym);
        return;
      }
      case 'enum_specifier': {
        const sym = this.extractEnum(node, context, filePath);
        if (sym) symbols.push(sym);
        return;
      }
      case 'namespace_definition': {
        this.extractNamespace(node, context, symbols, filePath);
        return;
      }
      case 'template_declaration': {
        // Unwrap: extract the inner declaration with template info
        const inner = node.namedChildren[node.namedChildren.length - 1];
        if (inner) {
          this.visitNode(inner, context, symbols, filePath);
        }
        return;
      }
      case 'type_definition': {
        const sym = this.extractTypedef(node, context, filePath);
        if (sym) symbols.push(sym);
        return;
      }
      case 'alias_declaration': {
        // C++ using X = Y
        const sym = this.extractUsingAlias(node, context, filePath);
        if (sym) symbols.push(sym);
        return;
      }
    }

    // Recurse into children
    for (const child of node.namedChildren) {
      this.visitNode(child, context, symbols, filePath);
    }
  }

  private extractFunction(
    node: SyntaxNode,
    context: string[],
    filePath?: string,
    isMethod?: boolean
  ): Symbol | null {
    // The declarator contains the function name and parameters
    const declarator = this.findDescendant(node, 'function_declarator');
    if (!declarator) return null;

    const nameNode = this.findChild(declarator, 'identifier')
      ?? this.findChild(declarator, 'field_identifier')
      ?? this.findDescendant(declarator, 'identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    const params = this.extractParameters(declarator);
    const returnType = this.extractReturnType(node);
    const docstring = this.getDocstring(node);

    return {
      type: isMethod ? 'method' : 'function',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      signature: this.buildSignature(name, params, returnType),
      parameters: params,
      returnType,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
      isStatic: this.hasStorageSpecifier(node, 'static'),
    };
  }

  private extractForwardDeclaration(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol | null {
    const funcDecl = this.findDescendant(node, 'function_declarator');
    if (!funcDecl) return null;

    const nameNode = this.findChild(funcDecl, 'identifier')
      ?? this.findChild(funcDecl, 'field_identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    const params = this.extractParameters(funcDecl);
    const returnType = this.extractReturnType(node);

    return {
      type: 'function',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      signature: this.buildSignature(name, params, returnType),
      parameters: params,
      returnType,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  private extractClassOrStruct(
    node: SyntaxNode,
    context: string[],
    filePath: string | undefined,
    kind: 'class' | 'struct'
  ): Symbol | null {
    const nameNode = this.findChild(node, 'type_identifier')
      ?? this.findChild(node, 'identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    const newContext = [...context, name];
    const docstring = this.getDocstring(node);

    // Extract base class from base_class_clause
    const baseClause = this.findChild(node, 'base_class_clause');
    let extendsName: string | undefined;
    if (baseClause) {
      const baseId = this.findDescendant(baseClause, 'type_identifier');
      if (baseId) extendsName = this.getNodeText(baseId);
    }

    // Extract members
    const children: Symbol[] = [];
    const body = this.findChild(node, 'field_declaration_list');
    if (body) {
      let currentVisibility: 'public' | 'private' | 'protected' =
        kind === 'struct' ? 'public' : 'private';

      for (const child of body.namedChildren) {
        if (child.type === 'access_specifier') {
          const specText = this.getNodeText(child).replace(':', '').trim().toLowerCase();
          if (specText === 'public' || specText === 'private' || specText === 'protected') {
            currentVisibility = specText;
          }
          continue;
        }

        if (child.type === 'function_definition') {
          const method = this.extractFunction(child, newContext, filePath, true);
          if (method) {
            method.visibility = currentVisibility;
            children.push(method);
          }
        } else if (child.type === 'declaration') {
          const funcDecl = this.findDescendant(child, 'function_declarator');
          if (funcDecl) {
            const method = this.extractForwardDeclaration(child, newContext, filePath);
            if (method) {
              method.type = 'method';
              method.visibility = currentVisibility;
              children.push(method);
            }
          } else {
            // Field declaration
            const field = this.extractField(child, newContext, filePath, currentVisibility);
            if (field) children.push(field);
          }
        } else if (child.type === 'field_declaration') {
          const field = this.extractField(child, newContext, filePath, currentVisibility);
          if (field) children.push(field);
        } else if (child.type === 'template_declaration') {
          // Template method inside class
          const inner = child.namedChildren[child.namedChildren.length - 1];
          if (inner?.type === 'function_definition') {
            const method = this.extractFunction(inner, newContext, filePath, true);
            if (method) {
              method.visibility = currentVisibility;
              children.push(method);
            }
          }
        }
      }
    }

    return {
      type: 'class',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      extends: extendsName,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
      children: children.length > 0 ? children : undefined,
    };
  }

  private extractField(
    node: SyntaxNode,
    context: string[],
    filePath?: string,
    visibility?: 'public' | 'private' | 'protected'
  ): Symbol | null {
    const nameNode = this.findChild(node, 'field_identifier')
      ?? this.findDescendant(node, 'identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    return {
      type: 'property',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      visibility,
      isStatic: this.hasStorageSpecifier(node, 'static'),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  private extractEnum(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol | null {
    const nameNode = this.findChild(node, 'type_identifier')
      ?? this.findChild(node, 'identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    const docstring = this.getDocstring(node);

    return {
      type: 'enum',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
    };
  }

  private extractNamespace(
    node: SyntaxNode,
    context: string[],
    symbols: Symbol[],
    filePath?: string
  ): void {
    const nameNode = this.findChild(node, 'identifier')
      ?? this.findChild(node, 'namespace_identifier');
    const name = nameNode ? this.getNodeText(nameNode) : '';

    const newContext = name ? [...context, name] : context;

    // Recurse into namespace body
    const body = this.findChild(node, 'declaration_list');
    if (body) {
      for (const child of body.namedChildren) {
        this.visitNode(child, newContext, symbols, filePath);
      }
    }
  }

  private extractTypedef(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol | null {
    const nameNode = this.findChild(node, 'type_identifier')
      ?? this.findDescendant(node, 'type_identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    return {
      type: 'type',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  private extractUsingAlias(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol | null {
    const nameNode = this.findChild(node, 'type_identifier')
      ?? this.findChild(node, 'identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    return {
      type: 'type',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  private extractParameters(declaratorNode: SyntaxNode): Parameter[] {
    const paramList = this.findChild(declaratorNode, 'parameter_list');
    if (!paramList) return [];

    const params: Parameter[] = [];
    for (const child of paramList.namedChildren) {
      if (child.type === 'parameter_declaration') {
        const nameNode = this.findChild(child, 'identifier')
          ?? this.findDescendant(child, 'identifier');
        const typeNode = this.findChild(child, 'type_identifier')
          ?? this.findChild(child, 'primitive_type');

        params.push({
          name: nameNode ? this.getNodeText(nameNode) : '',
          type: typeNode ? this.getNodeText(typeNode) : undefined,
        });
      } else if (child.type === 'variadic_parameter_declaration' || child.type === 'variadic_parameter') {
        params.push({ name: '...', isRest: true });
      }
    }

    return params;
  }

  private extractReturnType(node: SyntaxNode): string | undefined {
    // Return type is the type specifier(s) before the declarator
    const typeNode = this.findChild(node, 'type_identifier')
      ?? this.findChild(node, 'primitive_type');
    if (typeNode) return this.getNodeText(typeNode);

    // Check for qualified identifier as return type
    const qualId = this.findChild(node, 'qualified_identifier');
    if (qualId) return this.getNodeText(qualId);

    return undefined;
  }

  private hasStorageSpecifier(node: SyntaxNode, specifier: string): boolean {
    for (const child of node.namedChildren) {
      if (child.type === 'storage_class_specifier' && this.getNodeText(child) === specifier) {
        return true;
      }
    }
    return false;
  }

  private isClassContext(node: SyntaxNode): boolean {
    let current = node.parent;
    while (current) {
      if (current.type === 'class_specifier' || current.type === 'struct_specifier') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private findDescendant(node: SyntaxNode, type: string): SyntaxNode | null {
    for (const child of node.namedChildren) {
      if (child.type === type) return child;
      const found = this.findDescendant(child, type);
      if (found) return found;
    }
    return null;
  }

  // ─── Imports ────────────────────────────────────────────────────────

  extractImports(node: SyntaxNode): ImportStatement[] {
    const imports: ImportStatement[] = [];

    const visit = (n: SyntaxNode): void => {
      if (n.type === 'preproc_include') {
        const pathNode = this.findChild(n, 'string_literal')
          ?? this.findChild(n, 'system_lib_string');
        if (pathNode) {
          const raw = this.getNodeText(pathNode);
          const source = raw.replace(/^[<"']|[>"']$/g, '');
          imports.push({
            source,
            specifiers: [],
            startLine: n.startPosition.row + 1,
          });
        }
      }
      for (const child of n.namedChildren) {
        visit(child);
      }
    };

    visit(node);
    return imports;
  }

  // ─── Exports ────────────────────────────────────────────────────────

  extractExports(_node: SyntaxNode): string[] {
    // C/C++ doesn't have explicit export statements
    return [];
  }
}
