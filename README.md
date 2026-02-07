# ctx-sys

**Context System** - An intelligent context management framework for AI coding assistants.

## Why ctx-sys?

Modern AI coding assistants are limited by context windows. Long conversations lose important details, codebases are too large to fit in context, and relevant information is scattered across files, docs, and past conversations.

**ctx-sys** solves this with a sophisticated hybrid RAG approach that combines:

- **Graph RAG** - Understand code structure and relationships, not just text similarity
- **Local-first** - Your code never leaves your machine. Use Ollama for embeddings and summarization
- **Multi-source retrieval** - Search code, docs, and conversation history together
- **Token efficiency** - Save 60-80% on token costs by retrieving only what matters

### Key Benefits

| Problem | ctx-sys Solution |
|---------|------------------|
| "The AI forgot what we discussed" | Conversation memory with decision tracking |
| "It doesn't understand my codebase" | Graph-aware indexing with relationship extraction |
| "Context windows are too small" | Smart retrieval with token budgets |
| "I don't want my code in the cloud" | 100% local with Ollama - no API keys required |
| "Generic RAG misses important connections" | Hybrid search: vector + graph + keyword |

## How It Works

**ctx-sys** acts as a *smart librarian* rather than a *hoarder*. Instead of stuffing everything into context, it:

1. **Indexes** your codebase, documentation, and conversations
2. **Extracts** entities, relationships, and semantic meaning
3. **Retrieves** precisely the right context when needed
4. **Minimizes** token usage while maximizing relevance

The result: AI assistants that remember everything but only surface what matters.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   Developer Integrations                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  VS Code     │  │  Git Hooks   │  │  AI Assistants       │   │
│  │  Extension   │  │  (auto-sync) │  │  (Claude/Copilot)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼──────────────────┼─────────────────────┼───────────────┘
          │                  │                     │
          └──────────────────┼─────────────────────┘
                             │ MCP Protocol
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ctx-sys MCP Server                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      Tool Interface                         │  │
│  │  • context_query     • index_codebase    • store_message   │  │
│  │  • sync_from_git     • query_graph       • get_history     │  │
│  │  • analytics_stats   • checkpoint_save   • hooks_install   │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                     Processing Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ AST Parser   │  │  Summarizer  │  │  Entity Extractor      │  │
│  │ (tree-sitter)│  │ (Ollama/Cloud│  │  (NER + semantic)      │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Embedding   │  │ Relationship │  │  Query Expansion       │  │
│  │  Generator   │  │  Extractor   │  │  & Ranking             │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   Impact     │  │   Analytics  │  │  Proactive Context     │  │
│  │  Analyzer    │  │   Tracker    │  │  Subscription          │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                    Storage Layer (SQLite)                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │  Entities   │ │   Vectors   │ │    Graph    │ │  Messages  │  │
│  │  (+ AST)    │ │ (+ FTS5)    │ │   (edges)   │ │ (sessions) │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ Checkpoints │ │  Analytics  │ │Hook History │ │ Reflections│  │
│  │  (agent)    │ │  (queries)  │ │  (git ops)  │ │ (lessons)  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Current Status

> **Beta Release** - Core functionality, Phase 10 RAG enhancements, and Phase 10b MCP tool fixes are complete. Phase 10c retrieval quality improvements planned.

### What Works Now

| Feature | Status | Notes |
|---------|--------|-------|
| **CLI** | ✅ Working | 30+ commands for all operations |
| **MCP Server** | ✅ Working | All tools available for Claude/AI assistants |
| **AST Parsing** | ✅ Working | TypeScript, JavaScript, Python via tree-sitter |
| **Entity Storage** | ✅ Working | Functions, classes, methods with full source code |
| **Embedding Search** | ✅ Working | Incremental, hash-based with Ollama |
| **Multi-Strategy Search** | ✅ Working | Keyword + semantic + graph with RRF fusion |
| **Conversation Memory** | ✅ Working | Store/retrieve messages across sessions |
| **Graph Traversal** | ✅ Working | Auto-extracted relationships |
| **Database Persistence** | ✅ Working | SQLite with streaming batches |
| **LLM Summaries** | ✅ Working | Ollama, OpenAI, or Anthropic providers |
| **Smart Context** | ✅ Working | Assemble context with source code and token budgets |

### Phase 10 Enhancements (Completed)

| Enhancement | Description |
|-------------|-------------|
| **F10.1: Code Content Storage** | Store actual source code, not just descriptions |
| **F10.2: Incremental Embedding** | Hash-based change detection, skip unchanged entities |
| **F10.3: Scalable Indexing** | Streaming batches for 100k+ entity codebases |
| **F10.4: Smart Context Assembly** | Include source code in context with token budgets |
| **F10.5: Auto Relationship Extraction** | Extract imports, calls, extends, implements from AST |
| **F10.6: LLM Summaries** | Multi-provider summarization (Ollama/OpenAI/Anthropic) |
| **F10.7: CLI Completeness** | 30+ commands covering all functionality |
| **F10.8: Robustness** | Replace hand-rolled glob/YAML/import parsers with picomatch, yaml |
| **F10.9: Universal Document Indexing** | Index markdown, YAML, JSON, TOML, plain text + LLM extraction |
| **F10.10: Native SQLite + FTS5** | Migrate to better-sqlite3 with FTS5 full-text search |
| **F10.11: Smart Context Expansion** | Auto-include parent classes, imports, and type definitions |
| **F10.12: Advanced Query Pipeline** | Query decomposition + LLM re-ranking |
| **F10.13: Incremental Doc Updates** | Hash-based change detection + directory indexing for docs |
| **F10.14: Embedding Quality** | Overlapping chunks prevent silent truncation of long entities |

See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for architecture details.

### Phase 10b: MCP Tool Fixes (Complete)

Systematic testing of all 33 MCP tools revealed 15 issues — 10 bugs and 5 placeholder stubs. All fixed.

| Fix | Issue | Status |
|-----|-------|--------|
| **F10b.1** | context_query returns empty results (3 root causes) | Done |
| **F10b.2** | search_entities type filter misses exact matches | Done |
| **F10b.3** | link_entities resolves names to wrong entities | Done |
| **F10b.4** | get_graph_stats reports 0 nodes with 54 edges | Done |
| **F10b.5** | search_decisions ignores decision metadata | Done |
| **F10b.6** | store_message FK error on new sessions | Done |
| **F10b.7** | summarize_session wired to LLM providers | Done |
| **F10b.8-9** | checkpoint step numbering + state nesting | Done |
| **F10b.10** | reflection_query type/outcome filters | Done |
| **F10b.11** | Analytics inflated savings for empty results | Done |
| **F10b.12** | Memory tier tools wired to MemoryTierManager | Done |
| **F10b.13** | hooks_install writes actual git hooks | Done |
| **F10b.14** | hooks_impact_report git diff analysis | Done |
| **F10b.15** | analytics_dashboard entity type breakdown | Done |

### Phase 10c: Retrieval Quality Improvements (Planned)

Improvements to search quality, document RAG, and analytics honesty:

| Feature | Description | Priority |
|---------|-------------|----------|
| **F10c.1** | FTS5 camelCase/PascalCase tokenizer | Critical |
| **F10c.2** | Embedding model quality & prompt prefixes | High |
| **F10c.3** | Hybrid reranking pipeline | High |
| **F10c.4** | Document chunking with size constraints + overlap | High |
| **F10c.5** | Search strategy auto-tuning by query type | Medium |
| **F10c.6** | Realistic analytics baselines (grep+read comparison) | Medium |
| **F10c.7** | Query understanding & synonym expansion | Medium |
| **F10c.8** | Code-aware context assembly (signatures over bodies) | Medium |

---

## Features

### Hybrid RAG Retrieval

ctx-sys combines multiple retrieval strategies for superior results:

- **Vector Search** - Semantic similarity using embeddings (Ollama or OpenAI)
- **Graph Traversal** - Follow relationships: `Function → calls → Function → imports → Module`
- **Keyword/FTS** - Full-text search for exact matches
- **Reciprocal Rank Fusion** - Intelligently merge results from all strategies

### Code Intelligence

- **AST Parsing** - Deep understanding of code structure via tree-sitter
- **Relationship Extraction** - Automatically discover imports, calls, inheritance
- **Symbol Summarization** - AI-generated summaries of functions and classes
- **Git Integration** - Track changes and auto-index on commit

### Conversation Memory

- **Session Tracking** - Remember what was discussed across sessions
- **Decision Extraction** - Automatically identify and store architectural decisions
- **Summarization** - Compress long conversations while preserving key points

### Agent Patterns

Designed for long-running AI agent workflows:

- **Checkpointing** - Save/restore agent state for resumable tasks
- **Hot/Cold Memory** - Automatic memory management with token budgets
- **Reflection Storage** - Learn from past attempts, store lessons learned
- **Proactive Context** - Push relevant context based on file changes

### Privacy & Local-First

- **No cloud required** - Run entirely locally with Ollama
- **Your data stays yours** - Single SQLite file, no external services
- **Optional cloud** - Use OpenAI/Anthropic only if you choose to

## Installation

```bash
# Install globally
npm install -g ctx-sys

# Or clone and build
git clone https://github.com/davidfranz/ctx-sys.git
cd ctx-sys
npm install
npm run build
npm link
```

## Quick Start

```bash
# Initialize a project
ctx-sys init

# Index your codebase
ctx-sys index

# Start the MCP server for Claude Desktop
ctx-sys serve

# Or watch for changes and auto-index
ctx-sys watch
```

## CLI Commands

### Core Commands

```bash
ctx-sys init              # Initialize project configuration
ctx-sys index             # Index codebase (with streaming for large projects)
ctx-sys search <query>    # Search entities
ctx-sys status            # Show indexing status
ctx-sys serve             # Start MCP server
ctx-sys watch             # Watch and auto-index on changes
```

### Entity Management

```bash
ctx-sys entities          # List all entities
ctx-sys entity <id>       # Show entity details
ctx-sys entity-stats      # Entity type statistics
ctx-sys entity-delete     # Delete an entity
```

### Graph Operations

```bash
ctx-sys graph <entity>    # Traverse relationship graph
ctx-sys graph-stats       # Graph statistics
ctx-sys relationships     # List relationships
ctx-sys link <src> <type> <tgt>  # Create relationship
```

### Embeddings & Summaries

```bash
ctx-sys embed             # Generate embeddings
ctx-sys embed-status      # Embedding coverage status
ctx-sys summarize         # Generate LLM summaries
ctx-sys providers         # Show available LLM providers
```

### Sessions & Analytics

```bash
ctx-sys sessions          # List conversation sessions
ctx-sys messages          # View session messages
ctx-sys analytics         # View usage analytics
ctx-sys dashboard         # Project dashboard
```

### Debug & Maintenance

```bash
ctx-sys health            # System health check
ctx-sys inspect           # Inspect database tables
ctx-sys query <sql>       # Execute SQL query
ctx-sys export <file>     # Export project data
ctx-sys import <file>     # Import project data
```

### With Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"],
      "env": {}
    }
  }
}
```

## Core Concepts

### Entities

Everything is an entity. Entities have types, content, metadata, and vector embeddings.

| Category | Entity Types |
|----------|-------------|
| **Code** | File, Module, Class, Function, Method, Interface, Type |
| **Docs** | Document, Section, Requirement, Feature, UserStory |
| **Conversation** | Session, Message, Decision, Question |
| **Domain** | Person, Concept, Technology, Pattern, Component |

### Relationships (Graph RAG)

Entities are connected through typed relationships, enabling graph traversal for context discovery.

| Relationship | Example |
|-------------|---------|
| `CONTAINS` | File → Function, Document → Section |
| `CALLS` | Function → Function |
| `IMPORTS` | File → File |
| `IMPLEMENTS` | Class → Interface |
| `EXTENDS` | Class → Class |
| `MENTIONS` | Message → any entity |
| `RELATES_TO` | Concept → Concept (semantic) |

### Context Retrieval

When you query `"how does authentication work?"`, ctx-sys:

1. **Parses** the query to extract intent and entities
2. **Searches** using multiple strategies (vector similarity, graph traversal, keyword/FTS)
3. **Ranks** results by relevance, recency, and connectivity
4. **Assembles** context with source attribution, respecting token budgets

## MCP Tools Interface

### Core Retrieval

```typescript
context_query({
  query: string,           // The search query
  project?: string,        // Target project (default: active)
  max_tokens?: number,     // Token budget for response
  include_sources?: boolean
}) → {
  context: string,         // Formatted context for LLM
  sources: Source[],       // Attribution
  confidence: number
}
```

### Indexing

```typescript
// Full codebase indexing
index_codebase({
  path: string,
  project: string,
  options?: {
    depth?: 'full' | 'signatures' | 'selective',
    ignore?: string[],
    languages?: string[],
    summarize?: boolean
  }
})

// Incremental update from git
sync_from_git({
  project: string,
  since?: string,          // Commit SHA or 'last_sync'
  summarize?: boolean
})
```

### Conversation Memory

```typescript
store_message({
  content: string,
  role: 'user' | 'assistant' | 'system',
  session?: string,
  metadata?: object
})

get_history({
  session?: string,
  limit?: number,
  before?: string
})
```

### Graph Operations

```typescript
query_graph({
  entity: string,          // Starting entity
  depth?: number,          // Hops (default: 2)
  relationships?: string[], // Filter by type
  direction?: 'in' | 'out' | 'both'
})
```

### Analytics

```typescript
analytics_get_stats({
  projectId: string,
  period: 'day' | 'week' | 'month' | 'all'
}) → {
  tokensSaved: number,
  costSaved: number,
  savingsPercent: number,
  averageRelevance: number
}
```

## Configuration

### Project Configuration

```yaml
# .ctx-sys/config.yaml (per-project)
project:
  name: my-project

indexing:
  mode: incremental
  watch: true
  ignore:
    - node_modules
    - dist
  languages:
    - typescript
    - python

summarization:
  enabled: true
  provider: ollama
  model: qwen2.5-coder:7b

embeddings:
  provider: ollama
  model: nomic-embed-text

retrieval:
  default_max_tokens: 4000
  strategies:
    - vector
    - graph
    - fts
```

### Global Configuration

```yaml
# ~/.ctx-sys/config.yaml (global)
database:
  path: ~/.ctx-sys/ctx-sys.db

providers:
  ollama:
    base_url: http://localhost:11434
  openai:
    api_key: ${OPENAI_API_KEY}
```

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | TypeScript | MCP SDK compatibility, type safety |
| **Database** | better-sqlite3 + FTS5 | Native performance, full-text search with BM25 |
| **AST Parsing** | tree-sitter | Multi-language, fast, accurate |
| **Embeddings (local)** | Ollama + nomic-embed-text | Quality local embeddings |
| **Embeddings (cloud)** | OpenAI text-embedding-3-small | Fallback option |
| **Summaries (local)** | Ollama + qwen3:0.6b | Fast local summarization |
| **Summaries (cloud)** | OpenAI gpt-4o-mini, Anthropic claude-3-haiku | Cloud fallback options |
| **MCP Framework** | @modelcontextprotocol/sdk | Official protocol SDK |

## Use Cases

### For Individual Developers

- **Context-aware coding assistance** - AI that understands your codebase structure
- **Conversation continuity** - Pick up where you left off, even days later
- **Documentation search** - Find relevant docs alongside code

### For Teams

- **Shared knowledge base** - Capture decisions and context across the team
- **Onboarding acceleration** - New members get context from past discussions
- **Impact analysis** - Understand how changes affect the codebase

### For AI Agent Builders

- **Long-running tasks** - Checkpoint and resume complex operations
- **Memory management** - Automatic hot/cold tiering for context
- **Learning loops** - Store reflections and lessons learned

## Contributing

Contributions are welcome! Please see the documentation in [docs/](./docs/) for architecture details.

## License

MIT
