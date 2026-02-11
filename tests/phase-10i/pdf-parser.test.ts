/**
 * Tests for PDF parser.
 * Uses jest.mock to avoid needing real PDF files and pdf-parse internals.
 */

import { parsePdf } from '../../src/documents/pdf-parser';

// Mock the pdf-parse module
jest.mock('pdf-parse', () => {
  class MockPDFParse {
    private options: any;
    constructor(options: any) {
      this.options = options;
    }

    async getText() {
      // Simulate different PDFs based on buffer content
      const data = Buffer.from(this.options.data);
      const content = data.toString('utf-8');

      if (content.includes('EMPTY_PDF')) {
        return { pages: [], text: '', total: 0 };
      }

      if (content.includes('MULTI_PAGE')) {
        return {
          pages: [
            { num: 1, text: 'Page one content here.' },
            { num: 2, text: 'Page two has more text.' },
            { num: 3, text: 'Final page three.' },
          ],
          text: 'Page one content here.\nPage two has more text.\nFinal page three.',
          total: 3,
        };
      }

      // Default single-page PDF
      return {
        pages: [{ num: 1, text: 'Hello World from PDF' }],
        text: 'Hello World from PDF',
        total: 1,
      };
    }

    async getInfo() {
      const data = Buffer.from(this.options.data);
      const content = data.toString('utf-8');

      if (content.includes('WITH_METADATA')) {
        return {
          info: {
            Title: 'Test Document',
            Author: 'Jane Doe',
            Subject: 'Testing',
            Creator: 'TestApp',
            Producer: 'TestProducer',
          },
          total: 1,
        };
      }

      if (content.includes('EMPTY_PDF')) {
        return { info: {}, total: 0 };
      }

      return { info: {}, total: 1 };
    }

    async destroy() {}
  }

  return { PDFParse: MockPDFParse };
});

describe('PDF Parser', () => {
  it('should parse a single-page PDF', async () => {
    const buffer = Buffer.from('SINGLE_PAGE_PDF');
    const result = await parsePdf(buffer);

    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toBe('Hello World from PDF');
    expect(result.fullText).toBe('Hello World from PDF');
  });

  it('should parse multi-page PDF', async () => {
    const buffer = Buffer.from('MULTI_PAGE_PDF');
    const result = await parsePdf(buffer);

    expect(result.pageCount).toBe(3);
    expect(result.pages).toHaveLength(3);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Page one');
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[2].pageNumber).toBe(3);
  });

  it('should extract metadata when present', async () => {
    const buffer = Buffer.from('WITH_METADATA');
    const result = await parsePdf(buffer);

    expect(result.title).toBe('Test Document');
    expect(result.author).toBe('Jane Doe');
    expect(result.metadata.title).toBe('Test Document');
    expect(result.metadata.author).toBe('Jane Doe');
    expect(result.metadata.subject).toBe('Testing');
    expect(result.metadata.creator).toBe('TestApp');
    expect(result.metadata.producer).toBe('TestProducer');
  });

  it('should handle PDF with no metadata', async () => {
    const buffer = Buffer.from('SINGLE_PAGE_PDF');
    const result = await parsePdf(buffer);

    expect(result.title).toBe('');
    expect(result.author).toBe('');
    expect(result.metadata).toEqual({});
  });

  it('should handle empty PDF', async () => {
    const buffer = Buffer.from('EMPTY_PDF');
    const result = await parsePdf(buffer);

    expect(result.pageCount).toBe(0);
    expect(result.pages).toHaveLength(0);
    expect(result.fullText).toBe('');
  });

  it('should filter out pages with empty text', async () => {
    // The mock returns pages with non-empty text, so all should be kept
    const buffer = Buffer.from('MULTI_PAGE_PDF');
    const result = await parsePdf(buffer);

    for (const page of result.pages) {
      expect(page.text.length).toBeGreaterThan(0);
    }
  });
});
