/**
 * F4.2 Requirement Extraction Tests
 *
 * Tests for requirement extraction from documents:
 * - RequirementExtractor operations
 * - User story pattern detection
 * - MoSCoW priority detection
 * - Acceptance criteria extraction
 * - Entity storage for requirements
 *
 * @see docs/phase-4/F4.2-requirement-extraction.md
 *
 * NOTE: These tests will fail until the following implementations are created:
 * - src/documents/requirements.ts (RequirementExtractor class)
 * - src/documents/types.ts (Requirement, RequirementType, RequirementPriority, RequirementStatus types)
 * - src/documents/markdown-parser.ts (MarkdownParser class)
 * - src/database/entity-store.ts (EntityStore class)
 */

import { RequirementExtractor } from '../../src/documents/requirements';
import {
  Requirement,
  RequirementType,
  RequirementPriority,
  RequirementStatus,
  MarkdownSection
} from '../../src/documents/types';
import { MarkdownParser } from '../../src/documents/markdown-parser';
import { EntityStore } from '../../src/db/entity-store';

// Mock dependencies
jest.mock('../../src/documents/markdown-parser');
jest.mock('../../src/entities/store');

const MockedMarkdownParser = MarkdownParser as jest.MockedClass<typeof MarkdownParser>;
const MockedEntityStore = EntityStore as jest.MockedClass<typeof EntityStore>;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSection(overrides: Partial<MarkdownSection> = {}): MarkdownSection {
  return {
    id: `section_${Math.random().toString(36).slice(2, 11)}`,
    title: 'Test Section',
    level: 2,
    content: 'Test content.',
    startLine: 1,
    endLine: 10,
    ...overrides
  };
}

function createMockRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    id: `req_${Math.random().toString(36).slice(2, 11)}`,
    type: 'requirement',
    title: 'Test Requirement',
    description: 'This is a test requirement.',
    priority: undefined,
    status: undefined,
    acceptanceCriteria: undefined,
    source: {
      file: 'docs/requirements.md',
      section: 'Requirements',
      line: 10
    },
    ...overrides
  };
}

describe('F4.2 Requirement Extraction', () => {
  let mockMarkdownParser: jest.Mocked<MarkdownParser>;
  let mockEntityStore: jest.Mocked<EntityStore>;
  let requirementExtractor: RequirementExtractor;

  const projectId = 'proj_123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockMarkdownParser = new MockedMarkdownParser() as jest.Mocked<MarkdownParser>;
    mockEntityStore = new MockedEntityStore(projectId) as jest.Mocked<EntityStore>;

    // Create real RequirementExtractor instance with mocked dependencies
    requirementExtractor = new RequirementExtractor({
      markdownParser: mockMarkdownParser,
      entityStore: mockEntityStore,
      projectId
    });
  });

  // ============================================================================
  // Requirement Interface Tests
  // ============================================================================

  describe('Requirement Interface', () => {
    it('should have all required fields', () => {
      const req = createMockRequirement();

      expect(req).toHaveProperty('id');
      expect(req).toHaveProperty('type');
      expect(req).toHaveProperty('title');
      expect(req).toHaveProperty('description');
      expect(req).toHaveProperty('source');
    });

    it('should support all requirement types', () => {
      const types: RequirementType[] = ['requirement', 'feature', 'user-story', 'constraint'];

      types.forEach(type => {
        const req = createMockRequirement({ type });
        expect(req.type).toBe(type);
      });
    });

    it('should support MoSCoW priority levels', () => {
      const priorities: RequirementPriority[] = ['must', 'should', 'could', 'wont'];

      priorities.forEach(priority => {
        const req = createMockRequirement({ priority });
        expect(req.priority).toBe(priority);
      });
    });

    it('should support all status values', () => {
      const statuses: RequirementStatus[] = ['proposed', 'accepted', 'implemented', 'deprecated'];

      statuses.forEach(status => {
        const req = createMockRequirement({ status });
        expect(req.status).toBe(status);
      });
    });

    it('should have source information', () => {
      const req = createMockRequirement({
        source: {
          file: 'docs/spec.md',
          section: 'Functional Requirements',
          line: 42
        }
      });

      expect(req.source.file).toBe('docs/spec.md');
      expect(req.source.section).toBe('Functional Requirements');
      expect(req.source.line).toBe(42);
    });
  });

  // ============================================================================
  // Requirement Section Detection Tests
  // ============================================================================

  describe('Requirement Section Detection', () => {
    it('should identify requirements sections by title', () => {
      const sections = [
        createMockSection({ title: 'Requirements' }),
        createMockSection({ title: 'Functional Requirements' }),
        createMockSection({ title: 'User Stories' }),
        createMockSection({ title: 'Features' }),
        createMockSection({ title: 'Specifications' })
      ];

      mockMarkdownParser.parseSections.mockReturnValue(sections);

      sections.forEach(section => {
        const isReqSection = requirementExtractor.isRequirementSection(section);
        expect(isReqSection).toBe(true);
      });
    });

    it('should not match unrelated sections', () => {
      const sections = [
        createMockSection({ title: 'Installation' }),
        createMockSection({ title: 'Getting Started' }),
        createMockSection({ title: 'API Reference' })
      ];

      sections.forEach(section => {
        const isReqSection = requirementExtractor.isRequirementSection(section);
        expect(isReqSection).toBe(false);
      });
    });
  });

  // ============================================================================
  // User Story Pattern Tests
  // ============================================================================

  describe('User Story Pattern Detection', () => {
    it('should match standard user story format', () => {
      const story = 'As a user, I want to log in, so that I can access my account.';
      const result = requirementExtractor.parseUserStory(story);

      expect(result).not.toBeNull();
      expect(result?.role).toBe('user');
      expect(result?.want).toBe('to log in');
      expect(result?.benefit).toBe('I can access my account.');
    });

    it('should match "As an" variant', () => {
      const story = 'As an admin, I want to manage users, so that I can control access.';
      const result = requirementExtractor.parseUserStory(story);

      expect(result).not.toBeNull();
      expect(result?.role).toBe('admin');
    });

    it('should match without comma separators', () => {
      const story = 'As a developer I want better tooling so that I can be more productive.';
      const result = requirementExtractor.parseUserStory(story);

      expect(result).not.toBeNull();
    });

    it('should not match non-user-story text', () => {
      const texts = [
        'The system should validate inputs.',
        'Users can log in using OAuth.',
        'Authentication is required.'
      ];

      texts.forEach(text => {
        const result = requirementExtractor.parseUserStory(text);
        expect(result).toBeNull();
      });
    });

    it('should extract user story components as requirement', () => {
      const story = 'As a project manager, I want to view team progress, so that I can track deliverables.';

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({ title: 'User Stories', content: story })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/stories.md', story);

      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements[0].type).toBe('user-story');
      expect(requirements[0].title).toContain('project manager');
    });
  });

  // ============================================================================
  // MoSCoW Priority Detection Tests
  // ============================================================================

  describe('MoSCoW Priority Detection', () => {
    it('should detect MUST priority', () => {
      const texts = [
        'The system must authenticate users.',
        'This shall be completed by release.',
        'JWT tokens are required.'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.detectPriority(text)).toBe('must');
      });
    });

    it('should detect SHOULD priority', () => {
      const texts = [
        'The UI should be responsive.',
        'Caching is recommended for performance.'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.detectPriority(text)).toBe('should');
      });
    });

    it('should detect COULD priority', () => {
      const texts = [
        'Dark mode could be added later.',
        'Users may customize themes.',
        'This is an optional feature.'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.detectPriority(text)).toBe('could');
      });
    });

    it('should detect WONT priority', () => {
      const texts = [
        "We won't support IE11.",
        'This will not be included in v1.',
        'Mobile app is out of scope.'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.detectPriority(text)).toBe('wont');
      });
    });

    it('should return undefined for no priority markers', () => {
      const text = 'The system provides user authentication.';
      expect(requirementExtractor.detectPriority(text)).toBeUndefined();
    });
  });

  // ============================================================================
  // Requirement Type Detection Tests
  // ============================================================================

  describe('Requirement Type Detection', () => {
    it('should detect user stories', () => {
      const text = 'As a user, I want to log in, so that I can access features.';
      expect(requirementExtractor.detectType(text)).toBe('user-story');
    });

    it('should detect constraints', () => {
      const texts = [
        'Constraint: The API must respond within 200ms.',
        'Limitation: Only 100 concurrent users.',
        'Restriction: No third-party cookies.'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.detectType(text)).toBe('constraint');
      });
    });

    it('should detect features', () => {
      const texts = [
        'Feature: Dark mode support',
        'Capability: Export to PDF'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.detectType(text)).toBe('feature');
      });
    });

    it('should default to requirement', () => {
      const text = 'The system validates user input.';
      expect(requirementExtractor.detectType(text)).toBe('requirement');
    });
  });

  // ============================================================================
  // Acceptance Criteria Extraction Tests
  // ============================================================================

  describe('Acceptance Criteria Extraction', () => {
    it('should detect acceptance criteria sections', () => {
      const texts = [
        'Acceptance Criteria:',
        'Given a user is logged in, When they click logout, Then they are logged out.'
      ];

      texts.forEach(text => {
        expect(requirementExtractor.hasAcceptanceCriteria(text)).toBe(true);
      });
    });

    it('should extract Given-When-Then criteria', () => {
      const content = `
        Given a user is on the login page
        When they enter valid credentials
        Then they are redirected to the dashboard
      `;

      const criteria = requirementExtractor.extractAcceptanceCriteria(content);
      expect(criteria.length).toBeGreaterThan(0);
    });

    it('should parse multiple acceptance criteria', () => {
      const content = `
        Acceptance Criteria:
        - Given user is logged in, When they view profile, Then they see their details.
        - Given user is logged out, When they access protected route, Then they are redirected to login.
      `;

      const criteria = requirementExtractor.extractAcceptanceCriteria(content);
      expect(criteria).toHaveLength(2);
    });
  });

  // ============================================================================
  // RequirementExtractor.extractFromDocument() Tests
  // ============================================================================

  describe('RequirementExtractor.extractFromDocument()', () => {
    it('should extract requirements from requirements section', () => {
      const content = `
# Requirements

- The system must authenticate users
- Users should be able to reset passwords
- Dark mode could be added in future
`;

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content: `- The system must authenticate users
- Users should be able to reset passwords
- Dark mode could be added in future`
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/spec.md', content);

      expect(requirements).toHaveLength(3);
      expect(requirements[0].priority).toBe('must');
      expect(requirements[1].priority).toBe('should');
      expect(requirements[2].priority).toBe('could');
    });

    it('should extract user stories from any section', () => {
      const content = 'As a developer, I want clear documentation, so that I can integrate quickly.';

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Overview',
          content
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/overview.md', content);

      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements[0].type).toBe('user-story');
    });

    it('should handle numbered lists', () => {
      const content = `
# Requirements

1. First requirement
2. Second requirement
3. Third requirement
`;

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content: `1. First requirement
2. Second requirement
3. Third requirement`
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/spec.md', content);

      expect(requirements).toHaveLength(3);
    });

    it('should handle bullet point lists', () => {
      const content = `
# Features

- Feature A
* Feature B
- Feature C
`;

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Features',
          content: `- Feature A
* Feature B
- Feature C`
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/features.md', content);

      expect(requirements).toHaveLength(3);
    });
  });

  // ============================================================================
  // RequirementExtractor.storeRequirement() Tests
  // ============================================================================

  describe('RequirementExtractor.storeRequirement()', () => {
    it('should store requirement as entity', async () => {
      const req = createMockRequirement({
        title: 'Authentication Required',
        description: 'The system must authenticate all API requests.'
      });

      mockEntityStore.store.mockResolvedValue(req.id);

      const entityId = await requirementExtractor.storeRequirement(req);

      expect(mockEntityStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          type: req.type,
          name: req.title,
          content: req.description,
          filePath: req.source.file
        })
      );
      expect(entityId).toBe(req.id);
    });

    it('should use qualified name from file and title', async () => {
      const req = createMockRequirement({
        title: 'User Login',
        source: { file: 'docs/auth.md' }
      });

      mockEntityStore.store.mockResolvedValue(req.id);

      await requirementExtractor.storeRequirement(req);

      expect(mockEntityStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          qualifiedName: 'docs/auth.md::User Login'
        })
      );
    });

    it('should truncate long descriptions for summary', async () => {
      const longDescription = 'x'.repeat(500);
      const req = createMockRequirement({
        description: longDescription
      });

      mockEntityStore.store.mockResolvedValue(req.id);

      await requirementExtractor.storeRequirement(req);

      expect(mockEntityStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.stringMatching(/^x{200}/)
        })
      );
    });

    it('should include priority and acceptance criteria in metadata', async () => {
      const req = createMockRequirement({
        priority: 'must',
        acceptanceCriteria: ['Given X, When Y, Then Z']
      });

      mockEntityStore.store.mockResolvedValue(req.id);

      await requirementExtractor.storeRequirement(req);

      expect(mockEntityStore.store).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            priority: 'must',
            acceptanceCriteria: ['Given X, When Y, Then Z']
          })
        })
      );
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty requirements section', () => {
      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content: ''
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/empty.md', '');
      expect(requirements).toHaveLength(0);
    });

    it('should handle requirements with special characters', () => {
      const content = 'Support UTF-8: emojis and symbols <>&"\'';

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content: `- ${content}`
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/special.md', content);

      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements[0].description).toContain('<>&');
    });

    it('should handle very long requirements', () => {
      const longDescription = 'This requirement ' + 'covers many things '.repeat(50);

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content: `- ${longDescription}`
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/long.md', longDescription);

      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements[0].title.length).toBeLessThanOrEqual(80);
    });

    it('should handle requirements without priority', () => {
      const content = 'The system provides logging.';

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content: `- ${content}`
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/nopriority.md', content);

      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements[0].priority).toBeUndefined();
    });

    it('should handle malformed user stories', () => {
      const malformed = [
        'As a user',  // Incomplete
        'I want features',  // Missing role
        'So that I can do things'  // Missing want
      ];

      malformed.forEach(text => {
        const result = requirementExtractor.parseUserStory(text);
        expect(result).toBeNull();
      });
    });

    it('should handle nested requirements', () => {
      const content = `
- Parent requirement
  - Child requirement 1
  - Child requirement 2
`;

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Requirements',
          content
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/nested.md', content);

      // Should extract both parent and child requirements
      expect(requirements.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // Complex Document Tests
  // ============================================================================

  describe('Complex Documents', () => {
    it('should extract requirements from multiple sections', () => {
      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({ title: 'Functional Requirements', content: '- Req 1\n- Req 2' }),
        createMockSection({ title: 'Non-Functional Requirements', content: '- NFR 1' }),
        createMockSection({ title: 'User Stories', content: 'As a user, I want X, so that Y.' })
      ]);

      const content = `
# Functional Requirements
- Req 1
- Req 2

# Non-Functional Requirements
- NFR 1

# User Stories
As a user, I want X, so that Y.
`;

      const requirements = requirementExtractor.extractFromDocument('docs/multi.md', content);

      expect(requirements.length).toBe(4);
    });

    it('should preserve requirement source information', () => {
      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Authentication',
          content: '- Users must authenticate',
          startLine: 42,
          endLine: 50
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/spec.md', '');

      expect(requirements.length).toBeGreaterThan(0);
      expect(requirements[0].source.file).toBe('docs/spec.md');
      expect(requirements[0].source.section).toBe('Authentication');
      expect(requirements[0].source.line).toBe(42);
    });

    it('should handle mixed content types', () => {
      const content = `
## Feature: Authentication

As a user, I want to log in securely, so that my data is protected.

Requirements:
- The system must use HTTPS
- Passwords should be hashed

Acceptance Criteria:
Given valid credentials, When user logs in, Then they are authenticated.
`;

      mockMarkdownParser.parseSections.mockReturnValue([
        createMockSection({
          title: 'Feature: Authentication',
          content
        })
      ]);

      const requirements = requirementExtractor.extractFromDocument('docs/auth.md', content);

      // Should extract user story, individual requirements, and associate acceptance criteria
      expect(requirements.length).toBeGreaterThanOrEqual(1);

      const userStory = requirements.find((r: Requirement) => r.type === 'user-story');
      expect(userStory).toBeDefined();
    });

    it('should batch store multiple requirements', async () => {
      const requirements = [
        createMockRequirement({ id: 'req_1', title: 'Requirement 1' }),
        createMockRequirement({ id: 'req_2', title: 'Requirement 2' }),
        createMockRequirement({ id: 'req_3', title: 'Requirement 3' })
      ];

      mockEntityStore.storeBatch.mockResolvedValue(['req_1', 'req_2', 'req_3']);

      const ids = await requirementExtractor.storeRequirements(requirements);

      expect(mockEntityStore.storeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Requirement 1' }),
          expect.objectContaining({ name: 'Requirement 2' }),
          expect.objectContaining({ name: 'Requirement 3' })
        ])
      );
      expect(ids).toHaveLength(3);
    });
  });
});
