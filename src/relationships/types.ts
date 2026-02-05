/**
 * Relationship Types
 *
 * Defines types for entity relationships in the context management system.
 */

export enum RelationshipType {
  CALLS = 'calls',
  CALLED_BY = 'called_by',
  IMPORTS = 'imports',
  IMPORTED_BY = 'imported_by',
  EXTENDS = 'extends',
  EXTENDED_BY = 'extended_by',
  IMPLEMENTS = 'implements',
  IMPLEMENTED_BY = 'implemented_by',
  USES = 'uses',
  USED_BY = 'used_by',
  CONTAINS = 'contains',
  CONTAINED_BY = 'contained_by',
  REFERENCES = 'references',
  REFERENCED_BY = 'referenced_by',
  DEFINES = 'defines',
  DEFINED_IN = 'defined_in',
  DEPENDS_ON = 'depends_on',
  DEPENDENCY_OF = 'dependency_of',
  USES_TYPE = 'uses_type',
  EXPORTS = 'exports',
  INSTANTIATES = 'instantiates',
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  weight?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRelationshipInput {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  metadata?: Record<string, any>;
}

export interface RelationshipFilter {
  sourceId?: string;
  targetId?: string;
  type?: RelationshipType | RelationshipType[];
  entityId?: string; // Either source or target
}

export interface RelationshipQuery extends RelationshipFilter {
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
}
