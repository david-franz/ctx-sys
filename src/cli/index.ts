#!/usr/bin/env node

/**
 * F10.7: Complete CLI for ctx-sys context management system.
 */

import { Command } from 'commander';

// Core commands
import { createServeCommand } from './serve';
import { createInitCommand } from './init';
import { createIndexCommand } from './index-cmd';
import { createSearchCommand } from './search';
import { createWatchCommand } from './watch';
import { createConfigCommand } from './config';
import { createStatusCommand } from './status';

// Session commands (F10.7)
import { createSessionsCommand, createMessagesCommand } from './sessions';

// Entity commands (F10.7)
import {
  createEntitiesCommand,
  createEntityCommand,
  createEntityDeleteCommand,
  createEntityStatsCommand
} from './entities';

// Graph commands (F10.7)
import {
  createGraphCommand,
  createGraphStatsCommand,
  createRelationshipsCommand,
  createLinkCommand
} from './graph';

// Embedding commands (F10.7)
import {
  createEmbedCommand,
  createEmbedStatusCommand,
  createEmbedCleanupCommand
} from './embeddings';

// Summarization commands (F10.7)
import {
  createSummarizeCommand,
  createSummarizeStatusCommand,
  createProvidersCommand
} from './summarize';

// Analytics commands (F10.7)
import { createAnalyticsCommand, createDashboardCommand } from './analytics';

// Document indexing commands (F10.9)
import { createDocIndexCommand } from './doc-index-cmd';
import { createExtractRelCommand } from './extract-rel-cmd';

// Decision search (F10.7)
import { createSearchDecisionsCommand } from './search-decisions-cmd';

// Debug commands (F10.7)
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
  .version('0.1.0');

// Core commands
program.addCommand(createInitCommand());
program.addCommand(createIndexCommand());
program.addCommand(createSearchCommand());
program.addCommand(createWatchCommand());
program.addCommand(createConfigCommand());
program.addCommand(createStatusCommand());
program.addCommand(createServeCommand());

// Session commands
program.addCommand(createSessionsCommand());
program.addCommand(createMessagesCommand());

// Entity commands
program.addCommand(createEntitiesCommand());
program.addCommand(createEntityCommand());
program.addCommand(createEntityDeleteCommand());
program.addCommand(createEntityStatsCommand());

// Graph commands
program.addCommand(createGraphCommand());
program.addCommand(createGraphStatsCommand());
program.addCommand(createRelationshipsCommand());
program.addCommand(createLinkCommand());

// Embedding commands
program.addCommand(createEmbedCommand());
program.addCommand(createEmbedStatusCommand());
program.addCommand(createEmbedCleanupCommand());

// Summarization commands
program.addCommand(createSummarizeCommand());
program.addCommand(createSummarizeStatusCommand());
program.addCommand(createProvidersCommand());

// Analytics commands
program.addCommand(createAnalyticsCommand());
program.addCommand(createDashboardCommand());

// Document indexing commands
program.addCommand(createDocIndexCommand());
program.addCommand(createExtractRelCommand());

// Decision search
program.addCommand(createSearchDecisionsCommand());

// Debug commands (also available as top-level: inspect, query, export, import, health)
const debugCommand = new Command('debug')
  .description('Database debugging and maintenance tools');
debugCommand.addCommand(createInspectCommand());
debugCommand.addCommand(createQueryCommand());
debugCommand.addCommand(createExportCommand());
debugCommand.addCommand(createImportCommand());
debugCommand.addCommand(createHealthCommand());
program.addCommand(debugCommand);

// Also register debug commands as top-level for convenience
program.addCommand(createInspectCommand());
program.addCommand(createQueryCommand());
program.addCommand(createExportCommand());
program.addCommand(createImportCommand());
program.addCommand(createHealthCommand());

// Parse arguments
program.parse();
