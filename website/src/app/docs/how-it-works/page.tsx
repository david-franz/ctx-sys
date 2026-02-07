import Link from 'next/link';

export default function HowItWorksPage() {
  return (
    <>
      <h1>How It Works</h1>
      <p>
        ctx-sys is a context management system that uses hybrid RAG (Retrieval
        Augmented Generation) to give AI assistants deep understanding of
        codebases. Rather than feeding an entire repository into a prompt,
        ctx-sys indexes your code into a structured knowledge graph, generates
        embeddings for semantic search, and provides a unified retrieval
        pipeline that combines keyword, vector, and graph-based search to
        surface the most relevant context for any query.
      </p>

      {/* Architecture Overview */}
      <h2>Architecture Overview</h2>
      <p>
        The system is organized into five layers that work together: code
        parsing, entity extraction, relationship discovery, embedding
        generation, and LLM summarization. Once indexed, a hybrid search
        pipeline retrieves relevant context, and a conversation memory layer
        tracks sessions and decisions over time.
      </p>

      {/* Code Parsing */}
      <h2>1. Code Parsing</h2>
      <p>
        ctx-sys uses <strong>Tree-sitter</strong> to parse source files into
        abstract syntax trees (ASTs). Tree-sitter provides fast, incremental,
        and error-tolerant parsing that works reliably even on incomplete or
        syntactically invalid code.
      </p>
      <p>Supported languages:</p>
      <ul>
        <li><strong>TypeScript</strong> (and JavaScript/TSX/JSX)</li>
        <li><strong>Python</strong></li>
        <li><strong>Rust</strong></li>
        <li><strong>Go</strong></li>
        <li><strong>Java</strong></li>
      </ul>
      <p>
        Each file is parsed into its AST, and the parser walks the tree to
        identify meaningful code constructs: function declarations, class
        definitions, interface declarations, type aliases, exported variables,
        and more.
      </p>

      {/* Entity Extraction */}
      <h2>2. Entity Extraction</h2>
      <p>
        Every code symbol identified during parsing becomes an{' '}
        <strong>entity</strong> in the ctx-sys knowledge base. Each entity
        stores:
      </p>
      <ul>
        <li>
          <strong>Name</strong> &mdash; the symbol name (e.g.,{' '}
          <code>authenticateRequest</code>)
        </li>
        <li>
          <strong>Type</strong> &mdash; the kind of symbol: function, class,
          interface, type, variable, module, or file
        </li>
        <li>
          <strong>Content</strong> &mdash; the full source code of the symbol
        </li>
        <li>
          <strong>File path</strong> &mdash; the file where the symbol is
          defined
        </li>
        <li>
          <strong>Qualified name</strong> &mdash; a unique identifier combining
          file path and symbol name (e.g.,{' '}
          <code>src/middleware/auth.ts::authenticateRequest</code>)
        </li>
        <li>
          <strong>Relationships</strong> &mdash; connections to other entities
        </li>
      </ul>
      <p>
        Entities are stored in a SQLite database and indexed for both keyword
        search (via FTS5) and vector search (via embeddings).
      </p>

      {/* Relationship Discovery */}
      <h2>3. Relationship Discovery</h2>
      <p>
        After entities are extracted, ctx-sys analyzes the code structure to
        build a <strong>relationship graph</strong> connecting related symbols.
        Two types of relationships are discovered automatically:
      </p>
      <ul>
        <li>
          <strong>CONTAINS</strong> &mdash; a file contains a symbol. For
          example, <code>src/auth.ts</code> CONTAINS{' '}
          <code>authenticateRequest</code>.
        </li>
        <li>
          <strong>IMPORTS</strong> &mdash; one file imports from another. For
          example, <code>src/routes/login.ts</code> IMPORTS{' '}
          <code>src/auth.ts</code>.
        </li>
      </ul>
      <p>
        Additionally, ctx-sys supports <strong>LLM-based relationship
        extraction</strong> as an optional step. When enabled, a language model
        analyzes entity content to identify higher-level relationships such as
        CALLS, IMPLEMENTS, EXTENDS, and USES. This produces a richer graph but
        requires more processing time.
      </p>
      <p>
        The relationship graph enables graph traversal during search: when a
        query matches an entity, ctx-sys can walk its connections to surface
        related code that would not appear in a simple keyword or vector
        search.
      </p>

      {/* Embedding Generation */}
      <h2>4. Embedding Generation</h2>
      <p>
        To enable semantic search, ctx-sys generates vector embeddings for each
        entity. Embeddings are dense numerical representations that capture the
        meaning of code, allowing queries like &ldquo;authentication
        middleware&rdquo; to match functions even if they do not contain those
        exact words.
      </p>
      <p>
        By default, embeddings are generated using the{' '}
        <strong>nomic-embed-text</strong> model (768 dimensions) running
        locally via <strong>Ollama</strong>. This keeps all data on your
        machine. Alternatively, you can configure <strong>OpenAI</strong> as
        the embedding provider for faster processing.
      </p>
      <p>
        Embeddings are stored alongside entities in the SQLite database and
        compared using <strong>cosine distance</strong> during retrieval.
      </p>

      {/* LLM Summarization */}
      <h2>5. LLM Summarization</h2>
      <p>
        Optionally, ctx-sys can generate concise, human-readable summaries for
        each entity using a language model. These summaries describe what a
        function does, what a class represents, or what a module provides,
        making search results more informative without needing to read full
        source code.
      </p>
      <p>
        The default summarization model is <strong>qwen3:0.6b</strong> via
        Ollama, chosen for its balance of quality and speed on consumer
        hardware. For higher quality, you can switch to{' '}
        <strong>GPT-4o-mini</strong> via OpenAI.
      </p>

      {/* Search Pipeline */}
      <h2>Search Pipeline (Hybrid RAG)</h2>
      <p>
        The core of ctx-sys is its hybrid retrieval pipeline. When you run a
        query, ctx-sys executes up to three search strategies in parallel and
        fuses the results into a single ranked list.
      </p>

      <h3>Keyword Search (FTS)</h3>
      <p>
        Uses <strong>SQLite FTS5</strong> with <strong>BM25 ranking</strong> to
        find entities whose names, content, or summaries match the query terms.
        This is fast, precise, and works well for exact identifier lookups and
        known symbol names.
      </p>

      <h3>Semantic Search (Vector)</h3>
      <p>
        Computes the <strong>cosine similarity</strong> between the query
        embedding and all entity embeddings to find conceptually related code.
        This is the strategy that lets you search by intent rather than exact
        wording.
      </p>
      <p>
        ctx-sys optionally supports <strong>HyDE (Hypothetical Document
        Embeddings)</strong> for query expansion. With HyDE, the system first
        asks a language model to generate a hypothetical code snippet that
        would answer the query, then embeds that snippet instead of the raw
        query. This can significantly improve recall for abstract or
        high-level queries.
      </p>

      <h3>Graph Traversal</h3>
      <p>
        Walks the entity relationship graph starting from top keyword or
        vector matches. If a function is relevant, its containing file, the
        types it uses, and the modules that import it may also be relevant.
        Graph traversal surfaces this connected context automatically.
      </p>

      <h3>Fusion: Reciprocal Rank Fusion (RRF)</h3>
      <p>
        Results from all active strategies are combined using{' '}
        <strong>Reciprocal Rank Fusion (RRF)</strong>. RRF assigns each result
        a score based on its rank in each individual strategy&apos;s results
        list, then sums the scores. This produces a final ranking that
        balances precision (from keyword search), semantic understanding (from
        vector search), and structural context (from graph traversal).
      </p>

      {/* Conversation Memory */}
      <h2>Conversation Memory</h2>
      <p>
        ctx-sys maintains a persistent conversation memory that tracks
        interactions across sessions. This enables AI assistants to recall
        previous discussions, decisions, and context.
      </p>
      <ul>
        <li>
          <strong>Message storage</strong> &mdash; every message is stored with
          its role, content, and metadata, organized by session
        </li>
        <li>
          <strong>Decision extraction and search</strong> &mdash; architectural
          decisions made during conversations are extracted and indexed so they
          can be found later across sessions
        </li>
        <li>
          <strong>Session summarization</strong> &mdash; when a session ends,
          ctx-sys can generate a summary capturing the key topics, decisions,
          and outcomes
        </li>
      </ul>

      {/* Agent Memory */}
      <h2>Agent Memory</h2>
      <p>
        Beyond conversation history, ctx-sys provides structured memory
        primitives designed for AI agent workflows:
      </p>
      <ul>
        <li>
          <strong>Hot/cold memory tiering</strong> &mdash; frequently accessed
          context stays in &ldquo;hot&rdquo; memory for fast retrieval, while
          older items are spilled to &ldquo;cold&rdquo; storage to manage
          context window limits. Items can be recalled from cold storage on
          demand.
        </li>
        <li>
          <strong>Checkpointing</strong> &mdash; agents can save state
          snapshots at any point during a task, enabling resumable workflows.
          If a task is interrupted, the agent can load the latest checkpoint
          and continue from where it left off.
        </li>
        <li>
          <strong>Reflections</strong> &mdash; agents can store learnings from
          their experiences: what worked, what failed, and what to do
          differently next time. These reflections are searchable and can
          inform future behavior.
        </li>
      </ul>

      {/* Storage */}
      <h2>Storage</h2>
      <p>
        All data is stored in a single <strong>SQLite database</strong>. SQLite
        was chosen for its zero-configuration setup, single-file portability,
        and reliable performance. The database contains the following tables:
      </p>
      <ul>
        <li>
          <strong>entities</strong> &mdash; extracted code symbols with names,
          types, content, summaries, and file paths
        </li>
        <li>
          <strong>relationships</strong> &mdash; edges in the entity graph
          (source, target, type, weight)
        </li>
        <li>
          <strong>vectors</strong> &mdash; embedding vectors stored alongside
          entity references
        </li>
        <li>
          <strong>sessions</strong> &mdash; conversation sessions with
          metadata and status
        </li>
        <li>
          <strong>messages</strong> &mdash; individual messages within sessions
        </li>
        <li>
          <strong>checkpoints</strong> &mdash; agent state snapshots for
          resumable tasks
        </li>
        <li>
          <strong>reflections</strong> &mdash; agent learning records
        </li>
        <li>
          <strong>analytics</strong> &mdash; query logs, feedback, and usage
          statistics
        </li>
      </ul>
      <p>
        By default, the database is located at{' '}
        <code>~/.ctx-sys/ctx-sys.db</code>. You can change this path in the{' '}
        <Link href="/docs/configuration">configuration</Link>.
      </p>

      {/* MCP Protocol */}
      <h2>MCP Protocol</h2>
      <p>
        ctx-sys exposes all of its functionality through the{' '}
        <strong>Model Context Protocol (MCP)</strong>, an open standard for
        connecting AI assistants to external tools and data sources. When you
        run <code>ctx serve</code>, ctx-sys starts an MCP server that
        communicates over stdio.
      </p>
      <p>
        AI assistants like Claude Desktop and Cursor connect to this server and
        can invoke any ctx-sys capability as an MCP tool: indexing code,
        searching entities, storing messages, managing sessions, querying the
        graph, and more. This means the AI assistant can autonomously explore
        and understand your codebase using the full power of ctx-sys, without
        you needing to copy and paste code into the chat.
      </p>
      <p>
        See the <Link href="/docs/mcp-tools">MCP Tools reference</Link> for
        the complete list of available tools and their parameters.
      </p>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/quickstart">Quick Start</Link> &mdash; get up and
          running in five minutes
        </li>
        <li>
          <Link href="/docs/configuration">Configuration</Link> &mdash;
          customize indexing, search, and provider settings
        </li>
        <li>
          <Link href="/docs/mcp-tools">MCP Tools</Link> &mdash; explore the
          tools exposed to AI assistants
        </li>
        <li>
          <Link href="/docs/cli">CLI Commands</Link> &mdash; full command
          reference for the <code>ctx</code> CLI
        </li>
      </ul>
    </>
  );
}
