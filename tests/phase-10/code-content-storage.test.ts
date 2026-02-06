import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodebaseIndexer } from '../../src/indexer';
import { EntityStore } from '../../src/entities';
import { DatabaseConnection } from '../../src/db/connection';

describe('F10.1 - Code Content Storage', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;
  let db: DatabaseConnection;
  let entityStore: EntityStore;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-f10-1-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseConnection(dbPath);
    await db.initialize();
    db.createProject('test-project');
    entityStore = new EntityStore(db, 'test-project');
    indexer = new CodebaseIndexer(tempDir, entityStore);
  });

  afterEach(() => {
    db.close();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  function createTestFile(relativePath: string, content: string): string {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return relativePath;
  }

  describe('Function Code Storage', () => {
    it('should store actual function code in content field', async () => {
      createTestFile('test.ts', `
export function myFunction(a: number, b: string): boolean {
  const result = a > 0 && b.length > 0;
  console.log('checking:', a, b);
  return result;
}
`);

      await indexer.indexFile('test.ts');

      const entity = await entityStore.getByName('myFunction', 'function');
      expect(entity).not.toBeNull();
      expect(entity!.content).toContain('function myFunction');
      expect(entity!.content).toContain('const result = a > 0');
      expect(entity!.content).toContain('return result');
    });

    it('should store description in summary field', async () => {
      createTestFile('test.ts', `
export async function asyncHelper(id: string): Promise<void> {
  await fetch(id);
}
`);

      await indexer.indexFile('test.ts');

      const entity = await entityStore.getByName('asyncHelper', 'function');
      expect(entity).not.toBeNull();
      expect(entity!.summary).toBeDefined();
      expect(entity!.summary).toContain('Async');
    });

    it('should store filePath, startLine, and endLine', async () => {
      createTestFile('src/utils.ts', `
export function helper() {
  return 42;
}
`);

      await indexer.indexFile('src/utils.ts');

      const entity = await entityStore.getByName('helper', 'function');
      expect(entity).not.toBeNull();
      expect(entity!.filePath).toBe('src/utils.ts');
      expect(entity!.startLine).toBeGreaterThan(0);
      expect(entity!.endLine).toBeGreaterThan(entity!.startLine!);
    });
  });

  describe('Class Code Storage', () => {
    it('should store class code including methods', async () => {
      createTestFile('test.ts', `
export class MyClass {
  private value: number;

  constructor(val: number) {
    this.value = val;
  }

  getValue(): number {
    return this.value;
  }
}
`);

      await indexer.indexFile('test.ts');

      const entity = await entityStore.getByName('MyClass', 'class');
      expect(entity).not.toBeNull();
      expect(entity!.content).toContain('class MyClass');
      expect(entity!.content).toContain('private value');
      expect(entity!.content).toContain('constructor');
      expect(entity!.content).toContain('getValue');
    });
  });

  describe('File Overview Storage', () => {
    it('should store file overview with imports', async () => {
      createTestFile('test.ts', `
import { something } from './other';
import * as path from 'path';

export function myFunc() {}
export class MyClass {}
`);

      await indexer.indexFile('test.ts');

      const entity = await entityStore.getByName('test.ts', 'file');
      expect(entity).not.toBeNull();
      expect(entity!.content).toContain('import');
      expect(entity!.summary).toBeDefined();
    });

    it('should include exports in file overview', async () => {
      createTestFile('test.ts', `
export const VALUE = 42;
export function helper() {}
export class Service {}
`);

      await indexer.indexFile('test.ts');

      const entity = await entityStore.getByName('test.ts', 'file');
      expect(entity).not.toBeNull();
      // Content should mention exports
      expect(entity!.content).toMatch(/Exports:.*helper/);
    });
  });

  describe('Code Truncation', () => {
    it('should truncate very long functions', async () => {
      // Create a function with many lines
      const lines = ['export function longFunction() {'];
      for (let i = 0; i < 600; i++) {
        lines.push(`  const line${i} = ${i};`);
      }
      lines.push('  return 0;');
      lines.push('}');

      createTestFile('long.ts', lines.join('\n'));

      await indexer.indexFile('long.ts');

      const entity = await entityStore.getByName('longFunction', 'function');
      expect(entity).not.toBeNull();
      const contentLines = entity!.content!.split('\n');
      // Should be truncated to ~500 lines + truncation indicator
      expect(contentLines.length).toBeLessThanOrEqual(502);
      expect(entity!.content).toContain('// ... (truncated)');
    });
  });

  describe('Multiple Symbols', () => {
    it('should store code for all symbols in a file', async () => {
      createTestFile('multi.ts', `
export function funcOne() {
  return 1;
}

export function funcTwo(x: number) {
  return x * 2;
}

export class ClassOne {
  method() {}
}
`);

      await indexer.indexFile('multi.ts');

      const func1 = await entityStore.getByName('funcOne', 'function');
      const func2 = await entityStore.getByName('funcTwo', 'function');
      const cls = await entityStore.getByName('ClassOne', 'class');

      expect(func1).not.toBeNull();
      expect(func1!.content).toContain('return 1');

      expect(func2).not.toBeNull();
      expect(func2!.content).toContain('return x * 2');

      expect(cls).not.toBeNull();
      expect(cls!.content).toContain('method()');
    });
  });

  describe('Python Support', () => {
    it('should store Python function code', async () => {
      createTestFile('test.py', `
def calculate(x, y):
    """Calculate the sum."""
    result = x + y
    return result
`);

      await indexer.indexFile('test.py');

      const entity = await entityStore.getByName('calculate', 'function');
      expect(entity).not.toBeNull();
      expect(entity!.content).toContain('def calculate');
      expect(entity!.content).toContain('result = x + y');
      expect(entity!.content).toContain('return result');
    });

    it('should store Python class code', async () => {
      createTestFile('test.py', `
class MyPythonClass:
    def __init__(self, value):
        self.value = value

    def get_value(self):
        return self.value
`);

      await indexer.indexFile('test.py');

      const entity = await entityStore.getByName('MyPythonClass', 'class');
      expect(entity).not.toBeNull();
      expect(entity!.content).toContain('class MyPythonClass');
      expect(entity!.content).toContain('def __init__');
    });
  });

  describe('Search with Code Content', () => {
    it('should search within actual code content', async () => {
      createTestFile('app.ts', `
export function processPayment(orderId: string, amount: number) {
  const validated = validateOrder(orderId);
  const charged = chargeCard(amount);
  return { validated, charged };
}
`);

      await indexer.indexFile('app.ts');

      // Search should find the function by code content
      const results = await entityStore.search('chargeCard');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('chargeCard');
    });
  });
});
