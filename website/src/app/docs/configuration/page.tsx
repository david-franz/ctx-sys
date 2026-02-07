import Link from 'next/link';

export default function ConfigurationPage() {
  return (
    <>
      <h1>Configuration</h1>
      <p>
        ctx-sys uses two configuration files: a global config that applies to
        all projects, and a per-project config that overrides global defaults.
        Both use YAML syntax. Environment variables can override any setting.
      </p>

      {/* Configuration Hierarchy */}
      <h2>Configuration Hierarchy</h2>
      <p>
        Settings are resolved in the following order, with later sources
        overriding earlier ones:
      </p>
      <ol>
        <li>
          <strong>Built-in defaults</strong> &mdash; sensible defaults shipped
          with ctx-sys
        </li>
        <li>
          <strong>Global config</strong> &mdash;{' '}
          <code>~/.ctx-sys/config.yaml</code>
        </li>
        <li>
          <strong>Project config</strong> &mdash;{' '}
          <code>.ctx-sys/config.yaml</code> in the project root
        </li>
        <li>
          <strong>Environment variables</strong> &mdash; highest priority,
          always wins
        </li>
      </ol>

      {/* Global Configuration */}
      <h2>Global Configuration</h2>
      <p>
        The global configuration file lives at{' '}
        <code>~/.ctx-sys/config.yaml</code>. It controls database location,
        provider credentials, default model choices, and CLI behavior. Create
        this file manually or use <code>ctx config set</code> to modify
        individual keys.
      </p>

      <h3>Full Global Config Reference</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# ~/.ctx-sys/config.yaml

# Database location
database:
  path: ~/.ctx-sys/ctx-sys.db        # string, default: ~/.ctx-sys/ctx-sys.db

# Provider configuration
providers:
  ollama:
    base_url: http://localhost:11434  # string, default: http://localhost:11434

  openai:
    api_key: \${OPENAI_API_KEY}        # string, supports env var interpolation
    base_url:                          # string, optional (for OpenAI-compatible APIs)

  anthropic:
    api_key: \${ANTHROPIC_API_KEY}     # string, supports env var interpolation

# Default model selections
defaults:
  summarization:
    provider: ollama                   # string, default: ollama
    model: qwen2.5-coder:7b           # string, default: qwen2.5-coder:7b

  embeddings:
    provider: ollama                   # string, default: ollama
    model: nomic-embed-text            # string, default: nomic-embed-text

# CLI preferences
cli:
  colors: true                         # boolean, default: true
  progress: true                       # boolean, default: true`}
          </code>
        </pre>
      </div>

      <h3>Global Config Options</h3>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>database.path</code></td>
            <td>string</td>
            <td><code>~/.ctx-sys/ctx-sys.db</code></td>
            <td>Path to the SQLite database file</td>
          </tr>
          <tr>
            <td><code>providers.ollama.base_url</code></td>
            <td>string</td>
            <td><code>http://localhost:11434</code></td>
            <td>Ollama server URL</td>
          </tr>
          <tr>
            <td><code>providers.openai.api_key</code></td>
            <td>string</td>
            <td>&mdash;</td>
            <td>OpenAI API key (supports <code>{'${OPENAI_API_KEY}'}</code>)</td>
          </tr>
          <tr>
            <td><code>providers.openai.base_url</code></td>
            <td>string</td>
            <td>&mdash;</td>
            <td>Custom base URL for OpenAI-compatible APIs</td>
          </tr>
          <tr>
            <td><code>providers.anthropic.api_key</code></td>
            <td>string</td>
            <td>&mdash;</td>
            <td>Anthropic API key (supports <code>{'${ANTHROPIC_API_KEY}'}</code>)</td>
          </tr>
          <tr>
            <td><code>defaults.summarization.provider</code></td>
            <td>string</td>
            <td><code>ollama</code></td>
            <td>Default provider for entity summarization</td>
          </tr>
          <tr>
            <td><code>defaults.summarization.model</code></td>
            <td>string</td>
            <td><code>qwen2.5-coder:7b</code></td>
            <td>Default model for entity summarization</td>
          </tr>
          <tr>
            <td><code>defaults.embeddings.provider</code></td>
            <td>string</td>
            <td><code>ollama</code></td>
            <td>Default provider for embedding generation</td>
          </tr>
          <tr>
            <td><code>defaults.embeddings.model</code></td>
            <td>string</td>
            <td><code>nomic-embed-text</code></td>
            <td>Default model for embedding generation</td>
          </tr>
          <tr>
            <td><code>cli.colors</code></td>
            <td>boolean</td>
            <td><code>true</code></td>
            <td>Enable colored CLI output</td>
          </tr>
          <tr>
            <td><code>cli.progress</code></td>
            <td>boolean</td>
            <td><code>true</code></td>
            <td>Show progress bars during long operations</td>
          </tr>
        </tbody>
      </table>

      {/* Project Configuration */}
      <h2>Project Configuration</h2>
      <p>
        Each project has its own configuration file at{' '}
        <code>.ctx-sys/config.yaml</code> relative to the project root. This
        file is created automatically when you run <code>ctx init</code>.
        Project-level settings override the corresponding global defaults.
      </p>

      <h3>Full Project Config Reference</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# .ctx-sys/config.yaml

# Project identity
project:
  name: my-project                     # string, default: unnamed

# Indexing behavior
indexing:
  mode: incremental                    # string: full | incremental | manual
                                       # default: incremental
  watch: false                         # boolean, default: false
  ignore:                              # string[], default shown below
    - node_modules
    - .git
    - dist
    - build
  languages:                           # string[], optional (auto-detected if omitted)
    - typescript
    - python

# Summarization settings
summarization:
  enabled: true                        # boolean, default: true
  provider: ollama                     # string, default: ollama
  model: qwen2.5-coder:7b             # string, default: qwen2.5-coder:7b

# Embedding settings
embeddings:
  provider: ollama                     # string, default: ollama
  model: nomic-embed-text              # string, default: nomic-embed-text

# Session management
sessions:
  retention: 30                        # number, default: 30 (days)
  auto_summarize: true                 # boolean, default: true

# Retrieval settings
retrieval:
  default_max_tokens: 4000             # number, default: 4000
  strategies:                          # string[], default shown below
    - vector
    - graph
    - fts`}
          </code>
        </pre>
      </div>

      <h3>Project Config Options</h3>
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>project.name</code></td>
            <td>string</td>
            <td><code>unnamed</code></td>
            <td>Human-readable project name</td>
          </tr>
          <tr>
            <td><code>indexing.mode</code></td>
            <td>string</td>
            <td><code>incremental</code></td>
            <td>Indexing mode: <code>full</code>, <code>incremental</code>, or <code>manual</code></td>
          </tr>
          <tr>
            <td><code>indexing.watch</code></td>
            <td>boolean</td>
            <td><code>false</code></td>
            <td>Watch for file changes and re-index automatically</td>
          </tr>
          <tr>
            <td><code>indexing.ignore</code></td>
            <td>string[]</td>
            <td><code>[node_modules, .git, dist, build]</code></td>
            <td>Directories and patterns to exclude from indexing</td>
          </tr>
          <tr>
            <td><code>indexing.languages</code></td>
            <td>string[]</td>
            <td>auto-detected</td>
            <td>Limit indexing to specific languages</td>
          </tr>
          <tr>
            <td><code>summarization.enabled</code></td>
            <td>boolean</td>
            <td><code>true</code></td>
            <td>Generate AI summaries for extracted entities</td>
          </tr>
          <tr>
            <td><code>summarization.provider</code></td>
            <td>string</td>
            <td><code>ollama</code></td>
            <td>Provider for summarization (ollama or openai)</td>
          </tr>
          <tr>
            <td><code>summarization.model</code></td>
            <td>string</td>
            <td><code>qwen2.5-coder:7b</code></td>
            <td>Model used for entity summarization</td>
          </tr>
          <tr>
            <td><code>embeddings.provider</code></td>
            <td>string</td>
            <td><code>ollama</code></td>
            <td>Provider for embedding generation (ollama or openai)</td>
          </tr>
          <tr>
            <td><code>embeddings.model</code></td>
            <td>string</td>
            <td><code>nomic-embed-text</code></td>
            <td>Model used for generating vector embeddings</td>
          </tr>
          <tr>
            <td><code>sessions.retention</code></td>
            <td>number</td>
            <td><code>30</code></td>
            <td>Days to retain conversation sessions</td>
          </tr>
          <tr>
            <td><code>sessions.auto_summarize</code></td>
            <td>boolean</td>
            <td><code>true</code></td>
            <td>Automatically summarize sessions on close</td>
          </tr>
          <tr>
            <td><code>retrieval.default_max_tokens</code></td>
            <td>number</td>
            <td><code>4000</code></td>
            <td>Token budget for context retrieval responses</td>
          </tr>
          <tr>
            <td><code>retrieval.strategies</code></td>
            <td>string[]</td>
            <td><code>[vector, graph, fts]</code></td>
            <td>Search strategies used in hybrid RAG</td>
          </tr>
        </tbody>
      </table>

      {/* Environment Variables */}
      <h2>Environment Variables</h2>
      <p>
        Environment variables provide the highest-priority overrides and are
        the recommended way to supply secrets such as API keys. ctx-sys
        recognizes the following variables:
      </p>
      <table>
        <thead>
          <tr>
            <th>Variable</th>
            <th>Description</th>
            <th>Equivalent Config Key</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>OPENAI_API_KEY</code></td>
            <td>OpenAI API key for embeddings and summarization</td>
            <td><code>providers.openai.api_key</code></td>
          </tr>
          <tr>
            <td><code>ANTHROPIC_API_KEY</code></td>
            <td>Anthropic API key</td>
            <td><code>providers.anthropic.api_key</code></td>
          </tr>
          <tr>
            <td><code>OLLAMA_BASE_URL</code></td>
            <td>Custom Ollama server URL</td>
            <td><code>providers.ollama.base_url</code></td>
          </tr>
        </tbody>
      </table>
      <p>
        Set these in your shell profile (<code>~/.bashrc</code>,{' '}
        <code>~/.zshrc</code>) or in your CI environment:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export OLLAMA_BASE_URL=http://gpu-server:11434`}
          </code>
        </pre>
      </div>

      {/* CLI Config Commands */}
      <h2>CLI Config Commands</h2>
      <p>
        You can inspect and modify configuration from the command line without
        editing YAML files directly.
      </p>

      <h3>List All Settings</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx config list

database.path              = ~/.ctx-sys/ctx-sys.db
providers.ollama.base_url  = http://localhost:11434
defaults.summarization.provider = ollama
defaults.summarization.model    = qwen2.5-coder:7b
defaults.embeddings.provider    = ollama
defaults.embeddings.model       = nomic-embed-text
cli.colors                 = true
cli.progress               = true`}
          </code>
        </pre>
      </div>

      <h3>Get a Single Value</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx config get defaults.embeddings.model

nomic-embed-text`}
          </code>
        </pre>
      </div>

      <h3>Set a Value</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`$ ctx config set defaults.embeddings.provider openai

Set defaults.embeddings.provider = openai`}
          </code>
        </pre>
      </div>

      {/* Example Configurations */}
      <h2>Example Configurations</h2>

      <h3>Local-Only Setup (Ollama)</h3>
      <p>
        This configuration keeps everything local. No data leaves your machine.
        Ideal for proprietary codebases.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# ~/.ctx-sys/config.yaml
providers:
  ollama:
    base_url: http://localhost:11434

defaults:
  summarization:
    provider: ollama
    model: qwen2.5-coder:7b
  embeddings:
    provider: ollama
    model: nomic-embed-text`}
          </code>
        </pre>
      </div>

      <h3>Cloud-Based Setup (OpenAI)</h3>
      <p>
        Use OpenAI for faster embeddings and higher-quality summarization.
        Requires an API key.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# ~/.ctx-sys/config.yaml
providers:
  openai:
    api_key: \${OPENAI_API_KEY}

defaults:
  summarization:
    provider: openai
    model: gpt-4o-mini
  embeddings:
    provider: openai
    model: text-embedding-3-small`}
          </code>
        </pre>
      </div>

      <h3>Large Monorepo Project Config</h3>
      <p>
        For large codebases, restrict indexing to specific languages and
        exclude generated code directories.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# .ctx-sys/config.yaml
project:
  name: my-monorepo

indexing:
  mode: incremental
  ignore:
    - node_modules
    - .git
    - dist
    - build
    - generated
    - __pycache__
    - .next
  languages:
    - typescript
    - python

retrieval:
  default_max_tokens: 8000
  strategies:
    - vector
    - graph
    - fts`}
          </code>
        </pre>
      </div>

      <h3>Keyword-Only Setup (No Ollama Required)</h3>
      <p>
        If you do not want to run Ollama or use an external API, you can
        disable summarization and rely on keyword and graph search only.
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`# .ctx-sys/config.yaml
project:
  name: my-project

summarization:
  enabled: false

retrieval:
  strategies:
    - graph
    - fts`}
          </code>
        </pre>
      </div>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/ollama">Ollama Setup</Link> &mdash; install and
          configure local models for embeddings and summarization
        </li>
        <li>
          <Link href="/docs/cli">CLI Commands</Link> &mdash; full reference
          for all available commands
        </li>
        <li>
          <Link href="/docs/how-it-works">How It Works</Link> &mdash;
          understand the architecture behind hybrid RAG
        </li>
      </ul>
    </>
  );
}
