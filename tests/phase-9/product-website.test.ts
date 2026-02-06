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

    it('should have pricing page', () => {
      const pagePath = path.join(srcDir, 'pricing/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);

      const content = fs.readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Pricing');
    });

    it('should have dashboard page', () => {
      const pagePath = path.join(srcDir, 'dashboard/page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);

      const content = fs.readFileSync(pagePath, 'utf-8');
      expect(content).toContain('Dashboard');
    });
  });

  describe('Marketing Pages Content', () => {
    it('should have value proposition on home page', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      // Key marketing messages (text may be split across elements)
      expect(content).toContain('Stop Repeating');
      expect(content).toContain('Yourself');
      expect(content).toContain('context');
    });

    it('should have feature descriptions', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      // Key features
      expect(content.toLowerCase()).toContain('graph rag');
      expect(content.toLowerCase()).toContain('decision');
      expect(content.toLowerCase()).toContain('token');
    });

    it('should have CTAs', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const pageContent = fs.readFileSync(pagePath, 'utf-8');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // CTA button text should be on home page or layout
      expect(pageContent + layoutContent).toContain('Get Started');
      // Signup link should be in layout navigation
      expect(layoutContent).toContain('/signup');
    });

    it('should have stats section', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('95%');
      expect(content).toContain('token savings');
    });
  });

  describe('Pricing Page Content', () => {
    it('should have pricing tiers', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/pricing/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Free');
      expect(content).toContain('Pro');
      expect(content).toContain('Team');
    });

    it('should show prices', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/pricing/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('$0');
      expect(content).toContain('$19');
      expect(content).toContain('$49');
    });

    it('should have FAQ section', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/pricing/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Frequently Asked Questions');
      expect(content).toContain('free tier');
    });
  });

  describe('Dashboard Page Content', () => {
    it('should show analytics stats', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/dashboard/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Queries');
      expect(content).toContain('Tokens Saved');
      expect(content).toContain('Cost Saved');
    });

    it('should have projects table', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/dashboard/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Projects');
      expect(content).toContain('table');
    });

    it('should show activity feed', () => {
      const pagePath = path.join(WEBSITE_DIR, 'src/app/dashboard/page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');

      expect(content).toContain('Recent Activity');
    });
  });

  describe('Layout', () => {
    it('should have navigation', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('nav');
      expect(content).toContain('Docs');
      expect(content).toContain('Pricing');
    });

    it('should have footer', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain('footer');
      expect(content).toContain('Product');
      expect(content).toContain('Resources');
    });

    it('should have metadata', () => {
      const layoutPath = path.join(WEBSITE_DIR, 'src/app/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');

      // Should have meta description or Next.js Metadata export
      expect(content).toMatch(/meta.*description|Metadata/i);
      expect(content).toContain('ctx-sys');
    });
  });
});
