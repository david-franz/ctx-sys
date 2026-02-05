/**
 * Parsing types and interfaces
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-2/F2.1-ast-parsing.test.ts for expected behavior.
 */

export interface ParseResult {
  filePath: string;
  language: string;
  success: boolean;
  symbols: Symbol[];
  imports: Import[];
  exports: Export[];
  errors: ParseError[];
}

export interface Symbol {
  type: 'class' | 'interface' | 'type' | 'function' | 'method' | 'property' | 'variable' | 'enum' | 'namespace' | 'module';
  name: string;
  qualifiedName: string;
  signature?: string;
  docstring?: string;
  decorators?: string[];
  visibility?: 'public' | 'private' | 'protected';
  isAsync?: boolean;
  isStatic?: boolean;
  isExported?: boolean;
  returnType?: string;
  parameters?: Parameter[];
  children?: Symbol[];
  startLine: number;
  endLine: number;
}

export interface Parameter {
  name: string;
  type?: string;
  isOptional?: boolean;
  isRest?: boolean;
  defaultValue?: string;
}

export interface Import {
  source: string;
  specifiers: Array<{ name: string; alias?: string }>;
  isNamespace?: boolean;
  isRelative?: boolean;
  startLine: number;
}

export interface Export {
  name: string;
  isDefault?: boolean;
  source?: string;
  startLine?: number;
}

export interface ParseError {
  message: string;
  startLine: number;
  endLine?: number;
}
