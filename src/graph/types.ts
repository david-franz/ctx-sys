/**
 * Graph Types
 *
 * Type definitions for graph-based relationship analysis.
 */

export enum RelationshipStrength {
  STRONG = 'strong',
  MODERATE = 'medium',
  WEAK = 'weak'
}

export interface SemanticRelationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  strength: RelationshipStrength;
  confidence: number;
  metadata?: Record<string, any>;
}

// Alias for compatibility
export type Node = GraphNode;
export type Edge = GraphEdge;

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  weight: number;
}

export interface GraphQuery {
  nodeIds?: string[];
  edgeTypes?: string[];
  relationshipTypes?: string[];
  depth?: number;
  limit?: number;
}

export interface SubgraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  // Aliases for test compatibility
  entities: any[];
  relationships: any[];
}

export interface PathResult {
  path: string[];
  paths: PathInfo[];
  length: number;
  cost: number;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

export interface PathInfo {
  nodes: string[];
  edges: string[];
  length: number;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  components: number;
}

export interface TraversalOptions {
  maxDepth?: number;
  direction?: 'forward' | 'backward' | 'both' | 'out' | 'in';
  relationshipTypes?: string[];
  types?: string[];
}

export interface TraversalResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  relationships: any[];
  entityIds: Set<string>;
  depth: number;
  startId?: string;
}

// Re-export Entity and Relationship for compatibility
export interface Entity {
  id: string;
  type: string;
  name: string;
  filePath?: string;
  metadata?: Record<string, any>;
}

export interface Relationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  metadata?: Record<string, any>;
}

export interface ResolvedEntity {
  id: string;
  primaryId: string;
  aliases: string[];
  confidence: number;
  merged?: boolean;
  name?: string;
  type?: string;
}

export interface ResolutionResult {
  resolved: ResolvedEntity[];
  duplicates: DuplicateGroup[];
  mergeCount: number;
  // Properties for single-entity resolution
  entity?: Entity | null;
  matchType?: 'exact' | 'fuzzy' | 'none';
  score?: number;
}

export interface DuplicateGroup {
  primaryId?: string;
  duplicateIds?: string[];
  primary: Entity;
  duplicates: Entity[];
  similarity: number;
  suggestedAction?: 'merge' | 'keep' | 'review';
}

export interface SemanticLink {
  sourceId: string;
  targetId: string;
  similarity: number;
}
