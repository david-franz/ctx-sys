/**
 * F10i.1: Context retrieval domain service.
 */

import { AppContext } from '../context';
import { EntityType } from '../entities/types';
import { RelationshipStore } from '../graph';
import {
  MultiStrategySearch, ContextAssembler, SearchResult, HeuristicReranker,
  ContextExpander, RetrievalGate, QueryDecomposer, HyDEQueryExpander,
  OllamaHypotheticalProvider
} from '../retrieval';
import { GraphTraversal } from '../graph';
import { QueryOptions, ContextResult } from './types';

export class RetrievalService {
  private searchServices = new Map<string, MultiStrategySearch>();
  private relationshipStores = new Map<string, RelationshipStore>();
  private graphTraversals = new Map<string, GraphTraversal>();

  constructor(private context: AppContext) {}

  private getRelationshipStore(projectId: string): RelationshipStore {
    if (!this.relationshipStores.has(projectId)) {
      this.relationshipStores.set(projectId, new RelationshipStore(this.context.db, projectId));
    }
    return this.relationshipStores.get(projectId)!;
  }

  private getGraphTraversal(projectId: string): GraphTraversal {
    if (!this.graphTraversals.has(projectId)) {
      const relationshipStore = this.getRelationshipStore(projectId);
      const entityStore = this.context.getEntityStore(projectId);
      this.graphTraversals.set(projectId, new GraphTraversal(
        this.context.db,
        projectId,
        relationshipStore,
        entityStore
      ));
    }
    return this.graphTraversals.get(projectId)!;
  }

  private async getSearchService(projectId: string): Promise<MultiStrategySearch> {
    if (!this.searchServices.has(projectId)) {
      const entityStore = this.context.getEntityStore(projectId);
      const project = await this.context.projectManager.get(projectId);
      const embeddingManager = await this.context.getEmbeddingManager(projectId, project?.config);
      const graphTraversal = this.getGraphTraversal(projectId);
      this.searchServices.set(projectId, new MultiStrategySearch(
        entityStore,
        embeddingManager,
        graphTraversal,
        undefined,
        new HeuristicReranker(),
        this.context.logger
      ));
    }
    return this.searchServices.get(projectId)!;
  }

  async queryContext(projectId: string, query: string, options?: QueryOptions): Promise<ContextResult> {
    if (options?.gate) {
      const gate = new RetrievalGate();
      const decision = await gate.shouldRetrieve({ query });
      if (!decision.shouldRetrieve) {
        return {
          context: '',
          sources: [],
          confidence: 0,
          tokensUsed: 0,
          truncated: false
        };
      }
    }

    const searchService = await this.getSearchService(projectId);

    let queryEmbedding: number[] | undefined;
    if (options?.hyde) {
      try {
        const project = await this.context.projectManager.get(projectId);
        const embeddingManager = await this.context.getEmbeddingManager(projectId, project?.config);
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const hydeModel = options?.hydeModel || project?.config?.hyde?.model || process.env.CTX_HYDE_MODEL;
        const hydeProvider = new OllamaHypotheticalProvider({ baseUrl, model: hydeModel });
        const hyde = new HyDEQueryExpander(hydeProvider, embeddingManager);
        const result = await hyde.getSearchEmbedding(query, projectId, {
          entityTypes: options?.includeTypes
        });
        if (result.usedHyDE) {
          const quickCheck = await embeddingManager.findSimilarByVector(result.embedding, {
            limit: 1,
            entityTypes: options?.includeTypes?.map(t => t as string)
          });

          if (quickCheck.length > 0 && quickCheck[0].score >= 0.3) {
            queryEmbedding = result.embedding;
          }
        }
      } catch {
        // HyDE failed — fall back to normal search
      }
    }

    const maxResults = options?.maxResults ?? 15;

    const searchOpts = {
      strategies: options?.strategies,
      limit: maxResults,
      entityTypes: options?.includeTypes as EntityType[],
      queryEmbedding
    };

    let results: SearchResult[];
    if (options?.decompose) {
      const decomposer = new QueryDecomposer();
      const decomposed = decomposer.decompose(query);

      if (decomposed.wasDecomposed) {
        const allResults = new Map<string, SearchResult>();
        for (const sub of decomposed.subQueries) {
          const subResults = await searchService.search(sub.text, {
            ...searchOpts,
            limit: 10
          });
          for (const r of subResults) {
            const existing = allResults.get(r.entity.id);
            const weighted = r.score * sub.weight;
            if (!existing || weighted > existing.score) {
              allResults.set(r.entity.id, { ...r, score: existing ? Math.max(existing.score, weighted) : weighted });
            }
          }
        }
        results = Array.from(allResults.values()).sort((a, b) => b.score - a.score).slice(0, maxResults);
      } else {
        results = await searchService.search(query, searchOpts);
      }
    } else {
      results = await searchService.search(query, searchOpts);
    }

    if (options?.expand && results.length > 0) {
      const entityStore = this.context.getEntityStore(projectId);
      const relationshipStore = this.getRelationshipStore(projectId);
      const expander = new ContextExpander(entityStore, relationshipStore);
      results = await expander.expand(results, {
        maxExpansionTokens: options?.expandTokens || 2000
      });
    }

    const assembler = new ContextAssembler();
    const assembled = assembler.assemble(results, {
      maxTokens: options?.maxTokens || 4000,
      includeSources: options?.includeSources ?? true,
      format: 'markdown',
      minRelevance: options?.minScore ?? 0.1
    });

    const confidence = this.calculateConfidence(results);

    return {
      context: assembled.context,
      sources: assembled.sources,
      confidence,
      tokensUsed: assembled.tokenCount,
      truncated: assembled.truncated
    };
  }

  private calculateConfidence(results: SearchResult[]): number {
    if (results.length === 0) return 0;

    const sorted = [...results].sort((a, b) => b.score - a.score);
    const k = Math.min(5, sorted.length);
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < k; i++) {
      const weight = Math.pow(0.7, i);
      weightedSum += Math.max(0, sorted[i].score) * weight;
      totalWeight += weight;
    }

    const raw = totalWeight > 0 ? weightedSum / totalWeight : 0;
    return Math.min(1.0, raw);
  }

  clearProjectCache(projectId: string): void {
    this.searchServices.delete(projectId);
    this.relationshipStores.delete(projectId);
    this.graphTraversals.delete(projectId);
  }
}
