# Implementation Plan

This document provides an overview of the implementation plan for ctx-sys, organized by phase. Each feature has a detailed specification in its own file.

## Overview

ctx-sys is implemented in 9 phases, progressing from foundational infrastructure to advanced context management patterns and integrations:

| Phase | Focus | Features |
|-------|-------|----------|
| 1 | Foundation | Database, projects, entities, embeddings, MCP server |
| 2 | Code Intelligence | AST parsing, summarization, indexing, relationships, git sync |
| 3 | Conversation Memory | Messages, sessions, summarization, decision extraction |
| 4 | Document Intelligence | Markdown parsing, requirements, code linking |
| 5 | Graph RAG | Graph traversal, entity resolution, semantic links |
| 6 | Advanced Retrieval | Query parsing, multi-strategy search, HyDE, gating, critique |
| 7 | Configuration & Polish | Configuration, model abstraction, watch mode, CLI |
| 8 | Agent Patterns | Checkpointing, hot/cold memory API, reflection, proactive context |
| 9 | Integrations & Analytics | VS Code extension, token analytics, team knowledge, git hooks |

### Context Management Patterns

This implementation covers all six context management patterns from modern AI agent research:

| Pattern | Implementation | Phase |
|---------|---------------|-------|
| **Rolling Summaries + Entity Memory** | Session summarization, decision extraction, entity storage | 3, 1 |
| **Checkpointed Agent Graphs** | Agent state snapshots, resumable execution | 8 |
| **Hot vs Cold Memory** | Explicit memory tiering API, access-pattern promotion | 8 |
| **Adaptive Retrieval (Gate→Draft→Critique)** | Retrieval gating, draft-critique loop | 6 |
| **HyDE Query Expansion** | Hypothetical document generation for better recall | 6 |
| **Reflection & Self-Improvement** | Lesson storage, cross-session learning | 8 |

---

## Phase 1: Foundation

Establishes the core infrastructure for data storage and the MCP server.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F1.1** | Database Schema | [F1.1-database-schema.md](phase-1/F1.1-database-schema.md) |
| **F1.2** | Project Management | [F1.2-project-management.md](phase-1/F1.2-project-management.md) |
| **F1.3** | Entity Storage | [F1.3-entity-storage.md](phase-1/F1.3-entity-storage.md) |
| **F1.4** | Embedding Pipeline | [F1.4-embedding-pipeline.md](phase-1/F1.4-embedding-pipeline.md) |
| **F1.5** | MCP Server | [F1.5-mcp-server.md](phase-1/F1.5-mcp-server.md) |

**Key Deliverables:**
- SQLite database with sqlite-vec for vectors
- Project CRUD and configuration
- Entity storage with FTS
- Embedding generation (Ollama/OpenAI)
- Basic MCP server with tool registration

---

## Phase 2: Code Intelligence

Adds the ability to understand and index codebases.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F2.1** | AST Parsing | [F2.1-ast-parsing.md](phase-2/F2.1-ast-parsing.md) |
| **F2.2** | Symbol Summarization | [F2.2-symbol-summarization.md](phase-2/F2.2-symbol-summarization.md) |
| **F2.3** | Codebase Indexing | [F2.3-codebase-indexing.md](phase-2/F2.3-codebase-indexing.md) |
| **F2.4** | Relationship Extraction | [F2.4-relationship-extraction.md](phase-2/F2.4-relationship-extraction.md) |
| **F2.5** | Git Diff Processing | [F2.5-git-diff-processing.md](phase-2/F2.5-git-diff-processing.md) |

**Key Deliverables:**
- Multi-language AST parsing (tree-sitter)
- AI-generated symbol summaries
- Full codebase indexing with progress
- Import/call/inheritance relationships
- Incremental updates from git

---

## Phase 3: Conversation Memory

Enables storage and retrieval of conversation history.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F3.1** | Message Storage | [F3.1-message-storage.md](phase-3/F3.1-message-storage.md) |
| **F3.2** | Session Management | [F3.2-session-management.md](phase-3/F3.2-session-management.md) |
| **F3.3** | Conversation Summarization | [F3.3-conversation-summarization.md](phase-3/F3.3-conversation-summarization.md) |
| **F3.4** | Decision Extraction | [F3.4-decision-extraction.md](phase-3/F3.4-decision-extraction.md) |

**Key Deliverables:**
- Verbatim message storage with metadata
- Session lifecycle (active/archived/summarized)
- AI-generated session summaries
- Automatic decision detection

---

## Phase 4: Document Intelligence

Adds understanding of markdown documentation.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F4.1** | Markdown Parsing | [F4.1-markdown-parsing.md](phase-4/F4.1-markdown-parsing.md) |
| **F4.2** | Requirement Extraction | [F4.2-requirement-extraction.md](phase-4/F4.2-requirement-extraction.md) |
| **F4.3** | Document-Code Linking | [F4.3-document-code-linking.md](phase-4/F4.3-document-code-linking.md) |

**Key Deliverables:**
- Hierarchical section extraction
- Requirements/user story detection
- Automatic linking between docs and code

---

## Phase 5: Graph RAG

Enables graph-based context retrieval.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F5.1** | Graph Storage | [F5.1-graph-storage.md](phase-5/F5.1-graph-storage.md) |
| **F5.2** | Entity Resolution | [F5.2-entity-resolution.md](phase-5/F5.2-entity-resolution.md) |
| **F5.3** | Semantic Relationships | [F5.3-semantic-relationships.md](phase-5/F5.3-semantic-relationships.md) |

**Key Deliverables:**
- Efficient graph traversal (recursive CTEs)
- Duplicate detection and merging
- Automatic semantic relationship discovery

---

## Phase 6: Advanced Retrieval

The core context retrieval system with advanced patterns for optimal context selection.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F6.1** | Query Parsing | [F6.1-query-parsing.md](phase-6/F6.1-query-parsing.md) |
| **F6.2** | Multi-Strategy Search | [F6.2-multi-strategy-search.md](phase-6/F6.2-multi-strategy-search.md) |
| **F6.3** | Context Assembly | [F6.3-context-assembly.md](phase-6/F6.3-context-assembly.md) |
| **F6.4** | Relevance Feedback | [F6.4-relevance-feedback.md](phase-6/F6.4-relevance-feedback.md) |
| **F6.5** | HyDE Query Expansion | [F6.5-hyde-query-expansion.md](phase-6/F6.5-hyde-query-expansion.md) |
| **F6.6** | Retrieval Gating | [F6.6-retrieval-gating.md](phase-6/F6.6-retrieval-gating.md) |
| **F6.7** | Draft-Critique Loop | [F6.7-draft-critique-loop.md](phase-6/F6.7-draft-critique-loop.md) |

**Key Deliverables:**
- Intent and entity extraction from queries
- Combined vector/graph/FTS search with RRF
- Token-aware context formatting
- Learning from usage patterns
- Hypothetical document embeddings for better recall
- Smart gating to avoid unnecessary retrievals
- Self-critique for hallucination prevention

---

## Phase 7: Configuration & Polish

Final polish and developer experience.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F7.1** | Configuration System | [F7.1-configuration.md](phase-7/F7.1-configuration.md) |
| **F7.2** | Model Abstraction | [F7.2-model-abstraction.md](phase-7/F7.2-model-abstraction.md) |
| **F7.3** | Watch Mode | [F7.3-watch-mode.md](phase-7/F7.3-watch-mode.md) |
| **F7.4** | CLI Interface | [F7.4-cli-interface.md](phase-7/F7.4-cli-interface.md) |

**Key Deliverables:**
- YAML configuration (global + per-project)
- Automatic model fallback
- Real-time file watching
- Complete CLI with all commands

---

## Phase 8: Agent Patterns

Implements advanced context management patterns for AI agents.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F8.1** | Agent Checkpointing | [F8.1-agent-checkpointing.md](phase-8/F8.1-agent-checkpointing.md) |
| **F8.2** | Hot/Cold Memory API | [F8.2-hot-cold-memory-api.md](phase-8/F8.2-hot-cold-memory-api.md) |
| **F8.3** | Reflection Storage | [F8.3-reflection-storage.md](phase-8/F8.3-reflection-storage.md) |
| **F8.4** | Proactive Context | [F8.4-proactive-context.md](phase-8/F8.4-proactive-context.md) |

**Key Deliverables:**
- Checkpoint save/restore for resumable agent execution
- Explicit hot/cold memory management with access-pattern promotion
- Lesson storage and cross-session learning
- Push-based context suggestions based on current activity

---

## Phase 9: Integrations & Analytics

Make value visible and reduce friction through integrations.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F9.1** | VS Code Extension | [F9.1-vscode-extension.md](phase-9/F9.1-vscode-extension.md) |
| **F9.2** | Token Analytics | [F9.2-token-analytics.md](phase-9/F9.2-token-analytics.md) |
| **F9.3** | Team Knowledge Base | [F9.3-team-knowledge-base.md](phase-9/F9.3-team-knowledge-base.md) |
| **F9.4** | Git Hooks | [F9.4-git-hooks.md](phase-9/F9.4-git-hooks.md) |

**Key Deliverables:**
- Native VS Code sidebar with context panel and commands
- Token savings dashboard with cost estimates
- Shared team decisions and cross-member knowledge search
- Automatic indexing on commit/merge with PR context suggestions

---

## File Structure

```
ctx-sys/
├── src/
│   ├── db/                    # Database (F1.1)
│   ├── project/               # Projects (F1.2)
│   ├── entities/              # Entities (F1.3)
│   ├── embeddings/            # Embeddings (F1.4)
│   ├── mcp/                   # MCP Server (F1.5)
│   ├── ast/                   # AST Parsing (F2.1)
│   ├── summarization/         # Summarization (F2.2)
│   ├── indexing/              # Indexing (F2.3)
│   ├── relationships/         # Relationships (F2.4)
│   ├── git/                   # Git Sync (F2.5)
│   ├── conversation/          # Conversations (F3.x)
│   ├── documents/             # Documents (F4.x)
│   ├── graph/                 # Graph RAG (F5.x)
│   ├── retrieval/             # Retrieval (F6.x)
│   ├── config/                # Config (F7.1)
│   ├── models/                # Models (F7.2)
│   ├── watch/                 # Watch (F7.3)
│   ├── cli/                   # CLI (F7.4)
│   ├── agent/                 # Agent Patterns (F8.x)
│   │   ├── checkpoints.ts     # Checkpoint save/restore
│   │   ├── memory-tier.ts     # Hot/cold memory API
│   │   ├── reflection.ts      # Lesson storage
│   │   └── proactive.ts       # Proactive context
│   ├── analytics/             # Token Analytics (F9.2)
│   └── team/                  # Team Knowledge (F9.3)
├── vscode-extension/          # VS Code Extension (F9.1)
│   ├── src/
│   ├── package.json
│   └── README.md
├── tests/
│   ├── helpers/
│   ├── phase-1/
│   ├── phase-2/
│   ├── phase-3/
│   ├── phase-4/
│   ├── phase-5/
│   ├── phase-6/
│   ├── phase-7/
│   ├── phase-8/
│   └── phase-9/
├── docs/
│   ├── phase-1/
│   ├── phase-2/
│   ├── phase-3/
│   ├── phase-4/
│   ├── phase-5/
│   ├── phase-6/
│   ├── phase-7/
│   ├── phase-8/
│   └── phase-9/
├── package.json
├── tsconfig.json
└── README.md
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Database | SQLite + sqlite-vec |
| AST Parsing | tree-sitter |
| Embeddings (local) | Ollama (nomic-embed-text) |
| Embeddings (cloud) | OpenAI (text-embedding-3-small) |
| Summaries (local) | Ollama (qwen2.5-coder) |
| Summaries (cloud) | OpenAI (gpt-4o-mini) |
| MCP | @modelcontextprotocol/sdk |
| CLI | Commander.js |
| File watching | chokidar |
| VS Code Extension | vscode API, webview |
| Git Hooks | simple-git, husky |

---

## Testing Strategy

- **Unit tests**: Each module with mocked dependencies
- **Integration tests**: Full pipelines with test fixtures
- **Performance tests**: Large codebase benchmarks
- **E2E tests**: Full agent workflow simulations (Phase 8)

---

## Implementation Priority

For maximum value delivery, the recommended implementation order is:

1. **Phases 1-5** — Foundation (in order)
2. **Phase 6.1-6.4** — Core retrieval
3. **Phase 6.5-6.7** — Advanced retrieval patterns (HyDE, gating, critique)
4. **Phase 9.2** — Token analytics (prove value early)
5. **Phase 8.4** — Proactive context (key differentiator)
6. **Phase 8.1-8.3** — Agent patterns (checkpointing, hot/cold, reflection)
7. **Phase 7** — Configuration and polish
8. **Phase 9.1** — VS Code extension
9. **Phase 9.3-9.4** — Team features and git hooks

---

## Getting Started

1. Start with Phase 1 features in order
2. Each feature doc contains full implementation details
3. Run tests after completing each feature
4. Proceed to next phase once current phase is complete
5. Consider implementing Phase 9.2 (analytics) early to measure impact
