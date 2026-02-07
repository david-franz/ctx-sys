import { Entity } from '../entities';

/**
 * Types of relationships that can exist in the graph.
 */
export type GraphRelationshipType =
  | 'CONTAINS'      // File/Module contains entity
  | 'CALLS'         // Function/method calls another
  | 'IMPORTS'       // File imports another
  | 'IMPLEMENTS'    // Class implements interface
  | 'EXTENDS'       // Class extends another
  | 'MENTIONS'      // Document/Message mentions entity
  | 'RELATES_TO'    // Semantic relationship
  | 'DEPENDS_ON'    // General dependency
  | 'DEFINED_IN'    // Requirement defined in document
  | 'USES'          // Symbol uses another
  | 'REFERENCES'    // Generic reference
  | 'DOCUMENTS'     // Documentation describes code entity
  | 'CONFIGURES'    // Config file configures a component
  | 'TESTS';        // Test file tests a component

/**
 * A stored relationship between two entities.
 */
export interface StoredRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: GraphRelationshipType;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Input for creating a relationship.
 */
export interface RelationshipInput {
  sourceId: string;
  targetId: string;
  relationship: GraphRelationshipType;
  weight?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Database row for relationships.
 */
export interface RelationshipRow {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  weight: number;
  metadata: string;
  created_at: string;
}

/**
 * Options for relationship queries.
 */
export interface RelationshipQueryOptions {
  types?: GraphRelationshipType[];
  minWeight?: number;
  limit?: number;
}

/**
 * Result of a subgraph extraction.
 */
export interface SubgraphResult {
  entities: Entity[];
  relationships: Array<{
    source: string;
    target: string;
    type: GraphRelationshipType;
    weight: number;
  }>;
}

/**
 * A path between two entities.
 */
export interface PathInfo {
  nodes: string[];
  edges: GraphRelationshipType[];
  totalWeight: number;
  length: number;
}

/**
 * Result of path finding.
 */
export interface PathResult {
  paths: PathInfo[];
  found: boolean;
}

/**
 * Statistics about the graph.
 */
export interface GraphStatistics {
  entityCount: number;
  relationshipCount: number;
  averageDegree: number;
  relationshipsByType: Record<string, number>;
  topConnectedEntities: Array<{ entityId: string; connections: number }>;
}

/**
 * Options for traversal operations.
 */
export interface TraversalOptions {
  maxDepth?: number;
  types?: GraphRelationshipType[];
  direction?: 'out' | 'in' | 'both';
  minWeight?: number;
}
