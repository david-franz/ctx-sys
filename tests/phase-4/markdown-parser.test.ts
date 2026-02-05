import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MarkdownParser } from '../../src';

describe('F4.1 - Markdown Parsing', () => {
  let parser: MarkdownParser;
  let testDir: string;

  beforeEach(() => {
    parser = new MarkdownParser();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-sys-md-test-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('parseContent', () => {
    it('should parse basic markdown with headings', () => {
      const content = `# Main Title

Some intro text.

## Section One

Content for section one.

## Section Two

Content for section two.

### Subsection

Nested content.
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.filePath).toBe('test.md');
      expect(doc.title).toBe('Main Title');
      expect(doc.sections.length).toBe(4);
      expect(doc.sections[0].title).toBe('Main Title');
      expect(doc.sections[0].level).toBe(1);
      expect(doc.sections[1].title).toBe('Section One');
      expect(doc.sections[1].level).toBe(2);
      expect(doc.sections[2].title).toBe('Section Two');
      expect(doc.sections[3].title).toBe('Subsection');
      expect(doc.sections[3].level).toBe(3);
    });

    it('should extract frontmatter', () => {
      const content = `---
title: Document Title
author: Test Author
version: 1.0
---

# Heading

Content here.
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.frontmatter).toBeDefined();
      expect(doc.frontmatter?.title).toBe('Document Title');
      expect(doc.frontmatter?.author).toBe('Test Author');
      expect(doc.frontmatter?.version).toBe(1.0);
      expect(doc.title).toBe('Document Title');
    });

    it('should extract code blocks', () => {
      const content = `# Code Example

Here is some code:

\`\`\`typescript
function hello(): string {
  return "Hello, World!";
}
\`\`\`

And some Python:

\`\`\`python
def hello():
    return "Hello, World!"
\`\`\`
`;
      const doc = parser.parseContent(content, 'test.md');
      const codeBlocks = parser.getAllCodeBlocks(doc);

      expect(codeBlocks.length).toBe(2);
      expect(codeBlocks[0].language).toBe('typescript');
      expect(codeBlocks[0].code).toContain('function hello()');
      expect(codeBlocks[1].language).toBe('python');
      expect(codeBlocks[1].code).toContain('def hello()');
    });

    it('should extract links', () => {
      const content = `# Links Section

Check out [Google](https://google.com) for more info.

See also [local docs](./docs/readme.md) and [another page](../other.md).

External link: [GitHub](https://github.com)
`;
      const doc = parser.parseContent(content, 'test.md');
      const allLinks = parser.getAllLinks(doc);
      const internal = parser.getInternalLinks(doc);
      const external = parser.getExternalLinks(doc);

      expect(allLinks.length).toBe(4);
      expect(internal.length).toBe(2);
      expect(external.length).toBe(2);
      expect(internal[0].url).toBe('./docs/readme.md');
      expect(internal[0].isInternal).toBe(true);
      expect(external[0].url).toBe('https://google.com');
      expect(external[0].isInternal).toBe(false);
    });

    it('should handle preamble content before first heading', () => {
      const content = `This is some preamble text before any heading.

It should be captured.

# First Heading

Content after heading.
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.sections.length).toBe(2);
      expect(doc.sections[0].title).toBe('Preamble');
      expect(doc.sections[0].level).toBe(0);
      expect(doc.sections[0].content).toContain('preamble text');
    });

    it('should track section hierarchy', () => {
      const content = `# Parent

## Child One

### Grandchild One

## Child Two

Content here.
`;
      const doc = parser.parseContent(content, 'test.md');
      const parent = doc.sections.find(s => s.title === 'Parent');
      const child1 = doc.sections.find(s => s.title === 'Child One');
      const grandchild = doc.sections.find(s => s.title === 'Grandchild One');
      const child2 = doc.sections.find(s => s.title === 'Child Two');

      expect(parent?.children).toContain(child1?.id);
      expect(child1?.parent).toBe(parent?.id);
      expect(child1?.children).toContain(grandchild?.id);
      expect(grandchild?.parent).toBe(child1?.id);
      expect(child2?.parent).toBe(parent?.id);
    });

    it('should track line numbers in order', () => {
      const content = `# First

Line 2

## Second

Line 6

## Third

Line 10
`;
      const doc = parser.parseContent(content, 'test.md');
      const first = doc.sections.find(s => s.title === 'First');
      const second = doc.sections.find(s => s.title === 'Second');
      const third = doc.sections.find(s => s.title === 'Third');

      expect(first?.startLine).toBeDefined();
      expect(second?.startLine).toBeDefined();
      expect(third?.startLine).toBeDefined();
      expect(first!.startLine).toBeLessThan(second!.startLine);
      expect(second!.startLine).toBeLessThan(third!.startLine);
    });

    it('should generate section IDs from titles', () => {
      const content = `# My Cool Section

## Another Section Here

## Section with 123 Numbers
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.sections[0].id).toBe('my-cool-section');
      expect(doc.sections[1].id).toBe('another-section-here');
      expect(doc.sections[2].id).toBe('section-with-123-numbers');
    });

    it('should handle code blocks without language', () => {
      const content = `# Code

\`\`\`
plain code block
no language specified
\`\`\`
`;
      const doc = parser.parseContent(content, 'test.md');
      const codeBlocks = parser.getAllCodeBlocks(doc);

      expect(codeBlocks.length).toBe(1);
      expect(codeBlocks[0].language).toBeUndefined();
      expect(codeBlocks[0].code).toContain('plain code block');
    });

    it('should handle empty sections', () => {
      const content = `# Empty Section

## Another Empty
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.sections.length).toBe(2);
    });

    it('should handle lists in content', () => {
      const content = `# List Section

- Item one
- Item two
- Item three

Numbered:

1. First
2. Second
3. Third
`;
      const doc = parser.parseContent(content, 'test.md');
      const section = doc.sections[0];

      expect(section.content).toContain('Item one');
      expect(section.content).toContain('1. First');
    });
  });

  describe('parseFile', () => {
    it('should parse markdown file from disk', async () => {
      const content = `# File Test

Content from file.

## Section

More content.
`;
      const filePath = path.join(testDir, 'test.md');
      fs.writeFileSync(filePath, content);

      const doc = await parser.parseFile(filePath);

      expect(doc.filePath).toBe(filePath);
      expect(doc.title).toBe('File Test');
      expect(doc.sections.length).toBe(2);
    });

    it('should handle file with array frontmatter', async () => {
      const content = `---
title: Complex Doc
tags:
  - typescript
  - testing
---

# Document

Content here.
`;
      const filePath = path.join(testDir, 'complex.md');
      fs.writeFileSync(filePath, content);

      const doc = await parser.parseFile(filePath);

      expect(doc.frontmatter?.tags).toEqual(['typescript', 'testing']);
    });
  });

  describe('helper methods', () => {
    it('should get section by ID', () => {
      const content = `# Main

## Target Section

Content here.
`;
      const doc = parser.parseContent(content, 'test.md');
      const section = parser.getSectionById(doc, 'target-section');

      expect(section).toBeDefined();
      expect(section?.title).toBe('Target Section');
    });

    it('should return undefined for non-existent section ID', () => {
      const content = `# Main

Content.
`;
      const doc = parser.parseContent(content, 'test.md');
      const section = parser.getSectionById(doc, 'non-existent');

      expect(section).toBeUndefined();
    });

    it('should get top-level sections', () => {
      const content = `# H1

## H2 One

### H3

## H2 Two

#### H4
`;
      const doc = parser.parseContent(content, 'test.md');
      const topLevel = parser.getTopLevelSections(doc);

      expect(topLevel.length).toBe(3);
      expect(topLevel.map(s => s.title)).toEqual(['H1', 'H2 One', 'H2 Two']);
    });

    it('should get section tree (root sections)', () => {
      const content = `# Root One

## Child

# Root Two

## Another Child
`;
      const doc = parser.parseContent(content, 'test.md');
      const tree = parser.getSectionTree(doc);

      expect(tree.length).toBe(2);
      expect(tree[0].title).toBe('Root One');
      expect(tree[1].title).toBe('Root Two');
    });

    it('should search sections by content', () => {
      const content = `# Introduction

Welcome to the documentation.

## Installation

Run npm install to get started.

## Usage

Import and use the module.
`;
      const doc = parser.parseContent(content, 'test.md');

      const results = parser.searchSections(doc, 'npm');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Installation');

      const titleResults = parser.searchSections(doc, 'usage');
      expect(titleResults.length).toBe(1);
      expect(titleResults[0].title).toBe('Usage');
    });

    it('should search case-insensitively', () => {
      const content = `# Test

Contains UPPERCASE and lowercase text.
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(parser.searchSections(doc, 'UPPERCASE').length).toBe(1);
      expect(parser.searchSections(doc, 'uppercase').length).toBe(1);
      expect(parser.searchSections(doc, 'LOWERCASE').length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', () => {
      const doc = parser.parseContent('', 'empty.md');

      expect(doc.sections.length).toBe(0);
      expect(doc.title).toBeUndefined();
    });

    it('should handle document with only frontmatter', () => {
      const content = `---
title: Only Frontmatter
---
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.title).toBe('Only Frontmatter');
      expect(doc.sections.length).toBe(0);
    });

    it('should handle deeply nested headings', () => {
      const content = `# H1

## H2

### H3

#### H4

##### H5

###### H6
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.sections.length).toBe(6);
      expect(doc.sections[5].level).toBe(6);
    });

    it('should handle multiple code blocks in one section', () => {
      const content = `# Examples

\`\`\`js
const a = 1;
\`\`\`

Some text between.

\`\`\`js
const b = 2;
\`\`\`

More text.

\`\`\`js
const c = 3;
\`\`\`
`;
      const doc = parser.parseContent(content, 'test.md');
      const section = doc.sections[0];

      expect(section.codeBlocks.length).toBe(3);
    });

    it('should use h1 as title when no frontmatter title', () => {
      const content = `---
author: Test
---

# Document Title From Heading

Content.
`;
      const doc = parser.parseContent(content, 'test.md');

      expect(doc.title).toBe('Document Title From Heading');
    });
  });
});
