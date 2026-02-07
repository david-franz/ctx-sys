/**
 * Tests for F9.5 NPM Distribution
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.join(__dirname, '../..');

describe('F9.5 NPM Distribution', () => {
  describe('Package Configuration', () => {
    let pkg: any;

    beforeAll(() => {
      const pkgPath = path.join(ROOT_DIR, 'package.json');
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    });

    it('should have required fields', () => {
      expect(pkg.name).toBe('ctx-sys');
      expect(pkg.version).toBeDefined();
      expect(pkg.description).toBeDefined();
      expect(pkg.main).toBe('dist/index.js');
      expect(pkg.types).toBe('dist/index.d.ts');
    });

    it('should have CLI binary configuration', () => {
      expect(pkg.bin).toBeDefined();
      expect(pkg.bin['ctx-sys']).toBe('./dist/cli/index.js');
    });

    it('should have files array for publishing', () => {
      expect(pkg.files).toBeDefined();
      expect(Array.isArray(pkg.files)).toBe(true);
      expect(pkg.files).toContain('dist');
      expect(pkg.files).toContain('README.md');
      expect(pkg.files).toContain('LICENSE');
    });

    it('should have build and test scripts', () => {
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.prepublishOnly).toContain('build');
      expect(pkg.scripts.prepublishOnly).toContain('test');
    });

    it('should have phase test scripts', () => {
      expect(pkg.scripts['test:phase1']).toBeDefined();
      expect(pkg.scripts['test:phase8']).toBeDefined();
      expect(pkg.scripts['test:phase9']).toBeDefined();
    });

    it('should have appropriate keywords', () => {
      expect(pkg.keywords).toBeDefined();
      expect(Array.isArray(pkg.keywords)).toBe(true);
      expect(pkg.keywords).toContain('context');
      expect(pkg.keywords).toContain('ai');
      expect(pkg.keywords).toContain('mcp');
      expect(pkg.keywords).toContain('graph-rag');
    });

    it('should have author field', () => {
      expect(pkg.author).toBeDefined();
      expect(pkg.author.length).toBeGreaterThan(0);
    });

    it('should have repository information', () => {
      expect(pkg.repository).toBeDefined();
      expect(pkg.repository.type).toBe('git');
      expect(pkg.repository.url).toContain('github.com');
    });

    it('should have homepage and bugs URLs', () => {
      expect(pkg.homepage).toBeDefined();
      expect(pkg.bugs).toBeDefined();
      expect(pkg.bugs.url).toContain('github.com');
    });

    it('should have publishConfig for public access', () => {
      expect(pkg.publishConfig).toBeDefined();
      expect(pkg.publishConfig.access).toBe('public');
    });

    it('should have MIT license', () => {
      expect(pkg.license).toBe('MIT');
    });

    it('should have node engine requirement', () => {
      expect(pkg.engines).toBeDefined();
      expect(pkg.engines.node).toContain('>=18');
    });
  });

  describe('Required Files', () => {
    it('should have LICENSE file', () => {
      const licensePath = path.join(ROOT_DIR, 'LICENSE');
      expect(fs.existsSync(licensePath)).toBe(true);

      const content = fs.readFileSync(licensePath, 'utf-8');
      expect(content).toContain('MIT License');
      expect(content).toContain('Copyright');
    });

    it('should have README.md', () => {
      const readmePath = path.join(ROOT_DIR, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
    });

    it('should have TypeScript config', () => {
      const tsconfigPath = path.join(ROOT_DIR, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.declaration).toBe(true);
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    });
  });

  describe('Entry Points', () => {
    it('should have main index.ts with exports', () => {
      const indexPath = path.join(ROOT_DIR, 'src/index.ts');
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, 'utf-8');

      // Core exports
      expect(content).toContain('export');
      expect(content).toContain('ConfigManager');
      expect(content).toContain('DatabaseConnection');
      expect(content).toContain('ProjectManager');
      expect(content).toContain('EntityStore');
      expect(content).toContain('EmbeddingManager');
      expect(content).toContain('CtxSysMcpServer');
    });

    it('should export hooks module', () => {
      const indexPath = path.join(ROOT_DIR, 'src/index.ts');
      const content = fs.readFileSync(indexPath, 'utf-8');

      expect(content).toContain('HookInstaller');
      expect(content).toContain('HookHandler');
      expect(content).toContain('ImpactAnalyzer');
    });

    it('should have CLI entry point', () => {
      const cliPath = path.join(ROOT_DIR, 'src/cli/index.ts');
      expect(fs.existsSync(cliPath)).toBe(true);
    });
  });

  describe('Dependencies', () => {
    let pkg: any;

    beforeAll(() => {
      const pkgPath = path.join(ROOT_DIR, 'package.json');
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    });

    it('should have required runtime dependencies', () => {
      expect(pkg.dependencies['@anthropic-ai/sdk']).toBeDefined();
      expect(pkg.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(pkg.dependencies['better-sqlite3']).toBeDefined();
      expect(pkg.dependencies['commander']).toBeDefined();
      expect(pkg.dependencies['uuid']).toBeDefined();
    });

    it('should have required dev dependencies', () => {
      expect(pkg.devDependencies['typescript']).toBeDefined();
      expect(pkg.devDependencies['jest']).toBeDefined();
      expect(pkg.devDependencies['ts-jest']).toBeDefined();
      expect(pkg.devDependencies['@types/node']).toBeDefined();
    });

    it('should not have extraneous dependencies in production', () => {
      // Ensure dev deps are properly categorized
      expect(pkg.dependencies['jest']).toBeUndefined();
      expect(pkg.dependencies['ts-jest']).toBeUndefined();
      expect(pkg.dependencies['@types/jest']).toBeUndefined();
    });
  });

  describe('Module Structure', () => {
    const modules = [
      'config',
      'db',
      'project',
      'entities',
      'embeddings',
      'mcp',
      'ast',
      'summarization',
      'indexer',
      'relationships',
      'git',
      'conversation',
      'documents',
      'graph',
      'retrieval',
      'models',
      'watch',
      'agent',
      'hooks'
    ];

    modules.forEach(moduleName => {
      it(`should have ${moduleName} module`, () => {
        const modulePath = path.join(ROOT_DIR, 'src', moduleName);
        expect(fs.existsSync(modulePath)).toBe(true);

        const indexPath = path.join(modulePath, 'index.ts');
        expect(fs.existsSync(indexPath)).toBe(true);
      });
    });
  });
});
