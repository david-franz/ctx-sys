/**
 * Document Processing Types
 *
 * Type definitions for markdown parsing, requirements, and document-code linking.
 */

// ============================================================================
// Markdown Document Types
// ============================================================================

export interface Section {
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

export interface CodeBlock {
  language?: string;
  code: string;
  startLine: number;
}

export interface Link {
  text: string;
  url: string;
  isInternal: boolean;
}

export interface MarkdownDocument {
  filePath: string;
  title?: string;
  frontmatter?: Record<string, any>;
  sections: Section[];
}

export interface MarkdownSection {
  id: string;
  title: string;
  level?: number;
  content: string;
  codeBlocks?: CodeBlock[];
  startLine?: number;
  endLine?: number;
}

// ============================================================================
// Requirement Types
// ============================================================================

export type RequirementType = 'requirement' | 'feature' | 'user-story' | 'constraint';
export type RequirementPriority = 'must' | 'should' | 'could' | 'wont';
export type RequirementStatus = 'proposed' | 'accepted' | 'implemented' | 'deprecated';

export interface Requirement {
  id: string;
  type: RequirementType;
  title: string;
  description: string;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  acceptanceCriteria?: string[];
  source: {
    file: string;
    section?: string;
    line?: number;
  };
}

export interface RequirementDocument {
  filePath: string;
  requirements: Requirement[];
}

// ============================================================================
// Document-Code Linking Types
// ============================================================================

export enum LinkType {
  MENTIONS = 'MENTIONS',
  DOCUMENTS = 'DOCUMENTS',
  IMPLEMENTS = 'IMPLEMENTS',
  REFERENCES = 'REFERENCES'
}

export interface DocumentLink {
  id: string;
  type: LinkType;
  sourceId: string;
  targetId: string;
  weight: number;
  metadata?: {
    section?: string;
    reference?: string;
    inCodeBlock?: boolean;
    language?: string;
    [key: string]: any;
  };
}
