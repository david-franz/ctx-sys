import Link from 'next/link';

export default function InstallationPage() {
  return (
    <>
      <h1>Installation</h1>
      <p>
        This guide covers everything you need to install ctx-sys, configure
        optional dependencies, and initialize your first project.
      </p>

      {/* System Requirements */}
      <h2>System Requirements</h2>
      <ul>
        <li>
          <strong>Node.js 18+</strong> &mdash; required for the CLI and MCP
          server
        </li>
        <li>
          <strong>npm 8+</strong> &mdash; ships with Node.js 18 and later
        </li>
        <li>
          <strong>Operating system</strong> &mdash; macOS, Linux, or Windows
        </li>
      </ul>

      {/* Install via npm */}
      <h2>Install via npm</h2>
      <p>
        Install ctx-sys globally so the CLI is available everywhere:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ npm install -g ctx-sys`}
          </code>
        </pre>
      </div>
      <p>
        This registers two identical commands: <code>ctx</code> and{' '}
        <code>ctx-sys</code>. Both work interchangeably &mdash; all examples
        in this documentation use <code>ctx</code> for brevity.
      </p>

      {/* Verify Installation */}
      <h2>Verify Installation</h2>
      <p>
        Confirm that the CLI is installed and accessible:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx --version
ctx-sys v1.0.0`}
          </code>
        </pre>
      </div>
      <p>
        If the command is not found, ensure that your global npm bin directory
        is included in your <code>PATH</code>. You can find it by running{' '}
        <code>npm bin -g</code>.
      </p>

      {/* Optional: Ollama */}
      <h2>Optional: Ollama for Local Embeddings</h2>
      <p>
        ctx-sys can generate vector embeddings locally using{' '}
        <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">
          Ollama
        </a>
        , enabling semantic search without sending code to external APIs. This
        is optional &mdash; keyword and graph search work without it.
      </p>
      <p>
        To set up Ollama, install it and pull the required models:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# Install Ollama (visit https://ollama.ai for platform-specific instructions)

# Pull the embedding model
$ ollama pull nomic-embed-text

# Pull the summarization model
$ ollama pull qwen3:0.6b`}
          </code>
        </pre>
      </div>
      <p>
        See the <Link href="/docs/ollama">Ollama Setup guide</Link> for
        detailed configuration options, model choices, and troubleshooting.
      </p>

      {/* Optional: OpenAI */}
      <h2>Optional: OpenAI API Key</h2>
      <p>
        As an alternative to local Ollama embeddings, ctx-sys supports
        OpenAI&apos;s embedding API. Export your API key as an environment
        variable:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ export OPENAI_API_KEY=your-key`}
          </code>
        </pre>
      </div>
      <p>
        Add this to your shell profile (<code>~/.bashrc</code>,{' '}
        <code>~/.zshrc</code>, etc.) to persist it across sessions.
      </p>

      {/* Project Initialization */}
      <h2>Project Initialization</h2>
      <p>
        Navigate to the root of a project you want to index and run{' '}
        <code>ctx init</code>:
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
      <p>
        This creates a <code>.ctx-sys/</code> directory in your project root
        containing:
      </p>
      <ul>
        <li>
          <code>config.yaml</code> &mdash; project configuration (languages,
          ignore patterns, embedding provider, etc.)
        </li>
        <li>
          A local SQLite database for entities, relationships, and embeddings
        </li>
      </ul>

      {/* Configuration */}
      <h2>Configuration Overview</h2>
      <p>
        The generated <code>.ctx-sys/config.yaml</code> file controls how
        ctx-sys indexes and searches your project. Key settings include:
      </p>
      <ul>
        <li>
          <strong>languages</strong> &mdash; which programming languages to
          parse (auto-detected by default)
        </li>
        <li>
          <strong>ignore</strong> &mdash; glob patterns for files and
          directories to skip (e.g., <code>node_modules</code>,{' '}
          <code>dist</code>)
        </li>
        <li>
          <strong>embedding.provider</strong> &mdash; choose between{' '}
          <code>ollama</code> (default) or <code>openai</code>
        </li>
        <li>
          <strong>embedding.model</strong> &mdash; the model used for
          generating vector embeddings
        </li>
      </ul>
      <p>
        See the{' '}
        <Link href="/docs/configuration">Configuration reference</Link> for
        the full list of options.
      </p>

      {/* First Index */}
      <h2>First Index</h2>
      <p>
        With your project initialized, run a full index with embeddings to
        unlock all search capabilities:
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
        Subsequent runs of <code>ctx index</code> are incremental &mdash;
        only changed files are re-parsed, making updates fast.
      </p>

      {/* Troubleshooting */}
      <h2>Troubleshooting</h2>
      <p>
        If you run into issues during installation, here are a few common
        problems and solutions:
      </p>
      <h3>Permission errors on global install</h3>
      <p>
        If <code>npm install -g</code> fails with <code>EACCES</code>,
        configure npm to use a user-writable directory:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ mkdir -p ~/.npm-global
$ npm config set prefix ~/.npm-global
$ export PATH="$HOME/.npm-global/bin:$PATH"`}
          </code>
        </pre>
      </div>
      <p>
        Add the <code>PATH</code> export to your shell profile to make it
        permanent.
      </p>

      <h3>Node.js version too old</h3>
      <p>
        ctx-sys requires Node.js 18 or later. Check your version with{' '}
        <code>node --version</code> and upgrade if needed. We recommend using{' '}
        <a href="https://github.com/nvm-sh/nvm" target="_blank" rel="noopener noreferrer">
          nvm
        </a>{' '}
        to manage Node.js versions.
      </p>

      <h3>Ollama connection refused</h3>
      <p>
        If <code>ctx index --embed</code> fails to connect to Ollama, make
        sure the Ollama service is running (<code>ollama serve</code>) and
        listening on the default port (11434).
      </p>

      <p>
        For more troubleshooting help, see the full{' '}
        <Link href="/docs/troubleshooting">Troubleshooting guide</Link>.
      </p>
    </>
  );
}
