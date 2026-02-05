/**
 * FileScanner - Project file scanning with gitignore support
 *
 * This is a STUB implementation. Tests will FAIL until properly implemented.
 * See tests/phase-2/F2.3-codebase-indexing.test.ts for expected behavior.
 */

import { ScanResult, IndexOptions } from './types';

export class FileScanner {
  constructor() {}

  async scan(projectPath: string, options?: Partial<IndexOptions>): Promise<ScanResult> {
    throw new Error('Not implemented');
  }
}
