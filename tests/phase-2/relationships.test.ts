import { RelationshipExtractor, ASTParser } from '../../src';

describe('F2.4 - Relationship Extraction', () => {
  let extractor: RelationshipExtractor;
  let parser: ASTParser;

  beforeEach(() => {
    extractor = new RelationshipExtractor();
    parser = new ASTParser();
  });

  describe('RelationshipExtractor', () => {
    describe('Import Relationships', () => {
      it('should extract import relationships from TypeScript', async () => {
        const code = `
import { useState } from 'react';
import * as fs from 'fs';
import path from 'path';

export function App() {}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        const relationships = extractor.extractFromParseResult(parseResult);

        const imports = relationships.filter(r => r.type === 'imports');
        expect(imports.length).toBe(3);
        expect(imports.map(r => r.target)).toContain('react');
        expect(imports.map(r => r.target)).toContain('fs');
        expect(imports.map(r => r.target)).toContain('path');
      });

      it('should mark external modules correctly', async () => {
        const code = `
import { external } from 'external-lib';
import { local } from './local';
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        extractor.extractFromParseResult(parseResult);

        const relationships = extractor.getRelationships();
        const externalRel = relationships.find(r => r.target === 'external-lib');
        const localRel = relationships.find(r => r.target === './local');

        expect(externalRel?.metadata?.isExternal).toBe(true);
        expect(localRel?.metadata?.isExternal).toBe(false);
      });

      it('should extract Python imports', async () => {
        const code = `
import os
from pathlib import Path
from typing import Dict, List

def main():
    pass
`;
        const parseResult = await parser.parseContent(code, 'python', 'app.py');
        const relationships = extractor.extractFromParseResult(parseResult);

        const imports = relationships.filter(r => r.type === 'imports');
        expect(imports.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Definition Relationships', () => {
      it('should extract symbol definitions', async () => {
        const code = `
export function myFunction() {}
export class MyClass {
  myMethod() {}
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        const relationships = extractor.extractFromParseResult(parseResult);

        const defines = relationships.filter(r => r.type === 'defines');
        expect(defines.length).toBeGreaterThan(0);

        // File defines function and class
        const fileDefines = defines.filter(r => r.source === 'app.ts');
        expect(fileDefines.length).toBeGreaterThanOrEqual(2);
      });

      it('should extract nested definitions', async () => {
        const code = `
class Parent {
  childMethod() {}
}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        const relationships = extractor.extractFromParseResult(parseResult);

        const defines = relationships.filter(r => r.type === 'defines');

        // Parent class defines childMethod
        const classDefines = defines.filter(r =>
          r.source.includes('Parent') && r.target.includes('childMethod')
        );
        expect(classDefines.length).toBe(1);
      });
    });

    describe('Graph Operations', () => {
      it('should get outgoing relationships', async () => {
        const code = `
import { a } from './a';
import { b } from './b';
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        extractor.extractFromParseResult(parseResult);

        const outgoing = extractor.getOutgoing('app.ts');
        const imports = outgoing.filter(r => r.type === 'imports');
        expect(imports.length).toBe(2);
      });

      it('should get incoming relationships', async () => {
        const code1 = `import { shared } from './shared';`;
        const code2 = `import { shared } from './shared';`;

        await extractor.extractFromParseResult(
          await parser.parseContent(code1, 'typescript', 'a.ts')
        );
        await extractor.extractFromParseResult(
          await parser.parseContent(code2, 'typescript', 'b.ts')
        );

        const incoming = extractor.getIncoming('./shared');
        expect(incoming.length).toBe(2);
      });

      it('should get dependencies transitively', async () => {
        // a imports b, b imports c
        extractor.addRelationship({
          type: 'imports',
          source: 'a.ts',
          target: 'b.ts'
        });
        extractor.addRelationship({
          type: 'imports',
          source: 'b.ts',
          target: 'c.ts'
        });

        const deps = extractor.getDependencies('a.ts');
        expect(deps).toContain('b.ts');
        expect(deps).toContain('c.ts');
      });

      it('should limit dependency depth', async () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'b', target: 'c' });
        extractor.addRelationship({ type: 'imports', source: 'c', target: 'd' });

        const deps = extractor.getDependencies('a', 1);
        expect(deps).toContain('b');
        expect(deps).not.toContain('c');
        expect(deps).not.toContain('d');
      });

      it('should get reverse dependencies', async () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'shared' });
        extractor.addRelationship({ type: 'imports', source: 'b', target: 'shared' });

        const dependents = extractor.getDependents('shared');
        expect(dependents).toContain('a');
        expect(dependents).toContain('b');
      });

      it('should find path between nodes', async () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'b', target: 'c' });
        extractor.addRelationship({ type: 'imports', source: 'c', target: 'd' });

        const path = extractor.findPath('a', 'd');
        expect(path).toEqual(['a', 'b', 'c', 'd']);
      });

      it('should return null for disconnected nodes', () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'c', target: 'd' });

        const path = extractor.findPath('a', 'd');
        expect(path).toBeNull();
      });
    });

    describe('Graph Statistics', () => {
      it('should compute basic statistics', async () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'c' });
        extractor.addRelationship({ type: 'defines', source: 'a', target: 'fn' });

        const stats = extractor.getStats();

        expect(stats.nodeCount).toBe(4); // a, b, c, fn
        expect(stats.edgeCount).toBe(3);
        expect(stats.byType['imports']).toBe(2);
        expect(stats.byType['defines']).toBe(1);
      });

      it('should identify root nodes', () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'c' });

        const stats = extractor.getStats();

        expect(stats.rootNodes).toContain('a');
        expect(stats.rootNodes).not.toContain('b');
        expect(stats.rootNodes).not.toContain('c');
      });

      it('should identify leaf nodes', () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'c' });

        const stats = extractor.getStats();

        expect(stats.leafNodes).toContain('b');
        expect(stats.leafNodes).toContain('c');
        expect(stats.leafNodes).not.toContain('a');
      });

      it('should identify hub nodes', () => {
        // Create a hub node
        for (let i = 0; i < 5; i++) {
          extractor.addRelationship({ type: 'imports', source: `file${i}`, target: 'hub' });
        }

        const stats = extractor.getStats();
        const hubNode = stats.hubs.find(h => h.id === 'hub');

        expect(hubNode).toBeDefined();
        expect(hubNode!.connections).toBe(5);
      });
    });

    describe('Node Management', () => {
      it('should track nodes in the graph', async () => {
        const code = `
export function myFunc() {}
export class MyClass {}
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        extractor.extractFromParseResult(parseResult);

        const nodes = extractor.getNodes();
        expect(nodes.length).toBeGreaterThan(0);

        const fileNode = nodes.find(n => n.id === 'app.ts');
        expect(fileNode).toBeDefined();
        expect(fileNode!.type).toBe('file');
      });

      it('should track node degrees', () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'shared' });
        extractor.addRelationship({ type: 'imports', source: 'b', target: 'shared' });

        const sharedNode = extractor.getNode('shared');
        expect(sharedNode?.inDegree).toBe(2);
        expect(sharedNode?.outDegree).toBe(0);
      });
    });

    describe('Filtering Options', () => {
      it('should exclude external dependencies when configured', async () => {
        const filteredExtractor = new RelationshipExtractor({
          includeExternal: false
        });

        const code = `
import { external } from 'external-lib';
import { local } from './local';
`;
        const parseResult = await parser.parseContent(code, 'typescript', 'app.ts');
        filteredExtractor.extractFromParseResult(parseResult);

        const imports = filteredExtractor.getRelationshipsByType('imports');
        expect(imports.length).toBe(1);
        expect(imports[0].target).toBe('./local');
      });

      it('should filter relationship types', () => {
        const filteredExtractor = new RelationshipExtractor({
          types: ['imports']
        });

        filteredExtractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        filteredExtractor.addRelationship({ type: 'defines', source: 'a', target: 'fn' });

        const relationships = filteredExtractor.getRelationships();
        expect(relationships.length).toBe(1);
        expect(relationships[0].type).toBe('imports');
      });
    });

    describe('Clear and Reset', () => {
      it('should clear all relationships', () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'c', target: 'd' });

        expect(extractor.getRelationships().length).toBe(2);

        extractor.clear();

        expect(extractor.getRelationships().length).toBe(0);
        expect(extractor.getNodes().length).toBe(0);
      });
    });

    describe('Duplicate Prevention', () => {
      it('should not add duplicate relationships', () => {
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });
        extractor.addRelationship({ type: 'imports', source: 'a', target: 'b' });

        expect(extractor.getRelationships().length).toBe(1);
      });
    });
  });
});
