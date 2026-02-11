# ctx-sys

**Local hybrid RAG for AI coding assistants.** Index your codebase, search with semantic + keyword + graph retrieval, and give your AI assistant deep project understanding — all running locally with Ollama.

```bash
npm install -g ctx-sys
```

## Why ctx-sys?

AI coding assistants are limited by context windows. They can't see your whole codebase, they forget what you discussed yesterday, and they miss connections between files. ctx-sys fixes this by acting as a *smart librarian* — it indexes your code, understands relationships between symbols, and retrieves exactly the right context when your AI needs it.

- **Hybrid RAG** — combines vector search, keyword/FTS5, and graph traversal with reciprocal rank fusion
- **Local-first** — your code never leaves your machine. Ollama handles embeddings and summarization
- **Code-aware** — tree-sitter AST parsing extracts functions, classes, imports, and relationships
- **Works with any MCP client** — Claude Desktop, Claude Code, Cursor, or any MCP-compatible tool

## Quick Start (5 minutes)

### 1. Install

```bash
# Install ctx-sys
npm install -g ctx-sys

# Install and start Ollama (for embeddings)
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull mxbai-embed-large:latest
```

### 2. Index your project

```bash
cd your-project
ctx-sys init
ctx-sys index
```

This parses your code with tree-sitter, generates embeddings with Ollama, and indexes any markdown docs — all in one command.

### 3. Search

```bash
# Semantic + keyword hybrid search
ctx-sys search "how does authentication work"

# Assembled context with source expansion
ctx-sys context "error handling in the API layer"

# Use HyDE for better conceptual search
ctx-sys search "database connection pooling" --hyde
```

### 4. Connect to your AI assistant

Add ctx-sys as an MCP server. For **Claude Desktop**, add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"]
    }
  }
}
```

For **Claude Code**, add to your MCP settings:

```json
{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"]
    }
  }
}
```

Now your AI assistant has access to 12 action-based tools for searching your codebase, querying the relationship graph, managing conversation memory, and more.

## How It Works

```
Your Code                  ctx-sys                         AI Assistant
─────────                  ───────                         ────────────
  .ts .py .rs    ──→   AST Parse (tree-sitter)
  .md .html      ──→   Document Chunking
                        ↓
                   Entity Extraction
                   (functions, classes, imports)
                        ↓
                   Embed with Ollama              ←──  "How does auth work?"
                   (mxbai-embed-large)                        ↓
                        ↓                              context_query
                   ┌─────────────┐                          ↓
                   │  SQLite DB  │               ┌─────────────────────┐
                   │  + FTS5     │──────────────→│  Hybrid Search      │
                   │  + vec0     │               │  • Vector similarity│
                   │  + Graph    │               │  • FTS5 keyword     │
                   └─────────────┘               │  • Graph traversal  │
                                                 └─────────┬───────────┘
                                                           ↓
                                                    Rank & Assemble
                                                           ↓
                                                  Relevant context with
                                                  source attribution
```

## CLI Reference

### Core Commands

```bash
ctx-sys init [directory]          # Initialize project config
ctx-sys index [directory]         # Index code + docs + embeddings
ctx-sys search <query>            # Hybrid search (semantic + keyword)
ctx-sys context <query>           # Assembled context with expansion
ctx-sys status [directory]        # Project info and health checks
ctx-sys serve                     # Start MCP server
ctx-sys watch [directory]         # Watch files and auto-reindex
```

### Key Flags

```bash
# Index
ctx-sys index --no-doc            # Skip document indexing
ctx-sys index --no-embed          # Skip embedding generation
ctx-sys index --force             # Re-index everything from scratch

# Search
ctx-sys search "query" --hyde     # Use HyDE for conceptual queries
ctx-sys search "query" --limit 20 # Control result count
ctx-sys search "query" --no-semantic  # Keyword-only search

# Context
ctx-sys context "query" --max-tokens 8000  # Token budget
ctx-sys context "query" --no-expand        # Skip context expansion
ctx-sys context "query" --hyde             # HyDE-enhanced retrieval

# Status
ctx-sys status --check            # Full health diagnostics
```

### Subcommands

```bash
# Entity management
ctx-sys entity list               # List indexed entities
ctx-sys entity stats              # Type breakdown
ctx-sys entity get <id>           # Entity details

# Relationship graph
ctx-sys graph query <entity>      # Traverse relationships
ctx-sys graph stats               # Graph statistics

# Embeddings
ctx-sys embed run                 # Generate/update embeddings
ctx-sys embed status              # Coverage report

# Summarization
ctx-sys summarize run             # Generate LLM summaries
ctx-sys summarize status          # Coverage report

# Sessions & memory
ctx-sys session list              # Conversation sessions
ctx-sys session messages [id]     # View session messages

# Knowledge bases
ctx-sys kb create <name>          # Package as shareable .ctx-kb
ctx-sys kb install <file>         # Install a knowledge base

# Debug
ctx-sys debug health              # System health check
ctx-sys debug inspect             # Database tables
ctx-sys debug export <file>       # Export project data
```

## MCP Tools

When connected as an MCP server, ctx-sys exposes 12 action-based tools:

| Tool | Actions | What It Does |
| ---- | ------- | ------------ |
| **context_query** | *(standalone)* | Hybrid RAG retrieval with source attribution |
| **entity** | add, get, search, delete | Manage code and document entities |
| **index** | codebase, document, sync, status | Parse and index code and docs |
| **graph** | link, query, stats | Navigate entity relationships |
| **session** | create, list, archive, summarize | Conversation session lifecycle |
| **message** | store, history | Conversation messages across sessions |
| **decision** | search, create | Architectural decision tracking |
| **checkpoint** | save, load, list, delete | Agent state persistence |
| **memory** | spill, recall, status | Hot/cold memory tier management |
| **reflection** | store, query | Cross-session learning and lessons |
| **project** | create, list, set_active, delete | Multi-project management |
| **hooks** | install, impact_report | Git hook integration |

## Configuration

### Project Config (`.ctx-sys/config.yaml`)

```yaml
project:
  name: my-project

indexing:
  ignore:
    - node_modules
    - dist
    - .git

embeddings:
  provider: ollama
  model: mxbai-embed-large:latest

summarization:
  provider: ollama
  model: qwen3:0.6b

hyde:
  model: gemma3:12b
```

### Global Config (`~/.ctx-sys/config.yaml`)

```yaml
database:
  path: ~/.ctx-sys/ctx-sys.db

providers:
  ollama:
    base_url: http://localhost:11434
  openai:
    api_key: ${OPENAI_API_KEY}  # Optional cloud fallback
```

## Supported Languages

| Language | Parsing | Entities Extracted |
| -------- | ------- | ------------------ |
| TypeScript/JavaScript | tree-sitter | Functions, classes, methods, interfaces, types, imports |
| Python | tree-sitter | Functions, classes, methods, imports |
| Rust | tree-sitter | Functions, structs, impls, traits, imports |
| Go | tree-sitter | Functions, structs, methods, interfaces, imports |
| Java | tree-sitter | Classes, methods, interfaces, imports |
| C/C++ | tree-sitter | Functions, classes, structs, enums, namespaces, #includes |
| C# | tree-sitter | Classes, interfaces, structs, records, enums, methods, usings |

Documents (Markdown, HTML, YAML, JSON, TOML, PDF, CSV, XML, plain text) are also indexed with semantic chunking.

## Requirements

- **Node.js** 18+
- **Ollama** (for local embeddings and summarization)
  - `mxbai-embed-large:latest` — embedding model (1024 dimensions, auto-detected)
  - `qwen3:0.6b` — summarization (optional)
  - `gemma3:12b` — HyDE query expansion (optional)

## Architecture

ctx-sys stores everything in a single SQLite database with:

- **Entities** — code symbols, document sections, conversation messages
- **Relationships** — CONTAINS, IMPORTS, CALLS, EXTENDS, IMPLEMENTS (auto-extracted from AST)
- **Vectors** — embeddings via sqlite-vec for fast KNN search
- **FTS5** — full-text search with BM25 ranking
- **Sessions** — conversation history with decision tracking

Search combines all four retrieval strategies (vector, FTS, graph, heuristic reranking) using reciprocal rank fusion. Advanced features include HyDE query expansion, query decomposition, retrieval gating, and smart context expansion.

## Building from Source

```bash
git clone https://github.com/davidfranz/ctx-sys.git
cd ctx-sys
npm install
npm run build
npm link    # Makes ctx-sys available globally
```

## Contributing

Contributions welcome. See the [whitepaper](https://ctx-sys.dev/whitepaper.pdf) for architecture details and the [website](https://ctx-sys.dev) for full documentation.

## License

MIT
