import {
  RequirementExtractor,
  MarkdownParser,
  MarkdownSection
} from '../../src';

describe('F4.2 - Requirement Extraction', () => {
  let extractor: RequirementExtractor;
  let parser: MarkdownParser;

  beforeEach(() => {
    extractor = new RequirementExtractor();
    parser = new MarkdownParser();
  });

  describe('isRequirementSection', () => {
    it('should detect requirements section', () => {
      const section = createSection('Requirements');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should detect features section', () => {
      const section = createSection('Features');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should detect user stories section', () => {
      const section = createSection('User Stories');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should detect functional requirements section', () => {
      const section = createSection('Functional Requirements');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should detect non-functional requirements section', () => {
      const section = createSection('Non-Functional Requirements');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should detect constraints section', () => {
      const section = createSection('Constraints');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should detect acceptance criteria section', () => {
      const section = createSection('Acceptance Criteria');
      expect(extractor.isRequirementSection(section)).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(extractor.isRequirementSection(createSection('REQUIREMENTS'))).toBe(true);
      expect(extractor.isRequirementSection(createSection('features'))).toBe(true);
    });

    it('should return false for non-requirement sections', () => {
      expect(extractor.isRequirementSection(createSection('Introduction'))).toBe(false);
      expect(extractor.isRequirementSection(createSection('Setup'))).toBe(false);
      expect(extractor.isRequirementSection(createSection('Architecture'))).toBe(false);
    });
  });

  describe('detectPriority', () => {
    it('should detect must priority', () => {
      expect(extractor.detectPriority('The system must validate input')).toBe('must');
      expect(extractor.detectPriority('This shall be implemented')).toBe('must');
      expect(extractor.detectPriority('Required feature: authentication')).toBe('must');
      expect(extractor.detectPriority('Mandatory logging')).toBe('must');
    });

    it('should detect should priority', () => {
      expect(extractor.detectPriority('The system should cache responses')).toBe('should');
      expect(extractor.detectPriority('Recommended to use HTTPS')).toBe('should');
      expect(extractor.detectPriority('Preferably use PostgreSQL')).toBe('should');
    });

    it('should detect could priority', () => {
      expect(extractor.detectPriority('The system could support dark mode')).toBe('could');
      expect(extractor.detectPriority('May include export feature')).toBe('could');
      expect(extractor.detectPriority('Optional: email notifications')).toBe('could');
      expect(extractor.detectPriority('Nice to have: themes')).toBe('could');
    });

    it('should detect wont priority', () => {
      expect(extractor.detectPriority("We won't implement mobile app")).toBe('wont');
      expect(extractor.detectPriority('Will not support IE11')).toBe('wont');
      expect(extractor.detectPriority('Out of scope: internationalization')).toBe('wont');
      expect(extractor.detectPriority('Not included: analytics')).toBe('wont');
    });

    it('should return undefined for no priority keywords', () => {
      expect(extractor.detectPriority('Add user authentication')).toBeUndefined();
      expect(extractor.detectPriority('Implement caching layer')).toBeUndefined();
    });
  });

  describe('detectType', () => {
    it('should detect user story type', () => {
      expect(extractor.detectType('As a user, I want to login so that I can access my account')).toBe('user-story');
    });

    it('should detect constraint type', () => {
      expect(extractor.detectType('Constraint: response time under 100ms')).toBe('constraint');
      expect(extractor.detectType('Limitation: max 1000 concurrent users')).toBe('constraint');
      expect(extractor.detectType('Must not expose internal IPs')).toBe('constraint');
      expect(extractor.detectType('Cannot modify existing API')).toBe('constraint');
    });

    it('should detect feature type', () => {
      expect(extractor.detectType('Feature: user dashboard')).toBe('feature');
      expect(extractor.detectType('Capability to export data')).toBe('feature');
      expect(extractor.detectType('Ability to import users')).toBe('feature');
      expect(extractor.detectType('Support for WebSockets')).toBe('feature');
    });

    it('should default to requirement type', () => {
      expect(extractor.detectType('Validate all form inputs')).toBe('requirement');
      expect(extractor.detectType('Log all API requests')).toBe('requirement');
    });
  });

  describe('extractUserStories', () => {
    it('should extract user story with full pattern', () => {
      const section = createSection('Stories', 'As a developer, I want to run tests so that I can verify my code.');
      const stories = extractor.extractUserStories(section, 'test.md');

      expect(stories.length).toBe(1);
      expect(stories[0].type).toBe('user-story');
      expect(stories[0].description).toContain('As a developer');
      expect(stories[0].description).toContain('I want to run tests');
      expect(stories[0].description).toContain('so that I can verify my code');
    });

    it('should extract multiple user stories from one section', () => {
      const content = `
As a user, I want to login so that I can access my account.

As an admin, I want to manage users so that I can control access.

As a guest, I want to browse products so that I can decide what to buy.
`;
      const section = createSection('Stories', content);
      const stories = extractor.extractUserStories(section, 'test.md');

      expect(stories.length).toBe(3);
      expect(stories[0].description).toContain('user');
      expect(stories[1].description).toContain('admin');
      expect(stories[2].description).toContain('guest');
    });

    it('should handle "as an" variation', () => {
      const section = createSection('Stories', 'As an administrator, I want to view logs so that I can debug issues.');
      const stories = extractor.extractUserStories(section, 'test.md');

      expect(stories.length).toBe(1);
      expect(stories[0].description).toContain('administrator');
    });

    it('should include source information', () => {
      const section = createSection('User Stories', 'As a user, I want to logout so that I can secure my session.');
      section.startLine = 10;
      const stories = extractor.extractUserStories(section, 'docs/requirements.md');

      expect(stories[0].source.file).toBe('docs/requirements.md');
      expect(stories[0].source.section).toBe('User Stories');
      expect(stories[0].source.line).toBe(10);
    });
  });

  describe('extractFromSection', () => {
    it('should extract requirements from list items', () => {
      const content = `
- The system must authenticate users
- Users should be able to reset passwords
- Admin could view audit logs
`;
      const section = createSection('Requirements', content);
      const reqs = extractor.extractFromSection(section, 'test.md');

      expect(reqs.length).toBe(3);
      expect(reqs[0].priority).toBe('must');
      expect(reqs[1].priority).toBe('should');
      expect(reqs[2].priority).toBe('could');
    });

    it('should extract requirements from numbered list', () => {
      const content = `
1. Implement user authentication
2. Add password recovery
3. Enable two-factor auth
`;
      const section = createSection('Requirements', content);
      const reqs = extractor.extractFromSection(section, 'test.md');

      expect(reqs.length).toBe(3);
    });

    it('should handle asterisk list markers', () => {
      const content = `
* First requirement
* Second requirement
`;
      const section = createSection('Requirements', content);
      const reqs = extractor.extractFromSection(section, 'test.md');

      expect(reqs.length).toBe(2);
    });

    it('should include source information in requirements', () => {
      const content = '- Must validate input';
      const section = createSection('Constraints', content);
      section.startLine = 25;
      const reqs = extractor.extractFromSection(section, 'specs.md');

      expect(reqs[0].source.file).toBe('specs.md');
      expect(reqs[0].source.section).toBe('Constraints');
    });

    it('should generate unique IDs for requirements', () => {
      const content = '- Req one\n- Req two\n- Req three';
      const section = createSection('Requirements', content);
      const reqs = extractor.extractFromSection(section, 'test.md');

      const ids = reqs.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('extractFromDocument', () => {
    it('should extract requirements from all requirement sections', () => {
      const content = `
# Project Spec

## Requirements

- Must have authentication
- Should support OAuth

## Features

- Dashboard feature
- Reporting feature

## Other Section

This is not a requirement section.
`;
      const doc = parser.parseContent(content, 'spec.md');
      const reqs = extractor.extractFromDocument(doc);

      expect(reqs.length).toBe(4);
    });

    it('should extract user stories from any section', () => {
      const content = `
# Overview

As a user, I want to see a dashboard so that I can monitor my data.

## Details

More details here.
`;
      const doc = parser.parseContent(content, 'spec.md');
      const reqs = extractor.extractFromDocument(doc);

      expect(reqs.length).toBe(1);
      expect(reqs[0].type).toBe('user-story');
    });

    it('should not duplicate user stories found in requirement sections', () => {
      const content = `
## User Stories

As a user, I want to login so that I can access my account.
`;
      const doc = parser.parseContent(content, 'spec.md');
      const reqs = extractor.extractFromDocument(doc);

      // Should only appear once, not duplicated
      const loginStories = reqs.filter(r => r.description.includes('login'));
      expect(loginStories.length).toBe(1);
    });

    it('should handle document with no requirements', () => {
      const content = `
# README

Just some documentation here.

## Installation

Run npm install.
`;
      const doc = parser.parseContent(content, 'readme.md');
      const reqs = extractor.extractFromDocument(doc);

      expect(reqs.length).toBe(0);
    });
  });

  describe('createRequirement', () => {
    it('should create requirement with all fields', () => {
      const req = extractor.createRequirement({
        type: 'feature',
        title: 'User Dashboard',
        description: 'A dashboard for users to view their data',
        priority: 'must',
        status: 'proposed',
        acceptanceCriteria: ['Shows user stats', 'Updates in real-time'],
        source: { file: 'spec.md', section: 'Features', line: 10 }
      });

      expect(req.id).toBeDefined();
      expect(req.type).toBe('feature');
      expect(req.title).toBe('User Dashboard');
      expect(req.description).toBe('A dashboard for users to view their data');
      expect(req.priority).toBe('must');
      expect(req.status).toBe('proposed');
      expect(req.acceptanceCriteria).toEqual(['Shows user stats', 'Updates in real-time']);
      expect(req.source.file).toBe('spec.md');
    });

    it('should create requirement with minimal fields', () => {
      const req = extractor.createRequirement({
        title: 'Simple Requirement',
        description: 'A basic requirement',
        source: { file: 'test.md' }
      });

      expect(req.id).toBeDefined();
      expect(req.type).toBe('requirement');
      expect(req.title).toBe('Simple Requirement');
      expect(req.priority).toBeUndefined();
      expect(req.status).toBeUndefined();
    });
  });

  describe('getPatterns', () => {
    it('should return all detection patterns', () => {
      const patterns = extractor.getPatterns();

      expect(patterns.userStory).toBeInstanceOf(RegExp);
      expect(patterns.must).toBeInstanceOf(RegExp);
      expect(patterns.should).toBeInstanceOf(RegExp);
      expect(patterns.could).toBeInstanceOf(RegExp);
      expect(patterns.wont).toBeInstanceOf(RegExp);
      expect(patterns.acceptance).toBeInstanceOf(RegExp);
    });
  });

  describe('getRequirementHeadings', () => {
    it('should return list of requirement headings', () => {
      const headings = extractor.getRequirementHeadings();

      expect(headings).toContain('requirements');
      expect(headings).toContain('features');
      expect(headings).toContain('user stories');
      expect(headings).toContain('constraints');
      expect(Array.isArray(headings)).toBe(true);
    });
  });
});

/**
 * Helper to create a test section.
 */
function createSection(title: string, content: string = ''): MarkdownSection {
  return {
    id: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    level: 2,
    content,
    codeBlocks: [],
    links: [],
    children: [],
    startLine: 1,
    endLine: 10
  };
}
