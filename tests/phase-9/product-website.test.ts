/**
 * Tests for F9.4 Product Website
 */

import * as fs from 'fs';
import * as path from 'path';

const WEBSITE_DIR = path.join(__dirname, '../../website');

describe('F9.4 Product Website', () => {
  describe('Project Structure', () => {
    it('should have package.json with correct dependencies', () => {
      const pkgPath = path.join(WEBSITE_DIR, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies.next).toBeDefined();
      expect(pkg.dependencies.react).toBeDefined();
    });

    it('should have Next.js config', () => {
      const configPath = path.join(WEBSITE_DIR, 'next.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should have Tailwind config', () => {
      const configPath = path.join(WEBSITE_DIR, 'tailwind.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should have TypeScript config', () => {
      const configPath = path.join(WEBSITE_DIR, 'tsconfig.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const tsconfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(tsconfig.compilerOptions).toBeDefined();
    });

    it('should have PostCSS config', () => {
      const configPath = path.join(WEBSITE_DIR, 'postcss.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });
  });

  describe('App Directory Structure', () => {
    const srcDir = path.join(WEBSITE_DIR, 'src/app');

    it('should have root layout', () => {
      const layoutPath = path.join(srcDir, 'layout.tsx');
      expect(fs.existsSync(layoutPath)).toBe(true);

      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).toContain('export default function');
      expect(content).toContain('RootLayout');
    });

    it('should have global styles', () => {
      const cssPath = path.join(srcDir, 'globals.css');
      expect(fs.existsSync(cssPath)).toBe(true);

      const content = fs.readFileSync(cssPath, 'utf-8');
      expect(content).toContain('@tailwind');
    });

    it('should have home page', () => {
      const pagePath = path.join(srcDir, 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);

      const content = fs.readFileSync(pagePath, 'utf-8');
      expect(content).toContain('export default function');
    });

    it('should NOT have pricing page (removed - open source tool)', () => {
      const pagePath = path.join(srcDir, 'pricing/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(false);
    });

    it('should NOT have dashboard page (removed - no mock data)', () => {
      const pagePath = path.join(srcDir, 'dashboard/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(false);
    });

    it('should have docs layout with sidebar', () => {
      const layoutPath = path.join(srcDir, 'docs/layout.tsx');
      expect(fs.existsSync(layoutPath)).toBe(true);

      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).toContain('DocsLayout');
      expect(content).toContain('sections');
    });
  });

  describe('Documentation Pages', () => {
    const docsDir = path.join(WEBSITE_DIR, 'src/app/docs');

    const requiredPages = [
      { path: 'page.tsx', name: 'Docs hub' },
      { path: 'quickstart/page.tsx', name: 'Quick Start' },
      { path: 'installation/page.tsx', name: 'Installation' },
      { path: 'integrations/page.tsx', name: 'Integrations' },
      { path: 'cli/page.tsx', name: 'CLI Reference' },
      { path: 'mcp-tools/page.tsx', name: 'MCP Tools' },
      { path: 'configuration/page.tsx', name: 'Configuration' },
      { path: 'how-it-works/page.tsx', name: 'How It Works' },
      { path: 'troubleshooting/page.tsx', name: 'Troubleshooting' },
    ];

    for (const page of requiredPages) {
      it(`should have ${page.name} page`, () => {
        const pagePath = path.join(docsDir, page.path);
        expect(fs.existsSync(pagePath)).toBe(true);

        const content = fs.readFileSync(pagePath, 'utf-8');
        expect(content).toContain('export default function');
      });
    }

    it('should have CLI reference with all command categories', () => {
      const content = fs.readFileSync(path.join(docsDir, 'cli/page.tsx'), 'utf-8');
      const lower = content.toLowerCase();
      expect(lower).toContain('init');
      expect(lower).toContain('index');
      expect(lower).toContain('search');
      expect(lower).toContain('serve');
      expect(lower).toContain('summarize');
    });

    it('should have MCP tools reference with tool descriptions', () => {
      const content = fs.readFileSync(path.join(docsDir, 'mcp-tools/page.tsx'), 'utf-8');
      const lower = content.toLowerCase();
      expect(lower).toContain('create_project');
      expect(lower).toContain('search_entities');
      expect(lower).toContain('context_query');
    });

    it('should have integrations page with Ollama setup and model instructions', () => {
      const content = fs.readFileSync(path.join(docsDir, 'integrations/page.tsx'), 'utf-8');
      expect(content).toContain('mxbai-embed-large');
      expect(content).toContain('ollama pull');
    });

    it('should have integrations page with MCP config', () => {
      const content = fs.readFileSync(path.join(docsDir, 'integrations/page.tsx'), 'utf-8');
      expect(content).toContain('mcpServers');
      expect(content).toContain('ctx-sys');
    });
  });

  describe('Landing Page Content', () => {
    it('should have value proposition on home page', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Intelligent Context');
      expect(content).toContain('AI Coding');
      expect(content).toContain('ctx-sys');
    });

    it('should have feature descriptions', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Hybrid RAG');
      expect(content).toContain('Code Intelligence');
      expect(content).toContain('Conversation Memory');
      expect(content).toContain('MCP Protocol');
    });

    it('should have CTAs linking to docs', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Get Started');
      expect(content).toContain('/docs/quickstart');
    });

    it('should show accurate stats', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('33');
      expect(content).toContain('CLI Commands');
      expect(content).toContain('MCP Tools');
    });

    it('should have before/after comparison', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Without ctx-sys');
      expect(content).toContain('With ctx-sys');
    });

    it('should have architecture section explaining hybrid RAG', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Hybrid RAG Pipeline');
      expect(content).toContain('Keyword Search');
      expect(content).toContain('Semantic Search');
      expect(content).toContain('Graph Traversal');
      expect(content).toContain('Reciprocal Rank Fusion');
    });

    it('should have integrations section', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Claude Desktop');
      expect(content).toContain('Cursor');
      expect(content).toContain('MCP');
    });

    it('should use ctx command in examples', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('ctx-sys init');
      expect(content).toContain('ctx-sys index');
      expect(content).toContain('ctx-sys serve');
    });

    it('should indicate open source / MIT license', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Open Source');
      expect(content).toContain('MIT');
    });
  });

  describe('Layout', () => {
    it('should have navigation with docs and GitHub', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('nav');
      expect(content).toContain('Docs');
      expect(content).toContain('GitHub');
    });

    it('should NOT have pricing or dashboard in navigation', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).not.toContain('Pricing');
      expect(content).not.toContain('Dashboard');
      expect(content).not.toContain('/signup');
    });

    it('should have footer', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('footer');
      expect(content).toContain('Product');
      expect(content).toContain('Resources');
    });

    it('should have correct copyright year', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('2026');
    });

    it('should have metadata', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toMatch(/meta.*description|Metadata/i);
      expect(content).toContain('ctx-sys');
    });

    it('should have dark mode toggle', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('darkMode');
      expect(content).toContain('dark');
    });
  });

  describe('Docs Navigation', () => {
    it('should have sidebar with all doc sections', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/docs/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('Getting Started');
      expect(content).toContain('Integration Guides');
      expect(content).toContain('Reference');
      expect(content).toContain('Concepts');
      expect(content).toContain('Help');
    });

    it('should have links to all doc pages', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/docs/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('/docs/quickstart');
      expect(content).toContain('/docs/installation');
      expect(content).toContain('/docs/integrations');
      expect(content).toContain('/docs/cli');
      expect(content).toContain('/docs/mcp-tools');
      expect(content).toContain('/docs/configuration');
      expect(content).toContain('/docs/how-it-works');
      expect(content).toContain('/docs/troubleshooting');
    });

    it('should have previous/next navigation', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/docs/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('Previous');
      expect(content).toContain('Next');
    });

    it('should have mobile sidebar toggle', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/docs/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('sidebarOpen');
      expect(content).toContain('lg:hidden');
    });
  });
});
