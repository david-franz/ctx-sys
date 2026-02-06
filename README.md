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
│  │  (+ AST)    │ │ (sqlite-vec)│ │   (edges)   │ │ (sessions) │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ Checkpoints │ │  Analytics  │ │Hook History │ │ Reflections│  │
│  │  (agent)    │ │  (queries)  │ │  (git ops)  │ │ (lessons)  │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

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
| **Database** | sql.js (WebAssembly SQLite) | Single file, portable, no native deps |
| **AST Parsing** | tree-sitter | Multi-language, fast, accurate |
| **Embeddings (local)** | Ollama + nomic-embed-text | Quality local embeddings |
| **Embeddings (cloud)** | OpenAI text-embedding-3-small | Fallback option |
| **Summaries (local)** | Ollama + qwen2.5-coder | Code-aware summarization |
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
