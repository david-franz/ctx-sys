import Link from 'next/link';
import { CodeBlock, Callout, FlagTable } from '../../../components/docs';

export default function ConfigurationPage() {
  return (
    <>
      <h1>Configuration</h1>
      <p>
        ctx-sys uses a layered configuration system. Settings are resolved in
        the following order, with each layer overriding the previous:
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
          <strong>Environment variables</strong> &mdash; override any config
          file setting
        </li>
        <li>
          <strong>CLI flags</strong> &mdash; highest priority, applied per
          command
        </li>
      </ol>
      <Callout type="tip">
        <p>
          For most users, the built-in defaults work out of the box. You only
          need to create configuration files when you want to change models,
          providers, or ignore patterns.
        </p>
      </Callout>

      {/* Project Configuration */}
      <h2>Project Configuration</h2>
      <p>
        Each project has its own configuration file at{' '}
        <code>.ctx-sys/config.yaml</code> relative to the project root. This
        file is created automatically when you run <code>ctx-sys init</code>.
        Project-level settings override global defaults.
      </p>
      <CodeBlock title=".ctx-sys/config.yaml">{`project:
  name: my-project

indexing:
  ignore:
    - node_modules
    - dist
    - .git

embeddings:
  provider: ollama
  model: mxbai-embed-large:latest

summarization:
  provider: ollama
  model: qwen3:0.6b

hyde:
  model: gemma3:12b`}</CodeBlock>

      <h3>Project Config Options</h3>
      <FlagTable
        flags={[
          { flag: 'project.name', description: 'Human-readable project name', default: 'unnamed' },
          { flag: 'indexing.ignore', description: 'Directories and patterns to exclude from indexing', default: '[node_modules, .git, dist, build]' },
          { flag: 'indexing.languages', description: 'Limit indexing to specific languages', default: 'auto-detected' },
          { flag: 'embeddings.provider', description: 'Provider for embedding generation (ollama or openai)', default: 'ollama' },
          { flag: 'embeddings.model', description: 'Model used for generating vector embeddings', default: 'mxbai-embed-large:latest' },
          { flag: 'summarization.provider', description: 'Provider for entity summarization (ollama or openai)', default: 'ollama' },
          { flag: 'summarization.model', description: 'Model used for entity summarization', default: 'qwen3:0.6b' },
          { flag: 'hyde.model', description: 'Model used for HyDE hypothetical document generation', default: 'gemma3:12b' },
          { flag: 'retrieval.default_max_tokens', description: 'Token budget for context retrieval responses', default: '4000' },
          { flag: 'retrieval.strategies', description: 'Search strategies used in hybrid RAG', default: '[vector, graph, fts]' },
        ]}
      />

      {/* Global Configuration */}
      <h2>Global Configuration</h2>
      <p>
        The global configuration file lives at{' '}
        <code>~/.ctx-sys/config.yaml</code>. It controls database location,
        provider credentials, and default model choices. These settings apply to
        all projects unless overridden by a project config.
      </p>
      <CodeBlock title="~/.ctx-sys/config.yaml">{`database:
  path: ~/.ctx-sys/ctx-sys.db

providers:
  ollama:
    base_url: http://localhost:11434
  openai:
    api_key: \${OPENAI_API_KEY}`}</CodeBlock>

      <h3>Global Config Options</h3>
      <FlagTable
        flags={[
          { flag: 'database.path', description: 'Path to the SQLite database file', default: '~/.ctx-sys/ctx-sys.db' },
          { flag: 'providers.ollama.base_url', description: 'Ollama server URL', default: 'http://localhost:11434' },
          { flag: 'providers.openai.api_key', description: 'OpenAI API key (supports ${OPENAI_API_KEY} interpolation)' },
          { flag: 'providers.openai.base_url', description: 'Custom base URL for OpenAI-compatible APIs' },
          { flag: 'providers.anthropic.api_key', description: 'Anthropic API key (supports ${ANTHROPIC_API_KEY} interpolation)' },
        ]}
      />

      {/* Environment Variables */}
      <h2>Environment Variables</h2>
      <p>
        Environment variables provide overrides that take priority over both
        global and project config files. They are the recommended way to supply
        secrets such as API keys.
      </p>
      <FlagTable
        flags={[
          { flag: 'OLLAMA_BASE_URL', description: 'Custom Ollama server URL', default: 'http://localhost:11434' },
          { flag: 'OPENAI_API_KEY', description: 'OpenAI API key for cloud embeddings and summarization' },
          { flag: 'ANTHROPIC_API_KEY', description: 'Anthropic API key for summarization' },
          { flag: 'CTX_HYDE_MODEL', description: 'Override HyDE model for hypothetical document generation', default: 'gemma3:12b' },
        ]}
      />
      <p>
        Set these in your shell profile (<code>~/.bashrc</code>,{' '}
        <code>~/.zshrc</code>) or in your CI environment:
      </p>
      <CodeBlock>{`export OLLAMA_BASE_URL=http://localhost:11434
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export CTX_HYDE_MODEL=gemma3:12b`}</CodeBlock>

      {/* CLI Config Commands */}
      <h2>CLI Config Commands</h2>
      <p>
        You can inspect and modify configuration from the command line without
        editing YAML files directly.
      </p>

      <h3>List All Settings</h3>
      <CodeBlock>{`$ ctx-sys config list

database.path              = ~/.ctx-sys/ctx-sys.db
providers.ollama.base_url  = http://localhost:11434
defaults.summarization.provider = ollama
defaults.summarization.model    = qwen3:0.6b
defaults.embeddings.provider    = ollama
defaults.embeddings.model       = mxbai-embed-large:latest`}</CodeBlock>

      <h3>Get a Single Value</h3>
      <CodeBlock>{`$ ctx-sys config get defaults.embeddings.model

mxbai-embed-large:latest`}</CodeBlock>

      <h3>Set a Value</h3>
      <CodeBlock>{`$ ctx-sys config set defaults.embeddings.provider openai

Set defaults.embeddings.provider = openai`}</CodeBlock>

      <h3>Show Config File Paths</h3>
      <CodeBlock>{`$ ctx-sys config path

Project config: /home/user/my-project/.ctx-sys/config.yaml
Global config:  ~/.ctx-sys/config.yaml`}</CodeBlock>

      {/* Example Configurations */}
      <h2>Example Configurations</h2>

      <h3>Local-Only (Ollama, Everything Default)</h3>
      <p>
        This is the simplest setup. Everything runs locally through Ollama and
        no data ever leaves your machine. Ideal for proprietary codebases.
      </p>
      <CodeBlock title=".ctx-sys/config.yaml">{`project:
  name: my-project

# All defaults use Ollama — no additional configuration needed.
# Just make sure Ollama is running and the models are pulled:
#   ollama pull mxbai-embed-large:latest
#   ollama pull qwen3:0.6b`}</CodeBlock>
      <Callout type="tip">
        <p>
          With the default configuration, you only need to run{' '}
          <code>ctx-sys init</code> and <code>ctx-sys index</code> to get
          started. No config file editing required.
        </p>
      </Callout>

      <h3>Large Monorepo</h3>
      <p>
        For large codebases, customize ignore patterns to exclude generated code
        and vendor directories. Restrict indexing to specific languages to reduce
        noise.
      </p>
      <CodeBlock title=".ctx-sys/config.yaml">{`project:
  name: my-monorepo

indexing:
  ignore:
    - node_modules
    - .git
    - dist
    - build
    - generated
    - __pycache__
    - .next
    - vendor
    - "**/*.min.js"
  languages:
    - typescript
    - python
    - go

retrieval:
  default_max_tokens: 8000
  strategies:
    - vector
    - graph
    - fts`}</CodeBlock>
      <Callout type="note">
        <p>
          For very large codebases, consider running the initial index with{' '}
          <code>ctx-sys index --no-embed</code> first to verify that the correct
          files are being parsed, then run <code>ctx-sys embed run</code>{' '}
          separately.
        </p>
      </Callout>

      <h3>Cloud-Based (OpenAI for Embeddings)</h3>
      <p>
        Use OpenAI for faster embeddings and higher-quality summarization.
        Requires an API key. Note that code content will be sent to the OpenAI
        API.
      </p>
      <CodeBlock title="~/.ctx-sys/config.yaml">{`providers:
  openai:
    api_key: \${OPENAI_API_KEY}

defaults:
  embeddings:
    provider: openai
    model: text-embedding-3-small
  summarization:
    provider: openai
    model: gpt-4o-mini`}</CodeBlock>
      <Callout type="warning">
        <p>
          When using a cloud provider, entity source code is sent to the
          provider API for processing. Do not use this configuration with
          codebases that contain sensitive or proprietary code unless your
          organization permits it.
        </p>
      </Callout>

      <h3>Keyword-Only (No Ollama Required)</h3>
      <p>
        If you do not want to run Ollama or use an external API, you can
        disable embeddings and summarization entirely. Keyword (full-text) and
        graph search still work without any AI models.
      </p>
      <CodeBlock title=".ctx-sys/config.yaml">{`project:
  name: my-project

summarization:
  enabled: false

retrieval:
  strategies:
    - graph
    - fts`}</CodeBlock>
      <p>
        Index with the <code>--no-embed</code> flag to skip embedding
        generation:
      </p>
      <CodeBlock>{`ctx-sys index --no-embed`}</CodeBlock>
      <Callout type="tip">
        <p>
          This is a good starting point if you want to try ctx-sys without
          installing Ollama. You can always add embeddings later by pulling the
          model and running <code>ctx-sys embed run</code>.
        </p>
      </Callout>

      {/* Next Steps */}
      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/integrations#ollama">Ollama Setup</Link> &mdash; install and
          configure local models for embeddings and summarization
        </li>
        <li>
          <Link href="/docs/cli">CLI Commands</Link> &mdash; full reference
          for all available commands
        </li>
        <li>
          <Link href="/docs/troubleshooting">Troubleshooting</Link> &mdash;
          common issues and how to resolve them
        </li>
      </ul>
    </>
  );
}
