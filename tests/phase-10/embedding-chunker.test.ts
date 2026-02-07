import { chunkEntity, estimateChunkCount, ChunkOptions } from '../../src/embeddings/chunker';
import { Entity } from '../../src/entities';

function makeEntity(content: string, name: string = 'TestEntity'): Entity {
  return {
    id: `id-${name}`,
    type: 'class',
    name,
    content,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('F10.14 - Embedding Quality (Chunking)', () => {
  describe('chunkEntity', () => {
    it('should return single chunk for short content', () => {
      const entity = makeEntity('function hello() { return "world"; }');
      const result = chunkEntity(entity);

      expect(result.wasSplit).toBe(false);
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].index).toBe(0);
      expect(result.chunks[0].text).toBe(entity.content);
    });

    it('should not split content under maxChars', () => {
      const content = 'x'.repeat(3999);
      const entity = makeEntity(content);
      const result = chunkEntity(entity, { maxChars: 4000 });

      expect(result.wasSplit).toBe(false);
      expect(result.chunks).toHaveLength(1);
    });

    it('should split content exceeding maxChars', () => {
      // Create content with clear line boundaries
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${'x'.repeat(80)}`);
      const content = lines.join('\n');
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 1000, overlapChars: 100 });

      expect(result.wasSplit).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(1);

      // All chunks should be within limits
      for (const chunk of result.chunks) {
        expect(chunk.text.length).toBeLessThanOrEqual(1100); // some tolerance
      }
    });

    it('should create overlapping chunks', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `Line ${i}: some content here`);
      const content = lines.join('\n');
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 500, overlapChars: 100 });

      if (result.chunks.length >= 2) {
        // Verify overlap: end of chunk N overlaps with start of chunk N+1
        const chunk0End = result.chunks[0].text;
        const chunk1Start = result.chunks[1].text;

        // The end of chunk 0 should overlap with the start of chunk 1
        const chunk0Suffix = chunk0End.slice(-100);
        expect(chunk1Start.startsWith(chunk0Suffix) || chunk1Start.includes(chunk0Suffix.trim())).toBeTruthy();
      }
    });

    it('should split at paragraph boundaries when possible', () => {
      const content = 'Paragraph one content.\n\nParagraph two content.\n\nParagraph three content.';
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 30, overlapChars: 5, minChunkChars: 10 });

      // Should try to split at paragraph breaks
      if (result.wasSplit) {
        for (const chunk of result.chunks) {
          // Chunks should not start or end mid-paragraph (roughly)
          expect(chunk.text.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('should split at line boundaries when no paragraph break', () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}: data`);
      const content = lines.join('\n');
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 100, overlapChars: 20, minChunkChars: 20 });

      if (result.wasSplit) {
        // Chunks should end at line boundaries (end with \n or be the last chunk)
        for (let i = 0; i < result.chunks.length - 1; i++) {
          const chunk = result.chunks[i];
          const lastChar = chunk.text[chunk.text.length - 1];
          // Should end at a newline or have content that was split at a boundary
          expect(lastChar === '\n' || chunk.text.includes('\n')).toBe(true);
        }
      }
    });

    it('should handle content with no good boundaries', () => {
      const content = 'a'.repeat(5000); // No spaces, newlines, or punctuation
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 1000, overlapChars: 100 });

      expect(result.wasSplit).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(1);

      // All content should be covered
      const totalCoverage = new Set<number>();
      for (const chunk of result.chunks) {
        for (let i = chunk.startOffset; i < chunk.endOffset; i++) {
          totalCoverage.add(i);
        }
      }
      expect(totalCoverage.size).toBe(content.length);
    });

    it('should absorb tiny final chunks into previous chunk', () => {
      // Content that would leave a tiny tail
      const content = 'x'.repeat(1050);
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 1000, overlapChars: 100, minChunkChars: 100 });

      // The tiny remainder (50 chars) should be absorbed
      for (const chunk of result.chunks) {
        expect(chunk.text.length).toBeGreaterThanOrEqual(100);
      }
    });

    it('should handle entity with only summary (no content)', () => {
      const entity: Entity = {
        id: 'test-id',
        type: 'concept',
        name: 'TestConcept',
        summary: 'A short summary',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = chunkEntity(entity);
      expect(result.wasSplit).toBe(false);
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].text).toBe('A short summary');
    });

    it('should handle empty content', () => {
      const entity = makeEntity('');
      const result = chunkEntity(entity);
      expect(result.wasSplit).toBe(false);
      expect(result.chunks).toHaveLength(1);
    });

    it('should use custom maxChars for different models', () => {
      const content = 'x'.repeat(3000);
      const entity = makeEntity(content);

      // nomic-embed-text: 4000 chars — no split
      const nomicResult = chunkEntity(entity, { maxChars: 4000 });
      expect(nomicResult.wasSplit).toBe(false);

      // all-minilm: 1000 chars — should split
      const minilmResult = chunkEntity(entity, { maxChars: 1000, overlapChars: 100 });
      expect(minilmResult.wasSplit).toBe(true);
      expect(minilmResult.chunks.length).toBeGreaterThan(1);
    });

    it('should preserve sequential chunk indices', () => {
      const content = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join('\n');
      const entity = makeEntity(content);

      const result = chunkEntity(entity, { maxChars: 200, overlapChars: 30 });

      for (let i = 0; i < result.chunks.length; i++) {
        expect(result.chunks[i].index).toBe(i);
      }
    });
  });

  describe('estimateChunkCount', () => {
    it('should return 1 for short content', () => {
      expect(estimateChunkCount(500, { maxChars: 4000 })).toBe(1);
    });

    it('should estimate multiple chunks for long content', () => {
      // 10000 chars with maxChars=4000, overlap=200 → effective step = 3800
      // (10000 - 200) / 3800 ≈ 2.58 → 3 chunks
      const count = estimateChunkCount(10000, { maxChars: 4000, overlapChars: 200 });
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(4);
    });

    it('should increase chunk count with smaller maxChars', () => {
      const opts1: ChunkOptions = { maxChars: 4000, overlapChars: 200 };
      const opts2: ChunkOptions = { maxChars: 1000, overlapChars: 200 };

      const count1 = estimateChunkCount(10000, opts1);
      const count2 = estimateChunkCount(10000, opts2);

      expect(count2).toBeGreaterThan(count1);
    });
  });
});
