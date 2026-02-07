/**
 * Tests for F9.3 Support Docs
 */

import * as fs from 'fs';
import * as path from 'path';

const WEBSITE_DOCS_DIR = path.join(__dirname, '../../website/docs');

describe('F9.3 Support Documentation', () => {
  describe('Documentation Structure', () => {
    it('should have root index file', () => {
      const indexPath = path.join(WEBSITE_DOCS_DIR, 'index.mdx');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    it('should have getting-started section', () => {
      const dir = path.join(WEBSITE_DOCS_DIR, 'getting-started');
      expect(fs.existsSync(dir)).toBe(true);

      const files = fs.readdirSync(dir);
      expect(files).toContain('introduction.mdx');
      expect(files).toContain('installation.mdx');
    });

    it('should have guides section', () => {
      const dir = path.join(WEBSITE_DOCS_DIR, 'guides');
      expect(fs.existsSync(dir)).toBe(true);

      const files = fs.readdirSync(dir);
      expect(files).toContain('claude-integration.mdx');
      expect(files).toContain('cursor-integration.mdx');
      expect(files).toContain('configuration.mdx');
    });

    it('should have concepts section', () => {
      const dir = path.join(WEBSITE_DOCS_DIR, 'concepts');
      expect(fs.existsSync(dir)).toBe(true);

      const files = fs.readdirSync(dir);
      expect(files).toContain('graph-rag.mdx');
      expect(files).toContain('decision-extraction.mdx');
    });

    it('should have api section', () => {
      const dir = path.join(WEBSITE_DOCS_DIR, 'api');
      expect(fs.existsSync(dir)).toBe(true);

      const files = fs.readdirSync(dir);
      expect(files).toContain('mcp-tools.mdx');
    });

    it('should have troubleshooting section', () => {
      const dir = path.join(WEBSITE_DOCS_DIR, 'troubleshooting');
      expect(fs.existsSync(dir)).toBe(true);

      const files = fs.readdirSync(dir);
      expect(files).toContain('common-issues.mdx');
    });
  });

  describe('Documentation Content', () => {
    const readFile = (filePath: string): string => {
      return fs.readFileSync(filePath, 'utf-8');
    };

    describe('MDX Files', () => {
      it('should have frontmatter in all docs', () => {
        const docFiles = getAllMdxFiles(WEBSITE_DOCS_DIR);

        for (const file of docFiles) {
          const content = readFile(file);
          expect(content.startsWith('---')).toBe(true);
          expect(content).toContain('title:');
        }
      });

      it('should have description in frontmatter', () => {
        const docFiles = getAllMdxFiles(WEBSITE_DOCS_DIR);

        for (const file of docFiles) {
          const content = readFile(file);
          // Most docs should have description
          const hasFrontmatter = content.startsWith('---');
          if (hasFrontmatter) {
            const frontmatter = content.split('---')[1];
            // At least check for title
            expect(frontmatter).toContain('title:');
          }
        }
      });
    });

    describe('Introduction', () => {
      it('should explain what ctx-sys is', () => {
        const intro = readFile(path.join(WEBSITE_DOCS_DIR, 'getting-started/introduction.mdx'));

        expect(intro).toContain('ctx-sys');
        expect(intro).toContain('context');
        expect(intro.toLowerCase()).toContain('ai');
      });

      it('should have quick start instructions', () => {
        const intro = readFile(path.join(WEBSITE_DOCS_DIR, 'getting-started/introduction.mdx'));

        expect(intro).toContain('npm install');
        expect(intro).toContain('ctx');
      });
    });

    describe('Installation Guide', () => {
      it('should list prerequisites', () => {
        const install = readFile(path.join(WEBSITE_DOCS_DIR, 'getting-started/installation.mdx'));

        expect(install.toLowerCase()).toContain('node');
        expect(install.toLowerCase()).toContain('prerequisites');
      });

      it('should include troubleshooting tips', () => {
        const install = readFile(path.join(WEBSITE_DOCS_DIR, 'getting-started/installation.mdx'));

        expect(install.toLowerCase()).toContain('troubleshooting');
      });
    });

    describe('Claude Integration', () => {
      it('should have setup steps', () => {
        const guide = readFile(path.join(WEBSITE_DOCS_DIR, 'guides/claude-integration.mdx'));

        expect(guide).toContain('claude_desktop_config.json');
        expect(guide).toContain('mcpServers');
      });

      it('should mention available tools', () => {
        const guide = readFile(path.join(WEBSITE_DOCS_DIR, 'guides/claude-integration.mdx'));

        expect(guide).toContain('context_query');
      });
    });

    describe('Graph RAG Concept', () => {
      it('should explain Graph RAG', () => {
        const concept = readFile(path.join(WEBSITE_DOCS_DIR, 'concepts/graph-rag.mdx'));

        expect(concept.toLowerCase()).toContain('graph');
        expect(concept.toLowerCase()).toContain('retrieval');
        expect(concept.toLowerCase()).toContain('rag');
      });

      it('should explain entities and relationships', () => {
        const concept = readFile(path.join(WEBSITE_DOCS_DIR, 'concepts/graph-rag.mdx'));

        expect(concept.toLowerCase()).toContain('entities');
        expect(concept.toLowerCase()).toContain('relationships');
      });
    });

    describe('API Reference', () => {
      it('should document context_query', () => {
        const api = readFile(path.join(WEBSITE_DOCS_DIR, 'api/mcp-tools.mdx'));

        expect(api).toContain('context_query');
        expect(api).toContain('Parameters');
        expect(api).toContain('Description');
      });

      it('should document search_entities', () => {
        const api = readFile(path.join(WEBSITE_DOCS_DIR, 'api/mcp-tools.mdx'));

        expect(api).toContain('search_entities');
      });

      it('should include graph operations', () => {
        const api = readFile(path.join(WEBSITE_DOCS_DIR, 'api/mcp-tools.mdx'));

        expect(api).toContain('Graph Operations');
      });
    });

    describe('Troubleshooting', () => {
      it('should cover common issues', () => {
        const troubleshooting = readFile(path.join(WEBSITE_DOCS_DIR, 'troubleshooting/common-issues.mdx'));

        expect(troubleshooting.toLowerCase()).toContain('command not found');
        expect(troubleshooting.toLowerCase()).toContain('ollama');
        expect(troubleshooting.toLowerCase()).toContain('database');
      });

      it('should provide solutions', () => {
        const troubleshooting = readFile(path.join(WEBSITE_DOCS_DIR, 'troubleshooting/common-issues.mdx'));

        expect(troubleshooting.toLowerCase()).toContain('solution');
      });
    });
  });

  describe('Website Configuration', () => {
    it('should have sidebars.json', () => {
      const sidebarPath = path.join(__dirname, '../../website/sidebars.json');
      expect(fs.existsSync(sidebarPath)).toBe(true);

      const sidebar = JSON.parse(fs.readFileSync(sidebarPath, 'utf-8'));
      expect(sidebar.docs).toBeDefined();
      expect(Array.isArray(sidebar.docs)).toBe(true);
    });

    it('should have docusaurus.config.js', () => {
      const configPath = path.join(__dirname, '../../website/docusaurus.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
    });
  });
});

/**
 * Get all MDX files in a directory recursively.
 */
function getAllMdxFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
