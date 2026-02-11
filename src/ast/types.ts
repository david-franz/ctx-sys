/**
 * AST parsing types and interfaces.
 */

export type SymbolType =
  | 'class'
  | 'interface'
  | 'type'
  | 'function'
  | 'method'
  | 'property'
  | 'variable'
  | 'enum'
  | 'namespace'
  | 'module';

export interface Parameter {
  name: string;
  type?: string;
  defaultValue?: string;
  isOptional?: boolean;
  isRest?: boolean;
}

export interface Symbol {
  type: SymbolType;
  name: string;
  qualifiedName: string;
  signature?: string;
  parameters?: Parameter[];
  returnType?: string;
  decorators?: string[];
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  isExported?: boolean;
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
  docstring?: string;
  children?: Symbol[];
}

export interface ImportSpecifier {
  name: string;
  alias?: string;
}

export interface ImportStatement {
  source: string;
  specifiers: ImportSpecifier[];
  isDefault?: boolean;
  isNamespace?: boolean;
  startLine: number;
}

export interface ParseError {
  message: string;
  startLine: number;
  endLine: number;
}

export interface ParseResult {
  filePath: string;
  language: string;
  symbols: Symbol[];
  imports: ImportStatement[];
  exports: string[];
  errors: ParseError[];
}

export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp';
