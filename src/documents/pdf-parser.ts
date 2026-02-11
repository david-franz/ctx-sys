/**
 * F10i.8: PDF parser.
 * Extracts text content and metadata from PDF files using pdf-parse v2.
 */

import { PDFParse } from 'pdf-parse';

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfDocument {
  title: string;
  author: string;
  pages: PdfPage[];
  pageCount: number;
  fullText: string;
  metadata: Record<string, string>;
}

/**
 * Parse a PDF buffer into structured pages and metadata.
 */
export async function parsePdf(buffer: Buffer): Promise<PdfDocument> {
  const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    const pages: PdfPage[] = textResult.pages.map(p => ({
      pageNumber: p.num,
      text: p.text.trim(),
    })).filter(p => p.text.length > 0);

    const info = infoResult.info || {};

    return {
      title: info.Title || '',
      author: info.Author || '',
      pages,
      pageCount: textResult.total,
      fullText: textResult.text,
      metadata: {
        ...(info.Title ? { title: String(info.Title) } : {}),
        ...(info.Author ? { author: String(info.Author) } : {}),
        ...(info.Subject ? { subject: String(info.Subject) } : {}),
        ...(info.Creator ? { creator: String(info.Creator) } : {}),
        ...(info.Producer ? { producer: String(info.Producer) } : {}),
      },
    };
  } finally {
    await parser.destroy();
  }
}
