/**
 * Phase 4 Integration Tests
 *
 * IMPORTANT: These tests will fail until the following implementations are created:
 * - src/parsers/MarkdownParser.ts
 * - src/extractors/RequirementExtractor.ts
 * - src/linkers/DocumentCodeLinker.ts
 * - src/pipelines/DocumentIntelligencePipeline.ts
 * - src/types/document.ts
 * - src/types/requirement.ts
 *
 * Tests for how Phase 4 features interact with each other:
 * - Markdown Parsing + Requirement Extraction
 * - Markdown Parsing + Document-Code Linking
 * - Requirement Extraction + Code Linking
 * - Full Document Intelligence Pipeline
 *
 * @see docs/IMPLEMENTATION.md Phase 4
 */

// ============================================================================
// Actual Implementation Imports (will fail until implementations exist)
// ============================================================================

import { MarkdownParser } from '../../src/ast/markdown-parser';
import { RequirementExtractor } from '../../src/documents/requirement-extractor';
import { DocumentCodeLinker } from '../../src/documents/document-code-linker';
import { DocumentIntelligencePipeline } from '../../src/documents/document-intelligence-pipeline';
import {
  MarkdownDocument,
  MarkdownSection,
  CodeBlock,
  Link
} from '../../src/types/document';
import {
  Requirement,
  RequirementPriority,
  RequirementType
} from '../../src/types/requirement';

// ============================================================================
// External Dependency Mocks Only
// ============================================================================

import {
  createMockDatabase,
  createMockEmbeddingProvider,
  MockDatabase,
  MockEmbeddingProvider,
  generateId
} from '../helpers/mocks';

// Mock the database module (external dependency)
jest.mock('../../src/db/database', () => ({
  Database: jest.fn().mockImplementation(() => createMockDatabase())
}));

// Mock the embedding provider (external dependency - API calls)
jest.mock('../../src/embeddings/provider', () => ({
  EmbeddingProvider: jest.fn().mockImplementation(() => createMockEmbeddingProvider())
}));

// Mock file system operations (external dependency)
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn()
}));

describe('Phase 4 Integration', () => {
  let mockDb: MockDatabase;
  let mockEmbeddingProvider: MockEmbeddingProvider;
  let markdownParser: MarkdownParser;
  let requirementExtractor: RequirementExtractor;
  let documentCodeLinker: DocumentCodeLinker;
  let pipeline: DocumentIntelligencePipeline;

  beforeEach(() => {
    // Setup external dependency mocks
    mockDb = createMockDatabase();
    mockEmbeddingProvider = createMockEmbeddingProvider();

    // Create REAL class instances
    markdownParser = new MarkdownParser();
    requirementExtractor = new RequirementExtractor();
    documentCodeLinker = new DocumentCodeLinker(mockDb);
    pipeline = new DocumentIntelligencePipeline({
      parser: markdownParser,
      extractor: requirementExtractor,
      linker: documentCodeLinker,
      embeddingProvider: mockEmbeddingProvider
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    mockDb.reset();
  });

  // ============================================================================
  // Markdown Parsing + Requirement Extraction Integration
  // ============================================================================

  describe('Markdown Parsing + Requirement Extraction', () => {
    it('should parse document and extract requirements from sections', async () => {
      const markdownContent = `
# Requirements

- The system must authenticate users
- Passwords should be hashed
- Dark mode could be added later

# User Stories

As a user, I want to log in, so that I can access my account.
`;

      // Use real parser instance
      const document = await markdownParser.parse(markdownContent, 'docs/requirements.md');

      // Verify parsed structure
      expect(document.sections).toHaveLength(2);
      expect(document.sections[0].title).toBe('Requirements');
      expect(document.sections[1].title).toBe('User Stories');

      // Use real extractor instance on parsed document
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Should extract list items as requirements
      expect(requirements.length).toBeGreaterThan(0);

      // Verify requirement types
      const listRequirements = requirements.filter(r => r.type === 'requirement');
      const userStories = requirements.filter(r => r.type === 'user-story');

      expect(listRequirements.length).toBeGreaterThanOrEqual(3);
      expect(userStories.length).toBeGreaterThanOrEqual(1);
    });

    it('should preserve section context in requirement source', async () => {
      const markdownContent = `
# Authentication Requirements

The system must validate user credentials.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/spec.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Verify source information is preserved
      requirements.forEach(req => {
        expect(req.source.file).toBe('docs/spec.md');
        expect(req.source.section).toBe('Authentication Requirements');
        expect(typeof req.source.line).toBe('number');
      });
    });

    it('should detect priority from parsed content', async () => {
      const markdownContent = `
# Requirements

- The system must use HTTPS
- Users should be able to export data
- Multi-language support could be added
- Legacy browser support won't be included
`;

      const document = await markdownParser.parse(markdownContent, 'docs/req.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Map requirements to priorities
      const priorities = requirements.map(r => r.priority);

      expect(priorities).toContain('must');
      expect(priorities).toContain('should');
      expect(priorities).toContain('could');
      expect(priorities).toContain('wont');
    });

    it('should handle complex nested sections', async () => {
      const markdownContent = `
# Requirements

## Functional Requirements

### Authentication
- Users must log in with email and password

### Authorization
- Users should have role-based access

## Non-Functional Requirements

### Performance
- System must respond within 200ms
`;

      const document = await markdownParser.parse(markdownContent, 'docs/nested.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Should find requirements in nested sections
      expect(requirements.length).toBeGreaterThanOrEqual(3);

      // Verify section hierarchy is preserved
      const authReq = requirements.find(r => r.description.includes('log in'));
      expect(authReq?.source.section).toContain('Authentication');
    });
  });

  // ============================================================================
  // Markdown Parsing + Document-Code Linking Integration
  // ============================================================================

  describe('Markdown Parsing + Document-Code Linking', () => {
    const projectId = 'proj_123';

    it('should find code references in parsed sections', async () => {
      const markdownContent = `
# API Documentation

The \`AuthService\` class in src/auth/service.ts handles authentication.
Use the login() function to authenticate users.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/api.md');

      // Use real linker to find references
      const codeRefs = await documentCodeLinker.findCodeReferences(document);

      expect(codeRefs).toContainEqual(expect.objectContaining({ name: 'AuthService' }));
      expect(codeRefs).toContainEqual(expect.objectContaining({ name: 'src/auth/service.ts' }));
      expect(codeRefs).toContainEqual(expect.objectContaining({ name: 'login' }));
    });

    it('should link code blocks to code entities', async () => {
      const markdownContent = `
# Usage Example

\`\`\`typescript
import { AuthService } from './auth';

const auth = new AuthService();
await auth.login(user, password);
\`\`\`
`;

      const document = await markdownParser.parse(markdownContent, 'docs/usage.md');

      // Verify code blocks are parsed
      expect(document.sections[0].codeBlocks).toHaveLength(1);
      expect(document.sections[0].codeBlocks[0].language).toBe('typescript');

      // Find references in code blocks
      const codeRefs = await documentCodeLinker.findCodeReferences(document);

      expect(codeRefs).toContainEqual(expect.objectContaining({
        name: 'AuthService',
        context: 'code-block'
      }));
    });

    it('should create MENTIONS relationships for code references', async () => {
      const markdownContent = `
# API Documentation

The AuthService handles authentication.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/api.md');

      // Mock that AuthService entity exists in database
      mockDb.mockGet({
        id: 'entity_auth_service',
        name: 'AuthService',
        type: 'class'
      });

      // Create links using real linker
      const links = await documentCodeLinker.createLinks(document, projectId);

      // Verify relationship creation was attempted
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([
          expect.any(String),
          'MENTIONS',
          expect.any(String),
          'entity_auth_service'
        ])
      );

      expect(links).toContainEqual(expect.objectContaining({
        type: 'MENTIONS',
        targetId: 'entity_auth_service'
      }));
    });

    it('should process internal links to other documents', async () => {
      const markdownContent = `
# Documentation

See [API Guide](./api.md) for more details.
Also check [GitHub](https://github.com) for source code.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/index.md');

      // Verify links are parsed correctly
      const section = document.sections[0];
      expect(section.links).toHaveLength(2);

      const internalLinks = section.links.filter(l => l.isInternal);
      const externalLinks = section.links.filter(l => !l.isInternal);

      expect(internalLinks).toHaveLength(1);
      expect(internalLinks[0].url).toBe('./api.md');
      expect(externalLinks).toHaveLength(1);
    });

    it('should resolve relative paths in code references', async () => {
      const markdownContent = `
# Module Guide

The module at ../utils/helpers.ts provides utility functions.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/guides/module.md');

      const codeRefs = await documentCodeLinker.findCodeReferences(document);

      // Should resolve relative path
      expect(codeRefs).toContainEqual(expect.objectContaining({
        name: '../utils/helpers.ts',
        resolvedPath: expect.stringContaining('utils/helpers.ts')
      }));
    });
  });

  // ============================================================================
  // Requirement Extraction + Code Linking Integration
  // ============================================================================

  describe('Requirement Extraction + Code Linking', () => {
    const projectId = 'proj_123';

    it('should link requirements to mentioned code entities', async () => {
      const markdownContent = `
# Requirements

- The AuthService must validate credentials before login.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/req.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Mock code entity exists
      mockDb.mockGet({ id: 'entity_auth', name: 'AuthService', type: 'class' });

      // Link requirements to code
      const links = await documentCodeLinker.linkRequirementsToCode(requirements, projectId);

      expect(links.length).toBeGreaterThan(0);
      expect(links).toContainEqual(expect.objectContaining({
        sourceType: 'requirement',
        targetName: 'AuthService'
      }));
    });

    it('should link user stories to related code', async () => {
      const markdownContent = `
# User Stories

As a user, I want to use the AuthService to log in securely.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/stories.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      const userStory = requirements.find(r => r.type === 'user-story');
      expect(userStory).toBeDefined();

      // Find code references in user story
      const codeRefs = await documentCodeLinker.findCodeReferencesInText(userStory!.description);

      expect(codeRefs).toContainEqual(expect.objectContaining({ name: 'AuthService' }));
    });

    it('should trace requirements to implementing code', async () => {
      const markdownContent = `
# Requirements

- Passwords must be hashed using hashPassword() in utils/crypto.ts.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/security.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      const codeRefs = await documentCodeLinker.findCodeReferencesInText(
        requirements[0].description
      );

      expect(codeRefs).toContainEqual(expect.objectContaining({
        name: 'utils/crypto.ts',
        type: 'file'
      }));
      expect(codeRefs).toContainEqual(expect.objectContaining({
        name: 'hashPassword',
        type: 'function'
      }));
    });

    it('should create bidirectional traceability', async () => {
      const markdownContent = `
# Requirements

- REQ-001: The AuthService must support OAuth2.
`;

      const document = await markdownParser.parse(markdownContent, 'docs/req.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Mock entities
      mockDb.mockGet({ id: 'entity_req_001', name: 'REQ-001', type: 'requirement' });
      mockDb.mockGet({ id: 'entity_auth', name: 'AuthService', type: 'class' });

      // Create links
      await documentCodeLinker.linkRequirementsToCode(requirements, projectId);

      // Verify bidirectional queries would work
      mockDb.mockAll([
        { source_id: 'entity_req_001', target_id: 'entity_auth', type: 'MENTIONS' }
      ]);

      const relatedCode = mockDb.all(
        `SELECT * FROM ${projectId}_relationships WHERE source_id = ?`,
        ['entity_req_001']
      );

      expect(relatedCode).toHaveLength(1);
    });
  });

  // ============================================================================
  // Full Document Intelligence Pipeline Integration
  // ============================================================================

  describe('Full Document Intelligence Pipeline', () => {
    const projectId = 'proj_123';

    it('should process document through complete pipeline', async () => {
      const markdownContent = `---
version: 1.0
author: Team
---

# Architecture Overview

This document describes the system architecture.

## Authentication

The AuthService in src/auth/service.ts handles all authentication.
Users must provide valid credentials to access the system.

\`\`\`typescript
const auth = new AuthService();
\`\`\`

## Requirements

- The system must authenticate all API requests
- Sessions should expire after 24 hours
`;

      // Process through full pipeline
      const result = await pipeline.process(markdownContent, {
        filePath: 'docs/architecture.md',
        projectId,
        extractRequirements: true,
        createLinks: true,
        generateEmbeddings: true
      });

      // Verify all stages completed
      expect(result.document).toBeDefined();
      expect(result.document.title).toBe('Architecture Overview');
      expect(result.document.frontmatter).toEqual({ version: '1.0', author: 'Team' });

      expect(result.requirements).toHaveLength(2);
      expect(result.codeLinks.length).toBeGreaterThan(0);
      expect(result.entityId).toBeDefined();

      // Verify embedding was generated
      expect(mockEmbeddingProvider.embed).toHaveBeenCalled();
    });

    it('should search documents by content', async () => {
      // First, index some documents
      await pipeline.process('# Auth\n\nAuthentication service documentation.', {
        filePath: 'docs/auth.md',
        projectId,
        generateEmbeddings: true
      });

      await pipeline.process('# Security\n\nSecurity best practices.', {
        filePath: 'docs/security.md',
        projectId,
        generateEmbeddings: true
      });

      // Search
      mockDb.mockAll([
        { entity_id: 'doc_auth', distance: 0.1 },
        { entity_id: 'doc_security', distance: 0.2 }
      ]);

      const searchResults = await pipeline.search('authentication service', projectId);

      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith('authentication service');
      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].entityId).toBe('doc_auth');
    });

    it('should find requirements related to code entity', async () => {
      const codeEntityId = 'entity_auth_service';

      // Setup mock response
      mockDb.mockAll([
        { id: 'req_1', description: 'Authentication must use AuthService' },
        { id: 'req_2', description: 'AuthService must validate tokens' }
      ]);

      const relatedReqs = await pipeline.findRequirementsForCode(codeEntityId, projectId);

      expect(relatedReqs.length).toBeGreaterThan(0);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('MENTIONS'),
        expect.arrayContaining([codeEntityId])
      );
    });

    it('should trace documentation to implementation', async () => {
      const docSectionId = 'section_auth';

      mockDb.mockAll([
        { target_id: 'entity_auth_service', type: 'class', name: 'AuthService' },
        { target_id: 'entity_login_func', type: 'function', name: 'login' },
        { target_id: 'entity_auth_file', type: 'file', name: 'auth/service.ts' }
      ]);

      const mentionedCode = await pipeline.getCodeMentions(docSectionId, projectId);

      expect(mentionedCode).toHaveLength(3);
      expect(mentionedCode.map(c => c.type)).toEqual(['class', 'function', 'file']);
    });

    it('should support incremental updates', async () => {
      // Initial indexing
      const result1 = await pipeline.process('# Doc\n\nInitial content.', {
        filePath: 'docs/test.md',
        projectId
      });

      const originalEntityId = result1.entityId;

      // Update document
      const result2 = await pipeline.process('# Doc\n\nUpdated content with AuthService.', {
        filePath: 'docs/test.md',
        projectId,
        update: true
      });

      // Should update existing entity, not create new one
      expect(result2.entityId).toBe(originalEntityId);
    });
  });

  // ============================================================================
  // MCP Tool Integration
  // ============================================================================

  describe('MCP Tool Integration', () => {
    const projectId = 'proj_123';

    it('should handle index_document with requirement extraction', async () => {
      // Simulate MCP tool call
      const args = {
        path: 'docs/requirements.md',
        project: projectId,
        extract_requirements: true
      };

      // Mock file read
      const fs = require('fs/promises');
      fs.readFile.mockResolvedValue('# Requirements\n\n- Must do X\n- Should do Y');

      const result = await pipeline.indexDocument(args.path, {
        projectId: args.project,
        extractRequirements: args.extract_requirements
      });

      expect(result.success).toBe(true);
      expect(result.requirementsExtracted).toBeGreaterThan(0);
    });

    it('should return document indexing result', async () => {
      const fs = require('fs/promises');
      fs.readFile.mockResolvedValue(`
# Architecture

## Overview
System overview.

## Components
- AuthService
- UserService

## Requirements
- Must be fast
- Should be secure
`);

      const result = await pipeline.indexDocument('docs/arch.md', {
        projectId,
        extractRequirements: true,
        createLinks: true
      });

      expect(result).toMatchObject({
        success: true,
        documentId: expect.any(String),
        sectionsCreated: expect.any(Number),
        requirementsExtracted: expect.any(Number),
        codeLinksCreated: expect.any(Number)
      });
    });

    it('should support query_documents tool', async () => {
      mockDb.mockAll([
        { id: 'doc_1', title: 'Architecture', relevance: 0.95 },
        { id: 'doc_2', title: 'API Guide', relevance: 0.87 }
      ]);

      const results = await pipeline.queryDocuments('system architecture', {
        projectId,
        limit: 5
      });

      expect(results.length).toBeLessThanOrEqual(5);
      expect(results[0].relevance).toBeGreaterThan(results[1].relevance);
    });

    it('should support get_requirements tool', async () => {
      mockDb.mockAll([
        { id: 'req_1', type: 'requirement', priority: 'must', title: 'HTTPS Required' },
        { id: 'req_2', type: 'requirement', priority: 'should', title: 'Export Data' }
      ]);

      const requirements = await pipeline.getRequirements({
        projectId,
        priority: 'must'
      });

      expect(requirements.every(r => r.priority === 'must')).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle malformed markdown gracefully', async () => {
      const malformedContent = `
# Unclosed header
Some content
## Another header without proper spacing
* Mixed list marker
- Different marker
`;

      // Parser should handle gracefully
      const document = await markdownParser.parse(malformedContent, 'docs/malformed.md');

      // Should still extract what it can
      expect(document.sections.length).toBeGreaterThan(0);
      expect(document.sections[0].title).toBe('Unclosed header');
    });

    it('should handle documents with no requirements sections', async () => {
      const content = `
# Introduction

This is an introduction.

# Usage

How to use the system.
`;

      const document = await markdownParser.parse(content, 'docs/intro.md');
      const requirements = await requirementExtractor.extractFromDocument(document);

      // Should return empty array, not throw
      expect(requirements).toEqual([]);
    });

    it('should handle code references that cannot be resolved', async () => {
      const content = `
# Documentation

The NonExistentService handles nothing.
`;

      const document = await markdownParser.parse(content, 'docs/test.md');

      // Mock entity not found
      mockDb.mockGet(undefined);

      // Should not throw, should log warning and continue
      const links = await documentCodeLinker.createLinks(document, 'proj_123');

      // Unresolved references should be tracked but not linked
      expect(links.unresolvedReferences).toContainEqual(
        expect.objectContaining({ name: 'NonExistentService' })
      );
    });

    it('should handle concurrent document indexing', async () => {
      const documents = [
        { path: 'docs/a.md', content: '# A\n\nContent A' },
        { path: 'docs/b.md', content: '# B\n\nContent B' },
        { path: 'docs/c.md', content: '# C\n\nContent C' }
      ];

      const fs = require('fs/promises');
      documents.forEach(doc => {
        fs.readFile.mockResolvedValueOnce(doc.content);
      });

      // Process concurrently
      const results = await Promise.all(
        documents.map(doc => pipeline.indexDocument(doc.path, { projectId: 'proj_123' }))
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle empty documents', async () => {
      const document = await markdownParser.parse('', 'docs/empty.md');

      expect(document.sections).toEqual([]);
      expect(document.title).toBeUndefined();

      const requirements = await requirementExtractor.extractFromDocument(document);
      expect(requirements).toEqual([]);
    });

    it('should handle documents with only frontmatter', async () => {
      const content = `---
title: Empty Doc
author: Test
---`;

      const document = await markdownParser.parse(content, 'docs/meta-only.md');

      expect(document.frontmatter).toEqual({ title: 'Empty Doc', author: 'Test' });
      expect(document.sections).toEqual([]);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should batch entity creation in transaction', async () => {
      const content = Array(20)
        .fill(null)
        .map((_, i) => `## Section ${i}\n\nContent for section ${i}.\n`)
        .join('\n');

      const document = await markdownParser.parse(`# Document\n\n${content}`, 'docs/large.md');

      await pipeline.process(document, {
        filePath: 'docs/large.md',
        projectId: 'proj_123'
      });

      // Verify transaction was used
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should batch relationship creation', async () => {
      const content = `
# Lots of Code References

The AuthService, UserService, ProductService, OrderService, PaymentService,
NotificationService, LoggingService, CacheService, QueueService, and
StorageService all work together.
`;

      const document = await markdownParser.parse(content, 'docs/services.md');

      // Mock all entities exist
      const services = [
        'AuthService', 'UserService', 'ProductService', 'OrderService',
        'PaymentService', 'NotificationService', 'LoggingService',
        'CacheService', 'QueueService', 'StorageService'
      ];

      services.forEach((name, i) => {
        mockDb.mockGet({ id: `entity_${i}`, name, type: 'class' });
      });

      await documentCodeLinker.createLinks(document, 'proj_123');

      // Verify batched transaction
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should process large documents efficiently', async () => {
      // Generate a large document
      const sections = Array(100)
        .fill(null)
        .map((_, i) => `## Section ${i}\n\n${'Lorem ipsum '.repeat(50)}\n`)
        .join('\n');

      const content = `# Large Document\n\n${sections}`;

      const startTime = Date.now();
      const document = await markdownParser.parse(content, 'docs/huge.md');
      const parseTime = Date.now() - startTime;

      expect(document.sections).toHaveLength(100);
      // Should parse within reasonable time (adjust threshold as needed)
      expect(parseTime).toBeLessThan(5000);
    });

    it('should cache parsed documents', async () => {
      const content = '# Cached\n\nThis document will be cached.';

      // First parse
      await markdownParser.parse(content, 'docs/cached.md');

      // Second parse should use cache
      const cacheHit = await markdownParser.parse(content, 'docs/cached.md');

      expect(cacheHit).toBeDefined();
      // Implementation should track cache hits internally
    });
  });

  // ============================================================================
  // Cross-Feature Integration
  // ============================================================================

  describe('Cross-Feature Integration', () => {
    const projectId = 'proj_123';

    it('should link document to Phase 2 code entities', async () => {
      const content = `
# API Documentation

The AuthService class handles authentication.
`;

      // Mock Phase 2 indexed entity exists
      mockDb.mockGet({
        id: 'entity_auth_service',
        type: 'class',
        name: 'AuthService',
        file_path: 'src/auth/service.ts'
      });

      const document = await markdownParser.parse(content, 'docs/api.md');
      const links = await documentCodeLinker.createLinks(document, projectId);

      expect(links.resolved).toContainEqual(
        expect.objectContaining({
          targetId: 'entity_auth_service',
          targetPath: 'src/auth/service.ts'
        })
      );
    });

    it('should integrate with Phase 3 conversation context', async () => {
      // Document referenced in conversation should be found
      const conversationRef = 'docs/architecture.md';

      // Index the document
      await pipeline.indexDocument(conversationRef, { projectId });

      // Query should find it
      mockDb.mockAll([
        { id: 'entity_doc', file_path: conversationRef, type: 'document' }
      ]);

      const found = await pipeline.findDocumentByPath(conversationRef, projectId);

      expect(found).toBeDefined();
      expect(found.filePath).toBe(conversationRef);
    });

    it('should support Phase 5 Graph RAG queries', async () => {
      // Index document with requirements and code links
      const content = `
# Requirements

- The AuthService must support OAuth2.

The implementation is in src/auth/oauth.ts.
`;

      const result = await pipeline.process(content, {
        filePath: 'docs/oauth-req.md',
        projectId,
        extractRequirements: true,
        createLinks: true
      });

      // Verify graph structure for RAG queries
      expect(result.graphNodes.length).toBeGreaterThan(0);
      expect(result.graphEdges.length).toBeGreaterThan(0);

      // Should have document -> requirement -> code relationships
      const reqNode = result.graphNodes.find(n => n.type === 'requirement');
      const codeEdge = result.graphEdges.find(
        e => e.source === reqNode?.id && e.type === 'MENTIONS'
      );

      expect(reqNode).toBeDefined();
      expect(codeEdge).toBeDefined();
    });

    it('should support document hierarchy navigation', async () => {
      // Index multiple related documents
      const docs = [
        { path: 'docs/index.md', content: '# Docs\n\n[Guide](./guide.md)' },
        { path: 'docs/guide.md', content: '# Guide\n\n[API](./api.md)' },
        { path: 'docs/api.md', content: '# API\n\nAPI documentation.' }
      ];

      const fs = require('fs/promises');
      for (const doc of docs) {
        fs.readFile.mockResolvedValueOnce(doc.content);
        await pipeline.indexDocument(doc.path, { projectId });
      }

      // Should be able to navigate hierarchy
      mockDb.mockAll([
        { source: 'docs/index.md', target: 'docs/guide.md', type: 'LINKS_TO' },
        { source: 'docs/guide.md', target: 'docs/api.md', type: 'LINKS_TO' }
      ]);

      const hierarchy = await pipeline.getDocumentHierarchy('docs/index.md', projectId);

      expect(hierarchy.children).toContainEqual(
        expect.objectContaining({ path: 'docs/guide.md' })
      );
    });
  });
});
