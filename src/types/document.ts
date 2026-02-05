/**
 * Phase 4: Document Types
 * Type definitions for markdown documents
 */

export interface MarkdownDocument {
  filePath: string;
  title?: string;
  frontmatter?: Record<string, any>;
  sections: MarkdownSection[];
}

export interface MarkdownSection {
  title: string;
  content: string;
  level: number;
  codeBlocks: CodeBlock[];
  links: Link[];
}

export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
  endLine: number;
}

export interface Link {
  text: string;
  url: string;
  isInternal: boolean;
}
