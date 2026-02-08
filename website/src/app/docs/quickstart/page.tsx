import Link from 'next/link';
import { CodeBlock, Callout } from '../../../components/docs';

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
      <p>Install ctx-sys globally from npm:</p>
      <CodeBlock>{`npm install -g ctx-sys`}</CodeBlock>
      <p>
        After installation, both the <code>ctx</code> and{' '}
        <code>ctx-sys</code> commands are available. They are identical
        &mdash; all examples in this documentation use <code>ctx-sys</code> for
        clarity.
      </p>

      {/* Step 2 */}
      <h2>Step 2: Initialize Your Project</h2>
      <p>
        Navigate to your project directory and run <code>ctx-sys init</code>.
        This creates a <code>.ctx-sys/</code> directory with a default{' '}
        <code>config.yaml</code>.
      </p>
      <CodeBlock>{`cd /path/to/your/project
ctx-sys init

Initialized ctx-sys project in /path/to/your/project
Created .ctx-sys/config.yaml`}</CodeBlock>

      {/* Step 3 */}
      <h2>Step 3: Index Your Codebase</h2>
      <p>
        Run <code>ctx-sys index</code> to parse your source files and build the
        context graph. This step:
      </p>
      <ul>
        <li>Parses code with tree-sitter to extract functions, classes, and modules</li>
        <li>Builds relationships between entities (imports, calls, containment)</li>
        <li>Indexes documentation files (markdown, etc.)</li>
        <li>Generates vector embeddings when Ollama is running</li>
      </ul>
      <CodeBlock>{`ctx-sys index

Indexing codebase...
Parsed 142 files
Extracted 387 entities
Built 612 relationships
Generating embeddings... done (387 entities)
Done in 18.4s`}</CodeBlock>
      <p>
        To skip embedding generation, pass <code>--no-embed</code>:
      </p>
      <CodeBlock>{`ctx-sys index --no-embed`}</CodeBlock>
      <Callout type="tip">
        <p>
          Embedding requires{' '}
          <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">Ollama</a>{' '}
          running locally with the <code>mxbai-embed-large:latest</code> model
          pulled. Without it, keyword and graph search still work &mdash;
          semantic search is the only feature that needs embeddings. See the{' '}
          <Link href="/docs/integrations#ollama">Ollama Setup guide</Link> for details.
        </p>
      </Callout>

      {/* Step 4 */}
      <h2>Step 4: Search</h2>
      <p>
        Use <code>ctx-sys search</code> to query your indexed codebase. Results
        are ranked using hybrid search that combines keyword matching, graph
        traversal, and semantic similarity.
      </p>
      <CodeBlock>{`ctx-sys search "authentication middleware"

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
     Test suite for authentication middleware.`}</CodeBlock>

      {/* Step 5 */}
      <h2>Step 5: Start the MCP Server</h2>
      <p>
        Run <code>ctx-sys serve</code> to start ctx-sys as a{' '}
        <strong>Model Context Protocol (MCP)</strong> server over stdio. This
        allows AI assistants like Claude Desktop and Cursor to query your
        codebase context directly.
      </p>
      <CodeBlock>{`ctx-sys serve

Starting MCP server on stdio...
Project: /path/to/your/project
Entities: 387 | Relationships: 612
Ready for connections.`}</CodeBlock>
      <p>
        The server communicates over stdio and is designed to be launched by
        your AI assistant. See the{' '}
        <Link href="/docs/integrations#claude-desktop">Claude Desktop guide</Link> for
        step-by-step configuration.
      </p>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/integrations#claude-desktop">Claude Desktop</Link> &mdash;
          connect ctx-sys as an MCP server in Claude Desktop
        </li>
        <li>
          <Link href="/docs/installation">Installation</Link> &mdash;
          detailed installation options, building from source, and troubleshooting
        </li>
        <li>
          <Link href="/docs/integrations#ollama">Ollama Setup</Link> &mdash; configure
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
