import { CodeBlock, FlagTable } from '../../../components/docs';

export default function CLIReferencePage() {
  return (
    <>
      <h1>CLI Reference</h1>
      <p>
        ctx-sys provides <strong>16 commands</strong> with subcommands for
        managing your codebase index, searching, and running the MCP server.
        Both <code>ctx</code> and <code>ctx-sys</code> work as the command
        name.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/*  CORE COMMANDS                                                      */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="core-commands">Core Commands</h2>

      <h3 id="init"><code>init</code></h3>
      <p>
        Initialize a ctx-sys project. Creates a <code>.ctx-sys/</code> directory
        with a default <code>config.yaml</code>.
      </p>
      <CodeBlock>{`ctx-sys init [directory]`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-n, --name <name>', description: 'Set a custom project name' },
          { flag: '-f, --force', description: 'Overwrite existing configuration' },
          { flag: '--global', description: 'Initialize global configuration instead' },
        ]}
      />
      <CodeBlock title="Example">{`$ ctx-sys init --name my-api
Initialized ctx-sys project "my-api" in /home/user/my-api
Created .ctx-sys/config.yaml`}</CodeBlock>

      <h3 id="index"><code>index</code></h3>
      <p>
        Index a codebase for context retrieval. Parses source files with
        tree-sitter, extracts entities and relationships, indexes documentation,
        and generates embeddings. Docs and embeddings are included by default
        &mdash; use <code>--no-doc</code> or <code>--no-embed</code> to skip
        them.
      </p>
      <CodeBlock>{`ctx-sys index [directory]`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-f, --force', description: 'Force re-index even if files haven\'t changed' },
          { flag: '--full', description: 'Full re-index, clearing existing data first' },
          { flag: '--concurrency <n>', description: 'Files to parse in parallel', default: '5' },
          { flag: '--include <patterns>', description: 'Glob patterns to include (comma-separated)' },
          { flag: '--exclude <patterns>', description: 'Glob patterns to exclude (comma-separated)' },
          { flag: '-q, --quiet', description: 'Suppress progress output' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
          { flag: '--no-doc', description: 'Skip documentation indexing' },
          { flag: '--doc-path <path>', description: 'Index a specific doc file or directory' },
          { flag: '--no-embed', description: 'Skip embedding generation' },
          { flag: '--embed-batch-size <n>', description: 'Batch size for embedding generation', default: '50' },
        ]}
      />
      <CodeBlock title="Example">{`$ ctx-sys index --exclude "vendor/**,dist/**"
Indexing codebase...
Parsed 142 files
Extracted 387 entities
Built 612 relationships
Generating embeddings... done (387 entities)
Done in 18.4s`}</CodeBlock>

      <h3 id="search"><code>search</code></h3>
      <p>
        Search the indexed codebase using hybrid retrieval (keyword + semantic +
        graph). Results are ranked by relevance score.
      </p>
      <CodeBlock>{`ctx-sys search <query>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-l, --limit <n>', description: 'Maximum number of results', default: '10' },
          { flag: '-t, --type <type>', description: 'Filter by entity type (function, class, file, etc.)' },
          { flag: '--no-semantic', description: 'Keyword search only (disable embeddings)' },
          { flag: '--hyde', description: 'Use HyDE for better conceptual search' },
          { flag: '--threshold <n>', description: 'Minimum similarity score (0-1)', default: '0.3' },
          { flag: '--format <format>', description: 'Output format: text or json', default: 'text' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />
      <CodeBlock title="Example">{`$ ctx-sys search "authentication middleware"
Results (5 matches):

  1. src/middleware/auth.ts::authenticateRequest  [0.92]
     Validates JWT tokens and attaches user context.

  2. src/middleware/auth.ts::requireRole           [0.87]
     Role-based access control middleware factory.`}</CodeBlock>

      <h3 id="context"><code>context</code></h3>
      <p>
        Query assembled context with source attribution. Like the MCP{' '}
        <code>context_query</code> tool but from the command line. Returns a
        token-budgeted response with auto-expanded related entities.
      </p>
      <CodeBlock>{`ctx-sys context <query>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-t, --tokens <n>', description: 'Max tokens for context', default: '4000' },
          { flag: '--type <types>', description: 'Entity types to include (comma-separated)' },
          { flag: '--strategy <strategies>', description: 'Search strategies: keyword,semantic,graph' },
          { flag: '--min-score <n>', description: 'Minimum relevance score (0-1)', default: '0.1' },
          { flag: '--no-sources', description: 'Omit source attribution' },
          { flag: '--no-expand', description: 'Disable auto-inclusion of parent classes, imports, types' },
          { flag: '--expand-tokens <n>', description: 'Token budget for expansion', default: '2000' },
          { flag: '--decompose', description: 'Break complex queries into sub-queries' },
          { flag: '--gate', description: 'Skip retrieval for trivial queries' },
          { flag: '--hyde', description: 'Use HyDE for better semantic search' },
          { flag: '--hyde-model <model>', description: 'Model for HyDE generation', default: 'gemma3:12b' },
          { flag: '--max-results <n>', description: 'Maximum results to include', default: '15' },
          { flag: '--format <format>', description: 'Output format: markdown, json, text', default: 'markdown' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="status"><code>status</code></h3>
      <p>
        Show project status including entity counts, embedding coverage, and
        optional health checks for Ollama connectivity and model availability.
      </p>
      <CodeBlock>{`ctx-sys status [directory]`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-d, --db <path>', description: 'Custom database path' },
          { flag: '--check', description: 'Run full health checks (Ollama, models, database)' },
          { flag: '--json', description: 'Output as JSON' },
        ]}
      />

      <h3 id="serve"><code>serve</code></h3>
      <p>
        Start the MCP server on stdio. Designed to be launched by AI assistants
        like Claude Desktop or Cursor. Exposes 30 tools for searching,
        indexing, and managing context.
      </p>
      <CodeBlock>{`ctx-sys serve`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-d, --db <path>', description: 'Database path' },
          { flag: '-p, --project <path>', description: 'Project directory (auto-detects database)' },
          { flag: '-n, --name <name>', description: 'Server name', default: 'ctx-sys' },
          { flag: '-v, --version <version>', description: 'Server version', default: '1.0.0' },
        ]}
      />

      <h3 id="watch"><code>watch</code></h3>
      <p>
        Watch for file changes and automatically re-index affected files.
        Useful during active development.
      </p>
      <CodeBlock>{`ctx-sys watch [directory]`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-d, --db <path>', description: 'Custom database path' },
          { flag: '--debounce <ms>', description: 'Debounce delay in milliseconds', default: '300' },
          { flag: '--include <patterns>', description: 'Glob patterns to include (comma-separated)' },
          { flag: '--exclude <patterns>', description: 'Glob patterns to exclude (comma-separated)' },
          { flag: '-q, --quiet', description: 'Suppress event output' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  ENTITY COMMANDS                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="entity-commands">Entity Commands</h2>
      <p>Manage indexed entities (functions, classes, files, etc.).</p>

      <h3 id="entity-list"><code>entity list</code></h3>
      <p>List entities in the project with optional filters.</p>
      <CodeBlock>{`ctx-sys entity list`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-t, --type <type>', description: 'Filter by entity type' },
          { flag: '-f, --file <path>', description: 'Filter by file path' },
          { flag: '-l, --limit <n>', description: 'Max entities to show', default: '50' },
          { flag: '-o, --offset <n>', description: 'Skip first N entities', default: '0' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="entity-get"><code>entity get</code></h3>
      <p>Show details for a specific entity by ID or qualified name.</p>
      <CodeBlock>{`ctx-sys entity get <id>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '--content', description: 'Include full source content' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="entity-delete"><code>entity delete</code></h3>
      <p>Delete an entity by ID.</p>
      <CodeBlock>{`ctx-sys entity delete <id>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--force', description: 'Skip confirmation prompt' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="entity-stats"><code>entity stats</code></h3>
      <p>Show entity statistics: counts by type, file distribution.</p>
      <CodeBlock>{`ctx-sys entity stats`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="entity-extract-rel"><code>entity extract-rel</code></h3>
      <p>
        Use an LLM to discover relationships (CALLS, EXTENDS, IMPLEMENTS)
        between existing entities. Requires an LLM provider (Ollama).
      </p>
      <CodeBlock>{`ctx-sys entity extract-rel`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--type <type>', description: 'Only process entities of this type' },
          { flag: '--limit <n>', description: 'Max entities to process', default: '50' },
          { flag: '--dry-run', description: 'Show what would be extracted without saving' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
          { flag: '-q, --quiet', description: 'Suppress output' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  GRAPH COMMANDS                                                     */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="graph-commands">Graph Commands</h2>
      <p>Explore and manage the entity relationship graph.</p>

      <h3 id="graph-query"><code>graph query</code></h3>
      <p>Traverse the relationship graph starting from an entity.</p>
      <CodeBlock>{`ctx-sys graph query <entity>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-d, --depth <n>', description: 'Max traversal depth', default: '2' },
          { flag: '-t, --types <types>', description: 'Filter relationship types (comma-separated)' },
          { flag: '--direction <dir>', description: 'Direction: outgoing, incoming, both', default: 'both' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '--db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="graph-stats"><code>graph stats</code></h3>
      <p>Show graph statistics: node count, edge count, relationship type breakdown.</p>
      <CodeBlock>{`ctx-sys graph stats`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="graph-relationships"><code>graph relationships</code></h3>
      <p>List relationships with optional filters.</p>
      <CodeBlock>{`ctx-sys graph relationships`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-t, --type <type>', description: 'Filter by relationship type' },
          { flag: '-s, --source <id>', description: 'Filter by source entity' },
          { flag: '--target <id>', description: 'Filter by target entity' },
          { flag: '-l, --limit <n>', description: 'Max relationships to show', default: '50' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="graph-link"><code>graph link</code></h3>
      <p>Create a relationship between two entities.</p>
      <CodeBlock>{`ctx-sys graph link <source> <type> <target>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-w, --weight <n>', description: 'Relationship weight (0-1)', default: '1.0' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  EMBEDDING COMMANDS                                                 */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="embedding-commands">Embedding Commands</h2>
      <p>Manage vector embeddings for semantic search.</p>

      <h3 id="embed-run"><code>embed run</code></h3>
      <p>
        Generate embeddings for entities that don&apos;t have them yet.
        Uses Ollama with <code>mxbai-embed-large:latest</code> by default.
      </p>
      <CodeBlock>{`ctx-sys embed run`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-t, --type <type>', description: 'Only embed entities of this type' },
          { flag: '-f, --force', description: 'Regenerate all embeddings' },
          { flag: '--model-upgrade', description: 'Re-embed only vectors from a different model' },
          { flag: '-l, --limit <n>', description: 'Max entities to embed' },
          { flag: '--dry-run', description: 'Show what would be embedded' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="embed-status"><code>embed status</code></h3>
      <p>Show embedding coverage: how many entities have embeddings vs total.</p>
      <CodeBlock>{`ctx-sys embed status`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="embed-cleanup"><code>embed cleanup</code></h3>
      <p>Remove orphaned embeddings (vectors for deleted entities).</p>
      <CodeBlock>{`ctx-sys embed cleanup`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--force', description: 'Actually delete (otherwise dry-run)' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  SUMMARIZATION COMMANDS                                             */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="summarization-commands">Summarization Commands</h2>
      <p>Generate LLM-powered natural language summaries for code entities.</p>

      <h3 id="summarize-run"><code>summarize run</code></h3>
      <p>
        Generate summaries using an LLM. Uses <code>qwen3:0.6b</code> via
        Ollama by default.
      </p>
      <CodeBlock>{`ctx-sys summarize run`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-t, --type <type>', description: 'Only summarize entities of this type' },
          { flag: '-f, --force', description: 'Regenerate all summaries' },
          { flag: '-l, --limit <n>', description: 'Max entities to summarize' },
          { flag: '--provider <name>', description: 'LLM provider: ollama, openai, anthropic' },
          { flag: '--batch-size <n>', description: 'Entities per batch', default: '20' },
          { flag: '--concurrency <n>', description: 'Concurrent requests per batch', default: '5' },
          { flag: '--dry-run', description: 'Show what would be summarized' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="summarize-status"><code>summarize status</code></h3>
      <p>Show summarization coverage.</p>
      <CodeBlock>{`ctx-sys summarize status`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="summarize-providers"><code>summarize providers</code></h3>
      <p>Show available LLM providers and their status.</p>
      <CodeBlock>{`ctx-sys summarize providers`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '--json', description: 'Output as JSON' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  SESSION COMMANDS                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="session-commands">Session Commands</h2>
      <p>Manage conversation sessions and decision history.</p>

      <h3 id="session-list"><code>session list</code></h3>
      <p>List conversation sessions.</p>
      <CodeBlock>{`ctx-sys session list`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-s, --status <status>', description: 'Filter by status (active/archived/summarized)' },
          { flag: '-l, --limit <n>', description: 'Max sessions to show', default: '20' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="session-messages"><code>session messages</code></h3>
      <p>View messages in a session. Uses the most recent session if no ID is given.</p>
      <CodeBlock>{`ctx-sys session messages [sessionId]`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-l, --limit <n>', description: 'Max messages to show', default: '50' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '--raw', description: 'Show full message content without truncation' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="session-search-decisions"><code>session search-decisions</code></h3>
      <p>Search for architectural decisions across all sessions.</p>
      <CodeBlock>{`ctx-sys session search-decisions <query>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-l, --limit <n>', description: 'Maximum results', default: '10' },
          { flag: '-s, --session <id>', description: 'Filter by session ID' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  CONFIG COMMANDS                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="config-commands">Config Commands</h2>
      <p>Manage project and global configuration.</p>

      <h3 id="config-get"><code>config get</code></h3>
      <p>Get a configuration value by key.</p>
      <CodeBlock>{`ctx-sys config get <key>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory' },
          { flag: '-g, --global', description: 'Get from global config only' },
        ]}
      />

      <h3 id="config-set"><code>config set</code></h3>
      <p>Set a configuration value.</p>
      <CodeBlock>{`ctx-sys config set <key> <value>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory' },
          { flag: '-g, --global', description: 'Set in global config' },
        ]}
      />

      <h3 id="config-list"><code>config list</code></h3>
      <p>List all configuration values.</p>
      <CodeBlock>{`ctx-sys config list`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory' },
          { flag: '-g, --global', description: 'List global config only' },
        ]}
      />

      <h3 id="config-path"><code>config path</code></h3>
      <p>Show configuration file paths (project and global).</p>
      <CodeBlock>{`ctx-sys config path`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  DEBUG COMMANDS                                                     */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="debug-commands">Debug Commands</h2>
      <p>Database debugging, maintenance, and health checks.</p>

      <h3 id="debug-inspect"><code>debug inspect</code></h3>
      <p>Inspect database tables and their contents.</p>
      <CodeBlock>{`ctx-sys debug inspect`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-t, --table <name>', description: 'Specific table to inspect' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="debug-query"><code>debug query</code></h3>
      <p>Execute a raw SQL query against the database.</p>
      <CodeBlock>{`ctx-sys debug query <sql>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="debug-export"><code>debug export</code></h3>
      <p>Export project data to a file.</p>
      <CodeBlock>{`ctx-sys debug export <output-file>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-f, --format <format>', description: 'Export format: json, sql', default: 'json' },
          { flag: '--entities', description: 'Export entities only' },
          { flag: '--relationships', description: 'Export relationships only' },
          { flag: '--full', description: 'Include checkpoints, memory items, reflections' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="debug-import"><code>debug import</code></h3>
      <p>Import project data from a file.</p>
      <CodeBlock>{`ctx-sys debug import <input-file>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--merge', description: 'Merge with existing data (default: replace)' },
          { flag: '--force', description: 'Skip embedding model mismatch warning' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="debug-health"><code>debug health</code></h3>
      <p>Run comprehensive system health checks.</p>
      <CodeBlock>{`ctx-sys debug health`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  KB COMMANDS                                                        */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="kb-commands">Knowledge Base Commands</h2>
      <p>
        Package indexed projects as shareable <code>.ctx-kb</code> files.
        Knowledge bases bundle entities, relationships, and embeddings so
        others can install them without re-indexing.
      </p>

      <h3 id="kb-create"><code>kb create</code></h3>
      <p>Package the current project as a <code>.ctx-kb</code> knowledge base.</p>
      <CodeBlock>{`ctx-sys kb create <name>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--ver <version>', description: 'Package version', default: '1.0.0' },
          { flag: '--description <text>', description: 'Package description' },
          { flag: '--creator <name>', description: 'Creator name' },
          { flag: '-o, --output <path>', description: 'Output file path' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="kb-install"><code>kb install</code></h3>
      <p>Install a <code>.ctx-kb</code> file as a new project.</p>
      <CodeBlock>{`ctx-sys kb install <file>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '--as <name>', description: 'Override project name' },
          { flag: '--merge', description: 'Merge into existing project' },
          { flag: '--force', description: 'Skip embedding model mismatch warning' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="kb-info"><code>kb info</code></h3>
      <p>Display manifest information from a <code>.ctx-kb</code> file.</p>
      <CodeBlock>{`ctx-sys kb info <file>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '--json', description: 'Output as JSON' },
        ]}
      />

      <h3 id="kb-list"><code>kb list</code></h3>
      <p>List installed knowledge bases.</p>
      <CodeBlock>{`ctx-sys kb list`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  INSTRUCTION COMMANDS                                               */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="instruction-commands">Instruction Commands</h2>
      <p>
        Manage team instructions that guide AI assistant behavior. Instructions
        can be scoped to specific file types or directories.
      </p>

      <h3 id="instruction-add"><code>instruction add</code></h3>
      <p>Add a new instruction.</p>
      <CodeBlock>{`ctx-sys instruction add <name>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-c, --content <text>', description: 'Instruction content' },
          { flag: '-f, --file <path>', description: 'Read content from file' },
          { flag: '--scope <json>', description: 'Scope as JSON: {"fileTypes":[".tsx"], "directories":["src/"]}' },
          { flag: '--priority <level>', description: 'Priority: high, normal, low', default: 'normal' },
          { flag: '--tags <tags>', description: 'Comma-separated tags' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="instruction-list"><code>instruction list</code></h3>
      <p>List all instructions.</p>
      <CodeBlock>{`ctx-sys instruction list`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '--tag <tag>', description: 'Filter by tag' },
          { flag: '--priority <level>', description: 'Filter by priority' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="instruction-edit"><code>instruction edit</code></h3>
      <p>Edit an existing instruction.</p>
      <CodeBlock>{`ctx-sys instruction edit <id>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-c, --content <text>', description: 'New content' },
          { flag: '--priority <level>', description: 'New priority' },
          { flag: '--active <bool>', description: 'Set active status (true/false)' },
          { flag: '--tags <tags>', description: 'New tags (comma-separated)' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      <h3 id="instruction-remove"><code>instruction remove</code></h3>
      <p>Remove an instruction.</p>
      <CodeBlock>{`ctx-sys instruction remove <id>`}</CodeBlock>
      <FlagTable
        flags={[
          { flag: '-p, --project <path>', description: 'Project directory', default: '.' },
          { flag: '-d, --db <path>', description: 'Custom database path' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/*  COMMON WORKFLOWS                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="common-workflows">Common Workflows</h2>

      <h3>First-time setup</h3>
      <CodeBlock>{`# Install and pull embedding model
npm install -g ctx-sys
ollama pull mxbai-embed-large:latest

# Initialize and index
cd your-project
ctx-sys init && ctx-sys index

# Verify everything is working
ctx-sys status --check`}</CodeBlock>

      <h3>Daily development</h3>
      <CodeBlock>{`# Auto-reindex on file changes
ctx-sys watch

# Or sync from git after pulling
ctx-sys index`}</CodeBlock>

      <h3>Sharing a knowledge base</h3>
      <CodeBlock>{`# Package your indexed project
ctx-sys kb create my-project --description "API server context"

# Share the .ctx-kb file, then install it elsewhere
ctx-sys kb install my-project-1.0.0.ctx-kb`}</CodeBlock>

      <h3>Full re-index from scratch</h3>
      <CodeBlock>{`# Force re-index everything
ctx-sys index --full --force`}</CodeBlock>
    </>
  );
}
