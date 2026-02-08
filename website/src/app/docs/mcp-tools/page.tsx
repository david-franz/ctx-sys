export default function McpToolsPage() {
  return (
    <>
      <h1>MCP Tools Reference</h1>
      <p>
        ctx-sys exposes 30 tools through the Model Context Protocol (MCP). AI
        assistants like Claude Desktop and Cursor can call these tools
        automatically to understand your codebase, track conversations, and
        retrieve relevant context.
      </p>
      <p>
        All tools are organized into the following categories:
      </p>
      <ul>
        <li><a href="#project-management">Project Management</a> &mdash; 4 tools</li>
        <li><a href="#entity-management">Entity Management</a> &mdash; 3 tools</li>
        <li><a href="#codebase-indexing">Codebase Indexing</a> &mdash; 5 tools</li>
        <li><a href="#conversation-memory">Conversation Memory</a> &mdash; 5 tools</li>
        <li><a href="#graph-relationships">Graph Relationships</a> &mdash; 3 tools</li>
        <li><a href="#context-retrieval">Context Retrieval</a> &mdash; 1 tool</li>
        <li><a href="#agent-checkpoints">Agent Checkpoints</a> &mdash; 3 tools</li>
        <li><a href="#agent-memory">Agent Memory</a> &mdash; 3 tools</li>
        <li><a href="#agent-reflections">Agent Reflections</a> &mdash; 2 tools</li>
        <li><a href="#analytics">Analytics</a> &mdash; 3 tools</li>
        <li><a href="#git-hooks">Git Hooks</a> &mdash; 2 tools</li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      {/* PROJECT MANAGEMENT                                                  */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="project-management">Project Management</h2>
      <p>
        Tools for creating, listing, switching, and deleting ctx-sys projects.
        Every other tool operates in the context of a project.
      </p>

      <h3 id="create_project"><code>create_project</code></h3>
      <p>
        Create a new project for context management. A project maps to a single
        codebase or repository and stores all entities, relationships, and
        conversation history in its own database.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">name</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Unique project name in slug format (lowercase, alphanumeric, hyphens)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">path</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Absolute path to the project root directory</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">config</td>
              <td className="px-4 py-2">object</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Optional configuration overrides</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="list_projects"><code>list_projects</code></h3>
      <p>
        List all registered projects. Returns an array of project names, paths,
        and their current status.
      </p>
      <p>
        This tool takes no parameters.
      </p>

      <h3 id="set_active_project"><code>set_active_project</code></h3>
      <p>
        Set the active project for subsequent operations. When a project is
        active, all other tools that accept an optional <code>project</code>{' '}
        parameter will default to it.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">name</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Project name or ID to set as active</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="delete_project"><code>delete_project</code></h3>
      <p>
        Delete a project and optionally its data. By default, both the project
        registration and its underlying data tables are removed.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">name</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Project name or ID to delete</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">keep_data</td>
              <td className="px-4 py-2">boolean</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>false</code></td>
              <td className="px-4 py-2">Keep project data tables instead of deleting them</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ENTITY MANAGEMENT                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="entity-management">Entity Management</h2>
      <p>
        Tools for adding, retrieving, and searching entities. Entities represent
        code constructs (functions, classes, modules) as well as custom concepts
        like architectural patterns or technologies.
      </p>

      <h3 id="add_entity"><code>add_entity</code></h3>
      <p>
        Add a custom entity such as a concept, technology, pattern, or any other
        knowledge item. Indexed code entities are created automatically during
        indexing; this tool is for manually adding supplementary entities.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">type</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Entity type (e.g., function, class, concept, technology, pattern)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">name</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Entity name</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">content</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Entity description or full content</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">summary</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Brief summary of the entity</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">metadata</td>
              <td className="px-4 py-2">object</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Additional metadata as key-value pairs</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="get_entity"><code>get_entity</code></h3>
      <p>
        Get an entity by its ID or qualified name. Qualified names follow the
        format <code>src/file.ts::functionName</code>. Provide either{' '}
        <code>id</code> or <code>qualified_name</code>, not both.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">id</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Entity ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">qualified_name</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Entity qualified name (e.g., <code>src/file.ts::functionName</code>)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="search_entities"><code>search_entities</code></h3>
      <p>
        Search entities by text query. Returns matching entities ranked by
        relevance, with optional filtering by entity type.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">query</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Search query text</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">type</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Filter by entity type</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">limit</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>10</code></td>
              <td className="px-4 py-2">Maximum number of results to return</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CODEBASE INDEXING                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="codebase-indexing">Codebase Indexing</h2>
      <p>
        Tools for indexing source code and documentation files, syncing the
        index with git changes, and checking indexing status.
      </p>

      <h3 id="index_codebase"><code>index_codebase</code></h3>
      <p>
        Index a codebase for context retrieval. Parses code files and extracts
        entities such as functions, classes, and modules along with their
        relationships.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">path</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Project path</td>
              <td className="px-4 py-2">Path to the codebase root directory</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">depth</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>full</code></td>
              <td className="px-4 py-2">Indexing depth: <code>full</code>, <code>signatures</code>, or <code>selective</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">ignore</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Glob patterns to ignore (e.g., <code>node_modules</code>)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">languages</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">All detected</td>
              <td className="px-4 py-2">Languages to index (defaults to all detected languages)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">force</td>
              <td className="px-4 py-2">boolean</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>false</code></td>
              <td className="px-4 py-2">Force re-index even if the index is not stale</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="sync_from_git"><code>sync_from_git</code></h3>
      <p>
        Sync the codebase index from git changes. Updates entities for files
        that have changed since the last sync or a specified commit, making it
        faster than a full re-index.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">since</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>last_sync</code></td>
              <td className="px-4 py-2">Commit SHA or <code>&quot;last_sync&quot;</code> to sync from</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">summarize</td>
              <td className="px-4 py-2">boolean</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>false</code></td>
              <td className="px-4 py-2">Generate AI summaries for changed entities</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="index_document"><code>index_document</code></h3>
      <p>
        Index a documentation file such as a markdown document, requirements
        file, or API specification. Extracted sections are stored as entities
        and optionally linked to related code entities.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">path</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Path to the document file</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">type</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Document type: <code>markdown</code>, <code>requirements</code>, or <code>api_spec</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">link_to_code</td>
              <td className="px-4 py-2">boolean</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>true</code></td>
              <td className="px-4 py-2">Attempt to link document sections to code entities</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="get_index_status"><code>get_index_status</code></h3>
      <p>
        Get the current indexing status for a project, including the number of
        indexed files, entities, relationships, and the timestamp of the last
        index run.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CONVERSATION MEMORY                                                 */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="conversation-memory">Conversation Memory</h2>
      <p>
        Tools for storing and retrieving conversation messages, summarizing
        sessions, and searching for architectural decisions made during past
        conversations.
      </p>

      <h3 id="store_message"><code>store_message</code></h3>
      <p>
        Store a conversation message for context tracking. Messages are
        organized into sessions. If no session is specified, a new session is
        created automatically.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">content</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Message content</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">role</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Message role: <code>user</code>, <code>assistant</code>, or <code>system</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">New session</td>
              <td className="px-4 py-2">Session ID (creates a new session if not specified)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">metadata</td>
              <td className="px-4 py-2">object</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Additional metadata as key-value pairs</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="get_history"><code>get_history</code></h3>
      <p>
        Get conversation history for a session. Returns messages in
        chronological order with optional pagination.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Most recent</td>
              <td className="px-4 py-2">Session ID (defaults to the most recent session)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">limit</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>50</code></td>
              <td className="px-4 py-2">Maximum number of messages to return</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">before</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Get messages before this message ID (for pagination)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="summarize_session"><code>summarize_session</code></h3>
      <p>
        Generate a summary of a conversation session. The summary captures key
        topics discussed, decisions made, and any action items identified during
        the session.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session ID to summarize</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="search_decisions"><code>search_decisions</code></h3>
      <p>
        Search for architectural decisions across sessions. Returns decisions
        that were recorded during past conversations, allowing AI assistants to
        recall why certain choices were made.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">query</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Search query for finding relevant decisions</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">limit</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>10</code></td>
              <td className="px-4 py-2">Maximum number of results to return</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="list_sessions"><code>list_sessions</code></h3>
      <p>
        List conversation sessions. Returns sessions in reverse chronological
        order with optional filtering by status.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">status</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Filter by status: <code>active</code>, <code>archived</code>, or <code>summarized</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* GRAPH RELATIONSHIPS                                                 */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="graph-relationships">Graph Relationships</h2>
      <p>
        Tools for creating relationships between entities and traversing the
        entity graph. The graph captures how code constructs relate to each
        other through calls, imports, implementations, and custom links.
      </p>

      <h3 id="link_entities"><code>link_entities</code></h3>
      <p>
        Create a relationship between two entities. Relationships have a type
        and an optional weight indicating strength.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">source</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Source entity ID or name</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">target</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Target entity ID or name</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">type</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Relationship type (e.g., <code>calls</code>, <code>imports</code>, <code>implements</code>, <code>relates_to</code>)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">weight</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>1.0</code></td>
              <td className="px-4 py-2">Relationship strength between 0 and 1</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">metadata</td>
              <td className="px-4 py-2">object</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Additional relationship metadata</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="query_graph"><code>query_graph</code></h3>
      <p>
        Traverse the entity relationship graph starting from a given entity.
        Returns connected entities up to the specified depth, with optional
        filtering by relationship type and direction.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">entity</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Starting entity ID or name</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">depth</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>2</code></td>
              <td className="px-4 py-2">Maximum number of hops to traverse</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">relationships</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">All types</td>
              <td className="px-4 py-2">Filter by relationship types</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">direction</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>both</code></td>
              <td className="px-4 py-2">Traversal direction: <code>in</code>, <code>out</code>, or <code>both</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="get_graph_stats"><code>get_graph_stats</code></h3>
      <p>
        Get statistics about the entity relationship graph, including total
        node and edge counts, relationship type distribution, and connectivity
        metrics.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CONTEXT RETRIEVAL                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="context-retrieval">Context Retrieval</h2>
      <p>
        The primary tool AI assistants use to get relevant information from your
        codebase and conversation history.
      </p>

      <h3 id="context_query"><code>context_query</code></h3>
      <p>
        Query for relevant context using hybrid RAG (Retrieval-Augmented
        Generation). This is the primary tool AI assistants use to understand
        your codebase. It combines three search strategies and merges results
        using Reciprocal Rank Fusion:
      </p>
      <ul>
        <li><strong>Keyword search</strong> &mdash; FTS5 full-text search with BM25 ranking</li>
        <li><strong>Semantic search</strong> &mdash; vector similarity using embeddings</li>
        <li><strong>Graph traversal</strong> &mdash; follows entity relationships to find structurally related code</li>
      </ul>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">query</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">The search query in natural language</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">max_tokens</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>4000</code></td>
              <td className="px-4 py-2">Token budget for the response</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">strategies</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">All strategies</td>
              <td className="px-4 py-2">Search strategies to use: <code>keyword</code>, <code>semantic</code>, <code>graph</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">include_types</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">All types</td>
              <td className="px-4 py-2">Entity types to include in results</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">include_sources</td>
              <td className="px-4 py-2">boolean</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>true</code></td>
              <td className="px-4 py-2">Include source attribution in results</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">min_score</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>0.3</code></td>
              <td className="px-4 py-2">Minimum relevance score between 0 and 1</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AGENT CHECKPOINTS                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="agent-checkpoints">Agent Checkpoints</h2>
      <p>
        Tools for saving and restoring agent state. Checkpoints allow AI
        assistants to persist their working state across sessions so they can
        resume tasks where they left off.
      </p>

      <h3 id="checkpoint_save"><code>checkpoint_save</code></h3>
      <p>
        Save an agent state checkpoint for a resumable task. The state object
        can contain any serializable data the agent needs to continue later.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session or task ID to associate the checkpoint with</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">state</td>
              <td className="px-4 py-2">object</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Agent state to save (any serializable object)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">description</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Human-readable description of the checkpoint</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="checkpoint_load"><code>checkpoint_load</code></h3>
      <p>
        Load agent state from a checkpoint. By default, loads the most recent
        checkpoint for the given session. A specific checkpoint can be loaded
        by providing its ID.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session or task ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">checkpoint_id</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Latest</td>
              <td className="px-4 py-2">Specific checkpoint ID to load (defaults to the latest)</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="checkpoint_list"><code>checkpoint_list</code></h3>
      <p>
        List all checkpoints for a session. Returns checkpoints in
        chronological order with their IDs, descriptions, and timestamps.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session or task ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AGENT MEMORY                                                        */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="agent-memory">Agent Memory</h2>
      <p>
        Tools for managing the hot/cold memory system. Hot memory contains
        recently accessed items kept in active context. Cold storage holds
        older items that can be recalled on demand, reducing token usage while
        preserving full history.
      </p>

      <h3 id="memory_spill"><code>memory_spill</code></h3>
      <p>
        Spill hot memory items to cold storage to free up context. Items that
        exceed the token threshold are moved to cold storage where they remain
        searchable but no longer consume active context tokens.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">threshold</td>
              <td className="px-4 py-2">number</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Token threshold for spilling items to cold storage</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="memory_recall"><code>memory_recall</code></h3>
      <p>
        Recall relevant items from cold storage back into hot memory. Uses the
        provided query to find the most relevant cold items and bring them back
        into active context.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">query</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Query for finding relevant items to recall</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="memory_status"><code>memory_status</code></h3>
      <p>
        Get the current memory status showing the distribution of items between
        hot and cold storage, along with token usage metrics.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* AGENT REFLECTIONS                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="agent-reflections">Agent Reflections</h2>
      <p>
        Tools for storing and querying learning reflections. Reflections allow
        AI assistants to record lessons learned, observations, and decisions
        from their experiences, building institutional knowledge over time.
      </p>

      <h3 id="reflection_store"><code>reflection_store</code></h3>
      <p>
        Store a learning reflection from agent experience. Reflections are
        tagged and categorized so they can be queried later to inform future
        decisions.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">session</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Session ID</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">content</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Reflection content describing the learning or observation</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">type</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Reflection type: <code>lesson</code>, <code>observation</code>, or <code>decision</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">outcome</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Outcome of the experience: <code>success</code>, <code>failure</code>, or <code>partial</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">tags</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Tags for categorization</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="reflection_query"><code>reflection_query</code></h3>
      <p>
        Query stored reflections for relevant learnings. Returns reflections
        matching the query with optional filtering by type and outcome.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">query</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Search query for finding relevant reflections</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">type</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Filter by reflection type</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">outcome</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Filter by outcome</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* ANALYTICS                                                           */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="analytics">Analytics</h2>
      <p>
        Tools for tracking usage statistics, viewing dashboard data, and
        recording feedback on query results to improve relevance over time.
      </p>

      <h3 id="analytics_get_stats"><code>analytics_get_stats</code></h3>
      <p>
        Get token savings and usage analytics for a project over a given time
        period.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">period</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>week</code></td>
              <td className="px-4 py-2">Time period: <code>day</code>, <code>week</code>, <code>month</code>, or <code>all</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="analytics_dashboard"><code>analytics_dashboard</code></h3>
      <p>
        Get dashboard data including aggregate statistics, recent queries, and
        top entities for a project.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="analytics_feedback"><code>analytics_feedback</code></h3>
      <p>
        Record feedback on a query result. This feedback is used to improve
        search relevance over time by learning which results are helpful.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">query_id</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Query log ID to provide feedback on</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">was_useful</td>
              <td className="px-4 py-2">boolean</td>
              <td className="px-4 py-2">Yes</td>
              <td className="px-4 py-2">&mdash;</td>
              <td className="px-4 py-2">Whether the query result was useful</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* GIT HOOKS                                                           */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="git-hooks">Git Hooks</h2>
      <p>
        Tools for installing git hooks that automatically keep the index
        up to date, and for generating impact analysis reports on pending
        changes.
      </p>

      <h3 id="hooks_install"><code>hooks_install</code></h3>
      <p>
        Install git hooks for automatic indexing. Once installed, the index is
        updated automatically after commits, checkouts, and merges without
        manual intervention.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">repo_path</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Project path</td>
              <td className="px-4 py-2">Path to the git repository</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">hooks</td>
              <td className="px-4 py-2">string[]</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>post-commit</code></td>
              <td className="px-4 py-2">Hooks to install: <code>post-commit</code>, <code>post-checkout</code>, <code>post-merge</code></td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 id="hooks_impact_report"><code>hooks_impact_report</code></h3>
      <p>
        Get an impact analysis report for pending changes. Compares two
        branches to identify which entities and relationships are affected,
        helping AI assistants understand the scope of a change before it is
        merged.
      </p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full text-sm border border-slate-200 dark:border-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Parameter</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Required</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Default</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-600 dark:text-slate-300">
            <tr>
              <td className="px-4 py-2 font-mono text-xs">base_branch</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>main</code></td>
              <td className="px-4 py-2">Base branch for comparison</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">target_branch</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2"><code>HEAD</code></td>
              <td className="px-4 py-2">Target branch to analyze</td>
            </tr>
            <tr>
              <td className="px-4 py-2 font-mono text-xs">project</td>
              <td className="px-4 py-2">string</td>
              <td className="px-4 py-2">No</td>
              <td className="px-4 py-2">Active project</td>
              <td className="px-4 py-2">Target project name (defaults to active project)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
