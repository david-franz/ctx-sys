/**
 * F10.14: Overlapping Chunk Strategy.
 * Splits long entities into overlapping chunks for multi-vector embedding.
 * Prevents silent truncation of long code/documents.
 */

import { Entity } from '../entities';

export interface ChunkOptions {
  /** Maximum characters per chunk (model-dependent) */
  maxChars?: number;
  /** Overlap between consecutive chunks in characters */
  overlapChars?: number;
  /** Minimum chunk size (don't create tiny chunks) */
  minChunkChars?: number;
}

export interface Chunk {
  /** Chunk index (0-based) */
  index: number;
  /** Chunk text content */
  text: string;
  /** Character offset in the original content */
  startOffset: number;
  /** Character end offset in the original content */
  endOffset: number;
}

export interface ChunkResult {
  /** The entity that was chunked */
  entityId: string;
  /** The chunks produced */
  chunks: Chunk[];
  /** Whether the entity was actually split */
  wasSplit: boolean;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxChars: 4000,
  overlapChars: 200,
  minChunkChars: 100,
};

/**
 * Split an entity's content into overlapping chunks.
 * Short entities return a single chunk (no split).
 */
export function chunkEntity(entity: Entity, options?: ChunkOptions): ChunkResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const content = entity.content || entity.summary || entity.name;

  if (!content || content.length <= opts.maxChars) {
    return {
      entityId: entity.id,
      chunks: [{ index: 0, text: content || '', startOffset: 0, endOffset: content?.length || 0 }],
      wasSplit: false,
    };
  }

  const chunks: Chunk[] = [];
  let pos = 0;
  let index = 0;

  while (pos < content.length) {
    const end = Math.min(pos + opts.maxChars, content.length);
    let splitAt = end;

    // Find a good split boundary (don't split mid-line or mid-word)
    if (end < content.length) {
      splitAt = findBoundary(content, pos + opts.maxChars - opts.overlapChars, end);
    }

    const chunkText = content.slice(pos, splitAt);

    // Skip tiny final chunks
    if (chunkText.length < opts.minChunkChars && chunks.length > 0) {
      // Append to previous chunk instead
      const prev = chunks[chunks.length - 1];
      prev.text = content.slice(prev.startOffset, splitAt);
      prev.endOffset = splitAt;
      break;
    }

    chunks.push({
      index,
      text: chunkText,
      startOffset: pos,
      endOffset: splitAt,
    });
    index++;

    // Move forward with overlap
    pos = splitAt - opts.overlapChars;
    if (pos <= chunks[chunks.length - 1].startOffset) {
      // Prevent infinite loop if overlap >= chunk size
      pos = splitAt;
    }

    // If we've reached the end, stop
    if (splitAt >= content.length) break;
  }

  return {
    entityId: entity.id,
    chunks,
    wasSplit: chunks.length > 1,
  };
}

/**
 * Find a good boundary for splitting text.
 * Tries in order: paragraph break, line break, sentence end, word boundary.
 */
function findBoundary(text: string, searchStart: number, searchEnd: number): number {
  const region = text.slice(searchStart, searchEnd);

  // Try paragraph break (double newline)
  const paragraphIdx = region.lastIndexOf('\n\n');
  if (paragraphIdx >= 0) return searchStart + paragraphIdx + 2;

  // Try line break
  const lineIdx = region.lastIndexOf('\n');
  if (lineIdx >= 0) return searchStart + lineIdx + 1;

  // Try sentence end
  const sentenceMatch = region.match(/.*[.!?]\s/s);
  if (sentenceMatch) return searchStart + sentenceMatch[0].length;

  // Try word boundary (space)
  const spaceIdx = region.lastIndexOf(' ');
  if (spaceIdx >= 0) return searchStart + spaceIdx + 1;

  // No good boundary found, split at searchEnd
  return searchEnd;
}

/**
 * Estimate the number of chunks an entity would produce.
 */
export function estimateChunkCount(contentLength: number, options?: ChunkOptions): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (contentLength <= opts.maxChars) return 1;

  const effectiveStep = opts.maxChars - opts.overlapChars;
  return Math.ceil((contentLength - opts.overlapChars) / effectiveStep);
}
