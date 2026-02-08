/**
 * F10e.4: Knowledge base packaging types.
 */

export interface KBManifest {
  name: string;
  version: string;
  description?: string;
  created: string;
  creator?: string;

  schema: {
    version: number;
    compatible: number[];
  };

  embedding: {
    model: string;
    dimensions: number;
    provider: string;
    vectorCount: number;
  };

  content: {
    entities: number;
    relationships: number;
    sessions: number;
    messages: number;
    entityTypes: Record<string, number>;
  };

  checksum: string;
}

export interface KBCreateOptions {
  version?: string;
  description?: string;
  creator?: string;
  outputPath?: string;
}

export interface KBInstallOptions {
  projectName?: string;
  merge?: boolean;
  force?: boolean;
}

export interface KBPackage {
  manifest: KBManifest;
  data: {
    entities: unknown[];
    vectors: unknown[];
    relationships: unknown[];
    sessions: unknown[];
    messages: unknown[];
  };
}
