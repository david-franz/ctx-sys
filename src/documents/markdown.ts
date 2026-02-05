/**
 * Markdown Parser
 *
 * Parses markdown documents into structured sections with code blocks and links.
 */

import { FileSystemReader } from '../project/file-reader';
import { MarkdownDocument, Section, CodeBlock, Link } from './types';

export class MarkdownParser {
  constructor(private fileSystem: FileSystemReader) {
    throw new Error('Not implemented');
  }

  async parseFile(filePath: string): Promise<MarkdownDocument> {
    throw new Error('Not implemented');
  }

  parseContent(content: string, filePath?: string): MarkdownDocument {
    throw new Error('Not implemented');
  }
}
