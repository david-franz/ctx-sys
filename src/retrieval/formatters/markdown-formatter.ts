/**
 * Markdown Formatter
 *
 * Formats search results as markdown.
 */

import { Entity } from '../types';

export class MarkdownFormatter {
  formatEntity(entity: Entity, includeCode?: boolean): string {
    throw new Error('Not implemented');
  }

  format(entities: Entity[]): string {
    throw new Error('Not implemented');
  }

  detectLanguage(filePath?: string): string | null {
    throw new Error('Not implemented');
  }

  formatGroupHeader(groupName: string): string {
    throw new Error('Not implemented');
  }
}
