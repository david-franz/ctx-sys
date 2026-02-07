/**
 * F10.11: Smart Context Expansion.
 * When a code entity is retrieved, automatically includes
 * its parent class, file imports, and referenced type definitions.
 */

import { Entity, EntityStore } from '../entities';
import { RelationshipStore } from '../graph/relationship-store';
import { SearchResult } from './types';

export interface ExpansionOptions {
  includeParent?: boolean;
  includeImports?: boolean;
  includeTypes?: boolean;
  includeSiblings?: boolean;
  maxExpansionTokens?: number;
}

const DEFAULT_OPTIONS: Required<ExpansionOptions> = {
  includeParent: true,
  includeImports: true,
  includeTypes: true,
  includeSiblings: false,
  maxExpansionTokens: 2000,
};

const CHARS_PER_TOKEN = 4;

export class ContextExpander {
  constructor(
    private entityStore: EntityStore,
    private relationshipStore: RelationshipStore
  ) {}

  /**
   * Expand search results with surrounding context.
   * Adds parent classes, file imports, and referenced types.
   */
  async expand(
    results: SearchResult[],
    options?: ExpansionOptions
  ): Promise<SearchResult[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const expanded = new Map<string, SearchResult>();
    let tokensUsed = 0;
    const tokenBudget = opts.maxExpansionTokens;

    // Add all original results first
    for (const result of results) {
      expanded.set(result.entity.id, result);
    }

    // Expand each result, highest relevance first
    const sorted = [...results].sort((a, b) => b.score - a.score);

    for (const result of sorted) {
      if (tokensUsed >= tokenBudget) break;

      const entity = result.entity;

      // Expand based on entity type
      if (opts.includeParent) {
        tokensUsed += await this.expandParent(entity, result.score, expanded, tokenBudget - tokensUsed);
      }

      if (opts.includeImports && entity.type === 'file') {
        tokensUsed += await this.expandImports(entity, result.score, expanded, tokenBudget - tokensUsed);
      }

      if (opts.includeTypes) {
        tokensUsed += await this.expandTypes(entity, result.score, expanded, tokenBudget - tokensUsed);
      }
    }

    return Array.from(expanded.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Add parent entity (class for method, file for function).
   */
  private async expandParent(
    entity: Entity,
    childScore: number,
    expanded: Map<string, SearchResult>,
    budget: number
  ): Promise<number> {
    if (budget <= 0) return 0;

    // Find entities that CONTAIN this entity
    const rels = await this.relationshipStore.getForEntity(entity.id, 'in', {
      types: ['CONTAINS'],
    });

    let tokensAdded = 0;
    for (const rel of rels) {
      if (expanded.has(rel.sourceId)) continue;

      const parent = await this.entityStore.get(rel.sourceId);
      if (!parent) continue;

      const parentTokens = this.estimateTokens(parent);
      if (tokensAdded + parentTokens > budget) continue;

      // Add parent with reduced score
      expanded.set(parent.id, {
        entity: parent,
        score: childScore * 0.5,
        source: 'structural',
        matchInfo: { snippet: `Parent of ${entity.name}` },
      });
      tokensAdded += parentTokens;
    }

    return tokensAdded;
  }

  /**
   * Add imported files/modules.
   */
  private async expandImports(
    entity: Entity,
    entityScore: number,
    expanded: Map<string, SearchResult>,
    budget: number
  ): Promise<number> {
    if (budget <= 0) return 0;

    const rels = await this.relationshipStore.getForEntity(entity.id, 'out', {
      types: ['IMPORTS'],
    });

    let tokensAdded = 0;
    for (const rel of rels) {
      if (expanded.has(rel.targetId)) continue;

      const imported = await this.entityStore.get(rel.targetId);
      if (!imported) continue;

      const importTokens = this.estimateTokens(imported);
      if (tokensAdded + importTokens > budget) continue;

      expanded.set(imported.id, {
        entity: imported,
        score: entityScore * 0.3,
        source: 'structural',
        matchInfo: { snippet: `Imported by ${entity.name}` },
      });
      tokensAdded += importTokens;
    }

    return tokensAdded;
  }

  /**
   * Add referenced type definitions.
   */
  private async expandTypes(
    entity: Entity,
    entityScore: number,
    expanded: Map<string, SearchResult>,
    budget: number
  ): Promise<number> {
    if (budget <= 0) return 0;

    const rels = await this.relationshipStore.getForEntity(entity.id, 'out', {
      types: ['USES', 'IMPLEMENTS', 'EXTENDS'],
    });

    let tokensAdded = 0;
    for (const rel of rels) {
      if (expanded.has(rel.targetId)) continue;

      const referenced = await this.entityStore.get(rel.targetId);
      if (!referenced) continue;
      if (!['type', 'interface', 'class'].includes(referenced.type)) continue;

      const refTokens = this.estimateTokens(referenced);
      if (tokensAdded + refTokens > budget) continue;

      expanded.set(referenced.id, {
        entity: referenced,
        score: entityScore * 0.3,
        source: 'structural',
        matchInfo: { snippet: `Type referenced by ${entity.name}` },
      });
      tokensAdded += refTokens;
    }

    return tokensAdded;
  }

  private estimateTokens(entity: Entity): number {
    const contentLength = (entity.content?.length || 0) + (entity.summary?.length || 0);
    return Math.ceil(contentLength / CHARS_PER_TOKEN);
  }
}
