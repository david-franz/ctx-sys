# ctx-sys

**Context System** - An intelligent context management framework for AI coding assistants.

> **PROJECT STATUS**: Phase 2 (Code Intelligence) is complete with 259 passing tests.
>
> **What exists**: Core foundation + code intelligence with AST parsing, symbol summarization, codebase indexing, relationship extraction, and git diff processing
> **Next up**: Phase 3 (Conversation Memory)

## Philosophy

Modern AI coding assistants suffer from context limitations. Long conversations lose important details, codebases are too large to fit in context, and relevant information is scattered across files, docs, and past conversations.

**ctx-sys** solves this by being a *smart librarian* rather than a *hoarder*. Instead of stuffing everything into context, it:

- **Indexes** your codebase, documentation, and conversations
- **Extracts** entities, relationships, and semantic meaning
- **Retrieves** precisely the right context when needed
- **Minimizes** token usage while maximizing relevance

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
│  │  (+ AST)    │ │ (sqlite-vec)│ │   (edges)   │ │ (sessions) │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ Checkpoints │ │  Analytics  │ │Hook History │ │ Reflections│  │
│  │  (agent)    │ │  (queries)  │ │  (git ops)  │ │ (lessons)  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────────────┘
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
| **Project** | Ticket, Bug, Task, Milestone |

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
| `DEPENDS_ON` | Feature → Feature |
| `DEFINED_IN` | Requirement → Document |

### Context Retrieval

When you query with `#prompt 'how does authentication work?'`, ctx-sys:

1. **Parses** the query to extract intent and entities
2. **Searches** using multiple strategies (vector similarity, graph traversal, keyword/FTS)
3. **Ranks** results by relevance, recency, and connectivity
4. **Assembles** context with source attribution, respecting token budgets

## Advanced Features

### Agent Patterns (Phase 8)

Designed for long-running AI agent workflows:

- **Checkpointing** - Save/restore agent state for resumable tasks
- **Hot/Cold Memory** - Automatic memory management with explicit spill/recall API
- **Reflection Storage** - Learn from past attempts, store lessons learned
- **Proactive Context** - Push relevant context based on file changes and cursor position

### Integrations & Analytics (Phase 9)

Make ctx-sys value visible and reduce friction:

- **VS Code Extension** - Native integration with sidebar panel, hover info, and command palette
- **Token Analytics** - Track and visualize ROI with token usage stats and cost savings
- **Team Knowledge Base** - Share decisions and context across team members
- **Git Hooks** - Automatic indexing on commit/merge with impact analysis

## Database Structure

Single SQLite database with per-project table isolation:

```
ctx-sys.db
├── Global Tables
│   ├── projects (id, name, path, config, created_at)
│   ├── embedding_models (id, name, dimensions, provider)
│   └── config (key, value)
│
├── Per-Project Tables (prefixed by project_id)
│   ├── {project}_entities
│   ├── {project}_vectors
│   ├── {project}_relationships
│   ├── {project}_messages
│   ├── {project}_sessions
│   └── {project}_ast_cache
│
└── Cross-Project (explicit access only)
    ├── shared_entities
    └── cross_project_links
```

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
// Full codebase indexing (initial or rebuild)
index_codebase({
  path: string,
  project: string,
  options?: {
    depth?: 'full' | 'signatures' | 'selective',
    ignore?: string[],      // Additional ignore patterns
    languages?: string[],   // Limit to specific languages
    summarize?: boolean     // Generate AI summaries
  }
})

// Index a single document
index_document({
  path: string,
  project: string,
  type?: 'markdown' | 'text' | 'requirements'
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
// Store a message
store_message({
  content: string,
  role: 'user' | 'assistant' | 'system',
  session?: string,        // Auto-creates if not exists
  metadata?: object
})

// Get conversation history
get_history({
  session?: string,        // Default: current session
  limit?: number,          // Default: 10
  before?: string          // Cursor for pagination
})

// Summarize and archive a session
summarize_session({
  session: string,
  archive?: boolean        // Move to archived state
})
```

### Graph Operations

```typescript
// Add a custom entity
add_entity({
  type: string,
  name: string,
  content?: string,
  metadata?: object,
  project?: string
})

// Create a relationship
link_entities({
  source: string,          // Entity ID or name
  target: string,
  relationship: string,
  weight?: number,
  metadata?: object
})

// Query the graph
query_graph({
  entity: string,          // Starting entity
  depth?: number,          // Hops (default: 2)
  relationships?: string[], // Filter by type
  direction?: 'in' | 'out' | 'both'
})
```

### Project Management

```typescript
create_project({ name: string, path: string, config?: ProjectConfig })
list_projects()
set_active_project({ name: string })
delete_project({ name: string, keep_data?: boolean })

// Cross-project query (explicit)
query_cross_project({
  query: string,
  projects: string[],      // Explicit project list
  max_tokens?: number
})
```

### Agent Pattern Tools

```typescript
// Save agent state checkpoint
checkpoint_save({
  sessionId: string,
  state: object,           // Arbitrary state object
  metadata?: object
})

// Restore from checkpoint
checkpoint_load({
  sessionId: string,
  checkpointId?: string    // Latest if not specified
})

// Force memory spill (hot → cold)
memory_spill({
  sessionId: string,
  threshold?: number       // Optional size threshold
})

// Recall from cold storage
memory_recall({
  sessionId: string,
  query: string            // What to recall
})

// Store a reflection/lesson
reflection_store({
  sessionId: string,
  attempt: string,
  lesson: string,
  metadata?: object
})

// Subscribe to file changes for proactive context
context_subscribe({
  filePatterns: string[],
  callbackUrl: string
})
```

### Analytics & Integration Tools

```typescript
// Get token usage statistics
analytics_get_stats({
  projectId: string,
  period: 'day' | 'week' | 'month' | 'all'
}) → {
  tokensSaved: number,
  costSaved: number,
  savingsPercent: number,
  averageRelevance: number
}

// Record feedback on query usefulness
analytics_record_feedback({
  queryLogId: string,
  wasUseful: boolean
})

// Measure project for ROI calculation
analytics_measure_project({
  projectId: string,
  projectPath: string
})

// Install git hooks
hooks_install({
  projectId: string,
  repositoryPath: string,
  config?: HookConfig
})

// Generate impact report for code changes
hooks_generate_impact_report({
  projectId: string,
  baseBranch: string,
  targetBranch: string
}) → {
  riskLevel: 'low' | 'medium' | 'high',
  affectedEntities: Entity[],
  affectedDecisions: Decision[],
  suggestions: string[]
}

// Team knowledge base - search across team
team_search_decisions({
  query: string,
  teamMembers?: string[]
})
```

## Configuration

### Project Configuration

```yaml
# .ctx-sys/config.yaml (per-project)
project:
  name: my-project

indexing:
  mode: incremental        # 'full' | 'incremental' | 'manual'
  watch: true              # Real-time file watching
  ignore:
    - node_modules
    - dist
    - "*.test.ts"
  languages:
    - typescript
    - python

summarization:
  enabled: true
  provider: ollama         # 'ollama' | 'openai' | 'anthropic'
  model: qwen2.5-coder:7b

embeddings:
  provider: ollama         # 'ollama' | 'openai'
  model: nomic-embed-text

sessions:
  retention: 30            # Days to keep active sessions
  auto_summarize: true     # Summarize on close

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
  anthropic:
    api_key: ${ANTHROPIC_API_KEY}

defaults:
  summarization_provider: ollama
  embedding_provider: ollama
```

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Language** | TypeScript | MCP SDK compatibility, type safety |
| **Database** | sql.js (WebAssembly SQLite) | Single file, portable, no native deps |
| **AST Parsing** | tree-sitter | Multi-language, fast, accurate |
| **Embeddings (local)** | Ollama + nomic-embed-text | Quality local embeddings |
| **Embeddings (cloud)** | OpenAI text-embedding-3-small | Fallback option |
| **Summaries (local)** | Ollama + qwen2.5-coder | Code-aware summarization |
| **Summaries (cloud)** | Claude Haiku / GPT-4o-mini | Fallback option |
| **MCP Framework** | @modelcontextprotocol/sdk | Official protocol SDK |
| **CLI** | Commander.js | Standard CLI framework |
| **File Watching** | chokidar | Cross-platform file watching |

## Installation

> Phase 1 is implemented. You can install and run the MCP server.

```bash
# Clone the repository
git clone https://github.com/your-org/ctx-sys.git
cd ctx-sys

# Install dependencies
npm install

# Build
npm run build

# Install globally (optional)
npm link
```

## Quick Start

```bash
# Start the MCP server (stdio transport for MCP clients)
npm start serve

# Or with custom database path
npm start serve --db /path/to/custom.db
```

> **Note**: Full CLI commands like `init`, `index`, and `query` are planned for later phases.

### With Claude Code (Planned)

Add to your Claude Code MCP configuration:

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

### With VS Code Copilot (Planned)

Configuration instructions TBD based on Copilot MCP support.

## Usage Examples (Planned)

### Bootstrap an existing project

```bash
# Full index with AI summaries
ctx-sys index --summarize

# Quick index (signatures only, no summaries)
ctx-sys index --depth signatures
```

### During a coding session

```
User: #prompt 'how does the payment processing work?'

ctx-sys returns:
- PaymentService class summary and methods
- Related functions in billing module
- Relevant requirements from docs/requirements.md
- Past conversation where payment logic was discussed
```

### Manual entity management

```bash
# Add a concept
ctx-sys add-entity --type concept --name "Rate Limiting" \
  --content "System limits API calls to 100/min per user"

# Link entities
ctx-sys link --source "RateLimiter" --target "Rate Limiting" \
  --relationship "IMPLEMENTS"
```

## Development Roadmap

See [docs/](./docs/) for detailed implementation plans.

> **Note**: Checkboxes indicate implementation completion status.

### Phase 1: Foundation ✅ Complete (138 tests)

- [x] Database schema and migrations ([F1.1](docs/phase-1/F1.1-database-schema.md)) - 21 tests
- [x] Project management ([F1.2](docs/phase-1/F1.2-project-management.md)) - 29 tests
- [x] Entity storage ([F1.3](docs/phase-1/F1.3-entity-storage.md)) - 35 tests
- [x] Embedding pipeline ([F1.4](docs/phase-1/F1.4-embedding-pipeline.md)) - 24 tests
- [x] MCP server scaffold ([F1.5](docs/phase-1/F1.5-mcp-server.md)) - 29 tests

### Phase 2: Code Intelligence ✅ Complete (121 tests)

- [x] AST parsing ([F2.1](docs/phase-2/F2.1-ast-parsing.md)) - 35 tests
- [x] Symbol summarization ([F2.2](docs/phase-2/F2.2-symbol-summarization.md)) - 19 tests
- [x] Codebase indexing ([F2.3](docs/phase-2/F2.3-codebase-indexing.md)) - 26 tests
- [x] Relationship extraction ([F2.4](docs/phase-2/F2.4-relationship-extraction.md)) - 22 tests
- [x] Git diff processing ([F2.5](docs/phase-2/F2.5-git-diff-processing.md)) - 19 tests

### Phase 3: Conversation Memory (Design Complete)

- [ ] Message storage ([F3.1](docs/phase-3/F3.1-message-storage.md))
- [ ] Session management ([F3.2](docs/phase-3/F3.2-session-management.md))
- [ ] Conversation summarization ([F3.3](docs/phase-3/F3.3-conversation-summarization.md))
- [ ] Decision extraction ([F3.4](docs/phase-3/F3.4-decision-extraction.md))

### Phase 4: Document Intelligence (Design Complete)

- [ ] Markdown parsing ([F4.1](docs/phase-4/F4.1-markdown-parsing.md))
- [ ] Requirement extraction ([F4.2](docs/phase-4/F4.2-requirement-extraction.md))
- [ ] Document-code linking ([F4.3](docs/phase-4/F4.3-document-code-linking.md))

### Phase 5: Graph RAG (Design Complete)

- [ ] Graph storage ([F5.1](docs/phase-5/F5.1-graph-storage.md))
- [ ] Entity resolution ([F5.2](docs/phase-5/F5.2-entity-resolution.md))
- [ ] Semantic relationships ([F5.3](docs/phase-5/F5.3-semantic-relationships.md))

### Phase 6: Advanced Retrieval (Design Complete)

- [ ] Query parsing ([F6.1](docs/phase-6/F6.1-query-parsing.md))
- [ ] Multi-strategy search ([F6.2](docs/phase-6/F6.2-multi-strategy-search.md))
- [ ] Context assembly ([F6.3](docs/phase-6/F6.3-context-assembly.md))
- [ ] Relevance feedback ([F6.4](docs/phase-6/F6.4-relevance-feedback.md))
- [ ] HyDE query expansion ([F6.5](docs/phase-6/F6.5-hyde-query-expansion.md))
- [ ] Retrieval gating ([F6.6](docs/phase-6/F6.6-retrieval-gating.md))
- [ ] Draft-critique loop ([F6.7](docs/phase-6/F6.7-draft-critique-loop.md))

### Phase 7: Configuration & Polish (Design Complete)

- [ ] Configuration system ([F7.1](docs/phase-7/F7.1-configuration.md))
- [ ] Model abstraction ([F7.2](docs/phase-7/F7.2-model-abstraction.md))
- [ ] Watch mode ([F7.3](docs/phase-7/F7.3-watch-mode.md))
- [ ] CLI interface ([F7.4](docs/phase-7/F7.4-cli-interface.md))

### Phase 8: Agent Patterns (Design Complete)

- [ ] Agent checkpointing ([F8.1](docs/phase-8/F8.1-agent-checkpointing.md))
- [ ] Hot/cold memory API ([F8.2](docs/phase-8/F8.2-hot-cold-memory-api.md))
- [ ] Reflection storage ([F8.3](docs/phase-8/F8.3-reflection-storage.md))
- [ ] Proactive context ([F8.4](docs/phase-8/F8.4-proactive-context.md))

### Phase 9: Integrations & Analytics (Design Complete)

- [ ] VS Code extension ([F9.1](docs/phase-9/F9.1-vscode-extension.md))
- [ ] Token analytics ([F9.2](docs/phase-9/F9.2-token-analytics.md))
- [ ] Team knowledge base ([F9.3](docs/phase-9/F9.3-team-knowledge-base.md))
- [ ] Git hooks ([F9.4](docs/phase-9/F9.4-git-hooks.md))

## Current Status & Next Steps

### Phase 1 Complete

Foundation layer is fully implemented with:

- sql.js database with project isolation and migrations
- Project management (CRUD, config, active project)
- Entity storage with search and hash detection
- Embedding pipeline with Mock/Ollama/OpenAI providers
- MCP server scaffold with tool registry

### Phase 2 Complete

Code intelligence layer is fully implemented with:

- AST parsing using web-tree-sitter with WASM grammars (TypeScript, Python)
- Symbol summarization with configurable detail levels (minimal/standard/detailed)
- Codebase indexing with incremental updates and hash-based change detection
- Relationship extraction with dependency graph traversal
- Git diff processing with hunk-level granularity

### Next: Phase 3 (Conversation Memory)

- Message storage
- Session management
- Conversation summarization
- Decision extraction

## Contributing

This project is currently in early planning stages. Contributions to the design documentation or feedback on the proposed architecture are welcome. Implementation contributions should wait until the core architecture has been validated with a working prototype.

## License

MIT
