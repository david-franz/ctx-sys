/**
 * Phase 4: Markdown Parser
 * Parses markdown documents into structured format
 */

import { MarkdownDocument } from '../types/document';

export class MarkdownParser {
  constructor() {
    throw new Error('Not implemented');
  }

  async parse(content: string, filePath: string): Promise<MarkdownDocument> {
    throw new Error('Not implemented');
  }

  buildTranscript(messages: any[]): string {
    throw new Error('Not implemented');
  }

  maxTranscriptLength: number = 10000;
}
