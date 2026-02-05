import * as path from 'path';
import { ParseResult, ImportStatement, Symbol } from '../ast';
import { FileSummary } from '../summarization';
import {
  Relationship,
  RelationshipType,
  GraphNode,
  GraphStats,
  ExtractionOptions
} from './types';

/**
 * Default extraction options.
 */
const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  includeInternal: true,
  includeExternal: true,
  types: ['imports', 'exports', 'extends', 'implements', 'defines', 'uses', 'depends_on']
};

/**
 * Extracts and manages relationships between code elements.
 */
export class RelationshipExtractor {
  private relationships: Relationship[] = [];
  private nodes: Map<string, GraphNode> = new Map();
  private options: Required<ExtractionOptions>;

  constructor(options?: ExtractionOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract relationships from a parse result.
   */
  extractFromParseResult(parseResult: ParseResult): Relationship[] {
    const relationships: Relationship[] = [];
    const filePath = parseResult.filePath;

    // Extract import relationships
    if (this.options.types.includes('imports')) {
      for (const imp of parseResult.imports) {
        const rel = this.createImportRelationship(filePath, imp);
        if (rel) relationships.push(rel);
      }
    }

    // Extract symbol definitions
    if (this.options.types.includes('defines')) {
      for (const symbol of parseResult.symbols) {
        relationships.push({
          type: 'defines',
          source: filePath,
          target: symbol.qualifiedName,
          metadata: {
            line: symbol.startLine
          }
        });

        // Extract child definitions
        if (symbol.children) {
          for (const child of symbol.children) {
            relationships.push({
              type: 'defines',
              source: symbol.qualifiedName,
              target: child.qualifiedName,
              metadata: {
                line: child.startLine
              }
            });
          }
        }
      }
    }

    // Extract inheritance relationships
    this.extractInheritanceRelationships(parseResult, relationships);

    // Store relationships
    for (const rel of relationships) {
      this.addRelationship(rel);
    }

    // Update nodes
    this.updateNodesFromFile(filePath, parseResult);

    return relationships;
  }

  /**
   * Extract relationships from a file summary.
   */
  extractFromFileSummary(summary: FileSummary): Relationship[] {
    const relationships: Relationship[] = [];
    const filePath = summary.filePath;

    // Import relationships from dependencies
    if (this.options.types.includes('imports')) {
      for (const dep of summary.dependencies) {
        const isExternal = this.isExternalModule(dep);
        if (!this.options.includeExternal && isExternal) continue;

        relationships.push({
          type: 'imports',
          source: filePath,
          target: dep,
          metadata: { isExternal }
        });
      }
    }

    // Symbol definitions
    if (this.options.types.includes('defines')) {
      for (const symbol of summary.symbols) {
        relationships.push({
          type: 'defines',
          source: filePath,
          target: symbol.qualifiedName
        });
      }
    }

    // Store and return
    for (const rel of relationships) {
      this.addRelationship(rel);
    }

    return relationships;
  }

  /**
   * Add a relationship to the graph.
   */
  addRelationship(rel: Relationship): void {
    // Check if relationship should be included
    if (!this.options.types.includes(rel.type)) return;
    if (!this.options.includeExternal && rel.metadata?.isExternal) return;

    // Avoid duplicates
    const exists = this.relationships.some(
      r =>
        r.type === rel.type &&
        r.source === rel.source &&
        r.target === rel.target
    );

    if (!exists) {
      this.relationships.push(rel);
      this.ensureNode(rel.source);
      this.ensureNode(rel.target);
      this.updateNodeDegrees(rel.source, rel.target);
    }
  }

  /**
   * Get all relationships.
   */
  getRelationships(): Relationship[] {
    return [...this.relationships];
  }

  /**
   * Get relationships of a specific type.
   */
  getRelationshipsByType(type: RelationshipType): Relationship[] {
    return this.relationships.filter(r => r.type === type);
  }

  /**
   * Get relationships from a source.
   */
  getOutgoing(source: string): Relationship[] {
    return this.relationships.filter(r => r.source === source);
  }

  /**
   * Get relationships to a target.
   */
  getIncoming(target: string): Relationship[] {
    return this.relationships.filter(r => r.target === target);
  }

  /**
   * Get all dependencies of a node (transitive).
   * @param nodeId The starting node
   * @param depth Maximum depth to traverse (1 = direct deps only)
   */
  getDependencies(nodeId: string, depth: number = Infinity): string[] {
    const deps = new Set<string>();
    const visited = new Set<string>();

    const traverse = (id: string, currentDepth: number): void => {
      if (visited.has(id)) return;
      visited.add(id);

      // Don't traverse beyond the specified depth
      if (currentDepth >= depth) return;

      for (const rel of this.getOutgoing(id)) {
        if (rel.type === 'imports' || rel.type === 'depends_on' || rel.type === 'uses') {
          deps.add(rel.target);
          traverse(rel.target, currentDepth + 1);
        }
      }
    };

    traverse(nodeId, 0);
    return Array.from(deps);
  }

  /**
   * Get all dependents of a node (reverse dependencies).
   */
  getDependents(nodeId: string, depth: number = Infinity): string[] {
    const deps = new Set<string>();
    const visited = new Set<string>();

    const traverse = (id: string, currentDepth: number): void => {
      if (visited.has(id) || currentDepth > depth) return;
      visited.add(id);

      for (const rel of this.getIncoming(id)) {
        if (rel.type === 'imports' || rel.type === 'depends_on' || rel.type === 'uses') {
          deps.add(rel.source);
          traverse(rel.source, currentDepth + 1);
        }
      }
    };

    traverse(nodeId, 0);
    return Array.from(deps);
  }

  /**
   * Find path between two nodes.
   */
  findPath(from: string, to: string): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [
      { node: from, path: [from] }
    ];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === to) {
        return path;
      }

      if (visited.has(node)) continue;
      visited.add(node);

      for (const rel of this.getOutgoing(node)) {
        if (!visited.has(rel.target)) {
          queue.push({ node: rel.target, path: [...path, rel.target] });
        }
      }
    }

    return null;
  }

  /**
   * Get graph statistics.
   */
  getStats(): GraphStats {
    const byType: Record<string, number> = {};
    for (const rel of this.relationships) {
      byType[rel.type] = (byType[rel.type] || 0) + 1;
    }

    const rootNodes: string[] = [];
    const leafNodes: string[] = [];
    const nodeConnections: Array<{ id: string; connections: number }> = [];

    for (const [id, node] of this.nodes) {
      if (node.inDegree === 0) rootNodes.push(id);
      if (node.outDegree === 0) leafNodes.push(id);
      nodeConnections.push({ id, connections: node.inDegree + node.outDegree });
    }

    // Sort by connections descending and take top 10
    nodeConnections.sort((a, b) => b.connections - a.connections);
    const hubs = nodeConnections.slice(0, 10);

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.relationships.length,
      rootNodes,
      leafNodes,
      hubs,
      byType: byType as Record<RelationshipType, number>
    };
  }

  /**
   * Get all nodes.
   */
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get a specific node.
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Clear all relationships and nodes.
   */
  clear(): void {
    this.relationships = [];
    this.nodes.clear();
  }

  /**
   * Create import relationship from import statement.
   */
  private createImportRelationship(
    filePath: string,
    imp: ImportStatement
  ): Relationship | null {
    const isExternal = this.isExternalModule(imp.source);

    if (!this.options.includeExternal && isExternal) {
      return null;
    }

    return {
      type: 'imports',
      source: filePath,
      target: imp.source,
      metadata: {
        line: imp.startLine,
        isExternal,
        specifiers: imp.specifiers.map(s => s.alias || s.name)
      }
    };
  }

  /**
   * Extract inheritance relationships from parse result.
   */
  private extractInheritanceRelationships(
    parseResult: ParseResult,
    relationships: Relationship[]
  ): void {
    // This would require more sophisticated AST analysis
    // For now, we just track class definitions
    // In a full implementation, we would parse extends/implements clauses
  }

  /**
   * Check if a module is external (third-party).
   */
  private isExternalModule(source: string): boolean {
    // Relative imports start with . or /
    if (source.startsWith('.') || source.startsWith('/')) {
      return false;
    }
    // Absolute imports without extension are typically external
    return true;
  }

  /**
   * Ensure a node exists in the graph.
   */
  private ensureNode(id: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        name: this.extractName(id),
        type: this.inferNodeType(id),
        inDegree: 0,
        outDegree: 0
      });
    }
  }

  /**
   * Update node degrees after adding a relationship.
   */
  private updateNodeDegrees(source: string, target: string): void {
    const sourceNode = this.nodes.get(source);
    const targetNode = this.nodes.get(target);

    if (sourceNode) sourceNode.outDegree++;
    if (targetNode) targetNode.inDegree++;
  }

  /**
   * Update nodes from a file's parse result.
   */
  private updateNodesFromFile(filePath: string, parseResult: ParseResult): void {
    // Ensure file node exists
    this.ensureNode(filePath);
    const fileNode = this.nodes.get(filePath)!;
    fileNode.type = 'file';
    fileNode.filePath = filePath;

    // Add symbol nodes
    const addSymbolNode = (symbol: Symbol): void => {
      this.ensureNode(symbol.qualifiedName);
      const node = this.nodes.get(symbol.qualifiedName)!;
      node.type = symbol.type;
      node.filePath = filePath;

      if (symbol.children) {
        for (const child of symbol.children) {
          addSymbolNode(child);
        }
      }
    };

    for (const symbol of parseResult.symbols) {
      addSymbolNode(symbol);
    }
  }

  /**
   * Extract display name from identifier.
   */
  private extractName(id: string): string {
    // For qualified names like "file.ts::ClassName::methodName"
    const parts = id.split('::');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    // For file paths
    return path.basename(id);
  }

  /**
   * Infer node type from identifier.
   */
  private inferNodeType(id: string): string {
    if (id.includes('::')) {
      return 'symbol';
    }
    if (id.includes('.') && !id.startsWith('.')) {
      // Has extension, likely a file
      const ext = path.extname(id);
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'].includes(ext)) {
        return 'file';
      }
    }
    return 'module';
  }
}
