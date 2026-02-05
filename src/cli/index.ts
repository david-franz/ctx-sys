#!/usr/bin/env node

import { Command } from 'commander';
import { createServeCommand } from './serve';
import { createInitCommand } from './init';
import { createIndexCommand } from './index-cmd';
import { createSearchCommand } from './search';
import { createWatchCommand } from './watch';
import { createConfigCommand } from './config';
import { createStatusCommand } from './status';

const program = new Command();

program
  .name('ctx-sys')
  .description('Intelligent context management system for AI coding assistants')
  .version('0.1.0');

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createIndexCommand());
program.addCommand(createSearchCommand());
program.addCommand(createWatchCommand());
program.addCommand(createConfigCommand());
program.addCommand(createStatusCommand());
program.addCommand(createServeCommand());

// Parse arguments
program.parse();
