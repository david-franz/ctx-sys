/**
 * Entity Resolver
 *
 * Resolves entity references by name, qualified name, or file path.
 */

export class EntityResolver {
  async resolveByName(name: string, projectId: string, types?: string[]): Promise<any | null> {
    throw new Error('Not implemented');
  }

  async resolveByQualifiedName(qualifiedName: string, projectId: string): Promise<any | null> {
    throw new Error('Not implemented');
  }

  async resolveByFilePath(filePath: string, projectId: string): Promise<any | null> {
    throw new Error('Not implemented');
  }

  async fuzzySearch(query: string, projectId: string): Promise<Array<{ id: string; name: string; score: number }>> {
    throw new Error('Not implemented');
  }
}
