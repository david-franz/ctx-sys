#!/usr/bin/env node

import { Command } from 'commander';
import { createServeCommand } from './serve';

const program = new Command();

program
  .name('ctx-sys')
  .description('Intelligent context management system for AI coding assistants')
  .version('0.1.0');

// Add commands
program.addCommand(createServeCommand());

// Parse arguments
program.parse();
