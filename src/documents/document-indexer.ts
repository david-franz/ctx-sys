/**
 * F10.9: Universal Document Indexer.
 * Indexes any document type (markdown, YAML, JSON, TOML, plain text)
 * into the entity/relationship graph.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import YAML from 'yaml';
import picomatch from 'picomatch';
import { IgnoreResolver } from '../indexer/ignore-resolver';
import { EntityStore, Entity } from '../entities';
import { EntityType } from '../entities/types';
import { RelationshipStore } from '../graph/relationship-store';
import { GraphRelationshipType } from '../graph/types';
import { MarkdownParser } from './markdown-parser';
import { RequirementExtractor } from './requirement-extractor';
import { DocumentLinker } from './document-linker';
import { chunkSections } from './document-chunker';
import { MarkdownDocument, MarkdownSection } from './types';

export interface DocumentIndexOptions {
  extractEntities?: boolean;
  extractRelationships?: boolean;
  generateEmbeddings?: boolean;
}

export interface DirectoryIndexOptions extends DocumentIndexOptions {
  /** File extensions to include (default: .md, .mdx, .yaml, .yml, .json, .toml, .txt) */
  extensions?: string[];
  /** Glob patterns to exclude (default: node_modules, .git, dist, build) */
  exclude?: string[];
  /** Whether to recurse into subdirectories (default: true) */
  recursive?: boolean;
}

export interface DirectoryIndexResult {
  filesProcessed: number;
  filesSkipped: number;
  totalEntities: number;
  totalRelationships: number;
  errors: string[];
}

export interface DocumentIndexResult {
  documentId: string;
  entitiesCreated: number;
  relationshipsCreated: number;
  crossDocLinks: number;
  embeddingsGenerated: number;
  skipped?: boolean;
}

type DocumentType = 'markdown' | 'yaml' | 'json' | 'toml' | 'html' | 'text' | 'csv' | 'xml' | 'pdf';

const EXTENSION_MAP: Record<string, DocumentType> = {
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.html': 'html',
  '.htm': 'html',
  '.txt': 'text',
  '.log': 'text',
  '.csv': 'csv',
  '.tsv': 'csv',
  '.xml': 'xml',
  '.xsd': 'xml',
  '.wsdl': 'xml',
  '.csproj': 'xml',
  '.fsproj': 'xml',
  '.vbproj': 'xml',
  '.pdf': 'pdf',
};

export class DocumentIndexer {
  private markdownParser: MarkdownParser;
  private requirementExtractor: RequirementExtractor;
  private documentLinker: DocumentLinker;

  constructor(
    private entityStore: EntityStore,
    private relationshipStore: RelationshipStore
  ) {
    this.markdownParser = new MarkdownParser();
    this.requirementExtractor = new RequirementExtractor();
    this.documentLinker = new DocumentLinker(entityStore);
  }

  async indexFile(filePath: string, options: DocumentIndexOptions = {}): Promise<DocumentIndexResult> {
    const absolutePath = path.resolve(filePath);
    const ext = path.extname(absolutePath).toLowerCase();
    const docType = EXTENSION_MAP[ext] || 'text';

    // PDF needs binary reading
    if (docType === 'pdf') {
      const buffer = await fs.promises.readFile(absolutePath);
      const hash = crypto.createHash('md5').update(buffer).digest('hex');

      const existing = await this.entityStore.getByQualifiedName(absolutePath);
      if (existing && existing.metadata?.hash === hash) {
        return {
          documentId: existing.id,
          entitiesCreated: 0,
          relationshipsCreated: 0,
          crossDocLinks: 0,
          embeddingsGenerated: 0,
          skipped: true,
        };
      }

      return this.indexPdf(absolutePath, buffer, hash);
    }

    const content = await fs.promises.readFile(absolutePath, 'utf-8');
    const hash = crypto.createHash('md5').update(content).digest('hex');

    // Check if unchanged
    const existing = await this.entityStore.getByQualifiedName(absolutePath);
    if (existing && existing.metadata?.hash === hash) {
      return {
        documentId: existing.id,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        crossDocLinks: 0,
        embeddingsGenerated: 0,
        skipped: true,
      };
    }

    switch (docType) {
      case 'markdown':
        return this.indexMarkdown(absolutePath, content, hash, options);
      case 'yaml':
        return this.indexYaml(absolutePath, content, hash);
      case 'json':
        return this.indexJson(absolutePath, content, hash);
      case 'toml':
        return this.indexToml(absolutePath, content, hash);
      case 'html':
        return this.indexHtml(absolutePath, content, hash);
      case 'csv':
        return this.indexCsv(absolutePath, content, hash);
      case 'xml':
        return this.indexXml(absolutePath, content, hash);
      default:
        return this.indexPlainText(absolutePath, content, hash);
    }
  }

  private async indexMarkdown(
    filePath: string,
    content: string,
    hash: string,
    options: DocumentIndexOptions
  ): Promise<DocumentIndexResult> {
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    let crossDocLinks = 0;

    const doc = this.markdownParser.parseContent(content, filePath);

    // Create top-level document entity
    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: path.basename(filePath),
      qualifiedName: filePath,
      content,
      summary: doc.title || path.basename(filePath),
      filePath,
      metadata: { hash, docType: 'markdown', frontmatter: doc.frontmatter },
    });
    entitiesCreated++;

    // Apply chunking: split large sections, merge small ones, add overlap
    const chunkedSections = chunkSections(
      doc.sections.filter(s => s.level > 0)
    );

    // Create section entities with CONTAINS hierarchy
    const sectionEntities: Map<string, Entity> = new Map();

    for (const section of chunkedSections) {

      const sectionEntity = await this.entityStore.upsert({
        type: 'section',
        name: section.title,
        qualifiedName: `${filePath}::${section.id}`,
        content: section.content.trim(),
        summary: section.title,
        filePath,
        startLine: section.startLine,
        endLine: section.endLine,
        metadata: { level: section.level, sectionId: section.id },
      });
      sectionEntities.set(section.id, sectionEntity);
      entitiesCreated++;

      // Build hierarchy: parent section or document
      const parentEntity = section.parent
        ? sectionEntities.get(section.parent)
        : docEntity;

      if (parentEntity) {
        await this.relationshipStore.upsert({
          sourceId: parentEntity.id,
          targetId: sectionEntity.id,
          relationship: 'CONTAINS',
        });
        relationshipsCreated++;
      }
    }

    // Extract requirements
    const requirements = this.requirementExtractor.extractFromDocument(doc);
    for (const req of requirements) {
      const reqEntity = await this.entityStore.upsert({
        type: 'requirement',
        name: req.title,
        qualifiedName: `${filePath}::req::${req.id}`,
        content: req.description,
        summary: `[${req.priority || 'unset'}] ${req.title}`,
        filePath,
        metadata: {
          priority: req.priority,
          status: req.status,
          reqType: req.type,
          acceptanceCriteria: req.acceptanceCriteria,
        },
      });
      entitiesCreated++;

      // Link requirement to parent section or document
      const parentSection = req.source.section
        ? sectionEntities.get(req.source.section)
        : null;
      const parent = parentSection || docEntity;

      await this.relationshipStore.upsert({
        sourceId: parent.id,
        targetId: reqEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;
    }

    // Resolve code references → DOCUMENTS relationships
    const codeRefs = this.documentLinker.findCodeReferences(doc);
    for (const ref of codeRefs) {
      if (ref.inCodeBlock) continue;
      const resolved = await this.documentLinker.resolveReference(ref.text);
      if (resolved) {
        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: resolved.id,
          relationship: 'DOCUMENTS',
        });
        relationshipsCreated++;
        crossDocLinks++;
      }
    }

    // Internal links → RELATES_TO relationships
    const internalLinks = this.markdownParser.getInternalLinks(doc);
    for (const link of internalLinks) {
      const linkPath = path.resolve(path.dirname(filePath), link.url);
      const linkedDoc = await this.entityStore.getByQualifiedName(linkPath);
      if (linkedDoc) {
        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: linkedDoc.id,
          relationship: 'RELATES_TO',
        });
        relationshipsCreated++;
        crossDocLinks++;
      }
    }

    return {
      documentId: docEntity.id,
      entitiesCreated,
      relationshipsCreated,
      crossDocLinks,
      embeddingsGenerated: 0,
    };
  }

  private async indexYaml(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    let crossDocLinks = 0;

    let parsed: any;
    try {
      parsed = YAML.parse(content);
    } catch {
      return this.indexPlainText(filePath, content, hash);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return this.indexPlainText(filePath, content, hash);
    }

    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: path.basename(filePath),
      qualifiedName: filePath,
      content,
      summary: `YAML config: ${path.basename(filePath)}`,
      filePath,
      metadata: { hash, docType: 'yaml' },
    });
    entitiesCreated++;

    // Extract top-level keys as entities
    for (const [key, value] of Object.entries(parsed)) {
      const entityType: EntityType = typeof value === 'object' ? 'component' : 'variable';
      const entityContent = typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);

      const keyEntity = await this.entityStore.upsert({
        type: entityType,
        name: key,
        qualifiedName: `${filePath}::${key}`,
        content: entityContent,
        summary: `${key}: ${typeof value === 'object' ? 'object' : String(value).slice(0, 100)}`,
        filePath,
        metadata: { valueType: typeof value },
      });
      entitiesCreated++;

      await this.relationshipStore.upsert({
        sourceId: docEntity.id,
        targetId: keyEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;

      // Try to match key name against existing code entities
      const matchedEntity = await this.entityStore.getByName(key);
      if (matchedEntity && matchedEntity.id !== keyEntity.id) {
        await this.relationshipStore.upsert({
          sourceId: keyEntity.id,
          targetId: matchedEntity.id,
          relationship: 'CONFIGURES',
        });
        relationshipsCreated++;
        crossDocLinks++;
      }
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks, embeddingsGenerated: 0 };
  }

  private async indexJson(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    let crossDocLinks = 0;

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return this.indexPlainText(filePath, content, hash);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return this.indexPlainText(filePath, content, hash);
    }

    const fileName = path.basename(filePath);
    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: fileName,
      qualifiedName: filePath,
      content,
      summary: `JSON: ${fileName}`,
      filePath,
      metadata: { hash, docType: 'json' },
    });
    entitiesCreated++;

    // Special handling for package.json
    if (fileName === 'package.json') {
      const deps = { ...parsed.dependencies, ...parsed.devDependencies };
      for (const [name] of Object.entries(deps || {})) {
        const techEntity = await this.entityStore.upsert({
          type: 'technology',
          name,
          qualifiedName: `${filePath}::dep::${name}`,
          summary: `npm package: ${name}`,
        });
        entitiesCreated++;

        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: techEntity.id,
          relationship: 'CONTAINS',
        });
        relationshipsCreated++;
      }

      // Scripts as tasks
      for (const [name, script] of Object.entries(parsed.scripts || {})) {
        const taskEntity = await this.entityStore.upsert({
          type: 'task',
          name,
          qualifiedName: `${filePath}::script::${name}`,
          content: String(script),
          summary: `npm script: ${name}`,
        });
        entitiesCreated++;

        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: taskEntity.id,
          relationship: 'CONTAINS',
        });
        relationshipsCreated++;
      }
    } else {
      // Generic JSON: top-level keys as entities
      for (const [key, value] of Object.entries(parsed)) {
        const entityType: EntityType = typeof value === 'object' ? 'component' : 'variable';
        const keyEntity = await this.entityStore.upsert({
          type: entityType,
          name: key,
          qualifiedName: `${filePath}::${key}`,
          content: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
          summary: `${key}: ${typeof value === 'object' ? 'object' : String(value).slice(0, 100)}`,
          filePath,
        });
        entitiesCreated++;

        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: keyEntity.id,
          relationship: 'CONTAINS',
        });
        relationshipsCreated++;
      }
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks, embeddingsGenerated: 0 };
  }

  private async indexToml(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    let entitiesCreated = 0;
    let relationshipsCreated = 0;

    let parsed: any;
    try {
      const smolToml = await import('smol-toml');
      parsed = smolToml.parse(content);
    } catch {
      return this.indexPlainText(filePath, content, hash);
    }

    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: path.basename(filePath),
      qualifiedName: filePath,
      content,
      summary: `TOML config: ${path.basename(filePath)}`,
      filePath,
      metadata: { hash, docType: 'toml' },
    });
    entitiesCreated++;

    for (const [key, value] of Object.entries(parsed)) {
      const entityType: EntityType = typeof value === 'object' ? 'component' : 'variable';
      const keyEntity = await this.entityStore.upsert({
        type: entityType,
        name: key,
        qualifiedName: `${filePath}::${key}`,
        content: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
        summary: `${key}: ${typeof value === 'object' ? 'section' : String(value).slice(0, 100)}`,
        filePath,
      });
      entitiesCreated++;

      await this.relationshipStore.upsert({
        sourceId: docEntity.id,
        targetId: keyEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks: 0, embeddingsGenerated: 0 };
  }

  private async indexHtml(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    let crossDocLinks = 0;

    // Extract title
    const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath);

    // Strip script, style, and comments
    const cleaned = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Extract text content (strip all tags)
    const textContent = cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Create document entity
    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: title,
      qualifiedName: filePath,
      content: textContent,
      summary: `HTML: ${title}`,
      filePath,
      metadata: { hash, docType: 'html' },
    });
    entitiesCreated++;

    // Split by heading tags into sections
    const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
    const sections: Array<{ level: number; title: string; content: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(cleaned)) !== null) {
      if (sections.length > 0) {
        const between = cleaned.slice(lastIndex, match.index);
        const betweenText = between.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (betweenText) {
          sections[sections.length - 1].content = betweenText;
        }
      }

      const level = parseInt(match[1], 10);
      const headingText = match[2].replace(/<[^>]+>/g, '').trim();
      sections.push({ level, title: headingText, content: '' });
      lastIndex = match.index + match[0].length;
    }

    // Capture trailing content after last heading
    if (sections.length > 0) {
      const trailing = cleaned.slice(lastIndex);
      const trailingText = trailing.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (trailingText) {
        sections[sections.length - 1].content = trailingText;
      }
    }

    // Create section entities
    for (const section of sections) {
      if (!section.title) continue;

      const sectionId = section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const sectionEntity = await this.entityStore.upsert({
        type: 'section',
        name: section.title,
        qualifiedName: `${filePath}::${sectionId}`,
        content: section.content || section.title,
        summary: section.title,
        filePath,
        metadata: { level: section.level },
      });
      entitiesCreated++;

      await this.relationshipStore.upsert({
        sourceId: docEntity.id,
        targetId: sectionEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;
    }

    // Resolve code references from text content
    const fakeDoc: MarkdownDocument = {
      filePath,
      title,
      sections: [{
        id: 'root',
        title,
        level: 0,
        content: textContent,
        startLine: 0,
        endLine: 0,
        codeBlocks: [],
        links: [],
        children: [],
      }],
    };

    const codeRefs = this.documentLinker.findCodeReferences(fakeDoc);
    for (const ref of codeRefs) {
      const resolved = await this.documentLinker.resolveReference(ref.text);
      if (resolved) {
        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: resolved.id,
          relationship: 'DOCUMENTS',
        });
        relationshipsCreated++;
        crossDocLinks++;
      }
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks, embeddingsGenerated: 0 };
  }

  private async indexCsv(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    const { parseCsv } = await import('./csv-parser.js');
    const csv = parseCsv(content, { maxRows: 10000 });
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    const name = path.basename(filePath, path.extname(filePath));

    // Build schema description from headers
    const schemaDesc = csv.headers.join(', ');
    const sampleRows = csv.rows.slice(0, 5).map(row =>
      csv.headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(' | ')
    ).join('\n');

    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name,
      qualifiedName: filePath,
      content: `Columns: ${schemaDesc}\n\nSample rows:\n${sampleRows}`,
      summary: `CSV: ${name} — ${csv.rowCount} rows, ${csv.headers.length} columns (${csv.headers.slice(0, 5).join(', ')}${csv.headers.length > 5 ? '...' : ''})`,
      filePath,
      metadata: {
        hash,
        docType: 'csv',
        columns: csv.headers,
        rowCount: csv.rowCount,
        columnCount: csv.headers.length,
      },
    });
    entitiesCreated++;

    // Create variable entities for each column
    for (const header of csv.headers) {
      if (!header) continue;
      const colEntity = await this.entityStore.upsert({
        type: 'variable',
        name: header,
        qualifiedName: `${filePath}::column::${header}`,
        content: `Column "${header}" in ${name}`,
        summary: `CSV column: ${header}`,
        filePath,
        metadata: { hash, docType: 'csv-column', dataset: name },
      });
      entitiesCreated++;

      await this.relationshipStore.upsert({
        sourceId: docEntity.id,
        targetId: colEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks: 0, embeddingsGenerated: 0 };
  }

  private async indexXml(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    const { parseXml, detectXmlType } = await import('./xml-parser.js');
    const xml = parseXml(content);
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    let crossDocLinks = 0;
    const name = path.basename(filePath);
    const xmlType = detectXmlType(filePath, xml.rootTag, xml.namespaces);

    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name,
      qualifiedName: filePath,
      content: content.length > 50000 ? content.slice(0, 50000) : content,
      summary: `XML: ${name} (root: <${xml.rootTag}>, ${xml.elements.length} elements)${xmlType ? ` [${xmlType}]` : ''}`,
      filePath,
      metadata: {
        hash,
        docType: 'xml',
        xmlType,
        rootTag: xml.rootTag,
        elementCount: xml.elements.length,
      },
    });
    entitiesCreated++;

    // Create section entities for significant top-level elements
    const topElements = xml.elements.filter(e => e.path.split('/').length <= 3);
    for (const elem of topElements) {
      if (elem.textContent.length < 20 && elem.children.length === 0) continue;

      const elemContent = elem.textContent || `<${elem.tag}> with ${elem.children.length} children`;
      if (elemContent.length < 10) continue;

      const sectionEntity = await this.entityStore.upsert({
        type: 'section',
        name: `${name} - <${elem.tag}>`,
        qualifiedName: `${filePath}::${elem.path}`,
        content: elemContent,
        summary: `<${elem.tag}> element in ${name}`,
        filePath,
        startLine: elem.line,
        metadata: { hash, docType: 'xml', tag: elem.tag, xpath: elem.path },
      });
      entitiesCreated++;

      await this.relationshipStore.upsert({
        sourceId: docEntity.id,
        targetId: sectionEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;
    }

    // Maven POM: extract dependencies as technology entities
    if (xmlType === 'maven-pom') {
      const deps = xml.elements.filter(e => e.path.endsWith('/dependency'));
      for (const dep of deps) {
        const artifactId = dep.children.find(c => c.tag === 'artifactId')?.textContent ?? '';
        const groupId = dep.children.find(c => c.tag === 'groupId')?.textContent ?? '';
        const version = dep.children.find(c => c.tag === 'version')?.textContent ?? '';
        if (!artifactId) continue;

        const techEntity = await this.entityStore.upsert({
          type: 'technology',
          name: artifactId,
          qualifiedName: `${filePath}::dep::${groupId}:${artifactId}`,
          content: `Maven dependency: ${groupId}:${artifactId}:${version}`,
          summary: `Maven dep: ${artifactId}`,
          filePath,
          metadata: { hash, groupId, artifactId, version, source: 'pom.xml' },
        });
        entitiesCreated++;

        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: techEntity.id,
          relationship: 'DEPENDS_ON',
        });
        relationshipsCreated++;
      }
    }

    // Resolve code references
    const fakeDoc: MarkdownDocument = {
      filePath,
      title: name,
      sections: [{
        id: 'root', title: name, level: 0,
        content: content.slice(0, 10000),
        startLine: 0, endLine: 0,
        codeBlocks: [], links: [], children: [],
      }],
    };

    const codeRefs = this.documentLinker.findCodeReferences(fakeDoc);
    for (const ref of codeRefs) {
      const resolved = await this.documentLinker.resolveReference(ref.text);
      if (resolved) {
        await this.relationshipStore.upsert({
          sourceId: docEntity.id,
          targetId: resolved.id,
          relationship: 'DOCUMENTS',
        });
        relationshipsCreated++;
        crossDocLinks++;
      }
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks, embeddingsGenerated: 0 };
  }

  private async indexPdf(
    filePath: string,
    buffer: Buffer,
    hash: string
  ): Promise<DocumentIndexResult> {
    const { parsePdf } = await import('./pdf-parser.js');
    const pdf = await parsePdf(buffer);
    let entitiesCreated = 0;
    let relationshipsCreated = 0;
    const name = path.basename(filePath);
    const title = pdf.title || name;

    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: title,
      qualifiedName: filePath,
      content: pdf.fullText.slice(0, 100000),
      summary: `PDF: ${title} — ${pdf.pageCount} pages${pdf.author ? ` by ${pdf.author}` : ''}`,
      filePath,
      metadata: {
        hash,
        docType: 'pdf',
        pageCount: pdf.pageCount,
        ...pdf.metadata,
      },
    });
    entitiesCreated++;

    // Create section entities for each page
    for (const page of pdf.pages) {
      if (page.text.length < 50) continue;

      const pageEntity = await this.entityStore.upsert({
        type: 'section',
        name: `${title} - Page ${page.pageNumber}`,
        qualifiedName: `${filePath}::page-${page.pageNumber}`,
        content: page.text,
        summary: `Page ${page.pageNumber} of ${title}`,
        filePath,
        metadata: { hash, docType: 'pdf', pageNumber: page.pageNumber },
      });
      entitiesCreated++;

      await this.relationshipStore.upsert({
        sourceId: docEntity.id,
        targetId: pageEntity.id,
        relationship: 'CONTAINS',
      });
      relationshipsCreated++;
    }

    return { documentId: docEntity.id, entitiesCreated, relationshipsCreated, crossDocLinks: 0, embeddingsGenerated: 0 };
  }

  private async indexPlainText(
    filePath: string,
    content: string,
    hash: string
  ): Promise<DocumentIndexResult> {
    const docEntity = await this.entityStore.upsert({
      type: 'document',
      name: path.basename(filePath),
      qualifiedName: filePath,
      content,
      summary: `Document: ${path.basename(filePath)}`,
      filePath,
      metadata: { hash, docType: 'text' },
    });

    return {
      documentId: docEntity.id,
      entitiesCreated: 1,
      relationshipsCreated: 0,
      crossDocLinks: 0,
      embeddingsGenerated: 0,
    };
  }

  /**
   * F10.13: Index all documents in a directory recursively.
   * Supports change detection via hash — unchanged files are skipped.
   */
  async indexDirectory(
    dirPath: string,
    options: DirectoryIndexOptions = {}
  ): Promise<DirectoryIndexResult> {
    const defaultExtensions = Object.keys(EXTENSION_MAP);
    const extensions = options.extensions || defaultExtensions;
    const recursive = options.recursive !== false;

    const absoluteDir = path.resolve(dirPath);
    const resolver = new IgnoreResolver(absoluteDir, {
      extraExclude: options.exclude,
    });
    const files = this.collectFiles(absoluteDir, absoluteDir, extensions, (p) => resolver.isIgnored(p), recursive);

    const result: DirectoryIndexResult = {
      filesProcessed: 0,
      filesSkipped: 0,
      totalEntities: 0,
      totalRelationships: 0,
      errors: [],
    };

    for (const file of files) {
      try {
        const indexResult = await this.indexFile(file, options);
        if (indexResult.skipped) {
          result.filesSkipped++;
        } else {
          result.filesProcessed++;
          result.totalEntities += indexResult.entitiesCreated;
          result.totalRelationships += indexResult.relationshipsCreated;
        }
      } catch (err) {
        result.errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  }

  /**
   * Collect files matching extensions, excluding patterns.
   */
  private collectFiles(
    dir: string,
    rootDir: string,
    extensions: string[],
    isExcluded: (path: string) => boolean,
    recursive: boolean
  ): string[] {
    const files: string[] = [];

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return files;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (isExcluded(relativePath) || isExcluded(entry.name)) continue;

      if (entry.isDirectory() && recursive) {
        files.push(...this.collectFiles(fullPath, rootDir, extensions, isExcluded, recursive));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Get the supported document extensions.
   */
  static getSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_MAP);
  }
}
