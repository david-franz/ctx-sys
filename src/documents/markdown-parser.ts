/**
 * Markdown Parser (Alternative Path)
 *
 * Alternative import path for MarkdownParser.
 */

import { MarkdownDocument, MarkdownSection } from './types';

export class MarkdownParser {
  constructor() {
    throw new Error('Not implemented');
  }

  parseSections(content: string): MarkdownSection[] {
    throw new Error('Not implemented');
  }

  parseFile(filePath: string): Promise<MarkdownDocument> {
    throw new Error('Not implemented');
  }

  parseContent(content: string): MarkdownDocument {
    throw new Error('Not implemented');
  }
}
