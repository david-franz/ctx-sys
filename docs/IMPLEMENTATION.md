# Implementation Plan

This document provides an overview of the implementation plan for ctx-sys, organized by phase. Each feature has a detailed specification in its own file.

## Overview

ctx-sys is implemented in 12 phases, progressing from foundational infrastructure to advanced context management patterns and integrations:

| Phase | Focus | Features | Status |
|-------|-------|----------|--------|
| 1 | Foundation | Database, projects, entities, embeddings, MCP server | ✅ Complete |
| 2 | Code Intelligence | AST parsing, summarization, indexing, relationships, git sync | ✅ Complete |
| 3 | Conversation Memory | Messages, sessions, summarization, decision extraction | ✅ Complete |
| 4 | Document Intelligence | Markdown parsing, requirements, code linking | ✅ Complete |
| 5 | Graph RAG | Graph traversal, entity resolution, semantic links | ✅ Complete |
| 6 | Advanced Retrieval | Query parsing, multi-strategy search, HyDE, gating, critique | ✅ Complete |
| 7 | Configuration & Polish | Configuration, model abstraction, watch mode, CLI | ✅ Complete |
| 8 | Agent Patterns | Checkpointing, hot/cold memory API, reflection, proactive context | ✅ Complete |
| 9 | Analytics & Distribution | Token analytics, git hooks, support docs, website, npm | ✅ Complete |
| 10 | RAG Enhancements | Code content, scalable indexing, LLM summaries, robustness, Graph RAG | ✅ Complete |
| 10b | MCP Tool Fixes | Fix 15 bugs/stubs discovered during systematic MCP testing | ✅ Complete |
| 10i | Code Quality & New Formats | CoreService split, type safety, logging, PDF/CSV/XML, MCP consolidation | Planned |
| 11 | Integration & Team | VS Code extension, auto context injection, team knowledge base | Planned |
| 12 | Commercial & Enterprise | Auth & SSO, desktop app, licensing & billing, telemetry | Planned |

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

## Phase 9: Analytics, Support, & Web

Analytics infrastructure, support portal, and public-facing web presence.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F9.1** | Token Analytics | [F9.1-token-analytics.md](phase-9/F9.1-token-analytics.md) |
| **F9.2** | Git Hooks | [F9.2-git-hooks.md](phase-9/F9.2-git-hooks.md) |
| **F9.3** | Support & Docs | [F9.3-support-docs.md](phase-9/F9.3-support-docs.md) |
| **F9.4** | Product Website | [F9.4-product-website.md](phase-9/F9.4-product-website.md) |
| **F9.5** | NPM Distribution | [F9.5-npm-distribution.md](phase-9/F9.5-npm-distribution.md) |

## Phase 10: RAG Enhancements

Critical improvements to make RAG production-quality — storing real code, handling large codebases, intelligent summaries, universal document indexing, proper search infrastructure (FTS5 + ANN vectors), smart context expansion, and advanced query processing.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10.0** | Core Service Layer | [F10.0-core-service-layer.md](phase-10/F10.0-core-service-layer.md) | ✅ Complete |
| **F10.1** | Code Content Storage | [F10.1-code-content-storage.md](phase-10/F10.1-code-content-storage.md) | ✅ Complete |
| **F10.2** | Incremental Embedding | [F10.2-incremental-embedding.md](phase-10/F10.2-incremental-embedding.md) | ✅ Complete |
| **F10.3** | Scalable Indexing | [F10.3-scalable-indexing.md](phase-10/F10.3-scalable-indexing.md) | ✅ Complete |
| **F10.4** | Smart Context Assembly | [F10.4-smart-context-assembly.md](phase-10/F10.4-smart-context-assembly.md) | ✅ Complete |
| **F10.5** | Auto Relationship Extraction | [F10.5-auto-relationship-extraction.md](phase-10/F10.5-auto-relationship-extraction.md) | ✅ Complete |
| **F10.6** | LLM-Generated Summaries | [F10.6-llm-summaries.md](phase-10/F10.6-llm-summaries.md) | ✅ Complete |
| **F10.7** | CLI Completeness | [F10.7-cli-completeness.md](phase-10/F10.7-cli-completeness.md) | ✅ Complete |
| **F10.8** | Robustness Improvements | [F10.8-robustness-improvements.md](phase-10/F10.8-robustness-improvements.md) | ✅ Complete |
| **F10.9** | Universal Document Indexing + Graph RAG | [F10.9-graph-rag-extraction.md](phase-10/F10.9-graph-rag-extraction.md) | ✅ Complete |
| **F10.10** | Native SQLite + FTS5 | [F10.10-native-sqlite-fts5.md](phase-10/F10.10-native-sqlite-fts5.md) | ✅ Complete |
| **F10.11** | Smart Context Expansion | [F10.11-smart-context-expansion.md](phase-10/F10.11-smart-context-expansion.md) | ✅ Complete |
| **F10.12** | Advanced Query Pipeline | [F10.12-advanced-query-pipeline.md](phase-10/F10.12-advanced-query-pipeline.md) | ✅ Complete |
| **F10.13** | Incremental Document Updates | [F10.13-incremental-doc-updates.md](phase-10/F10.13-incremental-doc-updates.md) | ✅ Complete |
| **F10.14** | Embedding Quality | [F10.14-embedding-quality.md](phase-10/F10.14-embedding-quality.md) | ✅ Complete |

**Key Deliverables:**
- ✅ Store actual source code in entities (not just descriptions)
- ✅ Stream-based indexing that handles 100k+ entity codebases
- ✅ Return usable code snippets from context_query (not just file paths)
- ✅ Only re-embed changed entities (incremental updates)
- ✅ Automatically extract call graphs and type relationships
- ✅ LLM-generated summaries for semantic understanding (Ollama or cloud)
- ✅ Full CLI access to all features (30+ commands)
- ✅ Replace hand-rolled glob/YAML/import detection with npm packages (picomatch, yaml)
- ✅ Universal document indexing: markdown, YAML, JSON, TOML, plain text with DocumentIndexer
- ✅ LLM-powered entity and relationship extraction from any document (Ollama qwen3:0.6b)
- ✅ Native SQLite with better-sqlite3, FTS5 full-text search with BM25 ranking
- ✅ Parent/child context expansion — methods include their class, functions include imports
- ✅ Query decomposition for multi-part questions + LLM re-ranking pipeline
- ✅ Incremental document updates with hash-based change detection + directory indexing
- ✅ Overlapping chunk embeddings for long entities — smart boundary detection

---

## Phase 10b: MCP Tool Fixes (Complete)

Systematic testing of all 33 MCP tools revealed 10 bugs and 5 placeholder stubs. All 15 fixed.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10b.1** | Fix context_query Empty Results | [F10b.1-context-query-fix.md](phase-10b/F10b.1-context-query-fix.md) | ✅ Done |
| **F10b.2** | Fix search_entities Type Filter | [F10b.2-search-entities-type-filter.md](phase-10b/F10b.2-search-entities-type-filter.md) | ✅ Done |
| **F10b.3** | Fix link_entities Name Resolution | [F10b.3-link-entities-resolution.md](phase-10b/F10b.3-link-entities-resolution.md) | ✅ Done |
| **F10b.4** | Fix get_graph_stats Node Counting | [F10b.4-graph-stats-nodes.md](phase-10b/F10b.4-graph-stats-nodes.md) | ✅ Done |
| **F10b.5** | Fix search_decisions Returns 0 | [F10b.5-search-decisions-fix.md](phase-10b/F10b.5-search-decisions-fix.md) | ✅ Done |
| **F10b.6** | Fix store_message Auto-Create Session | [F10b.6-store-message-auto-session.md](phase-10b/F10b.6-store-message-auto-session.md) | ✅ Done |
| **F10b.7** | Fix summarize_session LLM Integration | [F10b.7-summarize-session-llm.md](phase-10b/F10b.7-summarize-session-llm.md) | ✅ Done |
| **F10b.8** | Fix checkpoint_save Step Numbering | [F10b.8-checkpoint-save-step.md](phase-10b/F10b.8-checkpoint-save-step.md) | ✅ Done |
| **F10b.9** | Fix checkpoint_load State Nesting | [F10b.9-checkpoint-load-nesting.md](phase-10b/F10b.9-checkpoint-load-nesting.md) | ✅ Done |
| **F10b.10** | Fix reflection_query Search + Filters | [F10b.10-reflection-query-fix.md](phase-10b/F10b.10-reflection-query-fix.md) | ✅ Done |
| **F10b.11** | Fix Analytics Inflated Token Savings | [F10b.11-analytics-inflated-stats.md](phase-10b/F10b.11-analytics-inflated-stats.md) | ✅ Done |
| **F10b.12** | Wire Memory Tier Tools | [F10b.12-memory-tier-wiring.md](phase-10b/F10b.12-memory-tier-wiring.md) | ✅ Done |
| **F10b.13** | Implement hooks_install | [F10b.13-hooks-install.md](phase-10b/F10b.13-hooks-install.md) | ✅ Done |
| **F10b.14** | Implement hooks_impact_report | [F10b.14-hooks-impact-report.md](phase-10b/F10b.14-hooks-impact-report.md) | ✅ Done |
| **F10b.15** | Fix analytics_dashboard topEntities | [F10b.15-dashboard-top-entities.md](phase-10b/F10b.15-dashboard-top-entities.md) | ✅ Done |

---

## Phase 10c: Retrieval Quality Improvements

Focused on improving search result quality, document RAG, and analytics honesty. Identified through comprehensive MCP testing and evaluation of the system's retrieval pipeline.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10c.1** | FTS5 CamelCase/PascalCase Tokenizer | [F10c.1-fts5-camelcase-tokenizer.md](phase-10c/F10c.1-fts5-camelcase-tokenizer.md) | ✅ Done |
| **F10c.2** | Embedding Model Quality & Prefixes | [F10c.2-embedding-model-quality.md](phase-10c/F10c.2-embedding-model-quality.md) | ✅ Done |
| **F10c.3** | Hybrid Reranking Pipeline | [F10c.3-hybrid-reranking.md](phase-10c/F10c.3-hybrid-reranking.md) | ✅ Done |
| **F10c.4** | Document Chunking Improvements | [F10c.4-document-chunking.md](phase-10c/F10c.4-document-chunking.md) | ✅ Done |
| **F10c.5** | Search Strategy Auto-Tuning | [F10c.5-search-auto-tuning.md](phase-10c/F10c.5-search-auto-tuning.md) | ✅ Done |
| **F10c.6** | Realistic Analytics Baselines | [F10c.6-analytics-baseline.md](phase-10c/F10c.6-analytics-baseline.md) | ✅ Done |
| **F10c.7** | Query Understanding & Expansion | [F10c.7-query-expansion.md](phase-10c/F10c.7-query-expansion.md) | ✅ Done |
| **F10c.8** | Code-Aware Context Assembly | [F10c.8-code-aware-assembly.md](phase-10c/F10c.8-code-aware-assembly.md) | ✅ Done |

**Key Deliverables:**
- Fix FTS5 to split PascalCase/camelCase/snake_case identifiers for better code search
- Add model-specific prompt prefixes (search_query/search_document) for nomic-embed-text
- Implement heuristic reranking to boost exact name matches and penalize stubs
- Add size-constrained document chunking with overlap between chunks
- Auto-tune search strategy weights based on query type (name vs conceptual)
- Replace misleading full-context baseline with realistic grep+read comparison
- Expand queries with domain-specific synonyms (database → sqlite, storage, etc.)
- Show class signatures instead of truncated raw code in context assembly

---

## Phase 10d: Bug Fixes & Cleanup (Complete)

Full system testing (CLI + MCP) revealed that the core `context_query` tool was broken, CLI and MCP used different databases, and analytics produced dishonest metrics. This phase removes analytics and fixes critical issues.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10d.1** | Remove Analytics System | [F10d.1-remove-analytics.md](phase-10d/F10d.1-remove-analytics.md) | ✅ Done |
| **F10d.2** | Unify CLI/MCP Database Path | [F10d.2-unify-database.md](phase-10d/F10d.2-unify-database.md) | ✅ Done |
| **F10d.3** | Fix context_query Empty Results | [F10d.3-fix-context-query.md](phase-10d/F10d.3-fix-context-query.md) | ✅ Done |
| **F10d.4** | Fix reflection_query Search | [F10d.4-fix-reflection-query.md](phase-10d/F10d.4-fix-reflection-query.md) | ✅ Done |
| **F10d.5** | Fix embed CLI Stub | [F10d.5-fix-embed-cli.md](phase-10d/F10d.5-fix-embed-cli.md) | ✅ Done |
| **F10d.6** | Fix search_entities Ranking | [F10d.6-fix-search-ranking.md](phase-10d/F10d.6-fix-search-ranking.md) | ✅ Done |
| **F10d.7** | CLI `context` Command | [F10d.7-cli-context-command.md](phase-10d/F10d.7-cli-context-command.md) | ✅ Done |
| **F10d.8** | HTML Document Indexing | [F10d.8-html-document-support.md](phase-10d/F10d.8-html-document-support.md) | ✅ Done |

---

## Phase 10e: Knowledge Bases & Long-Term Context

Shareable knowledge bases, full retrieval pipeline integration, conversation intelligence, and team instructions.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10e.1** | Wire Full Retrieval Pipeline | [F10e.1-wire-retrieval-pipeline.md](phase-10e/F10e.1-wire-retrieval-pipeline.md) | ✅ Done |
| **F10e.2** | Fix Export/Import (Vectors + Content) | [F10e.2-fix-export-import.md](phase-10e/F10e.2-fix-export-import.md) | ✅ Done |
| **F10e.3** | Embedding Model Version Tracking | [F10e.3-model-version-tracking.md](phase-10e/F10e.3-model-version-tracking.md) | ✅ Done |
| **F10e.4** | Knowledge Base Packaging (.ctx-kb) | [F10e.4-knowledge-base-packaging.md](phase-10e/F10e.4-knowledge-base-packaging.md) | ✅ Done |
| **F10e.5** | Conversation Intelligence | [F10e.5-conversation-intelligence.md](phase-10e/F10e.5-conversation-intelligence.md) | ✅ Done |
| **F10e.6** | Incremental Session Summaries | [F10e.6-incremental-summaries.md](phase-10e/F10e.6-incremental-summaries.md) | ✅ Done |
| **F10e.7** | Team Instructions | [F10e.7-team-instructions.md](phase-10e/F10e.7-team-instructions.md) | ✅ Done |

**Key Deliverables:**

- Wire RetrievalGate, ContextExpander, QueryDecomposer, HyDE as opt-in options on context_query (CLI + MCP)
- Fix export/import to include vectors, content, and metadata — unblocks all distribution
- Knowledge base packaging: `ctx-sys kb create/install/info` with `.ctx-kb` format
- Conversation intelligence: message FTS5 + embeddings, persistent decisions, entity-message linking
- Incremental session summaries with version history
- Team instruction entity type with scope-based priority boosting

---

## Phase 10f: Retrieval Quality

Fix retrieval quality issues discovered during end-to-end testing: noise filtering, confidence metrics, source attribution, and result capping.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10f.1** | Relevance Floor — Stop Returning Noise | [F10f.1-relevance-floor.md](phase-10f/F10f.1-relevance-floor.md) | Done |
| **F10f.2** | Fix Confidence Metric (weighted top-k) | [F10f.2-confidence-metric.md](phase-10f/F10f.2-confidence-metric.md) | Done |
| **F10f.3** | Fix Source File Paths (property name mismatch) | [F10f.3-source-file-paths.md](phase-10f/F10f.3-source-file-paths.md) | Done |
| **F10f.4** | Cap Result Count — Quality Over Quantity | [F10f.4-result-count-cap.md](phase-10f/F10f.4-result-count-cap.md) | Done |
| **F10f.5** | HyDE Quality Guard | [F10f.5-hyde-guard.md](phase-10f/F10f.5-hyde-guard.md) | Done |
| **F10f.6** | Entity Type Scoring — Prefer Code Over File Stubs | [F10f.6-entity-type-scoring.md](phase-10f/F10f.6-entity-type-scoring.md) | Done |

**Key Problems:**
- Queries with no matches return 20+ noise results instead of "nothing found"
- Confidence metric averages all scores (including garbage) producing misleading numbers
- Source file paths always show `-` due to `file` vs `filePath` property mismatch
- Token budget fills with file stubs and irrelevant entities
- HyDE can make results worse when the concept doesn't exist in the codebase

---

## Phase 10g: Retrieval Foundations

Structural improvements to the retrieval pipeline: ignore patterns, score normalization, richer relationship extraction, cleaner context display, and configurable HyDE models.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10g.1** | .ctxignore + .gitignore Improvements | [F10g.1-ctxignore-gitignore.md](phase-10g/F10g.1-ctxignore-gitignore.md) | ✅ Done |
| **F10g.2** | Score Normalization (Multiplicative Reranking) | [F10g.2-score-normalization.md](phase-10g/F10g.2-score-normalization.md) | ✅ Done |
| **F10g.3** | Richer Relationship Extraction | [F10g.3-richer-relationships.md](phase-10g/F10g.3-richer-relationships.md) | ✅ Done |
| **F10g.4** | Improve extractCodeSummary Display | [F10g.4-extract-code-summary.md](phase-10g/F10g.4-extract-code-summary.md) | ✅ Done |
| **F10g.5** | HyDE Model Selection & Testing | [F10g.5-hyde-model-selection.md](phase-10g/F10g.5-hyde-model-selection.md) | ✅ Done |

**Key Goals:**
- Centralized ignore pattern resolution (.ctxignore + .gitignore) for indexer and document indexer
- Switch reranker from additive boosts to multiplicative scoring for normalized [0,1] scores
- Wire AST-extracted CALLS/EXTENDS/IMPLEMENTS/USES_TYPE relationships into the graph
- Natural language entity mention extraction for document-to-code linking
- Fix extractCodeSummary to produce clean class/function signatures without body code leakage
- Configurable HyDE model with benchmarking across available Ollama models

---

## Phase 10h: Infrastructure & Performance

Environment health diagnostics and native vector search for production-scale performance.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10h.1** | `ctx-sys doctor` — Environment Health Check | [F10h.1-ctx-doctor.md](phase-10h/F10h.1-ctx-doctor.md) | Done |
| **F10h.2** | Native Vector Search with sqlite-vec | [F10h.2-sqlite-vec.md](phase-10h/F10h.2-sqlite-vec.md) | Done |
| **F10h.3** | Bug Fixes: Coverage, Doctor, FTS Scoring | [F10h.3-bug-fixes.md](phase-10h/F10h.3-bug-fixes.md) | Done |
| **F10h.4** | Smarter CLI Defaults | [F10h.4-smarter-defaults.md](phase-10h/F10h.4-smarter-defaults.md) | Done |
| **F10h.5** | CLI Simplification (36 → 7+9) | [F10h.5-cli-simplification.md](phase-10h/F10h.5-cli-simplification.md) | Done |
| **F10h.6** | MCP context_query Defaults | [F10h.6-mcp-defaults.md](phase-10h/F10h.6-mcp-defaults.md) | Done |

**Key Goals:**
- Environment health diagnostics with `status --check`
- Native sqlite-vec for 50-100x faster semantic search
- Fix bugs: 135% coverage, doctor "not indexed", fake FTS scores
- Smarter defaults: doc, embed, semantic, expand all ON by default
- Simplified CLI: 7 core commands + 9 subcommand groups
- MCP context_query: expand and gate default ON for agents

---

## Phase 10i: Code Quality & New Formats

Architectural cleanup, type safety, new document formats, and MCP tool consolidation. Addresses technical debt identified during code review.

| Feature | Description | Doc | Status |
|---------|-------------|-----|--------|
| **F10i.1** | CoreService Decomposition | [F10i.1-core-service-decomposition.md](phase-10i/F10i.1-core-service-decomposition.md) | Planned |
| **F10i.2** | Type Safety — Eliminate `as any` Casts | [F10i.2-type-safety.md](phase-10i/F10i.2-type-safety.md) | Planned |
| **F10i.3** | Logging Abstraction | [F10i.3-logging-abstraction.md](phase-10i/F10i.3-logging-abstraction.md) | Planned |
| **F10i.4** | Async Cleanup | [F10i.4-async-cleanup.md](phase-10i/F10i.4-async-cleanup.md) | Planned |
| **F10i.5** | Reflection Store Integration | [F10i.5-reflection-store-integration.md](phase-10i/F10i.5-reflection-store-integration.md) | Planned |
| **F10i.6** | Scalable Entity Iteration | [F10i.6-scalable-entity-iteration.md](phase-10i/F10i.6-scalable-entity-iteration.md) | Planned |
| **F10i.7** | Test Infrastructure Fix | [F10i.7-test-infrastructure.md](phase-10i/F10i.7-test-infrastructure.md) | Planned |
| **F10i.8** | PDF, CSV & XML Document Support | [F10i.8-pdf-csv-xml-support.md](phase-10i/F10i.8-pdf-csv-xml-support.md) | Planned |
| **F10i.9** | MCP Tool Consolidation (30 → 12) | [F10i.9-mcp-tool-consolidation.md](phase-10i/F10i.9-mcp-tool-consolidation.md) | Planned |
| **F10i.10** | Clean Error Messages | [F10i.10-error-messages.md](phase-10i/F10i.10-error-messages.md) | Planned |

**Key Deliverables:**

- Split CoreService (1051 lines, 43 methods) into 8 focused domain services behind a facade
- Remove all 28 `as any` casts with type guards and const-derived unions
- Injectable logger interface replacing 19 bare `console.*` calls in library code
- Remove vestigial `async` from 13+ synchronous EntityStore methods
- Wire up the full ReflectionStore (557 lines, currently dead code) replacing the message-based workaround
- Paginated entity iteration for embedding generation (replace `list({ limit: 100000 })`)
- Fix Jest/ESM test configuration so `npm test` passes reliably
- PDF, CSV, and XML document indexing with type-specific entity extraction
- Consolidate 30 MCP tools into 12 action-based tools for better LLM ergonomics
- Structured error hierarchy replacing raw `TypeError: fetch failed` with actionable messages and fix suggestions

---

## Phase 11: Integration & Team

Deep IDE integration, automatic context injection, and team collaboration features.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F11.0** | VS Code Extension | [F11.0-vscode-extension.md](phase-11/F11.0-vscode-extension.md) |
| **F11.1** | Automatic Context Injection | [F11.1-automatic-context-injection.md](phase-11/F11.1-automatic-context-injection.md) |
| **F11.2** | Team Knowledge | [F11.2-team-knowledge-base.md](phase-11/F11.2-team-knowledge-base.md) |

**Key Deliverables:**
- Native VS Code extension for full IDE integration
- Automatic context injection based on user activity and messages
- Shared team knowledge base and decision tracking

---

## Phase 12: Commercial Desktop & Enterprise

Authentication, standalone desktop application, and enterprise monetization features.

| Feature | Description | Doc |
|---------|-------------|-----|
| **F12.0** | Auth & SSO | [F12.0-auth-sso.md](phase-12/F12.0-auth-sso.md) |
| **F12.1** | Desktop App | [F12.1-desktop-app.md](phase-12/F12.1-desktop-app.md) |
| **F12.2** | Licensing & Billing | [F12.2-licensing-billing.md](phase-12/F12.2-licensing-billing.md) |
| **F12.3** | Telemetry | [F12.3-telemetry-analytics.md](phase-12/F12.3-telemetry-analytics.md) |

**Key Deliverables:**
- Enterprise SSO (Google/GitHub/SAML)
- Production-ready desktop application
- Licensing and billing integration
- Telemetry for product usage insights

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
│   ├── indexer/               # Indexing (F2.3, F10.2)
│   ├── relationships/         # Relationships (F2.4)
│   ├── git/                   # Git Sync (F2.5)
│   ├── conversation/          # Conversations (F3.x)
│   ├── documents/             # Documents (F4.x)
│   ├── graph/                 # Graph RAG (F5.x)
│   ├── retrieval/             # Retrieval (F6.x, F10.3)
│   ├── config/                # Config (F7.1)
│   ├── models/                # Models (F7.2)
│   ├── watch/                 # Watch (F7.3)
│   ├── cli/                   # CLI (F7.4)
│   ├── agent/                 # Agent Patterns (F8.x)
│   │   ├── checkpoints.ts     # Checkpoint save/restore
│   │   ├── memory-tier.ts     # Hot/cold memory API
│   │   ├── reflection.ts      # Lesson storage
│   │   └── proactive.ts       # Proactive context
│   ├── core/                  # Core Service Layer (F10.0)
│   │   └── service.ts         # Unified business logic API
│   └── team/                  # Team Knowledge (F11.2)
├── vscode-extension/          # VS Code Extension (F11.1)
│   ├── src/
│   ├── package.json
│   └── README.md
├── tests/
│   ├── helpers/
│   ├── phase-1/ ... phase-12/
├── docs/
│   ├── phase-1/ ... phase-12/
├── package.json
├── tsconfig.json
└── README.md
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Database | SQLite (better-sqlite3) + FTS5 |
| AST Parsing | tree-sitter |
| Embeddings (local) | Ollama (nomic-embed-text) |
| Embeddings (cloud) | OpenAI (text-embedding-3-small) |
| Summaries (local) | Ollama (qwen3:0.6b) |
| Summaries (cloud) | OpenAI (gpt-4o-mini), Anthropic (claude-3-haiku) |
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

1. **Phases 1-9** — Foundation through analytics ✅ Complete
2. **Phase 10.0-10.7** — RAG Enhancements ✅ Complete
3. **Phase 10.8-10.14** — RAG Enhancements ✅ Complete
4. **Phase 11** — Integration (VS Code -> Auto-inject -> Team)
5. **Phase 12** — Commercial (Auth/SSO -> Desktop -> Billing -> Telemetry)

---

## Getting Started

1. Start with Phase 1 features in order
2. Each feature doc contains full implementation details
3. Run tests after completing each feature
4. Proceed to next phase once current phase is complete
5. See Phase 10d for critical bug fixes applied after system testing
