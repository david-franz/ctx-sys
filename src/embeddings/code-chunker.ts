/**
 * Code-aware chunking for entity embeddings.
 * Wraps the generic chunker with entity header prepending,
 * so every chunk is self-describing for semantic search.
 */

import { Entity } from '../entities';
import { splitIdentifier } from '../utils/identifier-splitter';
import { chunkEntity } from './chunker';

export interface CodeChunk {
  /** Full text to embed (header + content slice) */
  text: string;
  /** 0-based chunk index */
  chunkIndex: number;
  /** Total chunks for this entity */
  totalChunks: number;
}

export interface CodeChunkOptions {
  /** Max chars per chunk including header (default: 1500) */
  maxChars?: number;
  /** Overlap between chunks in chars (default: 200) */
  overlapChars?: number;
}

const DEFAULTS: Required<CodeChunkOptions> = {
  maxChars: 1500,
  overlapChars: 200,
};

/**
 * Build the entity header prepended to every chunk.
 * Includes type, split name, file path, and summary.
 */
function buildEntityHeader(entity: Entity): string {
  const parts: string[] = [];

  parts.push(`${entity.type}: ${splitIdentifier(entity.name)}`);

  if (entity.filePath) {
    const pathParts = entity.filePath.split('/').slice(-2);
    parts.push(`in ${pathParts.join('/')}`);
  }

  if (entity.summary) {
    parts.push(entity.summary);
  }

  return parts.join('\n');
}

/**
 * Chunk an entity's content for multi-vector embedding.
 *
 * Small entities (content + header fits in maxChars) get a single chunk.
 * Large entities get split into overlapping chunks at line boundaries,
 * each prefixed with the entity header so every chunk is self-describing.
 */
export function chunkEntityForEmbedding(
  entity: Entity,
  options?: CodeChunkOptions
): CodeChunk[] {
  const opts = { ...DEFAULTS, ...options };
  const header = buildEntityHeader(entity);
  const content = entity.content || '';

  // Single chunk: header + content fits
  if (!content || (header.length + 2 + content.length) <= opts.maxChars) {
    const text = content ? `${header}\n\n${content}` : header;
    return [{ text, chunkIndex: 0, totalChunks: 1 }];
  }

  // Multi-chunk: split content, prepend header to each
  const contentBudget = opts.maxChars - header.length - 2; // 2 for "\n\n"
  const result = chunkEntity(entity, {
    maxChars: contentBudget,
    overlapChars: opts.overlapChars,
    minChunkChars: 100,
  });

  return result.chunks.map((chunk, _i) => ({
    text: `${header}\n\n${chunk.text}`,
    chunkIndex: chunk.index,
    totalChunks: result.chunks.length,
  }));
}
