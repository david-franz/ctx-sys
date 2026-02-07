import Link from 'next/link';

export default function TroubleshootingPage() {
  return (
    <>
      <h1>Troubleshooting</h1>
      <p>
        This page covers common issues you may encounter when using ctx-sys,
        organized by category. If your issue is not listed here, check the{' '}
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Issues
        </a>{' '}
        page.
      </p>

      {/* Installation Issues */}
      <h2>Installation Issues</h2>

      <h3>command not found: ctx</h3>
      <p>
        After installing ctx-sys globally, the <code>ctx</code> command is not
        recognized.
      </p>
      <p>
        <strong>Cause:</strong> Your global npm bin directory is not in your
        shell&apos;s <code>PATH</code>.
      </p>
      <p><strong>Solution:</strong></p>
      <ol>
        <li>
          Verify the package is installed globally:
        </li>
      </ol>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ npm list -g ctx-sys`}
          </code>
        </pre>
      </div>
      <ol start={2}>
        <li>
          Find your global npm bin directory and add it to your{' '}
          <code>PATH</code>:
        </li>
      </ol>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ npm bin -g
/usr/local/bin

# Add to your shell profile (~/.bashrc, ~/.zshrc):
export PATH="$(npm bin -g):$PATH"`}
          </code>
        </pre>
      </div>

      <h3>Node.js version too old</h3>
      <p>
        Installation fails or ctx-sys crashes on startup with syntax errors.
      </p>
      <p>
        <strong>Cause:</strong> ctx-sys requires Node.js 18 or later.
      </p>
      <p><strong>Solution:</strong></p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ node --version
v16.14.0    # Too old - need 18+

# Upgrade using nvm:
$ nvm install 18
$ nvm use 18

# Or install the latest LTS from https://nodejs.org`}
          </code>
        </pre>
      </div>

      {/* Ollama Issues */}
      <h2>Ollama Issues</h2>

      <h3>Ollama not running</h3>
      <p>
        Commands that require embeddings or summarization fail with a
        connection error.
      </p>
      <p>
        <strong>Cause:</strong> The Ollama server is not running on your
        machine.
      </p>
      <p><strong>Solution:</strong></p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# Check if Ollama is running:
$ curl http://localhost:11434/api/tags

# If you get "connection refused", start Ollama:
$ ollama serve`}
          </code>
        </pre>
      </div>
      <p>
        On macOS, Ollama may also be running as a menu bar application. Check
        your system tray.
      </p>

      <h3>Model not found</h3>
      <p>
        Ollama returns an error indicating the model does not exist.
      </p>
      <p>
        <strong>Cause:</strong> The required model has not been downloaded yet.
      </p>
      <p><strong>Solution:</strong> Pull the required models:</p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# Pull the embedding model
$ ollama pull nomic-embed-text

# Pull the summarization model
$ ollama pull qwen3:0.6b

# Verify installed models
$ ollama list`}
          </code>
        </pre>
      </div>

      <h3>Slow embeddings</h3>
      <p>
        Embedding generation takes a very long time, especially on large
        codebases.
      </p>
      <p>
        <strong>Cause:</strong> Ollama is running on CPU instead of GPU, or
        the codebase has a very large number of entities.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          If you have a GPU, ensure Ollama is configured to use it. Check the{' '}
          <a
            href="https://ollama.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ollama documentation
          </a>{' '}
          for GPU setup instructions.
        </li>
        <li>
          Consider switching to OpenAI for faster cloud-based embedding
          generation. See the{' '}
          <Link href="/docs/configuration">Configuration</Link> page to set
          up OpenAI as your embedding provider.
        </li>
        <li>
          Use the <code>--concurrency</code> flag to control parallel
          processing during indexing.
        </li>
      </ul>

      <h3>Connection refused on custom port</h3>
      <p>
        ctx-sys cannot reach Ollama even though the service is running.
      </p>
      <p>
        <strong>Cause:</strong> Ollama is running on a non-default port, or
        you are connecting to a remote Ollama server.
      </p>
      <p><strong>Solution:</strong> Set the correct URL in your configuration:</p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx config set providers.ollama.base_url http://localhost:11435

# Or set via environment variable:
$ export OLLAMA_BASE_URL=http://your-server:11434`}
          </code>
        </pre>
      </div>

      {/* Indexing Issues */}
      <h2>Indexing Issues</h2>

      <h3>No entities found after indexing</h3>
      <p>
        Running <code>ctx index</code> completes but reports zero entities.
      </p>
      <p><strong>Possible causes and solutions:</strong></p>
      <ul>
        <li>
          <strong>Unsupported language</strong> &mdash; ctx-sys currently
          supports TypeScript, Python, Rust, Go, and Java. Files in other
          languages are skipped. Check that your source files use a supported
          language.
        </li>
        <li>
          <strong>All files ignored</strong> &mdash; check your ignore
          patterns in <code>.ctx-sys/config.yaml</code>. Your source
          directories may be inadvertently excluded.
        </li>
        <li>
          <strong>Wrong directory</strong> &mdash; make sure you are running{' '}
          <code>ctx index</code> from the project root where{' '}
          <code>.ctx-sys/</code> is located.
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# Check current project status
$ ctx status

# Verify which files are being indexed
$ ctx index --dry-run`}
          </code>
        </pre>
      </div>

      <h3>Indexing is slow</h3>
      <p>
        Indexing a large codebase takes much longer than expected.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Use the <code>--concurrency</code> flag to increase parallel
          processing:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx index --concurrency 8`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          Exclude large auto-generated or vendored directories in your{' '}
          <code>.ctx-sys/config.yaml</code>:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`indexing:
  ignore:
    - node_modules
    - .git
    - dist
    - build
    - vendor
    - __generated__`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          Use <code>incremental</code> indexing mode (the default) so only
          changed files are re-parsed on subsequent runs.
        </li>
      </ul>

      <h3>Specific files not being indexed</h3>
      <p>
        Certain files you expect to be indexed are missing from the results.
      </p>
      <p><strong>Solution:</strong> Check your ignore patterns and language filters:</p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# Review your project config
$ ctx config list

# Check if the file extension is supported
# Supported: .ts, .tsx, .js, .jsx, .py, .rs, .go, .java`}
          </code>
        </pre>
      </div>
      <p>
        If the files are in a supported language but still excluded, review
        the <code>indexing.ignore</code> patterns in your{' '}
        <code>.ctx-sys/config.yaml</code> to ensure the directory is not being
        skipped.
      </p>

      {/* Search Issues */}
      <h2>Search Issues</h2>

      <h3>No search results</h3>
      <p>
        Running <code>ctx search</code> returns no matches.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Verify that indexing has completed successfully:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx status

Project: my-project
Entities: 387 | Relationships: 612 | Embeddings: 387
Last indexed: 2 minutes ago`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          If the entity count is zero, run <code>ctx index</code> first.
        </li>
        <li>
          Try broader search terms or different phrasing.
        </li>
      </ul>

      <h3>Poor search quality</h3>
      <p>
        Search returns results but they are not relevant to your query.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Generate embeddings if you have not already. Semantic search
          significantly improves result quality for natural-language queries:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx embed`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          Use the <code>--semantic</code> flag to prioritize vector search for
          conceptual queries:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx search "authentication flow" --semantic`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          For exact symbol lookups, keyword search is more precise. The hybrid
          pipeline balances both strategies by default.
        </li>
      </ul>

      <h3>Semantic search not working</h3>
      <p>
        Search results do not seem to include semantic matches, only keyword
        matches.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Ensure Ollama is running and the embedding model is available:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ curl http://localhost:11434/api/tags
$ ollama pull nomic-embed-text`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          Verify that embeddings have been generated by checking the status:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx status
# Look for "Embeddings: 387" - if it shows 0, run:
$ ctx embed`}
          </code>
        </pre>
      </div>

      {/* MCP Issues */}
      <h2>MCP Issues</h2>

      <h3>Claude Desktop not connecting to ctx-sys</h3>
      <p>
        Claude Desktop does not show ctx-sys tools in the interface.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Verify your Claude Desktop configuration file path is correct. On
          macOS, it is located at{' '}
          <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>.
        </li>
        <li>
          Ensure the <code>ctx-sys</code> binary is accessible from the PATH
          that Claude Desktop uses. Try specifying the full path in the config:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`{
  "mcpServers": {
    "ctx-sys": {
      "command": "/usr/local/bin/ctx-sys",
      "args": ["serve", "--project", "/path/to/your/project"]
    }
  }
}`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          Check the Claude Desktop logs for connection errors.
        </li>
      </ul>

      <h3>MCP tools not appearing</h3>
      <p>
        The MCP server starts but tools are not visible in the AI assistant.
      </p>
      <p>
        <strong>Solution:</strong> Restart Claude Desktop (or your AI
        assistant) completely after making changes to the MCP configuration.
        Most assistants only load MCP server configurations at startup.
      </p>

      <h3>Permission errors</h3>
      <p>
        The MCP server reports permission errors when reading or writing the
        database.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Check file permissions on the database file:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ls -la ~/.ctx-sys/ctx-sys.db

# Fix permissions if needed:
$ chmod 644 ~/.ctx-sys/ctx-sys.db`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          Ensure the directory is writable:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ chmod 755 ~/.ctx-sys/`}
          </code>
        </pre>
      </div>

      {/* Database Issues */}
      <h2>Database Issues</h2>

      <h3>Database locked</h3>
      <p>
        Operations fail with a &ldquo;database is locked&rdquo; error.
      </p>
      <p>
        <strong>Cause:</strong> Another process is currently using the SQLite
        database. SQLite allows only one writer at a time.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Check for other ctx-sys processes:
        </li>
      </ul>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ lsof ~/.ctx-sys/ctx-sys.db`}
          </code>
        </pre>
      </div>
      <ul>
        <li>
          If a previous process crashed and left a lock, the lock will
          automatically clear. Wait a moment and try again.
        </li>
        <li>
          Ensure you are not running multiple MCP servers pointing to the same
          database simultaneously.
        </li>
      </ul>

      <h3>Corrupt database</h3>
      <p>
        ctx-sys produces unexpected errors or inconsistent results that
        suggest data corruption.
      </p>
      <p><strong>Solution:</strong> Run the health check diagnostic:</p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx health

Database: OK
Tables: 8/8 present
Entities: 387
Relationships: 612
Embeddings: 387
Integrity check: PASSED`}
          </code>
        </pre>
      </div>
      <p>
        If the integrity check fails, you can re-index your project from
        scratch:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx index --force --embed`}
          </code>
        </pre>
      </div>

      {/* FAQ */}
      <h2>Frequently Asked Questions</h2>

      <h3>Does ctx-sys send my code to external servers?</h3>
      <p>
        By default, no. The default configuration uses Ollama for embeddings
        and summarization, which runs entirely on your local machine. If you
        configure OpenAI or Anthropic as providers, entity content will be
        sent to those APIs for processing. You can verify your provider
        settings with <code>ctx config list</code>.
      </p>

      <h3>Which languages are supported?</h3>
      <p>
        ctx-sys currently supports TypeScript (including JavaScript, TSX, and
        JSX), Python, Rust, Go, and Java. Language support is provided by
        Tree-sitter parsers.
      </p>

      <h3>Can I use ctx-sys with multiple projects?</h3>
      <p>
        Yes. Each project has its own <code>.ctx-sys/</code> directory and
        configuration. You can switch between projects by navigating to the
        respective project directory or by using the{' '}
        <code>--project</code> flag with CLI commands.
      </p>

      <h3>How much disk space does ctx-sys use?</h3>
      <p>
        The database size depends on your codebase. As a rough guide, a
        project with 400 entities and full embeddings typically uses 10 to
        50 MB. Embeddings are the largest component. You can save space by
        disabling embeddings and relying on keyword and graph search.
      </p>

      <h3>How do I reset everything and start over?</h3>
      <p>
        Delete the <code>.ctx-sys/</code> directory in your project root and
        run <code>ctx init</code> again. To also remove the global database,
        delete <code>~/.ctx-sys/ctx-sys.db</code>.
      </p>

      <h3>Where can I get help?</h3>
      <p>
        If this page does not resolve your issue, you can open an issue on the{' '}
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub repository
        </a>
        .
      </p>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/configuration">Configuration</Link> &mdash;
          review and adjust your settings
        </li>
        <li>
          <Link href="/docs/ollama">Ollama Setup</Link> &mdash; detailed
          guide for configuring local models
        </li>
        <li>
          <Link href="/docs/cli">CLI Commands</Link> &mdash; full command
          reference
        </li>
      </ul>
    </>
  );
}
