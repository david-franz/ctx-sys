/**
 * F10e.4: Knowledge base packaging — create, install, and inspect .ctx-kb files.
 *
 * A .ctx-kb file is a gzipped JSON containing a manifest and all project data
 * (entities, vectors, relationships, sessions, messages).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { DatabaseConnection } from '../db/connection';
import { sanitizeProjectId, createProjectTables } from '../db/schema';
import { KBManifest, KBCreateOptions, KBInstallOptions, KBPackage } from './types';

export class KnowledgeBasePackager {
  constructor(private db: DatabaseConnection) {}

  /**
   * Create a .ctx-kb package from a project.
   */
  async create(projectId: string, options: KBCreateOptions = {}): Promise<{ path: string; manifest: KBManifest }> {
    const prefix = sanitizeProjectId(projectId);

    // Export all project data
    const entities = this.db.all(`SELECT * FROM ${prefix}_entities`);
    const vectors = this.db.all(`SELECT * FROM ${prefix}_vectors`);
    const relationships = this.db.all(`SELECT * FROM ${prefix}_relationships`);
    const sessions = this.db.all(`SELECT * FROM ${prefix}_sessions`);
    const messages = this.db.all(`SELECT * FROM ${prefix}_messages`);

    // Get entity type breakdown
    const typeRows = this.db.all<{ type: string; count: number }>(
      `SELECT type, COUNT(*) as count FROM ${prefix}_entities GROUP BY type`
    );
    const entityTypes: Record<string, number> = {};
    for (const row of typeRows) {
      entityTypes[row.type] = row.count;
    }

    // Get embedding model info
    const embeddingModel = this.db.get<{ id: string; name: string; provider: string; dimensions: number }>(
      `SELECT * FROM embedding_models LIMIT 1`
    );

    const data = { entities, vectors, relationships, sessions, messages };

    // Compute checksum over data
    const dataJson = JSON.stringify(data);
    const checksum = 'sha256:' + crypto.createHash('sha256').update(dataJson).digest('hex');

    const manifest: KBManifest = {
      name: options.outputPath ? path.basename(options.outputPath, '.ctx-kb') : projectId,
      version: options.version || '1.0.0',
      description: options.description,
      creator: options.creator,
      created: new Date().toISOString(),
      schema: {
        version: 1,
        compatible: [1]
      },
      embedding: {
        model: embeddingModel?.name || 'unknown',
        dimensions: embeddingModel?.dimensions || 0,
        provider: embeddingModel?.provider || 'unknown',
        vectorCount: vectors.length
      },
      content: {
        entities: entities.length,
        relationships: relationships.length,
        sessions: sessions.length,
        messages: messages.length,
        entityTypes
      },
      checksum
    };

    const kbPackage: KBPackage = { manifest, data };
    const json = JSON.stringify(kbPackage);
    const compressed = zlib.gzipSync(Buffer.from(json));

    const outputName = options.outputPath || `${projectId}.ctx-kb`;
    const outputPath = path.resolve(outputName);
    fs.writeFileSync(outputPath, compressed);

    return { path: outputPath, manifest };
  }

  /**
   * Install a .ctx-kb package as a new project.
   */
  async install(
    kbPath: string,
    options: KBInstallOptions = {}
  ): Promise<{ projectId: string; manifest: KBManifest; counts: Record<string, number> }> {
    const absolutePath = path.resolve(kbPath);
    const compressed = fs.readFileSync(absolutePath);
    const json = zlib.gunzipSync(compressed).toString('utf-8');
    const kbPackage = JSON.parse(json) as KBPackage;
    const { manifest, data } = kbPackage;

    // Verify checksum
    const dataJson = JSON.stringify(data);
    const computedChecksum = 'sha256:' + crypto.createHash('sha256').update(dataJson).digest('hex');
    if (computedChecksum !== manifest.checksum) {
      throw new Error('Checksum mismatch — the .ctx-kb file may be corrupted');
    }

    // Check schema compatibility
    if (!manifest.schema.compatible.includes(1)) {
      throw new Error(`Incompatible schema version ${manifest.schema.version}`);
    }

    const projectId = options.projectName || manifest.name;
    const prefix = sanitizeProjectId(projectId);

    // Create project tables if new
    if (!options.merge) {
      this.db.exec(createProjectTables(projectId));
    }

    // Check embedding model mismatch
    const currentModel = this.db.get<{ name: string }>(`SELECT name FROM embedding_models LIMIT 1`);
    const modelMismatch = currentModel && currentModel.name !== manifest.embedding.model;

    // Clear existing data if not merging
    if (!options.merge) {
      // Tables may or may not have data; DELETE is safe
      try { this.db.run(`DELETE FROM ${prefix}_vectors`); } catch { /* table may not exist yet */ }
      try { this.db.run(`DELETE FROM ${prefix}_relationships`); } catch { /* */ }
      try { this.db.run(`DELETE FROM ${prefix}_messages`); } catch { /* */ }
      try { this.db.run(`DELETE FROM ${prefix}_sessions`); } catch { /* */ }
      try { this.db.run(`DELETE FROM ${prefix}_entities`); } catch { /* */ }
    }

    const counts: Record<string, number> = {};

    // Import entities
    if (data.entities) {
      let count = 0;
      for (const entity of data.entities as Record<string, unknown>[]) {
        try {
          this.db.run(`
            INSERT OR REPLACE INTO ${prefix}_entities
            (id, qualified_name, name, type, content, summary, metadata,
             file_path, start_line, end_line, hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            entity.id, entity.qualified_name, entity.name, entity.type,
            entity.content, entity.summary,
            typeof entity.metadata === 'string' ? entity.metadata : JSON.stringify(entity.metadata || null),
            entity.file_path, entity.start_line, entity.end_line,
            entity.hash, entity.created_at, entity.updated_at
          ]);
          count++;
        } catch { /* skip */ }
      }
      counts.entities = count;
    }

    // Import vectors
    if (data.vectors) {
      let count = 0;
      for (const v of data.vectors as Record<string, unknown>[]) {
        try {
          this.db.run(`
            INSERT OR REPLACE INTO ${prefix}_vectors
            (id, entity_id, model_id, embedding, content_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            v.id, v.entity_id, v.model_id,
            typeof v.embedding === 'string' ? v.embedding : JSON.stringify(v.embedding),
            v.content_hash, v.created_at
          ]);
          count++;
        } catch { /* skip orphaned */ }
      }
      counts.vectors = count;
    }

    // Import relationships
    if (data.relationships) {
      let count = 0;
      for (const rel of data.relationships as Record<string, unknown>[]) {
        try {
          this.db.run(`
            INSERT OR REPLACE INTO ${prefix}_relationships
            (id, source_id, target_id, relationship, weight, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            rel.id, rel.source_id, rel.target_id,
            rel.relationship || rel.type, rel.weight,
            typeof rel.metadata === 'string' ? rel.metadata : JSON.stringify(rel.metadata || null),
            rel.created_at
          ]);
          count++;
        } catch { /* skip */ }
      }
      counts.relationships = count;
    }

    // Import sessions
    if (data.sessions) {
      let count = 0;
      for (const s of data.sessions as Record<string, unknown>[]) {
        try {
          this.db.run(`
            INSERT OR REPLACE INTO ${prefix}_sessions
            (id, name, status, summary, message_count, created_at, updated_at, archived_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [s.id, s.name, s.status, s.summary, s.message_count, s.created_at, s.updated_at, s.archived_at]);
          count++;
        } catch { /* skip */ }
      }
      counts.sessions = count;
    }

    // Import messages
    if (data.messages) {
      let count = 0;
      for (const m of data.messages as Record<string, unknown>[]) {
        try {
          this.db.run(`
            INSERT OR REPLACE INTO ${prefix}_messages
            (id, session_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            m.id, m.session_id, m.role, m.content,
            typeof m.metadata === 'string' ? m.metadata : JSON.stringify(m.metadata || null),
            m.created_at
          ]);
          count++;
        } catch { /* skip */ }
      }
      counts.messages = count;
    }

    // Register project in global projects table
    const existingProject = this.db.get<{ id: string }>(`SELECT id FROM projects WHERE name = ?`, [projectId]);
    if (!existingProject) {
      const projectRow = {
        id: projectId,
        name: projectId,
        path: absolutePath,
        config: JSON.stringify({
          kb: {
            source: path.basename(absolutePath),
            version: manifest.version,
            installedAt: new Date().toISOString(),
            embeddingModel: manifest.embedding.model
          }
        })
      };
      this.db.run(
        `INSERT INTO projects (id, name, path, config) VALUES (?, ?, ?, ?)`,
        [projectRow.id, projectRow.name, projectRow.path, projectRow.config]
      );
    }

    // Ensure embedding model is registered
    if (manifest.embedding.model !== 'unknown') {
      const modelId = `${manifest.embedding.provider}:${manifest.embedding.model}`;
      const existingModel = this.db.get<{ id: string }>(`SELECT id FROM embedding_models WHERE id = ?`, [modelId]);
      if (!existingModel) {
        this.db.run(
          `INSERT INTO embedding_models (id, name, provider, dimensions) VALUES (?, ?, ?, ?)`,
          [modelId, manifest.embedding.model, manifest.embedding.provider, manifest.embedding.dimensions]
        );
      }
    }

    this.db.save();

    return {
      projectId,
      manifest,
      counts,
    };
  }

  /**
   * Read manifest from a .ctx-kb file without installing.
   */
  info(kbPath: string): KBManifest {
    const absolutePath = path.resolve(kbPath);
    const compressed = fs.readFileSync(absolutePath);
    const json = zlib.gunzipSync(compressed).toString('utf-8');
    const kbPackage = JSON.parse(json) as KBPackage;
    return kbPackage.manifest;
  }

  /**
   * List installed knowledge bases (projects with KB metadata).
   */
  list(): Array<{ projectId: string; name: string; version: string; source: string; installedAt: string }> {
    const projects = this.db.all<{ id: string; name: string; config: string }>(
      `SELECT id, name, config FROM projects WHERE config IS NOT NULL`
    );

    const kbs: Array<{ projectId: string; name: string; version: string; source: string; installedAt: string }> = [];
    for (const p of projects) {
      try {
        const config = JSON.parse(p.config);
        if (config.kb) {
          kbs.push({
            projectId: p.id,
            name: p.name,
            version: config.kb.version || '?',
            source: config.kb.source || '?',
            installedAt: config.kb.installedAt || '?'
          });
        }
      } catch { /* skip invalid config */ }
    }

    return kbs;
  }
}
