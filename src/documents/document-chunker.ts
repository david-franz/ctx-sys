/**
 * F10c.4: Document Chunking Improvements.
 * Splits large sections, merges small ones, adds overlap between chunks.
 */

import { MarkdownSection } from './types';

export interface ChunkingOptions {
  /** Target chunk size in characters */
  targetSize?: number;
  /** Maximum chunk size before forced split */
  maxSize?: number;
  /** Minimum chunk size (merge with neighbors) */
  minSize?: number;
  /** Overlap between adjacent chunks in characters */
  overlap?: number;
}

const DEFAULT_CHUNKING: Required<ChunkingOptions> = {
  targetSize: 1500,
  maxSize: 3000,
  minSize: 200,
  overlap: 200,
};

/**
 * Apply size-aware chunking to document sections.
 * Splits large sections, merges small ones, adds overlap.
 */
export function chunkSections(
  sections: MarkdownSection[],
  options?: ChunkingOptions
): MarkdownSection[] {
  const opts = { ...DEFAULT_CHUNKING, ...options };

  // Step 1: Split large sections
  let result = splitLargeSections(sections, opts);

  // Step 2: Merge small sections
  result = mergeSmallSections(result, opts);

  return result;
}

/**
 * Split sections that exceed maxSize into paragraph-aware chunks.
 */
function splitLargeSections(
  sections: MarkdownSection[],
  opts: Required<ChunkingOptions>
): MarkdownSection[] {
  const result: MarkdownSection[] = [];

  for (const section of sections) {
    if (section.content.length <= opts.maxSize) {
      result.push(section);
      continue;
    }

    // Split by paragraphs
    const chunks = chunkByParagraphs(section.content, opts);

    for (let i = 0; i < chunks.length; i++) {
      const linesInChunk = chunks[i].split('\n').length;
      result.push({
        ...section,
        id: i === 0 ? section.id : `${section.id}-chunk-${i}`,
        title: i === 0 ? section.title : `${section.title} (part ${i + 1})`,
        content: chunks[i],
        startLine: section.startLine + (i > 0 ? Math.floor(i * linesInChunk) : 0),
        endLine: section.startLine + Math.floor((i + 1) * linesInChunk),
      });
    }
  }

  return result;
}

/**
 * Split content into chunks at paragraph boundaries with overlap.
 */
function chunkByParagraphs(
  content: string,
  opts: Required<ChunkingOptions>
): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > opts.targetSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Add overlap from end of previous chunk
      if (opts.overlap > 0) {
        const overlapText = currentChunk.slice(-opts.overlap);
        currentChunk = overlapText + '\n\n' + para;
      } else {
        currentChunk = para;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Merge sections that are below minSize with adjacent sections.
 * Only merges split chunks (identified by "-chunk-" in id), not original headed sections.
 */
function mergeSmallSections(
  sections: MarkdownSection[],
  opts: Required<ChunkingOptions>
): MarkdownSection[] {
  const merged: MarkdownSection[] = [];

  for (const section of sections) {
    const last = merged[merged.length - 1];
    const isChunkContinuation = section.id.includes('-chunk-');

    if (
      last &&
      isChunkContinuation &&
      last.content.length < opts.minSize
    ) {
      // Merge small chunk with previous chunk from same section
      last.content += '\n\n' + section.content;
      last.endLine = section.endLine;
    } else {
      merged.push({ ...section });
    }
  }

  return merged;
}
