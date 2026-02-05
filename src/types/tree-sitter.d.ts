// Type declarations for tree-sitter (stub for testing)
declare module 'tree-sitter' {
  export interface Point {
    row: number;
    column: number;
  }

  export interface Range {
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
  }

  export interface SyntaxNode {
    id: number;
    tree: Tree;
    type: string;
    isNamed: boolean;
    text: string;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    parent: SyntaxNode | null;
    children: SyntaxNode[];
    namedChildren: SyntaxNode[];
    childCount: number;
    namedChildCount: number;
    firstChild: SyntaxNode | null;
    firstNamedChild: SyntaxNode | null;
    lastChild: SyntaxNode | null;
    lastNamedChild: SyntaxNode | null;
    nextSibling: SyntaxNode | null;
    nextNamedSibling: SyntaxNode | null;
    previousSibling: SyntaxNode | null;
    previousNamedSibling: SyntaxNode | null;
    hasChanges(): boolean;
    hasError(): boolean;
    isMissing(): boolean;
    toString(): string;
    child(index: number): SyntaxNode | null;
    namedChild(index: number): SyntaxNode | null;
    descendantForIndex(index: number): SyntaxNode;
    descendantForIndex(startIndex: number, endIndex: number): SyntaxNode;
    namedDescendantForIndex(index: number): SyntaxNode;
    namedDescendantForIndex(startIndex: number, endIndex: number): SyntaxNode;
    descendantForPosition(position: Point): SyntaxNode;
    descendantForPosition(startPosition: Point, endPosition: Point): SyntaxNode;
    namedDescendantForPosition(position: Point): SyntaxNode;
    namedDescendantForPosition(startPosition: Point, endPosition: Point): SyntaxNode;
    walk(): TreeCursor;
  }

  export interface TreeCursor {
    nodeType: string;
    nodeText: string;
    nodeIsNamed: boolean;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    readonly currentNode: SyntaxNode;
    reset(node: SyntaxNode): void;
    gotoParent(): boolean;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
  }

  export interface Tree {
    readonly rootNode: SyntaxNode;
    edit(delta: Edit): Tree;
    walk(): TreeCursor;
    getChangedRanges(other: Tree): Range[];
    getEditedRange(other: Tree): Range;
  }

  export interface Edit {
    startIndex: number;
    oldEndIndex: number;
    newEndIndex: number;
    startPosition: Point;
    oldEndPosition: Point;
    newEndPosition: Point;
  }

  export interface Language {
    // Opaque language object
  }

  export interface Parser {
    parse(input: string | Input, oldTree?: Tree): Tree;
    setLanguage(language: Language): void;
    getLanguage(): Language;
    setTimeoutMicros(timeout: number): void;
    getTimeoutMicros(): number;
    reset(): void;
  }

  export interface Input {
    (index: number, position?: Point): string | null;
  }

  interface ParserConstructor {
    new (): Parser;
  }

  const TreeSitter: ParserConstructor;
  export default TreeSitter;
}

declare module 'tree-sitter-typescript' {
  import { Language } from 'tree-sitter';
  export const typescript: Language;
  export const tsx: Language;
}

declare module 'tree-sitter-javascript' {
  import { Language } from 'tree-sitter';
  const language: Language;
  export default language;
}

declare module 'tree-sitter-python' {
  import { Language } from 'tree-sitter';
  const language: Language;
  export default language;
}
