import Link from 'next/link';
import { CodeBlock, Callout } from '../../../components/docs';

export default function IntegrationsPage() {
  return (
    <>
      <h1>Integrations</h1>
      <p>
        ctx-sys connects to AI assistants through the{' '}
        <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer">
          Model Context Protocol (MCP)
        </a>
        . Run <code>ctx-sys serve</code> and your assistant gets access to{' '}
        <strong>30 tools</strong> for searching, indexing, and navigating your
        codebase. This page covers setting up Ollama (the local AI backend) and
        connecting ctx-sys to popular AI clients.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/*  OLLAMA SETUP                                                       */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="ollama">Ollama Setup</h2>
      <p>
        <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a>{' '}
        runs language models and embedding models entirely on your machine. It is
        free, private, and requires no API keys. Your code never leaves your
        machine.
      </p>

      <h3>Install Ollama</h3>
      <CodeBlock>{`# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows — download from https://ollama.com`}</CodeBlock>

      <h3>Pull Required Models</h3>
      <CodeBlock>{`# Embedding model (required for semantic search)
ollama pull mxbai-embed-large:latest

# Summarization model (optional — improves search relevance)
ollama pull qwen3:0.6b

# HyDE model (optional — improves conceptual search)
ollama pull gemma3:12b`}</CodeBlock>
      <p>
        <code>mxbai-embed-large</code> produces 1024-dimensional vectors and
        powers all semantic search. This is the only model you strictly need.
      </p>

      <h3>Start Ollama</h3>
      <CodeBlock>{`ollama serve`}</CodeBlock>
      <Callout type="note">
        <p>
          On macOS, launching the Ollama application starts the server
          automatically. On Linux, the install script typically configures a
          systemd service that starts on boot.
        </p>
      </Callout>

      <h3>Configuration</h3>
      <p>
        ctx-sys uses Ollama by default with no extra configuration. If Ollama
        is running on <code>localhost:11434</code>, everything works out of
        the box. To customize:
      </p>
      <CodeBlock title=".ctx-sys/config.yaml">{`embeddings:
  provider: ollama
  model: mxbai-embed-large:latest`}</CodeBlock>
      <p>
        Or set the Ollama URL via environment variable:
      </p>
      <CodeBlock>{`OLLAMA_BASE_URL=http://localhost:11434`}</CodeBlock>

      <h3>Generate Embeddings</h3>
      <p>
        Embeddings are generated automatically during <code>ctx-sys index</code>.
        To generate or regenerate embeddings separately:
      </p>
      <CodeBlock>{`ctx-sys embed run`}</CodeBlock>

      <h3>Alternative: OpenAI</h3>
      <p>
        If you prefer cloud-based embeddings, ctx-sys also supports the OpenAI
        API:
      </p>
      <CodeBlock>{`export OPENAI_API_KEY=sk-your-key-here
ctx-sys embed run`}</CodeBlock>
      <Callout type="warning">
        <p>
          Using OpenAI sends your code to external servers for processing. If
          privacy is a concern, Ollama is the recommended option.
        </p>
      </Callout>

      <h3>Ollama Troubleshooting</h3>
      <p><strong>Ollama not running:</strong> Start the server with <code>ollama serve</code> and verify with:</p>
      <CodeBlock>{`curl http://localhost:11434/api/tags`}</CodeBlock>
      <p><strong>Model not found:</strong> Pull the missing model explicitly:</p>
      <CodeBlock>{`ollama pull mxbai-embed-large:latest`}</CodeBlock>
      <p><strong>Custom port:</strong> Set the environment variable before running ctx-sys:</p>
      <CodeBlock>{`OLLAMA_BASE_URL=http://localhost:12345 ctx-sys index`}</CodeBlock>
      <Callout type="tip">
        <p>
          Ollama automatically uses GPU acceleration (NVIDIA CUDA or Apple
          Metal) when available. CPU-only machines will be slower but still
          functional.
        </p>
      </Callout>

      {/* ------------------------------------------------------------------ */}
      {/*  CLAUDE DESKTOP                                                     */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="claude-desktop">Claude Desktop</h2>
      <p>
        Connect ctx-sys to Claude Desktop and give your AI assistant direct
        access to <strong>30 MCP tools</strong> for navigating, searching, and
        understanding your codebase.
      </p>

      <h3>Step 1: Index Your Project</h3>
      <CodeBlock>{`ctx-sys init && ctx-sys index`}</CodeBlock>

      <h3>Step 2: Add to Claude Desktop Config</h3>
      <p>
        Open the Claude Desktop configuration file at{' '}
        <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>{' '}
        and add the ctx-sys MCP server entry:
      </p>
      <CodeBlock title="claude_desktop_config.json">{`{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"]
    }
  }
}`}</CodeBlock>
      <Callout type="tip">
        <p>
          If Claude Desktop cannot find <code>ctx-sys</code>, replace the
          command with the full path from <code>which ctx-sys</code> (e.g.,{' '}
          <code>/usr/local/bin/ctx-sys</code>).
        </p>
      </Callout>

      <h3>Step 3: Restart Claude Desktop</h3>
      <p>
        Quit Claude Desktop completely and reopen it. Look for the MCP tools
        icon near the input field to confirm the connection.
      </p>

      <h3>Example Queries</h3>
      <p>Try asking Claude questions like these to see ctx-sys in action:</p>
      <ul>
        <li>&quot;How does authentication work in this codebase?&quot;</li>
        <li>&quot;What functions call the database connection?&quot;</li>
        <li>&quot;Show me the entity relationship graph for the User model.&quot;</li>
        <li>&quot;What architectural decisions were made about caching?&quot;</li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      {/*  CURSOR IDE                                                         */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="cursor">Cursor IDE</h2>
      <p>
        Cursor has built-in MCP support, so you can connect ctx-sys directly
        to your editor. This gives Cursor&apos;s chat, inline edits, and
        composer access to your full indexed codebase.
      </p>

      <h3>Step 1: Index Your Project</h3>
      <CodeBlock>{`ctx-sys init && ctx-sys index`}</CodeBlock>

      <h3>Step 2: Add ctx-sys to Cursor</h3>
      <p>
        Open <strong>Cursor Settings</strong> &gt; <strong>MCP</strong>, click{' '}
        <strong>&quot;Add new MCP server&quot;</strong>, and enter:
      </p>
      <CodeBlock title="MCP Server Configuration">{`{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"]
    }
  }
}`}</CodeBlock>
      <Callout type="tip">
        <p>
          If Cursor cannot find <code>ctx-sys</code>, replace the command with
          the full path from <code>which ctx-sys</code>.
        </p>
      </Callout>

      <h3>Step 3: Verify</h3>
      <p>
        Check that the MCP status indicator next to ctx-sys shows green. If it
        is red or missing, confirm that <code>ctx-sys</code> is on your PATH
        and that you have indexed at least one project.
      </p>

      <h3>Usage Tips</h3>
      <ul>
        <li>
          Use Cursor&apos;s <code>@file</code> and <code>@folder</code>{' '}
          references for targeted context, and let ctx-sys handle broader
          semantic queries.
        </li>
        <li>
          Install git hooks so your index stays in sync automatically:{' '}
          <code>ctx-sys hooks install</code>
        </li>
      </ul>

      {/* ------------------------------------------------------------------ */}
      {/*  CLAUDE CODE                                                        */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="claude-code">Claude Code</h2>
      <p>
        Claude Code (the CLI) supports MCP servers through its settings file.
        Add ctx-sys to your project-level or global MCP configuration:
      </p>
      <CodeBlock title=".claude/settings.json">{`{
  "mcpServers": {
    "ctx-sys": {
      "command": "ctx-sys",
      "args": ["serve"]
    }
  }
}`}</CodeBlock>
      <p>
        Once configured, Claude Code can call all 30 ctx-sys tools
        automatically during conversations.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/*  OTHER MCP CLIENTS                                                  */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="other-clients">Other MCP Clients</h2>
      <p>
        ctx-sys implements the MCP standard over stdio and works with any
        MCP-compatible client. The generic configuration is:
      </p>
      <CodeBlock>{`{
  "command": "ctx-sys",
  "args": ["serve"],
  "transport": "stdio"
}`}</CodeBlock>
      <p>
        If the client requires an absolute path to the binary, use{' '}
        <code>which ctx-sys</code> to find it. For the full list of exposed
        tools, see the <Link href="/docs/mcp-tools">MCP Tools Reference</Link>.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/*  TIPS                                                               */}
      {/* ------------------------------------------------------------------ */}

      <h2 id="tips">Tips</h2>
      <Callout type="tip">
        <p>
          Let the AI choose tools automatically. You do not need to tell it
          which ctx-sys tool to use &mdash; it will pick the right one based
          on your question.
        </p>
      </Callout>
      <ul>
        <li>
          Use <code>context_query</code> for broad, natural-language searches
          across your codebase.
        </li>
        <li>
          Use <code>search_entities</code> when you know the specific function
          or class name you are looking for.
        </li>
        <li>
          Keep your index fresh with <code>ctx-sys hooks install</code> to
          auto-sync on every commit, or use <code>ctx-sys watch</code> for
          continuous file watching.
        </li>
      </ul>

      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/mcp-tools">MCP Tools Reference</Link> &mdash;
          complete reference for all 30 tools with parameters
        </li>
        <li>
          <Link href="/docs/configuration">Configuration</Link> &mdash;
          customize models, providers, and ignore patterns
        </li>
        <li>
          <Link href="/docs/cli">CLI Commands</Link> &mdash; full command
          reference
        </li>
      </ul>
    </>
  );
}
