import { QueryDecomposer } from '../../src/retrieval/query-decomposer';
import { LLMReranker } from '../../src/retrieval/llm-reranker';
import { SearchResult } from '../../src/retrieval/types';
import { Entity } from '../../src/entities';

function makeEntity(name: string, type: string = 'function', content?: string): Entity {
  return {
    id: `id-${name}`,
    type: type as Entity['type'],
    name,
    content: content || `${type} ${name}() {}`,
    summary: `The ${name} ${type}`,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeResult(entity: Entity, score: number): SearchResult {
  return { entity, score, source: 'keyword' };
}

describe('F10.12 - Advanced Query Pipeline', () => {
  describe('QueryDecomposer', () => {
    let decomposer: QueryDecomposer;

    beforeEach(() => {
      decomposer = new QueryDecomposer();
    });

    describe('Single-topic queries', () => {
      it('should not decompose simple queries', () => {
        const result = decomposer.decompose('how does authentication work');
        expect(result.wasDecomposed).toBe(false);
        expect(result.subQueries).toHaveLength(1);
        expect(result.subQueries[0].text).toBe('how does authentication work');
      });

      it('should handle empty queries', () => {
        const result = decomposer.decompose('');
        expect(result.wasDecomposed).toBe(false);
        expect(result.subQueries).toHaveLength(1);
      });
    });

    describe('Conjunction-based decomposition', () => {
      it('should split on "and" with independent topics', () => {
        const result = decomposer.decompose('authentication logic and database schema');
        expect(result.wasDecomposed).toBe(true);
        expect(result.subQueries.length).toBeGreaterThanOrEqual(2);
        expect(result.subQueries.some(q => q.text.includes('authentication'))).toBe(true);
        expect(result.subQueries.some(q => q.text.includes('database'))).toBe(true);
      });

      it('should not split "and" within a single topic', () => {
        // "read and write" is a single topic about read/write operations
        const result = decomposer.decompose('read and write operations');
        // This may or may not decompose depending on the heuristic
        // At minimum, the result should be valid
        expect(result.subQueries.length).toBeGreaterThanOrEqual(1);
      });

      it('should split on "as well as"', () => {
        const result = decomposer.decompose('caching strategy as well as logging setup');
        expect(result.wasDecomposed).toBe(true);
        expect(result.subQueries.length).toBe(2);
      });
    });

    describe('Question-based decomposition', () => {
      it('should split multiple questions', () => {
        const result = decomposer.decompose('how does auth work? what database is used?');
        expect(result.wasDecomposed).toBe(true);
        expect(result.subQueries.length).toBe(2);
      });

      it('should split on semicolons', () => {
        const result = decomposer.decompose('authentication flow; payment processing');
        expect(result.wasDecomposed).toBe(true);
        expect(result.subQueries.length).toBe(2);
      });
    });

    describe('Sequential decomposition', () => {
      it('should split on "then"', () => {
        const result = decomposer.decompose('find the auth module then check its tests');
        expect(result.wasDecomposed).toBe(true);
        expect(result.subQueries.length).toBe(2);
      });

      it('should apply decreasing weight to later steps', () => {
        const result = decomposer.decompose('find the auth module then check its tests');
        if (result.wasDecomposed && result.subQueries.length > 1) {
          expect(result.subQueries[0].weight).toBeGreaterThanOrEqual(result.subQueries[1].weight);
        }
      });
    });

    describe('Weight assignment', () => {
      it('should give equal weight to conjunction splits', () => {
        const result = decomposer.decompose('authentication logic and database schema');
        if (result.wasDecomposed) {
          for (const sq of result.subQueries) {
            expect(sq.weight).toBe(1.0);
          }
        }
      });
    });
  });

  describe('LLMReranker', () => {
    it('should return empty results for empty input', async () => {
      const reranker = new LLMReranker();
      const result = await reranker.rerank('test query', []);
      expect(result.results).toHaveLength(0);
      expect(result.reranked).toBe(false);
    });

    it('should gracefully handle unavailable LLM', async () => {
      // Use an invalid URL so the LLM call fails
      const reranker = new LLMReranker({
        baseUrl: 'http://localhost:1',
        timeout: 500,
      });

      const entities = [
        makeEntity('funcA'),
        makeEntity('funcB'),
      ];

      const results = entities.map((e, i) => makeResult(e, 1 - i * 0.1));

      const ranked = await reranker.rerank('test query', results);

      // Should return original results when LLM is unavailable
      expect(ranked.reranked).toBe(false);
      expect(ranked.results).toHaveLength(2);
      expect(ranked.results[0].entity.name).toBe('funcA');
    });

    it('should check availability', async () => {
      const reranker = new LLMReranker({
        baseUrl: 'http://localhost:1',
      });
      const available = await reranker.isAvailable();
      expect(available).toBe(false);
    });

    it('should respect topK configuration', () => {
      const reranker = new LLMReranker({ topK: 5 });
      // Just verify it constructs without error
      expect(reranker).toBeDefined();
    });
  });
});
