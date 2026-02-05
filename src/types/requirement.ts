/**
 * Phase 4: Requirement Types
 * Type definitions for requirements extraction
 */

export interface Requirement {
  id: string;
  type: RequirementType;
  description: string;
  priority: RequirementPriority;
  source: RequirementSource;
  relatedEntities?: string[];
}

export type RequirementType = 'requirement' | 'user-story' | 'acceptance-criteria';

export type RequirementPriority = 'must' | 'should' | 'could' | 'wont';

export interface RequirementSource {
  file: string;
  section?: string;
  line?: number;
}
