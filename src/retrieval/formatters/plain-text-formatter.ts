/**
 * Plain Text Formatter
 *
 * Formats search results as plain text.
 */

import { Entity } from '../types';

export class PlainTextFormatter {
  formatEntity(entity: Entity): string {
    throw new Error('Not implemented');
  }

  format(entities: Entity[]): string {
    throw new Error('Not implemented');
  }
}
