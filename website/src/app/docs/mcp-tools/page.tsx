import Link from 'next/link';
import { ParamTable, Callout } from '../../../components/docs';

export default function McpToolsPage() {
  return (
    <>
      <h1>MCP Tools Reference</h1>
      <p>
        ctx-sys exposes <strong>30 tools</strong> through the{' '}
        <Link href="https://modelcontextprotocol.io">Model Context Protocol (MCP)</Link>.
        AI assistants like Claude Desktop, Cursor, and Claude Code can call
        these tools automatically to understand your codebase, track
        conversations, and retrieve relevant context.
      </p>

      <Callout type="tip">
        <p>
          The most important tool is{' '}
          <a href="#context_query"><code>context_query</code></a>. It combines
          keyword, semantic, and graph search into a single hybrid RAG query
          and is the primary way to retrieve context from an indexed project.
        </p>
      </Callout>

      <h2>Table of Contents</h2>
      <ul>
        <li><a href="#project-management">Project Management</a> &mdash; 4 tools</li>
        <li><a href="#entity-management">Entity Management</a> &mdash; 3 tools</li>
        <li><a href="#codebase-indexing">Codebase Indexing</a> &mdash; 4 tools</li>
        <li><a href="#context-retrieval">Context Retrieval</a> &mdash; 1 tool</li>
        <li><a href="#conversation-memory">Conversation Memory</a> &mdash; 5 tools</li>
        <li><a href="#graph-relationships">Graph Relationships</a> &mdash; 3 tools</li>
        <li><a href="#agent-checkpoints">Agent Checkpoints</a> &mdash; 3 tools</li>
        <li><a href="#agent-memory">Agent Memory</a> &mdash; 3 tools</li>
        <li><a href="#agent-reflections">Agent Reflections</a> &mdash; 2 tools</li>
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
      <ParamTable
        params={[
          { name: 'name', type: 'string', required: true, description: 'Project name in slug format (lowercase, alphanumeric, hyphens)' },
          { name: 'path', type: 'string', required: true, description: 'Absolute path to project root directory' },
          { name: 'config', type: 'object', required: false, description: 'Optional configuration overrides' },
        ]}
      />

      <h3 id="list_projects"><code>list_projects</code></h3>
      <p>
        List all registered projects. Returns an array of project names, paths,
        and their current status.
      </p>
      <p>This tool takes no parameters.</p>

      <h3 id="set_active_project"><code>set_active_project</code></h3>
      <p>
        Set the active project for subsequent operations. When a project is
        active, all other tools that accept an optional <code>project</code>{' '}
        parameter will default to it.
      </p>
      <ParamTable
        params={[
          { name: 'name', type: 'string', required: true, description: 'Project name or ID' },
        ]}
      />

      <h3 id="delete_project"><code>delete_project</code></h3>
      <p>
        Delete a project and optionally its data. By default, both the project
        registration and its underlying data tables are removed.
      </p>
      <ParamTable
        params={[
          { name: 'name', type: 'string', required: true, description: 'Project name or ID' },
          { name: 'keep_data', type: 'boolean', required: false, description: 'Keep project data tables (default: false)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* ENTITY MANAGEMENT                                                   */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="entity-management">Entity Management</h2>
      <p>
        Tools for adding, retrieving, and searching entities. Entities represent
        any meaningful unit in your codebase: functions, classes, concepts,
        technologies, patterns, and more.
      </p>

      <h3 id="add_entity"><code>add_entity</code></h3>
      <p>
        Add a custom entity such as a concept, technology, or pattern. This is
        useful for manually annotating your project with domain knowledge that
        automated indexing may not capture.
      </p>
      <ParamTable
        params={[
          { name: 'type', type: 'string', required: true, description: 'Entity type (function, class, concept, technology, pattern, etc.)' },
          { name: 'name', type: 'string', required: true, description: 'Entity name' },
          { name: 'project', type: 'string', required: false, description: 'Target project name (default: active project)' },
          { name: 'content', type: 'string', required: false, description: 'Entity description or content' },
          { name: 'summary', type: 'string', required: false, description: 'Brief summary of the entity' },
          { name: 'metadata', type: 'object', required: false, description: 'Additional metadata' },
        ]}
      />

      <h3 id="get_entity"><code>get_entity</code></h3>
      <p>
        Get an entity by its ID or qualified name. At least one
        of <code>id</code> or <code>qualified_name</code> must be provided.
      </p>
      <ParamTable
        params={[
          { name: 'id', type: 'string', required: false, description: 'Entity ID' },
          { name: 'qualified_name', type: 'string', required: false, description: 'Qualified name (e.g., src/file.ts::functionName)' },
          { name: 'project', type: 'string', required: false, description: 'Target project name (default: active project)' },
        ]}
      />

      <h3 id="search_entities"><code>search_entities</code></h3>
      <p>
        Search entities by text query. Returns matching entities ranked by
        relevance.
      </p>
      <ParamTable
        params={[
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'type', type: 'string', required: false, description: 'Filter by entity type' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum results (default: 10)' },
          { name: 'project', type: 'string', required: false, description: 'Target project name (default: active project)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* CODEBASE INDEXING                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="codebase-indexing">Codebase Indexing</h2>
      <p>
        Tools for indexing source code and documentation files. Indexing parses
        your codebase, extracts entities and relationships, and generates
        embeddings for semantic search.
      </p>

      <h3 id="index_codebase"><code>index_codebase</code></h3>
      <p>
        Index a codebase for context retrieval. Parses source files, extracts
        entities (functions, classes, types, etc.), builds the relationship
        graph, and generates vector embeddings.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'path', type: 'string', required: false, description: 'Path to codebase root (default: project path)' },
          { name: 'languages', type: 'array', required: false, description: 'Languages to index (default: all detected)' },
          { name: 'ignore', type: 'array', required: false, description: 'Patterns to ignore (e.g., node_modules)' },
          { name: 'force', type: 'boolean', required: false, description: 'Force re-index even if not stale' },
          { name: 'depth', type: 'string', required: false, description: 'Indexing depth (default: full)' },
        ]}
      />

      <h3 id="sync_from_git"><code>sync_from_git</code></h3>
      <p>
        Sync the codebase index from git changes. Instead of re-indexing the
        entire codebase, this tool updates only the entities affected by recent
        commits.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'since', type: 'string', required: false, description: 'Commit SHA or "last_sync" (default: last_sync)' },
          { name: 'summarize', type: 'boolean', required: false, description: 'Generate AI summaries for changed entities' },
        ]}
      />

      <h3 id="index_document"><code>index_document</code></h3>
      <p>
        Index a documentation file such as a markdown file, requirements
        document, or architecture decision record. Optionally links extracted
        sections to existing code entities.
      </p>
      <ParamTable
        params={[
          { name: 'path', type: 'string', required: true, description: 'Path to document file' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'type', type: 'string', required: false, description: 'Document type' },
          { name: 'link_to_code', type: 'boolean', required: false, description: 'Attempt to link to code entities (default: true)' },
        ]}
      />

      <h3 id="get_index_status"><code>get_index_status</code></h3>
      <p>
        Get the current indexing status for a project, including total entities,
        last index time, and whether the index is stale.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* CONTEXT RETRIEVAL                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="context-retrieval">Context Retrieval</h2>
      <p>
        The primary search interface for retrieving relevant context from an
        indexed project using hybrid RAG (Retrieval-Augmented Generation).
      </p>

      <h3 id="context_query"><code>context_query</code></h3>
      <p>
        Query for relevant context using hybrid RAG. Combines keyword search,
        semantic vector search, and graph traversal into a single unified query.
        This is the main tool AI assistants should use to find information about
        a codebase.
      </p>
      <ParamTable
        params={[
          { name: 'query', type: 'string', required: true, description: 'The search query' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'strategies', type: 'array', required: false, description: 'Search strategies to use: keyword, semantic, graph (default: all)' },
          { name: 'include_types', type: 'array', required: false, description: 'Entity types to include in results' },
          { name: 'min_score', type: 'number', required: false, description: 'Minimum relevance score 0-1 (default: 0.3)' },
          { name: 'max_tokens', type: 'number', required: false, description: 'Token budget for response (default: 4000)' },
          { name: 'expand', type: 'boolean', required: false, description: 'Auto-include related entities such as parent classes, imports, and type definitions (default: true)' },
          { name: 'expand_tokens', type: 'number', required: false, description: 'Token budget for expansion (default: 2000)' },
          { name: 'decompose', type: 'boolean', required: false, description: 'Break complex queries into sub-queries for better coverage' },
          { name: 'gate', type: 'boolean', required: false, description: 'Skip retrieval for trivial queries (default: true)' },
          { name: 'hyde', type: 'boolean', required: false, description: 'Use HyDE (Hypothetical Document Embeddings) for better semantic search' },
          { name: 'hyde_model', type: 'string', required: false, description: 'Model for HyDE hypothetical generation (default: gemma3:12b)' },
          { name: 'include_sources', type: 'boolean', required: false, description: 'Include source attribution in results (default: true)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* CONVERSATION MEMORY                                                  */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="conversation-memory">Conversation Memory</h2>
      <p>
        Tools for storing and retrieving conversation history. Conversations are
        organized into sessions that can be summarized and searched for
        architectural decisions.
      </p>

      <h3 id="store_message"><code>store_message</code></h3>
      <p>
        Store a conversation message for context tracking. Messages are
        associated with a session and can be recalled later.
      </p>
      <ParamTable
        params={[
          { name: 'content', type: 'string', required: true, description: 'Message content' },
          { name: 'role', type: 'string', required: true, description: 'Message role (user, assistant, system)' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'session', type: 'string', required: false, description: 'Session ID (creates new if not specified)' },
          { name: 'metadata', type: 'object', required: false, description: 'Additional metadata' },
        ]}
      />

      <h3 id="get_history"><code>get_history</code></h3>
      <p>
        Get conversation history for a session. Returns messages in
        chronological order with support for pagination.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'session', type: 'string', required: false, description: 'Session ID (default: most recent)' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum messages to return (default: 50)' },
          { name: 'before', type: 'string', required: false, description: 'Get messages before this message ID' },
        ]}
      />

      <h3 id="summarize_session"><code>summarize_session</code></h3>
      <p>
        Generate a summary of a conversation session. Useful for creating
        condensed recaps of long conversations.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session ID to summarize' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
        ]}
      />

      <h3 id="search_decisions"><code>search_decisions</code></h3>
      <p>
        Search for architectural decisions across conversation sessions. Finds
        design choices, trade-offs, and rationale discussed in past
        conversations.
      </p>
      <ParamTable
        params={[
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'limit', type: 'number', required: false, description: 'Maximum results (default: 10)' },
        ]}
      />

      <h3 id="list_sessions"><code>list_sessions</code></h3>
      <p>
        List conversation sessions for a project. Returns session IDs,
        creation times, and status.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'status', type: 'string', required: false, description: 'Filter by session status' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* GRAPH RELATIONSHIPS                                                  */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="graph-relationships">Graph Relationships</h2>
      <p>
        Tools for creating and querying the entity relationship graph. The graph
        captures how entities relate to each other through calls, imports,
        implementations, and other connections.
      </p>

      <h3 id="link_entities"><code>link_entities</code></h3>
      <p>
        Create a relationship between two entities. Relationships form the edges
        of the knowledge graph and are used by graph-based context retrieval.
      </p>
      <ParamTable
        params={[
          { name: 'source', type: 'string', required: true, description: 'Source entity ID or name' },
          { name: 'target', type: 'string', required: true, description: 'Target entity ID or name' },
          { name: 'type', type: 'string', required: true, description: 'Relationship type (calls, imports, implements, relates_to, etc.)' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'weight', type: 'number', required: false, description: 'Relationship strength 0-1 (default: 1.0)' },
          { name: 'metadata', type: 'object', required: false, description: 'Additional relationship metadata' },
        ]}
      />

      <h3 id="query_graph"><code>query_graph</code></h3>
      <p>
        Traverse the entity relationship graph starting from a given entity.
        Returns connected entities up to the specified depth.
      </p>
      <ParamTable
        params={[
          { name: 'entity', type: 'string', required: true, description: 'Starting entity ID or name' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'depth', type: 'number', required: false, description: 'Maximum hops (default: 2)' },
          { name: 'direction', type: 'string', required: false, description: 'Traversal direction (default: both)' },
          { name: 'relationships', type: 'array', required: false, description: 'Filter by relationship types' },
        ]}
      />

      <h3 id="get_graph_stats"><code>get_graph_stats</code></h3>
      <p>
        Get statistics about the entity relationship graph, including total
        entity count, relationship count, and type distributions.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* AGENT CHECKPOINTS                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="agent-checkpoints">Agent Checkpoints</h2>
      <p>
        Tools for saving and restoring agent state. Checkpoints allow long-running
        tasks to be paused and resumed across sessions.
      </p>

      <h3 id="checkpoint_save"><code>checkpoint_save</code></h3>
      <p>
        Save an agent state checkpoint for a resumable task. The state object
        can contain any serializable data the agent needs to resume later.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session or task ID' },
          { name: 'state', type: 'object', required: true, description: 'Agent state to save' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'description', type: 'string', required: false, description: 'Checkpoint description' },
        ]}
      />

      <h3 id="checkpoint_load"><code>checkpoint_load</code></h3>
      <p>
        Load agent state from a checkpoint. By default, loads the most recent
        checkpoint for the given session.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session or task ID' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'checkpoint_id', type: 'string', required: false, description: 'Specific checkpoint ID (default: latest)' },
        ]}
      />

      <h3 id="checkpoint_list"><code>checkpoint_list</code></h3>
      <p>
        List all checkpoints for a session. Returns checkpoint IDs, timestamps,
        and descriptions.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session or task ID' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* AGENT MEMORY                                                         */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="agent-memory">Agent Memory</h2>
      <p>
        Tools for managing hot and cold memory tiers. Hot memory is the
        actively used context, while cold storage holds items that can be
        recalled on demand to free up context window space.
      </p>

      <h3 id="memory_spill"><code>memory_spill</code></h3>
      <p>
        Spill hot memory items to cold storage to free up context. Items
        exceeding the token threshold are moved to cold storage where they
        can be recalled later.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session ID' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'threshold', type: 'number', required: false, description: 'Token threshold for spilling' },
        ]}
      />

      <h3 id="memory_recall"><code>memory_recall</code></h3>
      <p>
        Recall relevant items from cold storage back into hot memory. Uses
        semantic search to find the most relevant stored items for the given
        query.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session ID' },
          { name: 'query', type: 'string', required: true, description: 'Query for relevant items to recall' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
        ]}
      />

      <h3 id="memory_status"><code>memory_status</code></h3>
      <p>
        Get the current memory status including hot and cold item counts and
        token distribution across tiers.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session ID' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* AGENT REFLECTIONS                                                    */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="agent-reflections">Agent Reflections</h2>
      <p>
        Tools for storing and querying agent learning reflections. Reflections
        capture lessons learned, successful strategies, and mistakes to avoid,
        enabling agents to improve over time.
      </p>

      <h3 id="reflection_store"><code>reflection_store</code></h3>
      <p>
        Store a learning reflection from agent experience. Reflections are
        tagged and searchable, allowing agents to build up institutional
        knowledge across sessions.
      </p>
      <ParamTable
        params={[
          { name: 'session', type: 'string', required: true, description: 'Session ID' },
          { name: 'content', type: 'string', required: true, description: 'Reflection content' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'type', type: 'string', required: false, description: 'Reflection type' },
          { name: 'outcome', type: 'string', required: false, description: 'Outcome of the experience' },
          { name: 'tags', type: 'array', required: false, description: 'Tags for categorization' },
        ]}
      />

      <h3 id="reflection_query"><code>reflection_query</code></h3>
      <p>
        Query stored reflections for relevant learnings. Search across all
        reflections with optional filtering by type and outcome.
      </p>
      <ParamTable
        params={[
          { name: 'query', type: 'string', required: true, description: 'Search query' },
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'type', type: 'string', required: false, description: 'Filter by reflection type' },
          { name: 'outcome', type: 'string', required: false, description: 'Filter by outcome' },
        ]}
      />

      {/* ------------------------------------------------------------------ */}
      {/* GIT HOOKS                                                            */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="git-hooks">Git Hooks</h2>
      <p>
        Tools for installing git hooks and analyzing the impact of pending
        changes. Git hooks keep the index automatically up to date as you
        commit.
      </p>

      <h3 id="hooks_install"><code>hooks_install</code></h3>
      <p>
        Install git hooks for automatic indexing. After installation, the index
        is updated automatically on each commit.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'repo_path', type: 'string', required: false, description: 'Path to git repository (default: project path)' },
          { name: 'hooks', type: 'array', required: false, description: 'Hooks to install (default: post-commit)' },
        ]}
      />

      <h3 id="hooks_impact_report"><code>hooks_impact_report</code></h3>
      <p>
        Get an impact analysis report for pending changes. Compares the target
        branch against the base branch and reports which entities and
        relationships are affected.
      </p>
      <ParamTable
        params={[
          { name: 'project', type: 'string', required: false, description: 'Target project (default: active project)' },
          { name: 'base_branch', type: 'string', required: false, description: 'Base branch for comparison (default: main)' },
          { name: 'target_branch', type: 'string', required: false, description: 'Target branch (default: HEAD)' },
        ]}
      />
    </>
  );
}
