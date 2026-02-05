/**
 * XML Formatter
 *
 * Formats search results as XML.
 */

import { Entity } from '../types';

export class XmlFormatter {
  formatEntity(entity: Entity): string {
    throw new Error('Not implemented');
  }

  format(entities: Entity[]): string {
    throw new Error('Not implemented');
  }
}
