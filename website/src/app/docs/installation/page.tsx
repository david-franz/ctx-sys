import Link from 'next/link';
import { CodeBlock, Callout } from '../../../components/docs';

export default function InstallationPage() {
  return (
    <>
      <h1>Installation</h1>
      <p>
        This guide covers everything you need to install ctx-sys, configure
        optional dependencies, and get your first project indexed.
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

      {/* Install from npm */}
      <h2>Install from npm</h2>
      <p>Install ctx-sys globally so the CLI is available everywhere:</p>
      <CodeBlock>{`npm install -g ctx-sys`}</CodeBlock>
      <p>
        This registers two identical commands: <code>ctx</code> and{' '}
        <code>ctx-sys</code>. Both work interchangeably &mdash; all examples
        in this documentation use <code>ctx-sys</code> for clarity.
      </p>
      <p>Verify that the CLI is installed and accessible:</p>
      <CodeBlock>{`ctx-sys --version`}</CodeBlock>
      <Callout type="warning">
        <p>
          If the command is not found, make sure your global npm bin directory is
          in your <code>PATH</code>. Run <code>npm bin -g</code> to find it,
          then add it to your shell profile.
        </p>
      </Callout>

      {/* Install Ollama */}
      <h2>Install Ollama (Optional)</h2>
      <p>
        <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">
          Ollama
        </a>{' '}
        enables local vector embeddings for semantic search without sending code
        to external APIs. This is optional &mdash; keyword and graph search work
        without it.
      </p>

      <h3>macOS</h3>
      <CodeBlock>{`brew install ollama`}</CodeBlock>

      <h3>Linux</h3>
      <CodeBlock>{`curl -fsSL https://ollama.com/install.sh | sh`}</CodeBlock>

      <h3>Pull Models</h3>
      <p>
        After installing Ollama, pull the models ctx-sys uses:
      </p>
      <CodeBlock title="Required for semantic search">{`ollama pull mxbai-embed-large:latest`}</CodeBlock>
      <CodeBlock title="Optional: summaries">{`ollama pull qwen3:0.6b`}</CodeBlock>
      <CodeBlock title="Optional: HyDE (Hypothetical Document Embeddings)">{`ollama pull gemma3:12b`}</CodeBlock>
      <Callout type="tip">
        <p>
          Only the embedding model (<code>mxbai-embed-large:latest</code>) is
          needed for core semantic search. The summarization and HyDE models
          improve results but are not required. See the{' '}
          <Link href="/docs/integrations#ollama">Ollama Setup guide</Link> for more details.
        </p>
      </Callout>

      {/* Initialize a Project */}
      <h2>Initialize a Project</h2>
      <p>
        Navigate to the root of a project you want to index and run{' '}
        <code>ctx-sys init</code>:
      </p>
      <CodeBlock>{`cd /path/to/your/project
ctx-sys init

Initialized ctx-sys project in /path/to/your/project
Created .ctx-sys/config.yaml`}</CodeBlock>
      <p>
        This creates a <code>.ctx-sys/</code> directory in your project root
        containing:
      </p>
      <ul>
        <li>
          <code>config.yaml</code> &mdash; project configuration (languages,
          ignore patterns, embedding settings)
        </li>
        <li>
          A local SQLite database for entities, relationships, and embeddings
        </li>
      </ul>

      {/* First Index */}
      <h2>First Index</h2>
      <p>
        Run <code>ctx-sys index</code> to build the full context graph. This
        step:
      </p>
      <ul>
        <li>Parses source code with tree-sitter to extract functions, classes, and modules</li>
        <li>Builds relationships between entities (imports, calls, containment)</li>
        <li>Indexes documentation files (markdown, requirements, etc.)</li>
        <li>Generates vector embeddings for every entity (when Ollama is running)</li>
      </ul>
      <CodeBlock>{`ctx-sys index

Indexing codebase...
Parsed 142 files
Extracted 387 entities
Built 612 relationships
Generating embeddings... done (387 entities)
Done in 18.4s`}</CodeBlock>
      <p>
        Subsequent runs are incremental &mdash; only changed files are
        re-parsed, making updates fast.
      </p>

      {/* Verify */}
      <h2>Verify</h2>
      <p>
        Run the built-in health check to confirm everything is working:
      </p>
      <CodeBlock>{`ctx-sys status --check`}</CodeBlock>
      <p>
        This verifies the project configuration, database integrity, Ollama
        connectivity, and model availability.
      </p>

      {/* Building from Source */}
      <h2>Building from Source</h2>
      <p>
        To work on ctx-sys itself or run the latest development version:
      </p>
      <CodeBlock>{`git clone https://github.com/davidfranz/ctx-sys.git
cd ctx-sys
npm install
npm run build
npm link`}</CodeBlock>
      <p>
        After <code>npm link</code>, the <code>ctx-sys</code> and{' '}
        <code>ctx</code> commands will point to your local build. Run{' '}
        <code>npm run build</code> after making changes to recompile.
      </p>
      <Callout type="note">
        <p>
          The CLI runs from compiled JavaScript in <code>dist/</code>, not
          directly from TypeScript source. Always run <code>npm run build</code>{' '}
          after editing <code>.ts</code> files.
        </p>
      </Callout>

      {/* Troubleshooting */}
      <h2>Troubleshooting</h2>

      <h3>Command not found</h3>
      <p>
        If <code>ctx-sys</code> is not recognized after installation, your
        global npm bin directory is likely not in your <code>PATH</code>. Find
        it and add it to your shell profile:
      </p>
      <CodeBlock>{`# Find the global bin directory
npm bin -g

# Add it to your PATH (add this line to ~/.bashrc or ~/.zshrc)
export PATH="$(npm bin -g):$PATH"`}</CodeBlock>

      <h3>Node.js version too old</h3>
      <p>
        ctx-sys requires Node.js 18 or later. Check your version and upgrade if
        needed:
      </p>
      <CodeBlock>{`node --version`}</CodeBlock>
      <p>
        We recommend using{' '}
        <a href="https://github.com/nvm-sh/nvm" target="_blank" rel="noopener noreferrer">
          nvm
        </a>{' '}
        to manage Node.js versions:
      </p>
      <CodeBlock>{`nvm install 18
nvm use 18`}</CodeBlock>

      <h3>Ollama not running</h3>
      <p>
        If <code>ctx-sys index</code> reports that it cannot connect to Ollama,
        make sure the Ollama service is started:
      </p>
      <CodeBlock>{`ollama serve`}</CodeBlock>
      <p>
        Ollama listens on port 11434 by default. If you are running it on a
        different host or port, update the <code>ollama.url</code> setting in
        your <code>.ctx-sys/config.yaml</code>.
      </p>

      <h3>Permission errors on global install</h3>
      <p>
        If <code>npm install -g</code> fails with <code>EACCES</code>,
        configure npm to use a user-writable directory:
      </p>
      <CodeBlock>{`mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
export PATH="$HOME/.npm-global/bin:$PATH"`}</CodeBlock>
      <p>
        Add the <code>PATH</code> export to your shell profile to make it
        permanent.
      </p>
    </>
  );
}
