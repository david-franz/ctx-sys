import {
  MarkdownDocument,
  MarkdownSection,
  Requirement,
  RequirementInput
} from './types';
import { generateId } from '../utils/id';

/**
 * Patterns for detecting requirements.
 */
const PATTERNS = {
  userStory: /as a[n]?\s+(.+?),?\s+i want\s+(.+?),?\s+so that\s+(.+)/i,
  must: /\b(must|shall|required|mandatory)\b/i,
  should: /\b(should|recommended|preferably)\b/i,
  could: /\b(could|may|optional|nice to have)\b/i,
  wont: /\b(won't|will not|out of scope|not included)\b/i,
  acceptance: /acceptance criteria|given.+when.+then/i,
  givenWhenThen: /given\s+(.+?)\s+when\s+(.+?)\s+then\s+(.+)/i
};

/**
 * Headings that typically contain requirements.
 */
const REQUIREMENT_HEADINGS = [
  'requirements',
  'features',
  'user stories',
  'functional requirements',
  'non-functional requirements',
  'specifications',
  'constraints',
  'goals',
  'objectives',
  'acceptance criteria',
  'use cases'
];

/**
 * Extracts requirements from markdown documents.
 */
export class RequirementExtractor {
  /**
   * Extract all requirements from a document.
   */
  extractFromDocument(document: MarkdownDocument): Requirement[] {
    const requirements: Requirement[] = [];

    for (const section of document.sections) {
      // Check if this is a requirements section
      if (this.isRequirementSection(section)) {
        const sectionReqs = this.extractFromSection(section, document.filePath);
        requirements.push(...sectionReqs);
      }

      // Also check for inline user stories anywhere
      const userStories = this.extractUserStories(section, document.filePath);
      // Only add user stories that aren't already captured
      for (const story of userStories) {
        if (!requirements.some(r => r.description === story.description)) {
          requirements.push(story);
        }
      }
    }

    return requirements;
  }

  /**
   * Extract requirements from a specific section.
   */
  extractFromSection(section: MarkdownSection, filePath: string): Requirement[] {
    const requirements: Requirement[] = [];
    const lines = section.content.split('\n');

    let currentReq: Partial<Requirement> | null = null;
    let inAcceptanceCriteria = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for list items (potential requirements)
      if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) {
        // Save previous requirement
        if (currentReq?.description) {
          requirements.push(this.finalizeRequirement(currentReq, filePath, section));
        }

        const content = line.replace(/^[-*\d.]+\s*/, '').trim();
        if (!content) continue;

        currentReq = {
          id: generateId(),
          type: this.detectType(content),
          title: this.extractTitle(content),
          description: content,
          priority: this.detectPriority(content),
          acceptanceCriteria: []
        };
        inAcceptanceCriteria = false;
      } else if (currentReq && line) {
        // Check if we're entering acceptance criteria
        if (PATTERNS.acceptance.test(line)) {
          inAcceptanceCriteria = true;
        }

        if (inAcceptanceCriteria) {
          currentReq.acceptanceCriteria?.push(line);
        } else {
          currentReq.description += ' ' + line;
        }
      }
    }

    // Don't forget last requirement
    if (currentReq?.description) {
      requirements.push(this.finalizeRequirement(currentReq, filePath, section));
    }

    return requirements;
  }

  /**
   * Extract user stories using pattern matching.
   */
  extractUserStories(section: MarkdownSection, filePath: string): Requirement[] {
    const requirements: Requirement[] = [];
    const content = section.content;

    // Find all user story patterns
    const regex = new RegExp(PATTERNS.userStory.source, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const [full, role, want, benefit] = match;
      requirements.push({
        id: generateId(),
        type: 'user-story',
        title: `As a ${role.trim()}, I want ${want.trim().slice(0, 40)}...`,
        description: full.trim(),
        source: {
          file: filePath,
          section: section.title,
          line: section.startLine
        }
      });
    }

    return requirements;
  }

  /**
   * Check if a section is likely to contain requirements.
   */
  isRequirementSection(section: MarkdownSection): boolean {
    const titleLower = section.title.toLowerCase();
    return REQUIREMENT_HEADINGS.some(h => titleLower.includes(h));
  }

  /**
   * Detect the type of requirement from its content.
   */
  detectType(content: string): Requirement['type'] {
    const lower = content.toLowerCase();

    if (PATTERNS.userStory.test(content)) {
      return 'user-story';
    }
    if (/constraint|limitation|restriction|must not|cannot/i.test(lower)) {
      return 'constraint';
    }
    if (/feature|capability|ability to|support for/i.test(lower)) {
      return 'feature';
    }
    return 'requirement';
  }

  /**
   * Detect MoSCoW priority from content.
   */
  detectPriority(content: string): Requirement['priority'] | undefined {
    if (PATTERNS.must.test(content)) return 'must';
    if (PATTERNS.should.test(content)) return 'should';
    if (PATTERNS.could.test(content)) return 'could';
    if (PATTERNS.wont.test(content)) return 'wont';
    return undefined;
  }

  /**
   * Extract a short title from content.
   */
  private extractTitle(content: string): string {
    // Remove priority keywords for cleaner title
    let title = content
      .replace(/\b(must|shall|should|could|may|required|mandatory|optional)\b/gi, '')
      .trim();

    // Truncate to reasonable length
    if (title.length > 80) {
      title = title.slice(0, 77) + '...';
    }

    return title || 'Untitled Requirement';
  }

  /**
   * Finalize a partial requirement.
   */
  private finalizeRequirement(
    partial: Partial<Requirement>,
    filePath: string,
    section: MarkdownSection
  ): Requirement {
    return {
      id: partial.id || generateId(),
      type: partial.type || 'requirement',
      title: partial.title || 'Untitled Requirement',
      description: (partial.description || '').trim(),
      priority: partial.priority,
      acceptanceCriteria:
        partial.acceptanceCriteria && partial.acceptanceCriteria.length > 0
          ? partial.acceptanceCriteria
          : undefined,
      source: {
        file: filePath,
        section: section.title,
        line: section.startLine
      }
    };
  }

  /**
   * Create a requirement from input.
   */
  createRequirement(input: RequirementInput): Requirement {
    return {
      id: generateId(),
      type: input.type || 'requirement',
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      acceptanceCriteria: input.acceptanceCriteria,
      source: input.source
    };
  }

  /**
   * Get the patterns used for detection.
   */
  getPatterns(): typeof PATTERNS {
    return { ...PATTERNS };
  }

  /**
   * Get the requirement headings list.
   */
  getRequirementHeadings(): string[] {
    return [...REQUIREMENT_HEADINGS];
  }
}
