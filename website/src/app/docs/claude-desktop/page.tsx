import Link from 'next/link';

export default function ClaudeDesktopPage() {
  return (
    <>
      <h1>Claude Desktop Integration</h1>
      <p>
        Connecting ctx-sys to Claude Desktop gives your AI assistant direct
        access to <strong>33 MCP tools</strong> for navigating, searching, and
        understanding your codebase. Claude can query your indexed code, trace
        relationships between entities, recall past conversations, and much
        more &mdash; all without you having to copy-paste context manually.
      </p>

      <h2>Prerequisites</h2>
      <ul>
        <li>
          <strong>Claude Desktop</strong> installed and running (
          <a href="https://claude.ai/download">download here</a>)
        </li>
        <li>
          <strong>ctx-sys</strong> installed globally (
          <code>npm install -g ctx-sys</code>). Both the <code>ctx</code> and{' '}
          <code>ctx-sys</code> commands are available after installation.
        </li>
        <li>
          <strong>A codebase indexed</strong> with ctx-sys (see steps below)
        </li>
      </ul>

      <h2>Step-by-Step Setup</h2>

      <h3>1. Index Your Project</h3>
      <p>
        Navigate to your project directory and initialize ctx-sys, then index
        the codebase with embeddings:
      </p>
      <pre>
        <code>{`ctx init && ctx index --embed`}</code>
      </pre>
      <p>
        This creates a <code>.ctx-sys</code> directory in your project, parses
        all source files, and generates vector embeddings for semantic search.
      </p>

      <h3>2. Find the ctx-sys Path</h3>
      <p>
        Claude Desktop needs the absolute path to the ctx-sys binary. Find it
        with:
      </p>
      <pre>
        <code>{`which ctx-sys`}</code>
      </pre>
      <p>
        Note the output (for example, <code>/usr/local/bin/ctx-sys</code>). You
        will need this in the next step if Claude Desktop cannot find the
        command on its default PATH.
      </p>

      <h3>3. Edit the Claude Desktop MCP Configuration</h3>
      <p>Open the Claude Desktop configuration file in your text editor:</p>
      <ul>
        <li>
          <strong>macOS:</strong>{' '}
          <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
        </li>
        <li>
          <strong>Windows:</strong>{' '}
          <code>%APPDATA%\Claude\claude_desktop_config.json</code>
        </li>
      </ul>

      <h3>4. Add the ctx-sys MCP Server</h3>
      <p>
        Add the following to your configuration file. If the file already
        contains other MCP servers, merge the <code>ctx-sys</code> entry into
        the existing <code>mcpServers</code> object:
      </p>
      <pre>
        <code>
{`{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"]
    }
  }
}`}
        </code>
      </pre>
      <p>
        If <code>ctx-sys</code> is not on Claude Desktop&apos;s PATH, replace{' '}
        <code>&quot;ctx-sys&quot;</code> in the <code>command</code> field with the
        full path you found in step 2 (for example,{' '}
        <code>&quot;/usr/local/bin/ctx-sys&quot;</code>).
      </p>

      <h3>5. Restart Claude Desktop</h3>
      <p>
        Quit Claude Desktop completely and reopen it. The application reads the
        MCP configuration on startup.
      </p>

      <h3>6. Verify the Connection</h3>
      <p>
        Open a new conversation in Claude Desktop and look for the MCP tools
        icon (a hammer or plug icon near the input field). Click it to see the
        list of available tools. You should see tools prefixed with{' '}
        <code>ctx-sys</code>, such as <code>ctx-sys_context_query</code>,{' '}
        <code>ctx-sys_search_entities</code>, and others.
      </p>

      <h2>Available Tools</h2>
      <p>
        ctx-sys exposes <strong>33 tools</strong> across 9 categories. Here is
        an overview of each category with key tools:
      </p>

      <h3>Project Management</h3>
      <p>Create and manage projects that ctx-sys tracks.</p>
      <ul>
        <li>
          <code>create_project</code> &mdash; Register a new project
        </li>
        <li>
          <code>set_active_project</code> &mdash; Switch the active project
        </li>
        <li>
          <code>list_projects</code> &mdash; List all registered projects
        </li>
        <li>
          <code>delete_project</code> &mdash; Remove a project
        </li>
      </ul>

      <h3>Entity Management</h3>
      <p>Work with code entities (functions, classes, modules, and custom concepts).</p>
      <ul>
        <li>
          <code>add_entity</code> &mdash; Add a custom entity
        </li>
        <li>
          <code>get_entity</code> &mdash; Retrieve an entity by ID or qualified name
        </li>
        <li>
          <code>search_entities</code> &mdash; Search entities by text query
        </li>
      </ul>

      <h3>Codebase Indexing</h3>
      <p>Parse and index source code for retrieval.</p>
      <ul>
        <li>
          <code>index_codebase</code> &mdash; Full index of a codebase
        </li>
        <li>
          <code>sync_from_git</code> &mdash; Incremental update from git changes
        </li>
        <li>
          <code>index_document</code> &mdash; Index a markdown or requirements file
        </li>
        <li>
          <code>get_index_status</code> &mdash; Check current indexing status
        </li>
      </ul>

      <h3>Context Retrieval</h3>
      <p>The primary search interface for finding relevant code and documentation.</p>
      <ul>
        <li>
          <code>context_query</code> &mdash; Hybrid RAG search combining vector,
          graph, and keyword strategies. This is the main tool Claude will use
          to answer questions about your code.
        </li>
      </ul>

      <h3>Conversation Memory</h3>
      <p>Track conversations and architectural decisions across sessions.</p>
      <ul>
        <li>
          <code>store_message</code> &mdash; Store a conversation message
        </li>
        <li>
          <code>get_history</code> &mdash; Retrieve conversation history
        </li>
        <li>
          <code>search_decisions</code> &mdash; Search for past architectural decisions
        </li>
        <li>
          <code>summarize_session</code> &mdash; Generate a session summary
        </li>
        <li>
          <code>list_sessions</code> &mdash; List all conversation sessions
        </li>
      </ul>

      <h3>Graph</h3>
      <p>Explore and build the entity relationship graph.</p>
      <ul>
        <li>
          <code>link_entities</code> &mdash; Create a relationship between two entities
        </li>
        <li>
          <code>query_graph</code> &mdash; Traverse the relationship graph
        </li>
        <li>
          <code>get_graph_stats</code> &mdash; View graph statistics
        </li>
      </ul>

      <h3>Agent Memory</h3>
      <p>Checkpoint and manage agent state for long-running tasks.</p>
      <ul>
        <li>
          <code>checkpoint_save</code> / <code>checkpoint_load</code> &mdash;
          Save and restore agent state
        </li>
        <li>
          <code>memory_spill</code> &mdash; Move items from hot to cold storage
        </li>
        <li>
          <code>memory_recall</code> &mdash; Recall items from cold storage
        </li>
        <li>
          <code>reflection_store</code> / <code>reflection_query</code> &mdash;
          Store and query learning reflections
        </li>
      </ul>

      <h3>Analytics</h3>
      <p>Monitor usage and get insights.</p>
      <ul>
        <li>
          <code>analytics_dashboard</code> &mdash; View stats, recent queries, and top entities
        </li>
        <li>
          <code>analytics_get_stats</code> &mdash; Get token savings and usage analytics
        </li>
        <li>
          <code>analytics_feedback</code> &mdash; Record feedback on query results
        </li>
      </ul>

      <h3>Git Hooks</h3>
      <p>Automate indexing with git integration.</p>
      <ul>
        <li>
          <code>hooks_install</code> &mdash; Install git hooks for automatic indexing
        </li>
        <li>
          <code>hooks_impact_report</code> &mdash; Get an impact analysis for pending changes
        </li>
      </ul>

      <h2>Example Queries to Try</h2>
      <p>
        Once connected, try asking Claude questions like these to see ctx-sys in
        action:
      </p>
      <ul>
        <li>
          &quot;How does authentication work in this project?&quot;
        </li>
        <li>
          &quot;What functions call the <code>processPayment</code> method?&quot;
        </li>
        <li>
          &quot;Show me the database schema and how it relates to the API routes.&quot;
        </li>
        <li>
          &quot;What architectural decisions have been made about caching?&quot;
        </li>
        <li>
          &quot;Summarize what changed in the last session.&quot;
        </li>
      </ul>

      <h2>Tips for Best Results</h2>
      <ul>
        <li>
          <strong>Keep your index up to date.</strong> Run{' '}
          <code>ctx index --embed</code> after major changes, or install git
          hooks with <code>ctx hooks install</code> to automate it.
        </li>
        <li>
          <strong>Be specific in your questions.</strong> Claude can search more
          effectively when you mention file names, function names, or specific
          concepts.
        </li>
        <li>
          <strong>Use Ollama for local embeddings.</strong> ctx-sys works with
          Ollama out of the box for free, private embeddings. See the{' '}
          <Link href="/docs/ollama">Ollama Setup</Link> guide.
        </li>
        <li>
          <strong>Index documentation too.</strong> Use{' '}
          <code>ctx index-doc README.md</code> to include markdown files in the
          search index.
        </li>
        <li>
          <strong>Let Claude use the graph.</strong> If you ask about
          relationships between components, Claude will automatically use the
          graph traversal tools.
        </li>
      </ul>

      <h2>Next Steps</h2>
      <p>
        For the complete list of all 33 tools with detailed parameter
        descriptions and usage examples, see the{' '}
        <Link href="/docs/mcp-tools">MCP Tools Reference</Link>.
      </p>
    </>
  );
}
