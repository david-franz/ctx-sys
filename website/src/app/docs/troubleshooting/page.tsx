import Link from 'next/link';
import { CodeBlock, Callout } from '../../../components/docs';

export default function TroubleshootingPage() {
  return (
    <>
      <h1>Troubleshooting</h1>
      <p>
        This page covers common issues you may encounter when using ctx-sys,
        organized by category. If your issue is not listed here, check the{' '}
        <a
          href="https://github.com/davidfranz/ctx-sys/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Issues
        </a>{' '}
        page.
      </p>

      {/* Installation Issues */}
      <h2>Installation Issues</h2>

      <h3>&ldquo;command not found&rdquo; after install</h3>
      <p>
        After installing ctx-sys globally, the <code>ctx-sys</code> command is
        not recognized.
      </p>
      <p>
        <strong>Cause:</strong> Your global npm bin directory is not in your
        shell&apos;s <code>PATH</code>.
      </p>
      <p><strong>Solution:</strong></p>
      <CodeBlock>{`# Check if the package is installed
npm list -g ctx-sys

# Find your global npm bin directory
npm bin -g

# Add it to your PATH in ~/.bashrc or ~/.zshrc:
export PATH="$(npm bin -g):$PATH"

# Alternatively, run without global install:
npx ctx-sys`}</CodeBlock>
      <Callout type="tip">
        <p>
          Using <code>npx ctx-sys</code> is a quick way to verify the tool
          works before troubleshooting PATH issues.
        </p>
      </Callout>

      <h3>Node.js version too old</h3>
      <p>
        Installation fails or ctx-sys crashes on startup with syntax errors.
      </p>
      <p>
        <strong>Cause:</strong> ctx-sys requires Node.js 18 or later.
      </p>
      <p><strong>Solution:</strong></p>
      <CodeBlock>{`# Check your current version
node --version

# If below v18, upgrade using nvm:
nvm install 18
nvm use 18

# Or install the latest LTS from https://nodejs.org`}</CodeBlock>

      <h3>npm permission errors</h3>
      <p>
        Global installation fails with <code>EACCES</code> permission errors.
      </p>
      <p>
        <strong>Cause:</strong> Your global npm directory requires elevated
        permissions.
      </p>
      <p><strong>Solution:</strong></p>
      <CodeBlock>{`# Option 1: Install to a user-owned directory
npm install -g ctx-sys --prefix ~/.npm-global

# Then add to your PATH in ~/.bashrc or ~/.zshrc:
export PATH="$HOME/.npm-global/bin:$PATH"

# Option 2: Use nvm (which manages permissions automatically)
nvm install 18 && npm install -g ctx-sys`}</CodeBlock>
      <Callout type="warning">
        <p>
          Avoid using <code>sudo npm install -g</code> as it can cause
          permission issues with future packages.
        </p>
      </Callout>

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
      <CodeBlock>{`# Check if Ollama is running
curl http://localhost:11434/api/tags

# If you get "connection refused", start Ollama:
ollama serve`}</CodeBlock>
      <Callout type="note">
        <p>
          On macOS, Ollama may be running as a menu bar application. Check your
          system tray. If you installed Ollama via the desktop app, it starts
          automatically on login.
        </p>
      </Callout>

      <h3>Model not found</h3>
      <p>
        Ollama returns an error indicating the model does not exist.
      </p>
      <p>
        <strong>Cause:</strong> The required model has not been downloaded yet.
      </p>
      <p><strong>Solution:</strong></p>
      <CodeBlock>{`# Pull the embedding model
ollama pull mxbai-embed-large:latest

# Pull the summarization model
ollama pull qwen3:0.6b

# Pull the HyDE model (optional, for conceptual search)
ollama pull gemma3:12b

# Verify installed models
ollama list`}</CodeBlock>

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
          Enable GPU acceleration if you have a compatible GPU. Check the{' '}
          <a
            href="https://ollama.ai"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ollama documentation
          </a>{' '}
          for setup instructions.
        </li>
        <li>
          Verify GPU is being used:
        </li>
      </ul>
      <CodeBlock>{`# Check running models and their memory usage
ollama ps`}</CodeBlock>
      <ul>
        <li>
          Consider switching to OpenAI for faster cloud-based embeddings. See
          the <Link href="/docs/configuration">Configuration</Link> page.
        </li>
      </ul>

      <h3>Custom Ollama port</h3>
      <p>
        ctx-sys cannot reach Ollama even though the service is running.
      </p>
      <p>
        <strong>Cause:</strong> Ollama is running on a non-default port or a
        remote server.
      </p>
      <p><strong>Solution:</strong></p>
      <CodeBlock>{`# Set via environment variable
export OLLAMA_BASE_URL=http://localhost:XXXX

# Or set in config
ctx-sys config set providers.ollama.base_url http://localhost:XXXX`}</CodeBlock>

      {/* Indexing Issues */}
      <h2>Indexing Issues</h2>

      <h3>No entities found after indexing</h3>
      <p>
        Running <code>ctx-sys index</code> completes but reports zero entities.
      </p>
      <p><strong>Possible causes:</strong></p>
      <ul>
        <li>
          <strong>Unsupported language</strong> &mdash; ctx-sys currently
          supports TypeScript/JavaScript, Python, Rust, Go, and Java. Files in
          other languages are skipped.
        </li>
        <li>
          <strong>All files ignored</strong> &mdash; check your ignore patterns
          in <code>.ctx-sys/config.yaml</code>. Your source directories may be
          inadvertently excluded.
        </li>
        <li>
          <strong>Wrong directory</strong> &mdash; make sure you are running the
          command from the project root where <code>.ctx-sys/</code> is located.
        </li>
      </ul>
      <CodeBlock>{`# Check current project status
ctx-sys status

# Verify which files are being indexed
ctx-sys index --dry-run`}</CodeBlock>

      <h3>Slow indexing</h3>
      <p>
        Indexing a large codebase takes much longer than expected.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Reduce concurrency if your machine is resource-constrained, or
          increase it if you have headroom:
        </li>
      </ul>
      <CodeBlock>{`ctx-sys index --concurrency 3`}</CodeBlock>
      <ul>
        <li>
          Skip embeddings during initial testing to isolate parsing speed:
        </li>
      </ul>
      <CodeBlock>{`ctx-sys index --no-embed`}</CodeBlock>
      <ul>
        <li>
          Exclude large generated or vendor directories in your config:
        </li>
      </ul>
      <CodeBlock title=".ctx-sys/config.yaml">{`indexing:
  ignore:
    - node_modules
    - .git
    - dist
    - build
    - vendor
    - __generated__`}</CodeBlock>

      <h3>Missing specific files</h3>
      <p>
        Certain files you expect to be indexed are missing from the results.
      </p>
      <p><strong>Solution:</strong> Check your ignore patterns and language filters:</p>
      <CodeBlock>{`# Review your project config
ctx-sys config list

# Supported file extensions:
# .ts, .tsx, .js, .jsx, .py, .rs, .go, .java
# .md, .html, .yaml, .json, .toml (documentation)`}</CodeBlock>
      <p>
        If the files are in a supported language, review the{' '}
        <code>indexing.ignore</code> patterns in your{' '}
        <code>.ctx-sys/config.yaml</code> to ensure the parent directory is not
        being excluded.
      </p>

      {/* Search Issues */}
      <h2>Search Issues</h2>

      <h3>No search results</h3>
      <p>
        Running <code>ctx-sys search</code> returns no matches.
      </p>
      <p><strong>Solution:</strong> Verify that indexing has completed and entities exist:</p>
      <CodeBlock>{`ctx-sys status

# If entity count is 0, run indexing first:
ctx-sys index`}</CodeBlock>

      <h3>Poor quality results</h3>
      <p>
        Search returns results but they are not relevant to your query.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          For conceptual queries (&ldquo;how does authentication work&rdquo;),
          use the <code>--hyde</code> flag for better semantic matching:
        </li>
      </ul>
      <CodeBlock>{`ctx-sys search "authentication flow" --hyde`}</CodeBlock>
      <ul>
        <li>
          For exact symbol lookups, keyword search is more precise. The default
          hybrid pipeline balances both strategies automatically.
        </li>
        <li>
          Make sure embeddings have been generated. Without embeddings, only
          keyword and graph search are available.
        </li>
      </ul>

      <h3>Semantic search not working</h3>
      <p>
        Search results do not seem to include semantic matches, only keyword
        matches.
      </p>
      <p><strong>Solution:</strong> Verify that embeddings exist:</p>
      <CodeBlock>{`# Check embedding coverage
ctx-sys embed status

# If embeddings are missing, generate them:
ctx-sys embed run`}</CodeBlock>
      <Callout type="tip">
        <p>
          Ensure Ollama is running and the embedding model is available before
          running <code>ctx-sys embed run</code>. Check
          with <code>ollama list</code>.
        </p>
      </Callout>

      {/* MCP Server Issues */}
      <h2>MCP Server Issues</h2>

      <h3>Claude Desktop not connecting</h3>
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
          Ensure the <code>ctx-sys</code> binary is accessible. Try specifying
          the full path:
        </li>
      </ul>
      <CodeBlock title="claude_desktop_config.json">{`{
  "mcpServers": {
    "ctx-sys": {
      "command": "/usr/local/bin/ctx-sys",
      "args": ["serve", "--project", "/path/to/your/project"]
    }
  }
}`}</CodeBlock>
      <ul>
        <li>
          Restart Claude Desktop completely after making configuration changes.
        </li>
        <li>
          Test that <code>ctx-sys serve</code> works standalone before
          connecting it to Claude Desktop:
        </li>
      </ul>
      <CodeBlock>{`ctx-sys serve --project /path/to/your/project`}</CodeBlock>

      <h3>Tools not appearing</h3>
      <p>
        The MCP server starts but tools are not visible in the AI assistant.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Ensure the project is indexed. Tools require entities in the database
          to return useful results.
        </li>
      </ul>
      <CodeBlock>{`# Check project status
ctx-sys status

# If no entities, index first
ctx-sys index`}</CodeBlock>
      <ul>
        <li>
          Restart your AI assistant completely after making changes to MCP
          server configuration. Most assistants only load MCP configs at startup.
        </li>
      </ul>

      {/* Database Issues */}
      <h2>Database Issues</h2>

      <h3>Database locked</h3>
      <p>
        Operations fail with a &ldquo;database is locked&rdquo; error.
      </p>
      <p>
        <strong>Cause:</strong> Another process currently has the database open.
        ctx-sys uses WAL mode which should allow concurrent reads, but only one
        writer at a time.
      </p>
      <p><strong>Solutions:</strong></p>
      <ul>
        <li>
          Check for other ctx-sys processes:
        </li>
      </ul>
      <CodeBlock>{`lsof ~/.ctx-sys/ctx-sys.db`}</CodeBlock>
      <ul>
        <li>
          If a previous process crashed and left a lock, wait a moment and try
          again. SQLite locks are automatically cleared.
        </li>
        <li>
          Ensure you are not running multiple MCP servers pointing to the same
          database simultaneously.
        </li>
      </ul>

      <h3>Corrupt database</h3>
      <p>
        ctx-sys produces unexpected errors or inconsistent results that suggest
        data corruption.
      </p>
      <p><strong>Solution:</strong> Delete the database and re-index from scratch:</p>
      <CodeBlock>{`# Remove the database
rm ~/.ctx-sys/ctx-sys.db

# Re-index your project
ctx-sys index`}</CodeBlock>
      <Callout type="warning">
        <p>
          Deleting the database removes all indexed data, session history, and
          embeddings for all projects. You will need to re-index each project.
        </p>
      </Callout>

      {/* FAQ */}
      <h2>Frequently Asked Questions</h2>

      <h3>Does my code leave my machine?</h3>
      <p>
        No. The default configuration uses Ollama for embeddings and
        summarization, which runs entirely on your local machine. No data is
        sent to external servers unless you explicitly configure a cloud
        provider (OpenAI, Anthropic). You can verify your provider settings
        with <code>ctx-sys config list</code>.
      </p>

      <h3>What languages are supported?</h3>
      <p>
        ctx-sys supports the following through Tree-sitter parsers:
      </p>
      <ul>
        <li><strong>Code:</strong> TypeScript, JavaScript, TSX, JSX, Python, Rust, Go, Java</li>
        <li><strong>Docs:</strong> Markdown, HTML, YAML, JSON, TOML</li>
      </ul>

      <h3>How much disk space does ctx-sys use?</h3>
      <p>
        A medium-sized project (around 400 entities with full embeddings)
        typically uses 10 to 50 MB. Embeddings are the largest component. You
        can reduce disk usage by disabling embeddings and relying on keyword
        and graph search.
      </p>

      <h3>How do I reset everything?</h3>
      <p>
        Remove the project-level config and the global database:
      </p>
      <CodeBlock>{`# Remove project config
rm -rf .ctx-sys/

# Remove global database
rm ~/.ctx-sys/ctx-sys.db

# Re-initialize
ctx-sys init && ctx-sys index`}</CodeBlock>

      <h3>Can I use ctx-sys with multiple projects?</h3>
      <p>
        Yes. Each project has its own <code>.ctx-sys/</code> directory and
        configuration. All projects share the global database at{' '}
        <code>~/.ctx-sys/ctx-sys.db</code>, but their data is isolated by
        project name. Switch between projects by navigating to the respective
        directory or using the <code>--project</code> flag with CLI commands.
      </p>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/configuration">Configuration</Link> &mdash;
          review and adjust your settings
        </li>
        <li>
          <Link href="/docs/integrations#ollama">Ollama Setup</Link> &mdash; detailed
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
