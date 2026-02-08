#!/usr/bin/env node

/**
 * ctx-sys CLI — Intelligent context management for AI coding assistants.
 *
 * Core commands: init, index, search, context, status, serve, watch
 * Subcommand groups: entity, graph, embed, summarize, session, config, debug, kb, instruction
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

// Core commands
import { createServeCommand } from './serve';
import { createInitCommand } from './init';
import { createIndexCommand } from './index-cmd';
import { createSearchCommand } from './search';
import { createContextCommand } from './context';
import { createWatchCommand } from './watch';
import { createStatusCommand } from './status';

// Subcommand group imports
import { createConfigCommand } from './config';
import { createSessionsCommand, createMessagesCommand } from './sessions';
import {
  createEntitiesCommand,
  createEntityCommand,
  createEntityDeleteCommand,
  createEntityStatsCommand
} from './entities';
import {
  createGraphCommand,
  createGraphStatsCommand,
  createRelationshipsCommand,
  createLinkCommand
} from './graph';
import {
  createEmbedCommand,
  createEmbedStatusCommand,
  createEmbedCleanupCommand
} from './embeddings';
import {
  createSummarizeCommand,
  createSummarizeStatusCommand,
  createProvidersCommand
} from './summarize';
import { createExtractRelCommand } from './extract-rel-cmd';
import { createSearchDecisionsCommand } from './search-decisions-cmd';
import { createKBCommand } from './kb';
import { createInstructionCommand } from './instructions';
import {
  createInspectCommand,
  createQueryCommand,
  createExportCommand,
  createImportCommand,
  createHealthCommand
} from './debug';

const program = new Command();

program
  .name('ctx-sys')
  .description('Intelligent context management system for AI coding assistants')
  .version(pkg.version);

// ─── Core Commands (top-level) ──────────────────────────────────────

program.addCommand(createInitCommand());
program.addCommand(createIndexCommand());
program.addCommand(createSearchCommand());
program.addCommand(createContextCommand());
program.addCommand(createStatusCommand());
program.addCommand(createServeCommand());
program.addCommand(createWatchCommand());

// ─── Subcommand Groups ──────────────────────────────────────────────

// entity: list, get, delete, stats, extract-rel
const entityGroup = new Command('entity')
  .description('Manage indexed entities');
entityGroup.addCommand(createEntitiesCommand());
entityGroup.addCommand(createEntityCommand());
entityGroup.addCommand(createEntityDeleteCommand());
entityGroup.addCommand(createEntityStatsCommand());
entityGroup.addCommand(createExtractRelCommand());
program.addCommand(entityGroup);

// graph: query, stats, relationships, link
const graphGroup = new Command('graph')
  .description('Explore entity relationship graph');
graphGroup.addCommand(createGraphCommand());
graphGroup.addCommand(createGraphStatsCommand());
graphGroup.addCommand(createRelationshipsCommand());
graphGroup.addCommand(createLinkCommand());
program.addCommand(graphGroup);

// embed: run, status, cleanup
const embedGroup = new Command('embed')
  .description('Manage embeddings for semantic search');
embedGroup.addCommand(createEmbedCommand());
embedGroup.addCommand(createEmbedStatusCommand());
embedGroup.addCommand(createEmbedCleanupCommand());
program.addCommand(embedGroup);

// summarize: run, status, providers
const summarizeGroup = new Command('summarize')
  .description('LLM-powered entity summarization');
summarizeGroup.addCommand(createSummarizeCommand());
summarizeGroup.addCommand(createSummarizeStatusCommand());
summarizeGroup.addCommand(createProvidersCommand());
program.addCommand(summarizeGroup);

// session: list, messages, search-decisions
const sessionGroup = new Command('session')
  .description('Manage conversation sessions');
sessionGroup.addCommand(createSessionsCommand());
sessionGroup.addCommand(createMessagesCommand());
sessionGroup.addCommand(createSearchDecisionsCommand());
program.addCommand(sessionGroup);

// config
program.addCommand(createConfigCommand());

// debug: inspect, query, export, import, health
const debugGroup = new Command('debug')
  .description('Database debugging and maintenance tools');
debugGroup.addCommand(createInspectCommand());
debugGroup.addCommand(createQueryCommand());
debugGroup.addCommand(createExportCommand());
debugGroup.addCommand(createImportCommand());
debugGroup.addCommand(createHealthCommand());
program.addCommand(debugGroup);

// kb (knowledge base)
program.addCommand(createKBCommand());

// instruction (team instructions)
program.addCommand(createInstructionCommand());

// Parse arguments
program.parse();
