import Link from 'next/link';
import { CodeBlock, Callout } from '../../../components/docs';

export default function HowItWorksPage() {
  return (
    <>
      <h1>How It Works</h1>
      <p>
        ctx-sys is a local hybrid RAG system for codebases. It parses your
        source code into a structured knowledge graph, generates vector
        embeddings for semantic search, discovers relationships between symbols,
        and exposes a unified retrieval pipeline that combines keyword, vector,
        graph, and heuristic search strategies. Everything runs on your machine
        using SQLite and Ollama &mdash; no data leaves your environment.
      </p>

      <Callout type="tip">
        <p>
          If you want to jump straight into using ctx-sys, see
          the <Link href="/docs/quickstart">Quick Start</Link> guide. This page
          explains the internals.
        </p>
      </Callout>

      {/* Code Parsing */}
      <h2>Code Parsing</h2>
      <p>
        ctx-sys uses <strong>Tree-sitter</strong> to parse source files into
        abstract syntax trees (ASTs). Tree-sitter is fast, incremental, and
        error-tolerant &mdash; it produces useful parse trees even for
        incomplete or syntactically invalid code.
      </p>
      <p>Five languages are supported:</p>
      <ul>
        <li><strong>TypeScript / JavaScript</strong> (including TSX and JSX)</li>
        <li><strong>Python</strong></li>
        <li><strong>Rust</strong></li>
        <li><strong>Go</strong></li>
        <li><strong>Java</strong></li>
      </ul>
      <p>
        The parser walks each AST and extracts meaningful constructs: function
        declarations, class definitions, methods, interfaces, type aliases,
        imports, and exported variables.
      </p>
      <p>
        For non-code files &mdash; Markdown, HTML, YAML, JSON, and TOML
        &mdash; ctx-sys uses semantic paragraph splitting to chunk the content
        into coherent sections, each of which becomes a searchable entity.
      </p>

      {/* Entity Extraction */}
      <h2>Entity Extraction</h2>
      <p>
        Every code symbol identified during parsing becomes
        an <strong>entity</strong> in the ctx-sys knowledge base. Each entity
        records:
      </p>
      <ul>
        <li>
          <strong>Type</strong> &mdash; the kind of symbol: <code>function</code>,{' '}
          <code>class</code>, <code>method</code>, <code>interface</code>,{' '}
          <code>type</code>, <code>variable</code>, <code>module</code>,
          or <code>file</code>
        </li>
        <li>
          <strong>Name</strong> &mdash; the symbol name
          (e.g., <code>authenticateRequest</code>)
        </li>
        <li>
          <strong>Qualified name</strong> &mdash; a globally unique identifier
          combining the file path and symbol name
          (e.g., <code>src/middleware/auth.ts::authenticateRequest</code>)
        </li>
        <li>
          <strong>Content</strong> &mdash; the full source code of the symbol
        </li>
        <li>
          <strong>File path</strong> and <strong>line numbers</strong> &mdash;
          where the symbol is defined in the repository
        </li>
      </ul>
      <p>
        Entities are <strong>upserted by qualified name</strong>. When you
        re-index a project, existing entities are updated in place rather than
        deleted and recreated. This keeps entity IDs stable, which means
        embeddings and relationships remain linked across re-indexes without
        recomputation.
      </p>
      <CodeBlock title="Example: entity for a function">{`{
  type: "function",
  name: "authenticateRequest",
  qualified_name: "src/middleware/auth.ts::authenticateRequest",
  file_path: "src/middleware/auth.ts",
  start_line: 12,
  end_line: 38,
  content: "export async function authenticateRequest(req: Request) { ... }"
}`}</CodeBlock>

      {/* Relationship Discovery */}
      <h2>Relationship Discovery</h2>
      <p>
        After entities are extracted, ctx-sys builds
        a <strong>relationship graph</strong> connecting them. Two kinds of
        relationships are discovered automatically during indexing:
      </p>
      <ul>
        <li>
          <strong>CONTAINS</strong> &mdash; a file contains a symbol.
          For example, <code>src/auth.ts</code> CONTAINS{' '}
          <code>authenticateRequest</code>.
        </li>
        <li>
          <strong>IMPORTS</strong> &mdash; one file imports from another.
          For example, <code>src/routes/login.ts</code> IMPORTS{' '}
          <code>src/auth.ts</code>.
        </li>
      </ul>
      <p>
        For richer structural understanding, ctx-sys also
        supports <strong>LLM-powered relationship extraction</strong>. Running{' '}
        <code>ctx-sys entity extract-rel</code> sends entity content to a
        language model, which identifies higher-level relationships:
      </p>
      <ul>
        <li>
          <strong>CALLS</strong> &mdash; one function calls another
        </li>
        <li>
          <strong>EXTENDS</strong> &mdash; a class extends a base class
        </li>
        <li>
          <strong>IMPLEMENTS</strong> &mdash; a class implements an interface
        </li>
      </ul>
      <p>
        These relationships enable graph traversal during search. When a query
        matches an entity, ctx-sys can walk its connections to surface related
        code that would not appear in a simple keyword or vector search.
      </p>

      {/* Embedding Generation */}
      <h2>Embedding Generation</h2>
      <p>
        To enable semantic search, ctx-sys generates vector embeddings for each
        entity using <strong>Ollama</strong> running locally. The default model
        is <strong>mxbai-embed-large:latest</strong>, which produces 1024-dimensional
        vectors. Embedding dimensions are auto-detected from the Ollama model
        metadata, so switching models requires no configuration changes.
      </p>
      <p>
        Large entities &mdash; functions with many lines, classes with several
        methods &mdash; are split into <strong>overlapping chunks</strong> before
        embedding. This ensures the full implementation is searchable, not just
        signatures or opening lines. Each chunk produces its own vector, and all
        vectors are linked back to the parent entity.
      </p>
      <p>
        Vectors are stored in <strong>sqlite-vec</strong>, a SQLite extension
        that provides fast KNN (k-nearest-neighbor) search using cosine
        distance. Because sqlite-vec runs inside the same SQLite database, there
        is no separate vector store to manage.
      </p>

      <Callout type="note">
        <p>
          Embedding generation requires Ollama to be running. See
          the <Link href="/docs/integrations#ollama">Ollama setup guide</Link> for
          installation instructions.
        </p>
      </Callout>

      {/* Hybrid Retrieval Pipeline */}
      <h2>Hybrid Retrieval Pipeline</h2>
      <p>
        The core of ctx-sys is its hybrid retrieval pipeline. When you run a
        query &mdash; either through the CLI, the MCP server, or
        the <code>context_query</code> tool &mdash; ctx-sys executes four search
        strategies in parallel, then fuses the results into a single ranked list
        using <strong>Reciprocal Rank Fusion (RRF)</strong>.
      </p>

      <h3>Keyword Search</h3>
      <p>
        Uses <strong>SQLite FTS5</strong> with <strong>BM25 ranking</strong> to
        match entities by name, content, and summary text. This strategy excels
        at exact identifier lookups and known symbol names. If you search
        for <code>authenticateRequest</code>, keyword search will find it
        directly.
      </p>

      <h3>Semantic Search</h3>
      <p>
        Embeds the query and computes <strong>cosine similarity</strong> against
        all entity vectors via sqlite-vec. This is what lets you search by
        intent &mdash; a query like &ldquo;authentication middleware&rdquo; will
        match relevant functions even if they never contain those exact words.
      </p>

      <h3>Graph Traversal</h3>
      <p>
        Starting from the top keyword and vector matches, ctx-sys walks the
        entity relationship graph to find connected code. If a matched function
        is contained in a file that imports a utility module, those connected
        entities are surfaced as additional context. This strategy brings in
        structural relationships that neither keyword nor vector search can
        capture on their own.
      </p>

      <h3>Heuristic Reranking</h3>
      <p>
        Applies score boosts based on signals such as entity type, path
        matching, and name matching. For example, if the query contains a file
        path fragment, entities from that path are boosted. If the query
        mentions a specific function name, exact name matches are ranked higher.
      </p>

      <h3>Reciprocal Rank Fusion (RRF)</h3>
      <p>
        Results from all four strategies are combined
        using <strong>RRF</strong>. Each strategy produces a ranked list of
        results. RRF assigns each result a score of{' '}
        <code>1 / (k + rank)</code> for each list it appears in, then sums the
        scores across lists. The final ranking balances precision (keyword
        search), semantic understanding (vector search), structural context
        (graph traversal), and relevance signals (heuristic reranking).
      </p>

      <h3>Advanced Retrieval Features</h3>
      <p>
        The retrieval pipeline supports several advanced options:
      </p>
      <ul>
        <li>
          <strong>HyDE (Hypothetical Document Embeddings)</strong> &mdash; before
          embedding the query, ctx-sys asks <strong>gemma3:12b</strong> to
          generate a hypothetical code snippet that would answer the query. The
          snippet is embedded instead of the raw query, which significantly
          improves recall for abstract or high-level questions.
        </li>
        <li>
          <strong>Query decomposition</strong> &mdash; complex queries are broken
          into sub-queries that are executed independently and merged. This
          helps when a single query touches multiple unrelated areas of the
          codebase.
        </li>
        <li>
          <strong>Retrieval gating</strong> &mdash; trivial queries (greetings,
          simple yes/no questions) are detected and skipped, avoiding unnecessary
          retrieval overhead.
        </li>
      </ul>

      {/* Context Assembly */}
      <h2>Context Assembly</h2>
      <p>
        After retrieval, the <code>context_query</code> tool assembles a
        token-budgeted response. You specify a maximum token count, and ctx-sys
        fills that budget with the highest-ranked results.
      </p>
      <p>
        When <strong>auto-expansion</strong> is enabled (the default), ctx-sys
        automatically includes related entities that provide critical context:
      </p>
      <ul>
        <li>
          <strong>Parent classes</strong> &mdash; if a matched method belongs to a
          class, the class definition is included
        </li>
        <li>
          <strong>Imported types</strong> &mdash; type definitions referenced by
          matched entities are pulled in
        </li>
        <li>
          <strong>Type definitions</strong> &mdash; interfaces and type aliases
          that matched entities depend on
        </li>
      </ul>
      <p>
        Each result in the response includes <strong>source attribution</strong>:
        file path, line numbers, entity type, and relevance score. This lets the
        consuming AI assistant cite specific locations in the codebase.
      </p>

      <CodeBlock title="Example: context_query call">{`ctx-sys context query "how does authentication work" \\
  --max-tokens 4000 \\
  --hyde \\
  --expand`}</CodeBlock>

      {/* Conversation Memory */}
      <h2>Conversation Memory</h2>
      <p>
        ctx-sys maintains persistent conversation memory organized
        into <strong>sessions</strong>. Each session tracks a sequence of
        messages along with metadata about the conversation.
      </p>
      <ul>
        <li>
          <strong>Message storage</strong> &mdash; every message is stored with
          its role, content, and metadata, organized by session
        </li>
        <li>
          <strong>Architectural decisions</strong> &mdash; decisions made during
          conversations are extracted and indexed, so they can be searched across
          sessions later
        </li>
        <li>
          <strong>Session summaries</strong> &mdash; ctx-sys can generate a
          summary of a session capturing the key topics, decisions, and outcomes,
          providing context for future conversations
        </li>
      </ul>
      <p>
        For long-running agent workflows, ctx-sys
        provides <strong>hot/cold memory tiering</strong>. Frequently accessed
        context stays in hot memory for fast retrieval, while older items are
        spilled to cold storage to manage context window limits. Items can be
        recalled from cold storage on demand when they become relevant again.
      </p>
      <p>
        Agents can also save <strong>checkpoints</strong> &mdash; state
        snapshots at any point during a task &mdash; enabling resumable
        workflows. And <strong>reflections</strong> let agents store learnings
        from their experiences (what worked, what failed, what to do differently)
        that are searchable and can inform future behavior.
      </p>

      {/* Storage */}
      <h2>Storage</h2>
      <p>
        All data lives in a single <strong>SQLite database</strong>. SQLite was
        chosen for its zero-configuration setup, single-file portability, and
        reliable performance. The database runs in <strong>WAL mode</strong>{' '}
        (Write-Ahead Logging) for concurrent read/write access.
      </p>
      <p>The database contains the following tables:</p>
      <ul>
        <li>
          <strong>Entities</strong> &mdash; extracted code symbols with names,
          types, qualified names, content, and file paths
        </li>
        <li>
          <strong>Relationships</strong> &mdash; edges in the entity graph
          (source, target, relationship type, weight)
        </li>
        <li>
          <strong>FTS5 index</strong> &mdash; full-text search index over entity
          names, content, and summaries
        </li>
        <li>
          <strong>Vectors</strong> (vec0) &mdash; embedding vectors stored via
          sqlite-vec, linked to entities by ID
        </li>
        <li>
          <strong>Sessions</strong> &mdash; conversation sessions with metadata
          and status
        </li>
        <li>
          <strong>Messages</strong> &mdash; individual messages within sessions
        </li>
        <li>
          <strong>Checkpoints</strong> &mdash; agent state snapshots for
          resumable tasks
        </li>
        <li>
          <strong>Reflections</strong> &mdash; agent learning records with tags
          and outcomes
        </li>
      </ul>
      <p>
        By default, the database is located at{' '}
        <code>~/.ctx-sys/ctx-sys.db</code>. See
        the <Link href="/docs/configuration">Configuration</Link> page to
        change this path.
      </p>

      <Callout type="tip">
        <p>
          Because everything is in a single file, backing up or moving your
          ctx-sys data is as simple as copying the database file.
        </p>
      </Callout>

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
          reference for the <code>ctx-sys</code> CLI
        </li>
      </ul>
    </>
  );
}
