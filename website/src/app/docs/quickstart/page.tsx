import Link from 'next/link';

export default function QuickStartPage() {
  return (
    <>
      <h1>Quick Start</h1>
      <p>
        Get ctx-sys installed and running in under five minutes. This guide
        walks you through the core workflow: install, initialize, index, search,
        and serve.
      </p>

      {/* Prerequisites */}
      <h2>Prerequisites</h2>
      <ul>
        <li>
          <strong>Node.js 18+</strong> &mdash; check with{' '}
          <code>node --version</code>
        </li>
        <li>
          <strong>npm</strong> &mdash; ships with Node.js
        </li>
      </ul>

      {/* Step 1 */}
      <h2>Step 1: Install</h2>
      <p>
        Install ctx-sys globally from npm:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ npm install -g ctx-sys`}
          </code>
        </pre>
      </div>
      <p>
        After installation, both the <code>ctx</code> and{' '}
        <code>ctx-sys</code> commands are available. They are identical
        &mdash; all examples in this documentation use <code>ctx</code> for
        brevity.
      </p>

      {/* Step 2 */}
      <h2>Step 2: Initialize Your Project</h2>
      <p>
        Navigate to your project directory and run <code>ctx init</code> to
        create a new ctx-sys project. This generates a{' '}
        <code>.ctx-sys/</code> directory with a default configuration file.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ cd /path/to/your/project
$ ctx init

Initialized ctx-sys project in /path/to/your/project
Created .ctx-sys/config.yaml`}
          </code>
        </pre>
      </div>

      {/* Step 3 */}
      <h2>Step 3: Index Your Codebase</h2>
      <p>
        Run <code>ctx index</code> to parse your source files and build the
        entity graph. This extracts functions, classes, modules, and their
        relationships.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx index

Indexing codebase...
Parsed 142 files
Extracted 387 entities
Built 612 relationships
Done in 3.2s`}
          </code>
        </pre>
      </div>
      <p>
        For semantic search capabilities, add the <code>--embed</code> flag.
        This generates vector embeddings for every entity using a local Ollama
        model, enabling natural-language queries:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx index --embed

Indexing codebase...
Parsed 142 files
Extracted 387 entities
Built 612 relationships
Generating embeddings... done (387 entities)
Done in 18.4s`}
          </code>
        </pre>
      </div>
      <p>
        Embedding requires Ollama running locally. See the{' '}
        <Link href="/docs/ollama">Ollama Setup guide</Link> for installation
        instructions.
      </p>

      {/* Step 4 */}
      <h2>Step 4: Search</h2>
      <p>
        Use <code>ctx search</code> to query your indexed codebase. Results
        are ranked by relevance using a hybrid of keyword, graph, and vector
        search.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx search "authentication middleware"

Results (5 matches):

  1. src/middleware/auth.ts::authenticateRequest  [0.92]
     Validates JWT tokens and attaches user context to the request.

  2. src/middleware/auth.ts::requireRole           [0.87]
     Role-based access control middleware factory.

  3. src/routes/login.ts::handleLogin              [0.74]
     Processes login requests and issues JWT tokens.

  4. src/types/auth.ts::AuthContext                [0.71]
     Type definition for authenticated request context.

  5. src/tests/auth.test.ts::authMiddleware         [0.68]
     Test suite for authentication middleware.`}
          </code>
        </pre>
      </div>

      {/* Step 5 */}
      <h2>Step 5: Start the MCP Server</h2>
      <p>
        Run <code>ctx serve</code> to start ctx-sys as a{' '}
        <strong>Model Context Protocol (MCP)</strong> server. This allows AI
        assistants such as Claude Desktop and Cursor to query your codebase
        context directly.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx serve

Starting MCP server on stdio...
Project: /path/to/your/project
Entities: 387 | Relationships: 612
Ready for connections.`}
          </code>
        </pre>
      </div>
      <p>
        The server communicates over stdio and is designed to be launched by
        your AI assistant. See the{' '}
        <Link href="/docs/claude-desktop">Claude Desktop guide</Link> for
        step-by-step configuration.
      </p>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/claude-desktop">Claude Desktop</Link> &mdash;
          connect ctx-sys as an MCP server in Claude Desktop
        </li>
        <li>
          <Link href="/docs/installation">Installation</Link> &mdash;
          detailed installation options and configuration
        </li>
        <li>
          <Link href="/docs/ollama">Ollama Setup</Link> &mdash; configure
          local embedding and summarization models
        </li>
        <li>
          <Link href="/docs/cli">CLI Commands</Link> &mdash; full reference
          for all available commands
        </li>
        <li>
          <Link href="/docs/mcp-tools">MCP Tools</Link> &mdash; explore the
          tools ctx-sys exposes to AI assistants
        </li>
      </ul>
    </>
  );
}
