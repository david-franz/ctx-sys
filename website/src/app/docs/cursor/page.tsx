import Link from 'next/link';

export default function CursorPage() {
  return (
    <>
      <h1>Cursor IDE Integration</h1>
      <p>
        Cursor has built-in support for the Model Context Protocol (MCP),
        which means you can connect ctx-sys directly to your editor. This
        gives Cursor&apos;s AI features &mdash; including chat, inline edits,
        and the composer &mdash; access to your full indexed codebase, entity
        relationships, conversation history, and semantic search. Instead of
        relying on Cursor&apos;s built-in file scanning alone, ctx-sys provides
        a richer, pre-indexed understanding of your project.
      </p>

      <h2>Prerequisites</h2>
      <ul>
        <li>
          <strong>Cursor IDE</strong> installed (version 0.43 or later, which
          includes MCP support)
        </li>
        <li>
          <strong>ctx-sys</strong> installed globally (
          <code>npm install -g ctx-sys</code>). Both the <code>ctx</code> and{' '}
          <code>ctx-sys</code> commands are available after installation.
        </li>
        <li>
          <strong>A codebase indexed</strong> with ctx-sys
        </li>
      </ul>

      <h2>Step-by-Step Setup</h2>

      <h3>1. Index Your Project</h3>
      <p>
        If you have not already indexed your project, navigate to the project
        directory and run:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ctx init && ctx index --embed`}
          </code>
        </pre>
      </div>
      <p>
        This parses your source files, extracts entities, and generates vector
        embeddings for semantic search.
      </p>

      <h3>2. Open Cursor MCP Settings</h3>
      <p>
        In Cursor, open <strong>Settings</strong> (Cmd+, on macOS, Ctrl+, on
        Windows/Linux), then navigate to the <strong>MCP</strong> section in
        the sidebar. This is where you register external MCP servers.
      </p>

      <h3>3. Add the ctx-sys MCP Server</h3>
      <p>
        Click <strong>&quot;Add new MCP server&quot;</strong> and enter the
        following configuration:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
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
      </div>
      <p>
        If Cursor cannot find the <code>ctx-sys</code> command, replace it
        with the full path to the binary. You can find this by running{' '}
        <code>which ctx-sys</code> in your terminal.
      </p>

      <h3>4. Verify the Connection</h3>
      <p>
        After adding the server, Cursor should show a green status indicator
        next to ctx-sys in the MCP settings panel. You can also verify by
        opening the Cursor chat and asking a question about your codebase
        &mdash; Cursor will use ctx-sys tools automatically when relevant.
      </p>
      <p>
        If the status indicator is red or missing, check that:
      </p>
      <ul>
        <li>
          The <code>ctx-sys</code> command is accessible from your system PATH
        </li>
        <li>
          You have indexed at least one project with <code>ctx init</code>
        </li>
        <li>
          No other process is blocking the MCP connection
        </li>
      </ul>

      <h2>Usage Tips</h2>

      <h3>Let the AI Choose Its Tools</h3>
      <p>
        You do not need to explicitly tell Cursor to use ctx-sys. When you ask
        questions about your codebase in chat or the composer, Cursor will
        automatically invoke the appropriate ctx-sys tools (such as{' '}
        <code>context_query</code> for search or <code>query_graph</code> for
        relationship traversal).
      </p>

      <h3>Combine with Cursor&apos;s Native Features</h3>
      <p>
        ctx-sys complements Cursor&apos;s built-in codebase awareness. Use
        Cursor&apos;s <code>@file</code> and <code>@folder</code> references
        for targeted context, and let ctx-sys handle broader semantic queries
        like &quot;how does the authentication flow work&quot; or
        &quot;what calls this function.&quot;
      </p>

      <h3>Keep the Index Fresh</h3>
      <p>
        For the best results, keep your ctx-sys index up to date as you make
        changes. You can automate this with git hooks:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ctx hooks install`}
          </code>
        </pre>
      </div>
      <p>
        This installs a post-commit hook that automatically syncs the index
        after each commit. You can also manually re-index at any time:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ctx index --embed`}
          </code>
        </pre>
      </div>

      <h3>Use for Code Reviews and Refactoring</h3>
      <p>
        ctx-sys is particularly useful during code reviews and refactoring
        sessions. Ask Cursor questions like:
      </p>
      <ul>
        <li>
          &quot;What other functions depend on this module?&quot;
        </li>
        <li>
          &quot;Show me the impact of changing this interface.&quot;
        </li>
        <li>
          &quot;What decisions were made about this component in past sessions?&quot;
        </li>
      </ul>

      <h2>Next Steps</h2>
      <p>
        For the complete list of all tools available through the MCP
        connection, see the{' '}
        <Link href="/docs/mcp-tools">MCP Tools Reference</Link>.
      </p>
    </>
  );
}
