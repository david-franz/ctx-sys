'use client';

import Link from 'next/link';

function CmdBlock({ children }: { children: string }) {
  return (
    <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
      <pre className="m-0 p-0 bg-transparent border-0">
        <code className="text-sm text-slate-50 font-mono">{children}</code>
      </pre>
    </div>
  );
}

function OptTable({
  options,
}: {
  options: { flag: string; description: string }[];
}) {
  return (
    <div className="not-prose overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 pr-4 font-semibold text-slate-700 dark:text-slate-300">
              Option
            </th>
            <th className="text-left py-2 font-semibold text-slate-700 dark:text-slate-300">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {options.map((opt) => (
            <tr
              key={opt.flag}
              className="border-b border-slate-100 dark:border-slate-800"
            >
              <td className="py-2 pr-4 font-mono text-xs text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                {opt.flag}
              </td>
              <td className="py-2 text-slate-600 dark:text-slate-300">
                {opt.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sidebarLinks = [
  { href: '#core-commands', label: 'Core' },
  { href: '#entity-commands', label: 'Entity' },
  { href: '#graph-commands', label: 'Graph' },
  { href: '#embedding-commands', label: 'Embedding' },
  { href: '#summarization-commands', label: 'Summarization' },
  { href: '#session-commands', label: 'Session' },
  { href: '#document-decision-commands', label: 'Document / Decision' },
  { href: '#analytics-commands', label: 'Analytics' },
  { href: '#debug-commands', label: 'Debug' },
  { href: '#common-workflows', label: 'Common Workflows' },
];

export default function CLIReferencePage() {
  return (
    <div className="flex gap-10">
      {/* Main content */}
      <div className="min-w-0 flex-1">
      <h1>CLI Reference</h1>
      <p>
        ctx-sys provides <strong>33 CLI commands</strong> organized by function.
        Both <code>ctx</code> and <code>ctx-sys</code> work as the command
        name &mdash; all examples below use <code>ctx-sys</code>.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Table of Contents                                                   */}
      {/* ------------------------------------------------------------------ */}
      <h2 id="table-of-contents">Table of Contents</h2>

      <div className="not-prose columns-2 gap-8 text-sm my-4">
        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Core Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#init" className="text-cyan-600 dark:text-cyan-400 hover:underline">init</a></li>
            <li><a href="#index" className="text-cyan-600 dark:text-cyan-400 hover:underline">index</a></li>
            <li><a href="#search" className="text-cyan-600 dark:text-cyan-400 hover:underline">search</a></li>
            <li><a href="#watch" className="text-cyan-600 dark:text-cyan-400 hover:underline">watch</a></li>
            <li><a href="#config" className="text-cyan-600 dark:text-cyan-400 hover:underline">config</a></li>
            <li><a href="#status" className="text-cyan-600 dark:text-cyan-400 hover:underline">status</a></li>
            <li><a href="#serve" className="text-cyan-600 dark:text-cyan-400 hover:underline">serve</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Entity Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#entities" className="text-cyan-600 dark:text-cyan-400 hover:underline">entities</a></li>
            <li><a href="#entity" className="text-cyan-600 dark:text-cyan-400 hover:underline">entity</a></li>
            <li><a href="#entity-delete" className="text-cyan-600 dark:text-cyan-400 hover:underline">entity-delete</a></li>
            <li><a href="#entity-stats" className="text-cyan-600 dark:text-cyan-400 hover:underline">entity-stats</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Graph Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#graph" className="text-cyan-600 dark:text-cyan-400 hover:underline">graph</a></li>
            <li><a href="#graph-stats" className="text-cyan-600 dark:text-cyan-400 hover:underline">graph-stats</a></li>
            <li><a href="#relationships" className="text-cyan-600 dark:text-cyan-400 hover:underline">relationships</a></li>
            <li><a href="#link" className="text-cyan-600 dark:text-cyan-400 hover:underline">link</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Embedding Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#embed" className="text-cyan-600 dark:text-cyan-400 hover:underline">embed</a></li>
            <li><a href="#embed-status" className="text-cyan-600 dark:text-cyan-400 hover:underline">embed-status</a></li>
            <li><a href="#embed-cleanup" className="text-cyan-600 dark:text-cyan-400 hover:underline">embed-cleanup</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Summarization Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#summarize" className="text-cyan-600 dark:text-cyan-400 hover:underline">summarize</a></li>
            <li><a href="#summarize-status" className="text-cyan-600 dark:text-cyan-400 hover:underline">summarize-status</a></li>
            <li><a href="#providers" className="text-cyan-600 dark:text-cyan-400 hover:underline">providers</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Session Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#sessions" className="text-cyan-600 dark:text-cyan-400 hover:underline">sessions</a></li>
            <li><a href="#messages" className="text-cyan-600 dark:text-cyan-400 hover:underline">messages</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Document and Decision Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#doc-index" className="text-cyan-600 dark:text-cyan-400 hover:underline">doc-index</a></li>
            <li><a href="#extract-relationships" className="text-cyan-600 dark:text-cyan-400 hover:underline">extract-relationships</a></li>
            <li><a href="#search-decisions" className="text-cyan-600 dark:text-cyan-400 hover:underline">search-decisions</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Analytics Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#analytics" className="text-cyan-600 dark:text-cyan-400 hover:underline">analytics</a></li>
            <li><a href="#dashboard" className="text-cyan-600 dark:text-cyan-400 hover:underline">dashboard</a></li>
          </ul>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="font-semibold text-slate-900 dark:text-white mb-1">
            Debug Commands
          </p>
          <ul className="list-none pl-0 space-y-0.5">
            <li><a href="#inspect" className="text-cyan-600 dark:text-cyan-400 hover:underline">inspect</a></li>
            <li><a href="#query" className="text-cyan-600 dark:text-cyan-400 hover:underline">query</a></li>
            <li><a href="#export" className="text-cyan-600 dark:text-cyan-400 hover:underline">export</a></li>
            <li><a href="#import" className="text-cyan-600 dark:text-cyan-400 hover:underline">import</a></li>
            <li><a href="#health" className="text-cyan-600 dark:text-cyan-400 hover:underline">health</a></li>
          </ul>
        </div>
      </div>

      {/* ================================================================== */}
      {/* CORE COMMANDS                                                       */}
      {/* ================================================================== */}
      <h2 id="core-commands">Core Commands</h2>

      {/* ---- init -------------------------------------------------------- */}
      <h3 id="init">init</h3>
      <p>
        Initialize a ctx-sys project. Creates a <code>.ctx-sys/</code> directory
        with default configuration in the target directory.
      </p>
      <CmdBlock>{`ctx-sys init [directory]`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-n, --name <name>', description: 'Set a custom project name' },
          { flag: '-f, --force', description: 'Overwrite existing configuration' },
          { flag: '--global', description: 'Write to the global configuration directory instead' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys init --name my-api
Initialized ctx-sys project "my-api" in /home/user/my-api
Created .ctx-sys/config.yaml`}</CmdBlock>

      {/* ---- index ------------------------------------------------------- */}
      <h3 id="index">index</h3>
      <p>
        Index a codebase for context retrieval. Parses source files, extracts
        entities (functions, classes, modules, etc.), and discovers relationships
        between them.
      </p>
      <CmdBlock>{`ctx-sys index [directory]`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-f, --force', description: 'Force re-index even if files have not changed' },
          { flag: '--full', description: 'Perform a full re-index, clearing existing data first' },
          { flag: '--concurrency <n>', description: 'Number of files to parse in parallel' },
          { flag: '--include <patterns>', description: 'Glob patterns for files to include (comma-separated)' },
          { flag: '--exclude <patterns>', description: 'Glob patterns for files to exclude (comma-separated)' },
          { flag: '-q, --quiet', description: 'Suppress progress output' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
          { flag: '--doc', description: 'Also index markdown and documentation files' },
          { flag: '--embed', description: 'Generate vector embeddings after indexing' },
          { flag: '--embed-batch-size <n>', description: 'Batch size for embedding generation' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys index --exclude "vendor/**,dist/**"
Indexing codebase...
Parsed 142 files
Extracted 387 entities
Built 612 relationships
Generating embeddings... done (387 entities)
Done in 18.4s`}</CmdBlock>

      {/* ---- search ------------------------------------------------------ */}
      <h3 id="search">search</h3>
      <p>
        Search the indexed codebase. Supports keyword, semantic (vector), and
        hybrid search modes. Results are ranked by relevance score.
      </p>
      <CmdBlock>{`ctx-sys search <query>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-l, --limit <n>', description: 'Maximum number of results (default: 10)' },
          { flag: '-t, --type <type>', description: 'Filter results by entity type' },
          { flag: '--semantic', description: 'Use semantic (vector) search' },
          { flag: '--hyde', description: 'Use HyDE (Hypothetical Document Embeddings) for improved semantic search' },
          { flag: '--threshold <n>', description: 'Minimum relevance score, 0 to 1 (default: 0.3)' },
          { flag: '--format <format>', description: 'Output format: text or json' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys search --semantic --limit 5 "authentication middleware"
Results (5 matches):

  1. src/middleware/auth.ts::authenticateRequest  [0.92]
     Validates JWT tokens and attaches user context.

  2. src/middleware/auth.ts::requireRole           [0.87]
     Role-based access control middleware factory.`}</CmdBlock>

      {/* ---- watch ------------------------------------------------------- */}
      <h3 id="watch">watch</h3>
      <p>
        Watch the project directory for file changes and automatically re-index
        affected files. Useful during active development.
      </p>
      <CmdBlock>{`ctx-sys watch [directory]`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-d, --db <path>', description: 'Path to database file' },
          { flag: '--debounce <ms>', description: 'Debounce interval in milliseconds (default: 300)' },
          { flag: '--include <patterns>', description: 'Glob patterns for files to include (comma-separated)' },
          { flag: '--exclude <patterns>', description: 'Glob patterns for files to exclude (comma-separated)' },
          { flag: '-q, --quiet', description: 'Suppress progress output' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys watch --debounce 500
Watching /home/user/my-api for changes...
[12:34:01] Changed: src/routes/users.ts (re-indexed 3 entities)`}</CmdBlock>

      {/* ---- config ------------------------------------------------------ */}
      <h3 id="config">config</h3>
      <p>
        Manage project and global configuration. Supports four subcommands:
        <code>get</code>, <code>set</code>, <code>list</code>, and{' '}
        <code>path</code>.
      </p>
      <CmdBlock>{`ctx-sys config get <key>
ctx-sys config set <key> <value>
ctx-sys config list
ctx-sys config path`}</CmdBlock>
      <p>
        Each subcommand accepts scope flags to target either the project-level
        or global configuration:
      </p>
      <OptTable
        options={[
          { flag: '-p, --project', description: 'Target project-level configuration (config get, set, list, path)' },
          { flag: '-g, --global', description: 'Target global configuration (config get, set, list)' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys config set embedding.model mxbai-embed-large:latest --project
Set embedding.model = mxbai-embed-large:latest (project)

$ ctx-sys config list --global
embedding.provider = ollama
embedding.model = mxbai-embed-large:latest
summarization.provider = ollama`}</CmdBlock>

      {/* ---- status ------------------------------------------------------ */}
      <h3 id="status">status</h3>
      <p>
        Show the current project status and statistics, including entity counts,
        relationship counts, embedding coverage, and last index time.
      </p>
      <CmdBlock>{`ctx-sys status [directory]`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-d, --db <path>', description: 'Path to database file' },
          { flag: '--json', description: 'Output as JSON' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys status
Project: my-api (/home/user/my-api)
Database: .ctx-sys/ctx.db (4.2 MB)

Entities:      387
Relationships: 612
Embeddings:    387/387 (100%)
Summaries:     142/387 (37%)
Last indexed:  2 minutes ago`}</CmdBlock>

      {/* ---- serve ------------------------------------------------------- */}
      <h3 id="serve">serve</h3>
      <p>
        Start ctx-sys as a Model Context Protocol (MCP) server. The server
        communicates over stdio and exposes all ctx-sys tools to AI assistants
        such as Claude Desktop and Cursor.
      </p>
      <CmdBlock>{`ctx-sys serve`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-d, --db <path>', description: 'Path to database file' },
          { flag: '-n, --name <name>', description: 'Server name advertised to clients (default: ctx-sys)' },
          { flag: '-v, --version <version>', description: 'Server version advertised to clients' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys serve --name my-api
Starting MCP server on stdio...
Project: /home/user/my-api
Entities: 387 | Relationships: 612
Ready for connections.`}</CmdBlock>

      {/* ================================================================== */}
      {/* ENTITY COMMANDS                                                     */}
      {/* ================================================================== */}
      <h2 id="entity-commands">Entity Commands</h2>

      {/* ---- entities ---------------------------------------------------- */}
      <h3 id="entities">entities</h3>
      <p>
        List entities in the project. Results can be filtered by type or source
        file and paginated with limit and offset.
      </p>
      <CmdBlock>{`ctx-sys entities`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-t, --type <type>', description: 'Filter by entity type (function, class, module, etc.)' },
          { flag: '-f, --file <path>', description: 'Filter by source file path' },
          { flag: '-l, --limit <n>', description: 'Maximum number of results (default: 50)' },
          { flag: '-o, --offset <n>', description: 'Skip the first n results' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys entities --type function --limit 5
ID   Type      Name                  File
---  --------  --------------------  --------------------------
1    function  authenticateRequest   src/middleware/auth.ts
2    function  requireRole           src/middleware/auth.ts
3    function  handleLogin           src/routes/login.ts
4    function  hashPassword          src/utils/crypto.ts
5    function  verifyToken           src/utils/jwt.ts`}</CmdBlock>

      {/* ---- entity ------------------------------------------------------ */}
      <h3 id="entity">entity</h3>
      <p>
        Show detailed information about a single entity, including its metadata,
        relationships, and optionally its full source content.
      </p>
      <CmdBlock>{`ctx-sys entity <id>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '--content', description: 'Include the full source content of the entity' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys entity 1 --content
Entity: authenticateRequest
Type:   function
File:   src/middleware/auth.ts
Lines:  12-45

Relationships:
  calls    -> verifyToken (src/utils/jwt.ts)
  calls    -> getUserById (src/models/user.ts)
  used_by  <- routeHandler (src/routes/index.ts)

Content:
  export async function authenticateRequest(req, res, next) {
    ...
  }`}</CmdBlock>

      {/* ---- entity-delete ----------------------------------------------- */}
      <h3 id="entity-delete">entity-delete</h3>
      <p>
        Delete an entity from the project database. Associated relationships and
        embeddings are also removed.
      </p>
      <CmdBlock>{`ctx-sys entity-delete <id>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--force', description: 'Skip confirmation prompt' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys entity-delete 42 --force
Deleted entity 42 (authenticateRequest)`}</CmdBlock>

      {/* ---- entity-stats ------------------------------------------------ */}
      <h3 id="entity-stats">entity-stats</h3>
      <p>
        Show a breakdown of entity counts by type, file, and other dimensions.
      </p>
      <CmdBlock>{`ctx-sys entity-stats`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys entity-stats
Entity Statistics:

By Type:
  function   214
  class       38
  interface   29
  module      56
  variable    50

Total: 387 entities across 142 files`}</CmdBlock>

      {/* ================================================================== */}
      {/* GRAPH COMMANDS                                                      */}
      {/* ================================================================== */}
      <h2 id="graph-commands">Graph Commands</h2>

      {/* ---- graph ------------------------------------------------------- */}
      <h3 id="graph">graph</h3>
      <p>
        Traverse the entity relationship graph starting from a given entity.
        Shows connected entities up to the specified depth.
      </p>
      <CmdBlock>{`ctx-sys graph <entity>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-d, --depth <n>', description: 'Maximum traversal depth (default: 2)' },
          { flag: '-t, --types <types>', description: 'Filter by relationship types (comma-separated)' },
          { flag: '--direction <dir>', description: 'Traversal direction: outgoing, incoming, or both' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '--db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys graph authenticateRequest --depth 1 --direction outgoing
authenticateRequest (function)
  -- calls --> verifyToken (function)
  -- calls --> getUserById (function)
  -- imports --> AuthContext (interface)`}</CmdBlock>

      {/* ---- graph-stats ------------------------------------------------- */}
      <h3 id="graph-stats">graph-stats</h3>
      <p>
        Show statistics about the entity relationship graph, including node and
        edge counts and type distributions.
      </p>
      <CmdBlock>{`ctx-sys graph-stats`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys graph-stats
Graph Statistics:

Nodes: 387
Edges: 612

By Relationship Type:
  calls       298
  imports     187
  implements   64
  exports      63`}</CmdBlock>

      {/* ---- relationships ----------------------------------------------- */}
      <h3 id="relationships">relationships</h3>
      <p>
        List relationships in the project. Filter by type, source entity, or
        target entity.
      </p>
      <CmdBlock>{`ctx-sys relationships`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-t, --type <type>', description: 'Filter by relationship type (calls, imports, implements, etc.)' },
          { flag: '-s, --source <id>', description: 'Filter by source entity ID' },
          { flag: '--target <id>', description: 'Filter by target entity ID' },
          { flag: '-l, --limit <n>', description: 'Maximum number of results (default: 50)' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys relationships --type calls --source 1 --limit 10
Source                  Type    Target              Weight
----------------------  ------  ------------------  ------
authenticateRequest     calls   verifyToken         1.0
authenticateRequest     calls   getUserById         1.0`}</CmdBlock>

      {/* ---- link -------------------------------------------------------- */}
      <h3 id="link">link</h3>
      <p>
        Manually create a relationship between two entities. Useful for adding
        domain-specific connections that the parser cannot detect automatically.
      </p>
      <CmdBlock>{`ctx-sys link <source> <type> <target>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-w, --weight <n>', description: 'Relationship weight, 0 to 1 (default: 1.0)' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys link authenticateRequest depends_on AuthConfig --weight 0.8
Created relationship: authenticateRequest --depends_on--> AuthConfig (0.8)`}</CmdBlock>

      {/* ================================================================== */}
      {/* EMBEDDING COMMANDS                                                  */}
      {/* ================================================================== */}
      <h2 id="embedding-commands">Embedding Commands</h2>

      {/* ---- embed -------------------------------------------------------- */}
      <h3 id="embed">embed</h3>
      <p>
        Generate vector embeddings for entities. Embeddings enable semantic
        search and are stored in the project database. Requires a running
        Ollama instance or configured embedding provider.
      </p>
      <CmdBlock>{`ctx-sys embed run`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-t, --type <type>', description: 'Only embed entities of this type' },
          { flag: '-f, --force', description: 'Re-embed entities that already have embeddings' },
          { flag: '-l, --limit <n>', description: 'Maximum number of entities to embed' },
          { flag: '--dry-run', description: 'Show what would be embedded without making changes' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys embed run --type function --limit 100
Embedding 100 function entities...
[========================================] 100/100
Done in 12.3s`}</CmdBlock>

      {/* ---- embed-status ------------------------------------------------ */}
      <h3 id="embed-status">embed-status</h3>
      <p>
        Show the current embedding coverage: how many entities have embeddings
        and how many are pending.
      </p>
      <CmdBlock>{`ctx-sys embed-status`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys embed-status
Embedding Status:

Total entities:  387
With embeddings: 300 (77%)
Missing:          87 (23%)

By Type:
  function   200/214 (93%)
  class       38/38  (100%)
  module      32/56  (57%)
  interface   20/29  (69%)
  variable    10/50  (20%)`}</CmdBlock>

      {/* ---- embed-cleanup ----------------------------------------------- */}
      <h3 id="embed-cleanup">embed-cleanup</h3>
      <p>
        Remove orphaned embeddings whose parent entities no longer exist. Frees
        database space after entities are deleted or re-indexed.
      </p>
      <CmdBlock>{`ctx-sys embed-cleanup`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--force', description: 'Skip confirmation prompt' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys embed-cleanup --force
Removed 12 orphaned embeddings
Freed 1.4 MB`}</CmdBlock>

      {/* ================================================================== */}
      {/* SUMMARIZATION COMMANDS                                              */}
      {/* ================================================================== */}
      <h2 id="summarization-commands">Summarization Commands</h2>

      {/* ---- summarize --------------------------------------------------- */}
      <h3 id="summarize">summarize</h3>
      <p>
        Generate natural-language summaries for entities using a large language
        model. Summaries improve search relevance and provide context to AI
        assistants.
      </p>
      <CmdBlock>{`ctx-sys summarize`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-t, --type <type>', description: 'Only summarize entities of this type' },
          { flag: '-f, --force', description: 'Re-summarize entities that already have summaries' },
          { flag: '-l, --limit <n>', description: 'Maximum number of entities to summarize (default: 100)' },
          { flag: '--provider <name>', description: 'LLM provider: ollama, openai, or anthropic' },
          { flag: '--batch-size <n>', description: 'Number of entities per batch (default: 20)' },
          { flag: '--concurrency <n>', description: 'Parallel batch concurrency (default: 5)' },
          { flag: '--dry-run', description: 'Show what would be summarized without making changes' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys summarize --provider ollama --limit 50
Summarizing 50 entities...
[========================================] 50/50
Done in 34.1s`}</CmdBlock>

      {/* ---- summarize-status -------------------------------------------- */}
      <h3 id="summarize-status">summarize-status</h3>
      <p>
        Show the current summarization coverage: how many entities have
        summaries and how many are pending.
      </p>
      <CmdBlock>{`ctx-sys summarize-status`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys summarize-status
Summarization Status:

Total entities:   387
With summaries:   142 (37%)
Missing:          245 (63%)`}</CmdBlock>

      {/* ---- providers --------------------------------------------------- */}
      <h3 id="providers">providers</h3>
      <p>
        List available LLM providers and their connection status. Shows which
        providers are configured and reachable.
      </p>
      <CmdBlock>{`ctx-sys providers`}</CmdBlock>
      <OptTable
        options={[
          { flag: '--json', description: 'Output as JSON' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys providers
Available Providers:

  ollama     connected  (http://localhost:11434)
  openai     configured (API key set)
  anthropic  not configured`}</CmdBlock>

      {/* ================================================================== */}
      {/* SESSION COMMANDS                                                    */}
      {/* ================================================================== */}
      <h2 id="session-commands">Session Commands</h2>

      {/* ---- sessions ---------------------------------------------------- */}
      <h3 id="sessions">sessions</h3>
      <p>
        List conversation sessions. Sessions are created automatically when AI
        assistants interact with ctx-sys via the MCP server.
      </p>
      <CmdBlock>{`ctx-sys sessions`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-s, --status <status>', description: 'Filter by status: active, archived, or summarized' },
          { flag: '-l, --limit <n>', description: 'Maximum number of results (default: 20)' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys sessions --status active --limit 5
ID                                    Status   Messages  Created
------------------------------------  -------  --------  -------------------
a1b2c3d4-e5f6-7890-abcd-ef1234567890  active   24        2025-01-15 10:30:00
f0e1d2c3-b4a5-6789-0fed-cba987654321  active   12        2025-01-15 09:15:00`}</CmdBlock>

      {/* ---- messages ---------------------------------------------------- */}
      <h3 id="messages">messages</h3>
      <p>
        View messages in a conversation session. If no session ID is provided,
        shows messages from the most recent session.
      </p>
      <CmdBlock>{`ctx-sys messages [sessionId]`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-l, --limit <n>', description: 'Maximum number of messages (default: 50)' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '--raw', description: 'Show raw message content without formatting' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys messages --limit 3
Session: a1b2c3d4-e5f6-7890-abcd-ef1234567890

[user]  How does the auth middleware work?
[agent] The authenticateRequest function in src/middleware/auth.ts...
[user]  Can you show me the token verification logic?`}</CmdBlock>

      {/* ================================================================== */}
      {/* DOCUMENT & DECISION COMMANDS                                        */}
      {/* ================================================================== */}
      <h2 id="document-decision-commands">Document and Decision Commands</h2>

      {/* ---- doc-index --------------------------------------------------- */}
      <h3 id="doc-index">doc-index</h3>
      <p>
        Index documentation files (Markdown, text, etc.) or entire directories
        of documents. Extracted content is linked to related code entities when
        possible.
      </p>
      <CmdBlock>{`ctx-sys doc-index <path>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--extract-entities', description: 'Extract named entities from document content' },
          { flag: '--extract-relationships', description: 'Extract relationships from document content' },
          { flag: '--embed', description: 'Generate embeddings for extracted content' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
          { flag: '-q, --quiet', description: 'Suppress progress output' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys doc-index docs/ --extract-entities --embed
Indexing documents in docs/...
Processed 8 files
Extracted 23 entities
Generated 23 embeddings
Done in 5.1s`}</CmdBlock>

      {/* ---- extract-relationships --------------------------------------- */}
      <h3 id="extract-relationships">extract-relationships</h3>
      <p>
        Use a large language model to discover relationships between entities
        that static analysis cannot detect. Analyzes entity content and infers
        semantic connections.
      </p>
      <CmdBlock>{`ctx-sys extract-relationships`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--type <type>', description: 'Only analyze entities of this type' },
          { flag: '--limit <n>', description: 'Maximum number of entities to analyze (default: 50)' },
          { flag: '--dry-run', description: 'Show discovered relationships without saving' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
          { flag: '-q, --quiet', description: 'Suppress progress output' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys extract-relationships --limit 20 --dry-run
Analyzing 20 entities for relationships...
Discovered 14 new relationships:
  authenticateRequest  --depends_on-->  JwtConfig
  handleLogin          --produces-->    SessionToken
  ...
(dry run: no changes saved)`}</CmdBlock>

      {/* ---- search-decisions -------------------------------------------- */}
      <h3 id="search-decisions">search-decisions</h3>
      <p>
        Search for architectural decisions recorded across conversation
        sessions. Useful for finding past rationale and design choices.
      </p>
      <CmdBlock>{`ctx-sys search-decisions <query>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-l, --limit <n>', description: 'Maximum number of results (default: 10)' },
          { flag: '-s, --session <id>', description: 'Restrict search to a specific session' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys search-decisions "database schema migration"
Results (2 matches):

  1. [session a1b2c3d4] Decision: Use incremental migrations
     Decided to use versioned SQL migrations instead of ORM auto-sync...

  2. [session f0e1d2c3] Decision: Separate read/write schemas
     Split the database schema into read-optimized views and...`}</CmdBlock>

      {/* ================================================================== */}
      {/* ANALYTICS COMMANDS                                                  */}
      {/* ================================================================== */}
      <h2 id="analytics-commands">Analytics Commands</h2>

      {/* ---- analytics --------------------------------------------------- */}
      <h3 id="analytics">analytics</h3>
      <p>
        View usage analytics for the project, including query counts, token
        usage, and search performance over a configurable time period.
      </p>
      <CmdBlock>{`ctx-sys analytics`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--period <period>', description: 'Time period: day, week, or month' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys analytics --period week
Analytics (last 7 days):

Queries:         142
Avg latency:     45ms
Cache hit rate:  68%
Token savings:   ~34,000 tokens`}</CmdBlock>

      {/* ---- dashboard --------------------------------------------------- */}
      <h3 id="dashboard">dashboard</h3>
      <p>
        Show a high-level project dashboard with key statistics, recent queries,
        and the most-accessed entities.
      </p>
      <CmdBlock>{`ctx-sys dashboard`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys dashboard
Project Dashboard: my-api

Entities: 387 | Relationships: 612 | Embeddings: 100%
Sessions: 5 active | Queries today: 28

Top Entities:
  1. authenticateRequest  (42 hits)
  2. UserModel            (31 hits)
  3. routeHandler         (27 hits)

Recent Queries:
  "auth middleware"          12 min ago
  "database connection pool" 1 hr ago`}</CmdBlock>

      {/* ================================================================== */}
      {/* DEBUG COMMANDS                                                       */}
      {/* ================================================================== */}
      <h2 id="debug-commands">Debug Commands</h2>

      {/* ---- inspect ----------------------------------------------------- */}
      <h3 id="inspect">inspect</h3>
      <p>
        Inspect the contents of database tables directly. Useful for debugging
        indexing issues or verifying data integrity.
      </p>
      <CmdBlock>{`ctx-sys inspect`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-t, --table <name>', description: 'Table name to inspect' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys inspect --table entities
Table: entities (387 rows)

Columns: id, type, name, qualified_name, file_path, start_line, end_line, content, summary, ...

Sample rows:
  1 | function | authenticateRequest | src/middleware/auth.ts::authenticateRequest | ...
  2 | function | requireRole         | src/middleware/auth.ts::requireRole         | ...`}</CmdBlock>

      {/* ---- query ------------------------------------------------------- */}
      <h3 id="query">query</h3>
      <p>
        Execute a raw SQL query against the project database. Intended for
        advanced debugging and ad-hoc analysis.
      </p>
      <CmdBlock>{`ctx-sys query <sql>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys query "SELECT type, COUNT(*) as count FROM entities GROUP BY type"
type        count
----------  -----
function    214
class        38
interface    29
module       56
variable     50`}</CmdBlock>

      {/* ---- export ------------------------------------------------------ */}
      <h3 id="export">export</h3>
      <p>
        Export project data to a file. Supports JSON and SQL formats. You can
        export all data or limit to entities and/or relationships.
      </p>
      <CmdBlock>{`ctx-sys export <output-file>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '-f, --format <format>', description: 'Output format: json or sql' },
          { flag: '--entities', description: 'Export only entities' },
          { flag: '--relationships', description: 'Export only relationships' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys export backup.json --format json --entities
Exported 387 entities to backup.json (142 KB)`}</CmdBlock>

      {/* ---- import ------------------------------------------------------ */}
      <h3 id="import">import</h3>
      <p>
        Import project data from a previously exported file. Use{' '}
        <code>--merge</code> to combine with existing data instead of replacing
        it.
      </p>
      <CmdBlock>{`ctx-sys import <input-file>`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--merge', description: 'Merge with existing data instead of replacing' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys import backup.json --merge
Imported 387 entities (12 new, 375 updated)`}</CmdBlock>

      {/* ---- health ------------------------------------------------------ */}
      <h3 id="health">health</h3>
      <p>
        Check system health. Verifies that the database is accessible, the
        configuration is valid, and optional services (Ollama, LLM providers)
        are reachable.
      </p>
      <CmdBlock>{`ctx-sys debug health`}</CmdBlock>
      <OptTable
        options={[
          { flag: '-p, --project <path>', description: 'Path to the project' },
          { flag: '--json', description: 'Output as JSON' },
          { flag: '-d, --db <path>', description: 'Path to database file' },
        ]}
      />
      <CmdBlock>{`$ ctx-sys debug health
System Health:

  Database:    OK (4.2 MB, 387 entities)
  Config:      OK (.ctx-sys/config.yaml)
  Ollama:      OK (http://localhost:11434, model: mxbai-embed-large)
  OpenAI:      Not configured
  Anthropic:   Not configured

All checks passed.`}</CmdBlock>

      {/* ================================================================== */}
      {/* COMMON WORKFLOWS                                                    */}
      {/* ================================================================== */}
      <h2 id="common-workflows">Common Workflows</h2>

      <h3 id="workflow-full-setup">Full project setup</h3>
      <p>
        Initialize, index with embeddings, and start the MCP server in a single
        chain:
      </p>
      <CmdBlock>{`$ ctx-sys init && ctx-sys index && ctx-sys serve`}</CmdBlock>

      <h3 id="workflow-reindex">Re-index after changes</h3>
      <p>
        Re-index the codebase and regenerate embeddings for changed files:
      </p>
      <CmdBlock>{`$ ctx-sys index`}</CmdBlock>

      <h3 id="workflow-semantic-search">Semantic search</h3>
      <p>
        Run a natural-language search using vector embeddings:
      </p>
      <CmdBlock>{`$ ctx-sys search --semantic "how does the billing system calculate taxes"`}</CmdBlock>

      <h3 id="workflow-status-check">Quick status check</h3>
      <p>
        See an overview of the current project state:
      </p>
      <CmdBlock>{`$ ctx-sys status`}</CmdBlock>

      <h3 id="workflow-summarize-all">Generate summaries for all entities</h3>
      <p>
        Use a local Ollama model to summarize every entity in the project:
      </p>
      <CmdBlock>{`$ ctx-sys summarize --provider ollama --limit 500`}</CmdBlock>

      <h3 id="workflow-export-backup">Export and back up project data</h3>
      <p>
        Export the full project to a JSON file for backup or migration:
      </p>
      <CmdBlock>{`$ ctx-sys export project-backup.json --format json`}</CmdBlock>

      <hr />
      <p>
        For details on the MCP tools that ctx-sys exposes to AI assistants, see
        the <Link href="/docs/mcp-tools">MCP Tools reference</Link>. For
        configuration file options, see{' '}
        <Link href="/docs/configuration">Configuration</Link>.
      </p>
      </div>

      {/* Right sticky sidebar */}
      <nav className="hidden xl:block w-48 flex-shrink-0">
        <div className="sticky top-8 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            On This Page
          </p>
          {sidebarLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm py-1 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
