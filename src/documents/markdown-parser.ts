import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  MarkdownDocument,
  MarkdownSection,
  CodeBlock,
  Link
} from './types';
import { generateId } from '../utils/id';

/**
 * Parses markdown documents into structured format.
 * Uses simple regex-based parsing to avoid ESM dependency issues.
 */
export class MarkdownParser {
  /**
   * Parse a markdown file.
   */
  async parseFile(filePath: string): Promise<MarkdownDocument> {
    const absolutePath = path.resolve(filePath);
    const content = await fs.promises.readFile(absolutePath, 'utf-8');
    return this.parseContent(content, absolutePath);
  }

  /**
   * Parse markdown content directly.
   */
  parseContent(content: string, filePath: string = '<inline>'): MarkdownDocument {
    const lines = content.split('\n');

    const document: MarkdownDocument = {
      filePath,
      sections: [],
      frontmatter: undefined
    };

    // Extract frontmatter
    let contentStart = 0;
    if (lines[0] === '---') {
      const endIndex = lines.findIndex((line, i) => i > 0 && line === '---');
      if (endIndex > 0) {
        const frontmatterLines = lines.slice(1, endIndex);
        document.frontmatter = this.parseFrontmatter(frontmatterLines);
        if (document.frontmatter?.title) {
          document.title = String(document.frontmatter.title);
        }
        contentStart = endIndex + 1;
      }
    }

    // Parse content
    const sectionStack: MarkdownSection[] = [];
    let currentSection: MarkdownSection | null = null;
    let contentBeforeFirstHeading: string[] = [];
    let inCodeBlock = false;
    let codeBlockLang: string | undefined;
    let codeBlockStart = 0;
    let codeBlockLines: string[] = [];

    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.slice(3).trim() || undefined;
          codeBlockStart = lineNumber;
          codeBlockLines = [];
        } else {
          // End code block
          if (currentSection) {
            currentSection.codeBlocks.push({
              language: codeBlockLang,
              code: codeBlockLines.join('\n'),
              startLine: codeBlockStart,
              endLine: lineNumber
            });
          }
          inCodeBlock = false;
          codeBlockLang = undefined;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Check for headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];

        // Save previous section
        if (currentSection) {
          currentSection.endLine = lineNumber - 1;
          document.sections.push(currentSection);
        }

        // Determine parent
        while (
          sectionStack.length > 0 &&
          sectionStack[sectionStack.length - 1].level >= level
        ) {
          sectionStack.pop();
        }
        const parent = sectionStack[sectionStack.length - 1];

        // Create new section
        currentSection = {
          id: this.generateSectionId(title),
          title,
          level,
          content: '',
          codeBlocks: [],
          links: [],
          parent: parent?.id,
          children: [],
          startLine: lineNumber,
          endLine: 0
        };

        // Add as child to parent
        if (parent) {
          parent.children.push(currentSection.id);
        }

        sectionStack.push(currentSection);
        continue;
      }

      // Regular content
      if (currentSection) {
        currentSection.content += line + '\n';
        // Extract links
        this.extractLinksFromLine(line, currentSection);
      } else if (line.trim()) {
        contentBeforeFirstHeading.push(line);
      }
    }

    // Close last section
    if (currentSection) {
      currentSection.endLine = lines.length;
      document.sections.push(currentSection);
    }

    // Create preamble if needed
    if (contentBeforeFirstHeading.length > 0 && document.sections.length > 0) {
      const preambleContent = contentBeforeFirstHeading.join('\n').trim();
      if (preambleContent) {
        const preamble: MarkdownSection = {
          id: 'preamble',
          title: 'Preamble',
          level: 0,
          content: preambleContent,
          codeBlocks: [],
          links: [],
          children: [],
          startLine: contentStart + 1,
          endLine: document.sections[0].startLine - 1
        };
        document.sections.unshift(preamble);
      }
    }

    // Set title from first h1 if not in frontmatter
    if (!document.title) {
      const h1 = document.sections.find(s => s.level === 1);
      document.title = h1?.title;
    }

    return document;
  }

  /**
   * Parse YAML frontmatter using the yaml package.
   */
  private parseFrontmatter(lines: string[]): Record<string, unknown> {
    try {
      const yamlStr = lines.join('\n');
      const parsed = YAML.parse(yamlStr);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Extract links from a line.
   */
  private extractLinksFromLine(line: string, section: MarkdownSection): void {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const url = match[2];
      section.links.push({
        text: match[1],
        url,
        isInternal: !url.startsWith('http://') && !url.startsWith('https://')
      });
    }
  }

  /**
   * Generate a URL-friendly section ID.
   */
  private generateSectionId(title: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return slug || generateId().slice(0, 8);
  }

  /**
   * Get a section by ID.
   */
  getSectionById(document: MarkdownDocument, id: string): MarkdownSection | undefined {
    return document.sections.find(s => s.id === id);
  }

  /**
   * Get all top-level sections (level 1 or 2).
   */
  getTopLevelSections(document: MarkdownDocument): MarkdownSection[] {
    return document.sections.filter(s => s.level <= 2 && s.level > 0);
  }

  /**
   * Get the section hierarchy as a tree.
   */
  getSectionTree(document: MarkdownDocument): MarkdownSection[] {
    return document.sections.filter(s => !s.parent || s.level === 1);
  }

  /**
   * Get all code blocks from a document.
   */
  getAllCodeBlocks(document: MarkdownDocument): CodeBlock[] {
    return document.sections.flatMap(s => s.codeBlocks);
  }

  /**
   * Get all links from a document.
   */
  getAllLinks(document: MarkdownDocument): Link[] {
    return document.sections.flatMap(s => s.links);
  }

  /**
   * Get internal links only.
   */
  getInternalLinks(document: MarkdownDocument): Link[] {
    return this.getAllLinks(document).filter(l => l.isInternal);
  }

  /**
   * Get external links only.
   */
  getExternalLinks(document: MarkdownDocument): Link[] {
    return this.getAllLinks(document).filter(l => !l.isInternal);
  }

  /**
   * Search sections by title or content.
   */
  searchSections(document: MarkdownDocument, query: string): MarkdownSection[] {
    const lowerQuery = query.toLowerCase();
    return document.sections.filter(
      s =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.content.toLowerCase().includes(lowerQuery)
    );
  }
}
