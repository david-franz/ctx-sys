/**
 * Types of relationships between code elements.
 */
export type RelationshipType =
  | 'imports'       // File imports another file/module
  | 'exports'       // File exports to another
  | 'calls'         // Function/method calls another
  | 'extends'       // Class extends another
  | 'implements'    // Class implements interface
  | 'uses'          // Symbol uses another symbol
  | 'defines'       // File defines a symbol
  | 'references'    // Symbol references another
  | 'depends_on';   // General dependency

/**
 * A relationship between two code elements.
 */
export interface Relationship {
  /** Type of relationship */
  type: RelationshipType;
  /** Source element (qualified name or file path) */
  source: string;
  /** Target element (qualified name or file path) */
  target: string;
  /** Additional metadata */
  metadata?: {
    /** Line number where relationship is established */
    line?: number;
    /** Whether target is external (not in project) */
    isExternal?: boolean;
    /** Import specifiers if applicable */
    specifiers?: string[];
  };
}

/**
 * Node in the relationship graph.
 */
export interface GraphNode {
  /** Unique identifier (qualified name or file path) */
  id: string;
  /** Display name */
  name: string;
  /** Node type (file, class, function, etc.) */
  type: string;
  /** File path if applicable */
  filePath?: string;
  /** Number of incoming relationships */
  inDegree: number;
  /** Number of outgoing relationships */
  outDegree: number;
}

/**
 * Relationship graph statistics.
 */
export interface GraphStats {
  /** Total number of nodes */
  nodeCount: number;
  /** Total number of edges (relationships) */
  edgeCount: number;
  /** Nodes with no incoming edges */
  rootNodes: string[];
  /** Nodes with no outgoing edges */
  leafNodes: string[];
  /** Most connected nodes */
  hubs: Array<{ id: string; connections: number }>;
  /** Relationships by type */
  byType: Record<RelationshipType, number>;
}

/**
 * Options for relationship extraction.
 */
export interface ExtractionOptions {
  /** Include internal (same file) relationships */
  includeInternal?: boolean;
  /** Include external (third-party) dependencies */
  includeExternal?: boolean;
  /** Relationship types to extract */
  types?: RelationshipType[];
}
