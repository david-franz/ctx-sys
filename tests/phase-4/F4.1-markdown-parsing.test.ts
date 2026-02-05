/**
 * F4.1 Markdown Parsing Tests
 *
 * Tests for markdown document parsing:
 * - MarkdownParser operations
 * - Section extraction with hierarchy
 * - Code block extraction
 * - Link extraction (internal/external)
 * - Frontmatter parsing
 *
 * @see docs/phase-4/F4.1-markdown-parsing.md
 *
 * ============================================================================
 * NOTE: These tests will FAIL until the following implementations are created:
 *
 * Required source files:
 *   - src/documents/markdown.ts (MarkdownParser class)
 *   - src/documents/types.ts (Section, CodeBlock, Link, MarkdownDocument types)
 *   - src/filesystem/reader.ts (FileSystemReader class)
 *
 * Expected exports from src/documents/markdown.ts:
 *   - MarkdownParser class with:
 *     - constructor(fileSystem: FileSystemReader)
 *     - parseFile(filePath: string): Promise<MarkdownDocument>
 *     - parseContent(content: string, filePath?: string): MarkdownDocument
 *
 * Expected exports from src/documents/types.ts:
 *   - Section interface
 *   - CodeBlock interface
 *   - Link interface
 *   - MarkdownDocument interface
 *
 * Expected exports from src/filesystem/reader.ts:
 *   - FileSystemReader class with:
 *     - readFile(path: string): Promise<string>
 *     - exists(path: string): Promise<boolean>
 * ============================================================================
 */

// Import actual implementations from source paths (will fail until created)
import { MarkdownParser } from '../../src/documents/markdown';
import { Section, CodeBlock, Link, MarkdownDocument } from '../../src/documents/types';
import { FileSystemReader } from '../../src/project/file-reader';

// Mock the dependencies
jest.mock('../../src/project/file-reader');

// Import test utilities
import { generateId } from '../helpers/mocks';

// ============================================================================
// Type Guards (for runtime type checking in tests)
// ============================================================================

function isSection(obj: unknown): obj is Section {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'title' in obj &&
    'level' in obj &&
    'content' in obj &&
    'codeBlocks' in obj &&
    'links' in obj &&
    'children' in obj &&
    'startLine' in obj &&
    'endLine' in obj
  );
}

function isCodeBlock(obj: unknown): obj is CodeBlock {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'code' in obj &&
    'startLine' in obj
  );
}

function isLink(obj: unknown): obj is Link {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'text' in obj &&
    'url' in obj &&
    'isInternal' in obj
  );
}

function isMarkdownDocument(obj: unknown): obj is MarkdownDocument {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'filePath' in obj &&
    'sections' in obj
  );
}

// ============================================================================
// Test Helper Factories
// ============================================================================

function createTestSection(overrides: Partial<Section> = {}): Section {
  return {
    id: generateId(),
    title: 'Test Section',
    level: 1,
    content: 'Test content paragraph.',
    codeBlocks: [],
    links: [],
    parent: undefined,
    children: [],
    startLine: 1,
    endLine: 10,
    ...overrides
  };
}

function createTestCodeBlock(overrides: Partial<CodeBlock> = {}): CodeBlock {
  return {
    language: 'typescript',
    code: 'const x = 1;',
    startLine: 1,
    ...overrides
  };
}

function createTestLink(overrides: Partial<Link> = {}): Link {
  return {
    text: 'Test Link',
    url: './test.md',
    isInternal: true,
    ...overrides
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('F4.1 Markdown Parsing', () => {
  let mockFileSystem: jest.Mocked<FileSystemReader>;
  let parser: MarkdownParser;

  beforeEach(() => {
    // Create a mocked instance of FileSystemReader
    mockFileSystem = new FileSystemReader() as jest.Mocked<FileSystemReader>;

    // Set up default mock implementations
    mockFileSystem.readFile = jest.fn();
    mockFileSystem.exists = jest.fn();

    // Create the parser with the mocked file system
    parser = new MarkdownParser(mockFileSystem);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ============================================================================
  // Section Interface Tests
  // ============================================================================

  describe('Section Interface', () => {
    it('should have all required fields', () => {
      const section = createTestSection();

      expect(isSection(section)).toBe(true);
      expect(section).toHaveProperty('id');
      expect(section).toHaveProperty('title');
      expect(section).toHaveProperty('level');
      expect(section).toHaveProperty('content');
      expect(section).toHaveProperty('codeBlocks');
      expect(section).toHaveProperty('links');
      expect(section).toHaveProperty('children');
      expect(section).toHaveProperty('startLine');
      expect(section).toHaveProperty('endLine');
    });

    it('should support heading levels 1-6', () => {
      const levels = [1, 2, 3, 4, 5, 6];

      levels.forEach(level => {
        const section = createTestSection({ level });
        expect(section.level).toBe(level);
        expect(section.level).toBeGreaterThanOrEqual(1);
        expect(section.level).toBeLessThanOrEqual(6);
      });
    });

    it('should have optional parent', () => {
      const rootSection = createTestSection({ parent: undefined });
      const childSection = createTestSection({ parent: 'parent-id' });

      expect(rootSection.parent).toBeUndefined();
      expect(childSection.parent).toBe('parent-id');
    });

    it('should track child section IDs', () => {
      const section = createTestSection({
        children: ['child-1', 'child-2', 'child-3']
      });

      expect(section.children).toHaveLength(3);
    });
  });

  // ============================================================================
  // CodeBlock Interface Tests
  // ============================================================================

  describe('CodeBlock Interface', () => {
    it('should have required fields', () => {
      const codeBlock = createTestCodeBlock();

      expect(isCodeBlock(codeBlock)).toBe(true);
      expect(codeBlock).toHaveProperty('code');
      expect(codeBlock).toHaveProperty('startLine');
    });

    it('should have optional language', () => {
      const withLang = createTestCodeBlock({ language: 'python' });
      const withoutLang = createTestCodeBlock({ language: undefined });

      expect(withLang.language).toBe('python');
      expect(withoutLang.language).toBeUndefined();
    });

    it('should support various languages', () => {
      const languages = ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'sql', 'bash'];

      languages.forEach(lang => {
        const block = createTestCodeBlock({ language: lang });
        expect(block.language).toBe(lang);
      });
    });
  });

  // ============================================================================
  // Link Interface Tests
  // ============================================================================

  describe('Link Interface', () => {
    it('should have required fields', () => {
      const link = createTestLink();

      expect(isLink(link)).toBe(true);
      expect(link).toHaveProperty('text');
      expect(link).toHaveProperty('url');
      expect(link).toHaveProperty('isInternal');
    });

    it('should distinguish internal from external links', () => {
      const internalLink = createTestLink({
        text: 'API Docs',
        url: './api.md',
        isInternal: true
      });

      const externalLink = createTestLink({
        text: 'GitHub',
        url: 'https://github.com',
        isInternal: false
      });

      expect(internalLink.isInternal).toBe(true);
      expect(externalLink.isInternal).toBe(false);
    });

    it('should classify relative paths as internal', () => {
      const relativePaths = ['./other.md', '../docs/readme.md', 'images/logo.png'];

      relativePaths.forEach(url => {
        const isInternal = !url.startsWith('http');
        expect(isInternal).toBe(true);
      });
    });

    it('should classify http(s) URLs as external', () => {
      const externalUrls = ['https://example.com', 'http://example.com'];

      externalUrls.forEach(url => {
        const isInternal = !url.startsWith('http');
        expect(isInternal).toBe(false);
      });
    });
  });

  // ============================================================================
  // MarkdownDocument Interface Tests
  // ============================================================================

  describe('MarkdownDocument Interface', () => {
    it('should have required fields', () => {
      const doc: MarkdownDocument = {
        filePath: 'docs/test.md',
        sections: []
      };

      expect(isMarkdownDocument(doc)).toBe(true);
      expect(doc).toHaveProperty('filePath');
      expect(doc).toHaveProperty('sections');
    });

    it('should have optional title and frontmatter', () => {
      const docWithTitle: MarkdownDocument = {
        filePath: 'docs/test.md',
        title: 'My Document',
        frontmatter: { author: 'Test' },
        sections: []
      };

      const docWithoutTitle: MarkdownDocument = {
        filePath: 'docs/test.md',
        sections: []
      };

      expect(docWithTitle.title).toBe('My Document');
      expect(docWithTitle.frontmatter).toEqual({ author: 'Test' });
      expect(docWithoutTitle.title).toBeUndefined();
      expect(docWithoutTitle.frontmatter).toBeUndefined();
    });
  });

  // ============================================================================
  // MarkdownParser Tests
  // ============================================================================

  describe('MarkdownParser', () => {
    describe('parseFile()', () => {
      it('should read and parse markdown file', async () => {
        const filePath = '/docs/readme.md';
        const content = `# Hello World\n\nThis is content.`;

        mockFileSystem.readFile.mockResolvedValue(content);
        mockFileSystem.exists.mockResolvedValue(true);

        const result = await parser.parseFile(filePath);

        expect(mockFileSystem.readFile).toHaveBeenCalledWith(filePath);
        expect(isMarkdownDocument(result)).toBe(true);
        expect(result.filePath).toBe(filePath);
        expect(result.sections.length).toBeGreaterThan(0);
      });

      it('should handle file read errors', async () => {
        mockFileSystem.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

        await expect(parser.parseFile('/non-existent.md')).rejects.toThrow();
      });

      it('should check file existence before reading', async () => {
        const filePath = '/docs/readme.md';

        mockFileSystem.exists.mockResolvedValue(false);

        await expect(parser.parseFile(filePath)).rejects.toThrow();
        expect(mockFileSystem.exists).toHaveBeenCalledWith(filePath);
      });
    });

    describe('parseContent()', () => {
      it('should extract sections from headings', () => {
        const content = `# Main Title

Introduction paragraph.

## Section One

Section one content.

## Section Two

Section two content.
`;

        const result = parser.parseContent(content);

        expect(isMarkdownDocument(result)).toBe(true);
        expect(result.sections.length).toBe(3);
        expect(result.sections[0].title).toBe('Main Title');
        expect(result.sections[0].level).toBe(1);
        expect(result.sections[1].title).toBe('Section One');
        expect(result.sections[1].level).toBe(2);
        expect(result.sections[2].title).toBe('Section Two');
        expect(result.sections[2].level).toBe(2);
      });

      it('should build section hierarchy', () => {
        const content = `# Root

## Child 1

### Grandchild 1.1

## Child 2
`;

        const result = parser.parseContent(content);

        // Find the root section
        const root = result.sections.find(s => s.title === 'Root');
        const child1 = result.sections.find(s => s.title === 'Child 1');
        const grandchild = result.sections.find(s => s.title === 'Grandchild 1.1');
        const child2 = result.sections.find(s => s.title === 'Child 2');

        expect(root).toBeDefined();
        expect(root!.children.length).toBeGreaterThanOrEqual(2);

        expect(child1).toBeDefined();
        expect(child1!.parent).toBe(root!.id);
        expect(child1!.children).toContain(grandchild!.id);

        expect(grandchild).toBeDefined();
        expect(grandchild!.parent).toBe(child1!.id);

        expect(child2).toBeDefined();
        expect(child2!.parent).toBe(root!.id);
      });

      it('should extract code blocks with language', () => {
        const content = `# Code Example

\`\`\`typescript
const greeting = 'Hello';
console.log(greeting);
\`\`\`

\`\`\`python
print("Hello")
\`\`\`
`;

        const result = parser.parseContent(content);
        const codeSection = result.sections.find(s => s.title === 'Code Example');

        expect(codeSection).toBeDefined();
        expect(codeSection!.codeBlocks.length).toBe(2);
        expect(codeSection!.codeBlocks[0].language).toBe('typescript');
        expect(codeSection!.codeBlocks[0].code).toContain("const greeting = 'Hello'");
        expect(codeSection!.codeBlocks[1].language).toBe('python');
        expect(codeSection!.codeBlocks[1].code).toContain('print("Hello")');
      });

      it('should extract code blocks without language', () => {
        const content = `# Code Example

\`\`\`
some code here
\`\`\`
`;

        const result = parser.parseContent(content);
        const codeSection = result.sections.find(s => s.title === 'Code Example');

        expect(codeSection).toBeDefined();
        expect(codeSection!.codeBlocks.length).toBe(1);
        expect(codeSection!.codeBlocks[0].language).toBeUndefined();
        expect(codeSection!.codeBlocks[0].code).toBe('some code here');
      });

      it('should extract links', () => {
        const content = `# Links Example

Check out [our docs](./docs/readme.md) for more info.

Visit [GitHub](https://github.com) for source code.
`;

        const result = parser.parseContent(content);
        const linksSection = result.sections.find(s => s.title === 'Links Example');

        expect(linksSection).toBeDefined();
        expect(linksSection!.links.length).toBe(2);

        const internalLink = linksSection!.links.find(l => l.text === 'our docs');
        const externalLink = linksSection!.links.find(l => l.text === 'GitHub');

        expect(internalLink).toBeDefined();
        expect(internalLink!.url).toBe('./docs/readme.md');
        expect(internalLink!.isInternal).toBe(true);

        expect(externalLink).toBeDefined();
        expect(externalLink!.url).toBe('https://github.com');
        expect(externalLink!.isInternal).toBe(false);
      });

      it('should parse YAML frontmatter', () => {
        const content = `---
title: My Document
author: Test Author
tags:
  - documentation
  - guide
---

# Content Here
`;

        const result = parser.parseContent(content);

        expect(result.frontmatter).toBeDefined();
        expect(result.frontmatter!.title).toBe('My Document');
        expect(result.frontmatter!.author).toBe('Test Author');
        expect(result.frontmatter!.tags).toContain('documentation');
        expect(result.frontmatter!.tags).toContain('guide');
      });

      it('should handle invalid YAML frontmatter gracefully', () => {
        const content = `---
invalid: yaml: here:
---

# Content
`;

        // Should not throw, just set frontmatter to undefined
        const result = parser.parseContent(content);
        expect(result.frontmatter).toBeUndefined();
      });

      it('should use first h1 as title if no frontmatter title', () => {
        const content = `# My Document Title

Some content here.

## Section
`;

        const result = parser.parseContent(content);

        expect(result.title).toBe('My Document Title');
      });

      it('should prefer frontmatter title over h1', () => {
        const content = `---
title: Frontmatter Title
---

# H1 Title
`;

        const result = parser.parseContent(content);

        expect(result.title).toBe('Frontmatter Title');
      });
    });

    describe('Section Content Extraction', () => {
      it('should extract paragraph content', () => {
        const content = `# Test Section

This is a paragraph.

This is another paragraph.
`;

        const result = parser.parseContent(content);
        const section = result.sections[0];

        expect(section.content).toContain('This is a paragraph');
        expect(section.content).toContain('This is another paragraph');
      });

      it('should extract list content', () => {
        const content = `# Test Section

- Item 1
- Item 2
- Item 3
`;

        const result = parser.parseContent(content);
        const section = result.sections[0];

        expect(section.content).toContain('Item 1');
        expect(section.content).toContain('Item 2');
        expect(section.content).toContain('Item 3');
      });

      it('should track start and end lines', () => {
        const content = `# First Section

Content here.

## Second Section

More content.
`;

        const result = parser.parseContent(content);

        result.sections.forEach(section => {
          expect(section.startLine).toBeGreaterThan(0);
          expect(section.endLine).toBeGreaterThan(section.startLine);
        });
      });
    });

    describe('Section ID Generation', () => {
      it('should generate slug-like IDs from titles', () => {
        const content = `# Hello World

## API Documentation

## What's New?

## 1. Getting Started
`;

        const result = parser.parseContent(content);

        const helloWorld = result.sections.find(s => s.title === 'Hello World');
        const apiDocs = result.sections.find(s => s.title === 'API Documentation');
        const whatsNew = result.sections.find(s => s.title === "What's New?");
        const gettingStarted = result.sections.find(s => s.title === '1. Getting Started');

        expect(helloWorld!.id).toBe('hello-world');
        expect(apiDocs!.id).toBe('api-documentation');
        expect(whatsNew!.id).toMatch(/what-?s-?new/);
        expect(gettingStarted!.id).toMatch(/1-?getting-?started/);
      });

      it('should handle duplicate titles by appending index', () => {
        const content = `# Section

## Subsection

## Subsection

## Subsection
`;

        const result = parser.parseContent(content);
        const subsections = result.sections.filter(s => s.title === 'Subsection');

        expect(subsections.length).toBe(3);

        // IDs should be unique
        const ids = subsections.map(s => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(3);
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty document', () => {
      const result = parser.parseContent('');

      expect(result.sections).toHaveLength(0);
      expect(result.title).toBeUndefined();
    });

    it('should handle document with only frontmatter', () => {
      const content = `---
title: Empty Doc
---
`;

      const result = parser.parseContent(content);

      expect(result.title).toBe('Empty Doc');
      expect(result.sections).toHaveLength(0);
    });

    it('should handle very deeply nested sections', () => {
      const content = `# Level 1

## Level 2

### Level 3

#### Level 4

##### Level 5

###### Level 6
`;

      const result = parser.parseContent(content);

      expect(result.sections.length).toBe(6);

      const level6 = result.sections.find(s => s.level === 6);
      expect(level6).toBeDefined();
      expect(level6!.title).toBe('Level 6');
    });

    it('should handle section with many code blocks', () => {
      let content = '# Code Heavy Section\n\n';
      for (let i = 0; i < 10; i++) {
        content += `\`\`\`typescript\nconst x${i} = ${i};\n\`\`\`\n\n`;
      }

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.codeBlocks).toHaveLength(10);
    });

    it('should handle special characters in content', () => {
      const content = `# Special Characters

Code: \`const x = "test"\` and symbols: <>&"'
`;

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.content).toContain('<>&');
    });

    it('should handle unicode in titles and content', () => {
      const content = `# 日本語のタイトル

Emoji: 🚀 and international: Ñoño
`;

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.title).toBe('日本語のタイトル');
      expect(section.content).toContain('🚀');
      expect(section.content).toContain('Ñoño');
    });

    it('should handle code blocks with no content', () => {
      const content = `# Empty Code Block

\`\`\`typescript
\`\`\`
`;

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.codeBlocks.length).toBe(1);
      expect(section.codeBlocks[0].code).toBe('');
    });

    it('should handle very long documents', () => {
      let content = '# Document Start\n\n';
      for (let i = 0; i < 100; i++) {
        content += `## Section ${i}\n\nContent for section ${i}.\n\n`;
      }

      const result = parser.parseContent(content);

      expect(result.sections.length).toBe(101); // 1 root + 100 subsections
    });

    it('should handle content before first heading', () => {
      const content = `Some content before any heading.

# First Heading

Content after heading.
`;

      const result = parser.parseContent(content);

      // Should create a section for the first heading
      expect(result.sections.length).toBeGreaterThanOrEqual(1);
      expect(result.sections[0].title).toBe('First Heading');
    });

    it('should handle multiple blank lines', () => {
      const content = `# Section One



Content with lots of blank lines above.




## Section Two
`;

      const result = parser.parseContent(content);

      expect(result.sections.length).toBe(2);
    });
  });

  // ============================================================================
  // Complex Document Tests
  // ============================================================================

  describe('Complex Documents', () => {
    it('should parse document with mixed content types', () => {
      const content = `---
version: '1.0'
---

# API Guide

Welcome to the API. Check out [the reference](./ref.md).

## Authentication

Use JWT tokens.

\`\`\`bash
curl -H "Authorization: Bearer token" https://api.example.com
\`\`\`

## Endpoints

### GET /users

Returns a list of users.
`;

      const result = parser.parseContent(content);

      expect(result.title).toBe('API Guide');
      expect(result.frontmatter?.version).toBe('1.0');
      expect(result.sections.length).toBeGreaterThanOrEqual(4);

      const apiGuide = result.sections.find(s => s.title === 'API Guide');
      expect(apiGuide!.links.length).toBe(1);

      const auth = result.sections.find(s => s.title === 'Authentication');
      expect(auth!.codeBlocks.length).toBe(1);
    });

    it('should handle README-style document', () => {
      const content = `# my-project

A cool project.

## Installation

\`\`\`bash
npm install my-project
\`\`\`

## Usage

\`\`\`typescript
import { cool } from 'my-project';
cool();
\`\`\`

## API

See [API docs](./docs/api.md).

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
`;

      const result = parser.parseContent(content);

      expect(result.title).toBe('my-project');
      expect(result.sections.filter(s => s.level === 2)).toHaveLength(5);

      const installation = result.sections.find(s => s.title === 'Installation');
      expect(installation!.codeBlocks.length).toBe(1);
      expect(installation!.codeBlocks[0].language).toBe('bash');
    });

    it('should handle documentation with nested lists', () => {
      const content = `# Nested Lists

- Item 1
  - Nested 1.1
  - Nested 1.2
    - Deep 1.2.1
- Item 2
`;

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.content).toContain('Item 1');
      expect(section.content).toContain('Nested 1.1');
      expect(section.content).toContain('Deep 1.2.1');
    });

    it('should handle tables in markdown', () => {
      const content = `# Table Example

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |
`;

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.content).toContain('Column 1');
      expect(section.content).toContain('Value 1');
    });

    it('should handle blockquotes', () => {
      const content = `# Blockquote Example

> This is a blockquote.
> It can span multiple lines.

Regular text after.
`;

      const result = parser.parseContent(content);
      const section = result.sections[0];

      expect(section.content).toContain('This is a blockquote');
    });
  });

  // ============================================================================
  // Integration Tests (with mocked file system)
  // ============================================================================

  describe('Integration with FileSystem', () => {
    it('should parse multiple files sequentially', async () => {
      const files = {
        '/docs/readme.md': '# README\n\nMain readme.',
        '/docs/api.md': '# API\n\nAPI documentation.',
        '/docs/guide.md': '# Guide\n\nUser guide.'
      };

      for (const [path, content] of Object.entries(files)) {
        mockFileSystem.readFile.mockResolvedValueOnce(content);
        mockFileSystem.exists.mockResolvedValueOnce(true);

        const result = await parser.parseFile(path);

        expect(result.filePath).toBe(path);
        expect(result.sections.length).toBeGreaterThan(0);
      }

      expect(mockFileSystem.readFile).toHaveBeenCalledTimes(3);
    });

    it('should handle file path in result', async () => {
      const filePath = '/workspace/docs/architecture.md';
      const content = '# Architecture\n\nSystem architecture document.';

      mockFileSystem.readFile.mockResolvedValue(content);
      mockFileSystem.exists.mockResolvedValue(true);

      const result = await parser.parseFile(filePath);

      expect(result.filePath).toBe(filePath);
    });
  });
});
