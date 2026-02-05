/**
 * Types for document intelligence.
 */

/**
 * A code block found in a markdown document.
 */
export interface CodeBlock {
  language?: string;
  code: string;
  startLine: number;
  endLine: number;
}

/**
 * A link found in a markdown document.
 */
export interface Link {
  text: string;
  url: string;
  isInternal: boolean;
}

/**
 * A section in a markdown document (based on headings).
 */
export interface MarkdownSection {
  id: string;
  title: string;
  level: number;
  content: string;
  codeBlocks: CodeBlock[];
  links: Link[];
  parent?: string;
  children: string[];
  startLine: number;
  endLine: number;
}

/**
 * A parsed markdown document.
 */
export interface MarkdownDocument {
  filePath: string;
  title?: string;
  sections: MarkdownSection[];
  frontmatter?: Record<string, unknown>;
}

/**
 * A requirement extracted from documentation.
 */
export interface Requirement {
  id: string;
  type: 'requirement' | 'feature' | 'user-story' | 'constraint';
  title: string;
  description: string;
  priority?: 'must' | 'should' | 'could' | 'wont';
  status?: 'proposed' | 'accepted' | 'implemented' | 'deprecated';
  acceptanceCriteria?: string[];
  source: RequirementSource;
}

/**
 * Source location of a requirement.
 */
export interface RequirementSource {
  file: string;
  section?: string;
  line?: number;
}

/**
 * Input for creating a requirement manually.
 */
export interface RequirementInput {
  type?: Requirement['type'];
  title: string;
  description: string;
  priority?: Requirement['priority'];
  status?: Requirement['status'];
  acceptanceCriteria?: string[];
  source: RequirementSource;
}

/**
 * A code reference found in documentation.
 */
export interface CodeReference {
  text: string;
  type: 'backtick' | 'filepath' | 'classname' | 'function' | 'unknown';
  section?: string;
  inCodeBlock?: boolean;
}

/**
 * Result of linking a document to code.
 */
export interface LinkingResult {
  documentId: string;
  linksCreated: number;
  unresolvedReferences: string[];
}
