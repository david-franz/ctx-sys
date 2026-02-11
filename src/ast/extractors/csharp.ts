/**
 * C# AST extractor using tree-sitter-c-sharp grammar.
 */

import { BaseExtractor, SyntaxNode } from './base';
import { Symbol, ImportStatement, Parameter } from '../types';

/**
 * Dedicated extractor for C# source files.
 */
export class CSharpExtractor extends BaseExtractor {
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
      case 'class_declaration':
      case 'struct_declaration':
      case 'record_declaration':
        symbols.push(this.extractClass(node, context, filePath));
        return;
      case 'interface_declaration':
        symbols.push(this.extractInterface(node, context, filePath));
        return;
      case 'method_declaration':
      case 'constructor_declaration':
        symbols.push(this.extractMethod(node, context, filePath));
        return;
      case 'enum_declaration':
        symbols.push(this.extractEnum(node, context, filePath));
        return;
      case 'namespace_declaration':
      case 'file_scoped_namespace_declaration':
        this.extractNamespace(node, context, symbols, filePath);
        return;
      case 'property_declaration':
        symbols.push(this.extractProperty(node, context, filePath));
        return;
      case 'field_declaration': {
        const sym = this.extractFieldDecl(node, context, filePath);
        if (sym) symbols.push(sym);
        return;
      }
      case 'delegate_declaration': {
        const sym = this.extractDelegate(node, context, filePath);
        if (sym) symbols.push(sym);
        return;
      }
    }

    for (const child of node.namedChildren) {
      this.visitNode(child, context, symbols, filePath);
    }
  }

  // ─── Class / Struct / Record ────────────────────────────────────────

  private extractClass(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol {
    const name = this.getIdentifierName(node);
    const newContext = [...context, name];
    const docstring = this.getDocstring(node);
    const mods = this.extractModifiers(node);

    // Extract base types
    const baseList = this.findChild(node, 'base_list');
    let extendsName: string | undefined;
    const implementsList: string[] = [];
    if (baseList) {
      for (const child of baseList.namedChildren) {
        const typeName = this.extractTypeName(child);
        if (typeName) {
          // First one is typically the base class (for classes), rest are interfaces
          if (!extendsName && node.type === 'class_declaration') {
            extendsName = typeName;
          } else {
            implementsList.push(typeName);
          }
        }
      }
    }

    // Extract members
    const children: Symbol[] = [];
    const body = this.findChild(node, 'declaration_list');
    if (body) {
      for (const child of body.namedChildren) {
        this.visitMember(child, newContext, children, filePath);
      }
    }

    return {
      type: 'class',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      visibility: mods.visibility,
      isStatic: mods.isStatic,
      extends: extendsName,
      implements: implementsList.length > 0 ? implementsList : undefined,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
      children: children.length > 0 ? children : undefined,
    };
  }

  // ─── Interface ──────────────────────────────────────────────────────

  private extractInterface(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol {
    const name = this.getIdentifierName(node);
    const newContext = [...context, name];
    const docstring = this.getDocstring(node);
    const mods = this.extractModifiers(node);

    const children: Symbol[] = [];
    const body = this.findChild(node, 'declaration_list');
    if (body) {
      for (const child of body.namedChildren) {
        this.visitMember(child, newContext, children, filePath);
      }
    }

    return {
      type: 'interface',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      visibility: mods.visibility,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
      children: children.length > 0 ? children : undefined,
    };
  }

  // ─── Method / Constructor ───────────────────────────────────────────

  private extractMethod(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol {
    const name = this.getIdentifierName(node);
    const params = this.extractParameters(node);
    const returnType = this.extractReturnType(node);
    const mods = this.extractModifiers(node);
    const docstring = this.getDocstring(node);

    return {
      type: 'method',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      signature: this.buildSignature(name, params, returnType),
      parameters: params,
      returnType,
      visibility: mods.visibility,
      isStatic: mods.isStatic,
      isAsync: mods.isAsync,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
    };
  }

  // ─── Enum ───────────────────────────────────────────────────────────

  private extractEnum(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol {
    const name = this.getIdentifierName(node);
    const mods = this.extractModifiers(node);
    const docstring = this.getDocstring(node);

    return {
      type: 'enum',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      visibility: mods.visibility,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
    };
  }

  // ─── Property ───────────────────────────────────────────────────────

  private extractProperty(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol {
    const name = this.getIdentifierName(node);
    const mods = this.extractModifiers(node);
    const typeNode = this.findTypePredecessor(node);
    const docstring = this.getDocstring(node);

    return {
      type: 'property',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      returnType: typeNode,
      visibility: mods.visibility,
      isStatic: mods.isStatic,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      docstring,
    };
  }

  // ─── Field ──────────────────────────────────────────────────────────

  private extractFieldDecl(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol | null {
    // field_declaration has variable_declaration child with declarators
    const varDecl = this.findChild(node, 'variable_declaration');
    if (!varDecl) return null;

    const declarator = this.findChild(varDecl, 'variable_declarator');
    if (!declarator) return null;

    const nameNode = this.findChild(declarator, 'identifier');
    if (!nameNode) return null;

    const name = this.getNodeText(nameNode);
    const mods = this.extractModifiers(node);

    return {
      type: 'property',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      visibility: mods.visibility,
      isStatic: mods.isStatic,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  // ─── Delegate ───────────────────────────────────────────────────────

  private extractDelegate(
    node: SyntaxNode,
    context: string[],
    filePath?: string
  ): Symbol | null {
    const name = this.getIdentifierName(node);
    if (!name) return null;

    const mods = this.extractModifiers(node);
    return {
      type: 'type',
      name,
      qualifiedName: this.buildQualifiedName(filePath, ...context, name),
      visibility: mods.visibility,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  // ─── Namespace ──────────────────────────────────────────────────────

  private extractNamespace(
    node: SyntaxNode,
    context: string[],
    symbols: Symbol[],
    filePath?: string
  ): void {
    const nameNode = this.findChild(node, 'identifier')
      ?? this.findChild(node, 'qualified_name');
    const name = nameNode ? this.getNodeText(nameNode) : '';
    const newContext = name ? [...context, name] : context;

    const body = this.findChild(node, 'declaration_list');
    if (body) {
      for (const child of body.namedChildren) {
        this.visitNode(child, newContext, symbols, filePath);
      }
    } else {
      // File-scoped namespace: children are siblings, not wrapped in declaration_list
      for (const child of node.namedChildren) {
        if (child.type !== 'identifier' && child.type !== 'qualified_name') {
          this.visitNode(child, newContext, symbols, filePath);
        }
      }
    }
  }

  // ─── Member visitor ─────────────────────────────────────────────────

  private visitMember(
    node: SyntaxNode,
    context: string[],
    symbols: Symbol[],
    filePath?: string
  ): void {
    switch (node.type) {
      case 'method_declaration':
      case 'constructor_declaration':
        symbols.push(this.extractMethod(node, context, filePath));
        break;
      case 'property_declaration':
        symbols.push(this.extractProperty(node, context, filePath));
        break;
      case 'field_declaration': {
        const sym = this.extractFieldDecl(node, context, filePath);
        if (sym) symbols.push(sym);
        break;
      }
      case 'class_declaration':
      case 'struct_declaration':
      case 'record_declaration':
        symbols.push(this.extractClass(node, context, filePath));
        break;
      case 'interface_declaration':
        symbols.push(this.extractInterface(node, context, filePath));
        break;
      case 'enum_declaration':
        symbols.push(this.extractEnum(node, context, filePath));
        break;
      case 'delegate_declaration': {
        const sym = this.extractDelegate(node, context, filePath);
        if (sym) symbols.push(sym);
        break;
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private getIdentifierName(node: SyntaxNode): string {
    const nameNode = this.findChild(node, 'identifier');
    return nameNode ? this.getNodeText(nameNode) : '<anonymous>';
  }

  private extractModifiers(node: SyntaxNode): {
    visibility?: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAsync?: boolean;
  } {
    let visibility: 'public' | 'private' | 'protected' | undefined;
    let isStatic = false;
    let isAsync = false;

    for (const child of node.namedChildren) {
      if (child.type === 'modifier') {
        const text = this.getNodeText(child);
        if (text === 'public') visibility = 'public';
        else if (text === 'private') visibility = 'private';
        else if (text === 'protected') visibility = 'protected';
        else if (text === 'static') isStatic = true;
        else if (text === 'async') isAsync = true;
      }
    }

    return {
      visibility,
      isStatic: isStatic || undefined,
      isAsync: isAsync || undefined,
    };
  }

  private extractParameters(node: SyntaxNode): Parameter[] {
    const paramList = this.findChild(node, 'parameter_list');
    if (!paramList) return [];

    const params: Parameter[] = [];
    for (const child of paramList.namedChildren) {
      if (child.type === 'parameter') {
        const nameNode = this.findChild(child, 'identifier');
        const typeNode = this.findFirstType(child);

        const param: Parameter = {
          name: nameNode ? this.getNodeText(nameNode) : '',
          type: typeNode,
        };

        // Check for default value
        const equalsValue = this.findChild(child, 'equals_value_clause');
        if (equalsValue) {
          param.isOptional = true;
          param.defaultValue = this.getNodeText(equalsValue).replace(/^=\s*/, '');
        }

        // Check for params keyword
        const text = this.getNodeText(child);
        if (text.startsWith('params ')) {
          param.isRest = true;
        }

        params.push(param);
      }
    }

    return params;
  }

  private extractReturnType(node: SyntaxNode): string | undefined {
    // For methods, the return type precedes the method name
    return this.findTypePredecessor(node);
  }

  private findTypePredecessor(node: SyntaxNode): string | undefined {
    // Look for common type node types that precede the identifier
    for (const child of node.namedChildren) {
      if (child.type === 'identifier' || child.type === 'modifier') continue;
      if (
        child.type === 'predefined_type' ||
        child.type === 'generic_name' ||
        child.type === 'qualified_name' ||
        child.type === 'nullable_type' ||
        child.type === 'array_type' ||
        child.type === 'tuple_type'
      ) {
        return this.getNodeText(child);
      }
      // If we hit a type identifier that's not the symbol name
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        // Only return if it's not the name (check if next sibling is also an identifier)
        const siblings = node.namedChildren;
        const idx = siblings.indexOf(child);
        if (idx >= 0 && idx < siblings.length - 1) {
          const next = siblings[idx + 1];
          if (next?.type === 'identifier') {
            return this.getNodeText(child);
          }
        }
      }
    }
    return undefined;
  }

  private findFirstType(node: SyntaxNode): string | undefined {
    for (const child of node.namedChildren) {
      if (
        child.type === 'predefined_type' ||
        child.type === 'type_identifier' ||
        child.type === 'generic_name' ||
        child.type === 'qualified_name' ||
        child.type === 'nullable_type' ||
        child.type === 'array_type'
      ) {
        return this.getNodeText(child);
      }
    }
    return undefined;
  }

  private extractTypeName(node: SyntaxNode): string | undefined {
    // base_list children can be various types
    const typeId = this.findChild(node, 'type_identifier')
      ?? this.findChild(node, 'generic_name')
      ?? this.findChild(node, 'qualified_name')
      ?? this.findChild(node, 'identifier');
    return typeId ? this.getNodeText(typeId) : undefined;
  }

  // ─── Imports ────────────────────────────────────────────────────────

  extractImports(node: SyntaxNode): ImportStatement[] {
    const imports: ImportStatement[] = [];

    const visit = (n: SyntaxNode): void => {
      if (n.type === 'using_directive') {
        const nameNode = this.findChild(n, 'qualified_name')
          ?? this.findChild(n, 'identifier');
        if (nameNode) {
          imports.push({
            source: this.getNodeText(nameNode),
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

  extractExports(node: SyntaxNode): string[] {
    // Collect all public top-level type names
    const exports: string[] = [];

    for (const child of node.namedChildren) {
      if (
        child.type === 'class_declaration' ||
        child.type === 'struct_declaration' ||
        child.type === 'interface_declaration' ||
        child.type === 'enum_declaration' ||
        child.type === 'record_declaration'
      ) {
        const mods = this.extractModifiers(child);
        if (mods.visibility === 'public') {
          const name = this.getIdentifierName(child);
          if (name !== '<anonymous>') exports.push(name);
        }
      }
    }

    return exports;
  }
}
