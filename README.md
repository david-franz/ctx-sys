# ctx-sys

**Context System** - An intelligent context management framework for AI coding assistants.

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
│                     AI Assistants                                 │
│              (VS Copilot / Claude Code / etc.)                    │
└─────────────────────────┬────────────────────────────────────────┘
                          │ MCP Protocol
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                      ctx-sys MCP Server                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      Tool Interface                         │  │
│  │  • context_query     • index_codebase    • store_message   │  │
│  │  • sync_from_git     • query_graph       • get_history     │  │
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
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                    Storage Layer (SQLite)                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │  Entities   │ │   Vectors   │ │    Graph    │ │  Messages  │  │
│  │  (+ AST)    │ │ (sqlite-vec)│ │   (edges)   │ │ (sessions) │  │
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
| **Database** | SQLite + sqlite-vec | Single file, portable, vector support |
| **AST Parsing** | tree-sitter | Multi-language, fast, accurate |
| **Embeddings (local)** | Ollama + nomic-embed-text | Quality local embeddings |
| **Embeddings (cloud)** | OpenAI text-embedding-3-small | Fallback option |
| **Summaries (local)** | Ollama + qwen2.5-coder | Code-aware summarization |
| **Summaries (cloud)** | Claude Haiku / GPT-4o-mini | Fallback option |
| **MCP Framework** | @modelcontextprotocol/sdk | Official protocol SDK |
| **CLI** | Commander.js | Standard CLI framework |
| **File Watching** | chokidar | Cross-platform file watching |

## Installation

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
# Initialize a project
ctx-sys init --path ./my-project --name my-project

# Index the codebase
ctx-sys index

# Start the MCP server
ctx-sys serve

# Or use the CLI directly
ctx-sys query "how does authentication work?"
```

### With Claude Code

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

### With VS Code Copilot

[Configuration instructions TBD based on Copilot MCP support]

## Usage Examples

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

See [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) for detailed implementation plans.

### Phase 1: Foundation
- [ ] Database schema and migrations
- [ ] Project management
- [ ] Basic entity storage
- [ ] Embedding pipeline
- [ ] MCP server scaffold

### Phase 2: Code Intelligence
- [ ] AST parsing (tree-sitter)
- [ ] Symbol summarization
- [ ] Codebase indexing
- [ ] Relationship extraction
- [ ] Git diff processing

### Phase 3: Conversation Memory
- [ ] Message storage
- [ ] Session management
- [ ] Conversation summarization
- [ ] Decision extraction

### Phase 4: Document Intelligence
- [ ] Markdown parsing
- [ ] Requirement extraction
- [ ] Document-code linking

### Phase 5: Graph RAG
- [ ] Graph storage and traversal
- [ ] Entity resolution
- [ ] Semantic relationship discovery

### Phase 6: Smart Retrieval
- [ ] Query parsing
- [ ] Multi-strategy search
- [ ] Context assembly
- [ ] Relevance feedback

### Phase 7: Polish
- [ ] Configuration system
- [ ] Watch mode
- [ ] CLI refinement
- [ ] Documentation

## Contributing

[Contributing guidelines TBD]

## License

[License TBD]
