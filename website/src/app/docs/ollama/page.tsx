import Link from 'next/link';

export default function OllamaPage() {
  return (
    <>
      <h1>Ollama Setup</h1>
      <p>
        <a href="https://ollama.ai">Ollama</a> is a local LLM runner that
        lets you run language models and embedding models entirely on your own
        machine. It is free, private, and requires no API keys. ctx-sys uses
        Ollama by default for generating vector embeddings (used in semantic
        search) and entity summaries.
      </p>

      <h2>Why Use Ollama with ctx-sys</h2>
      <ul>
        <li>
          <strong>Embeddings for semantic search.</strong> ctx-sys converts
          your code entities into vector embeddings so you can search by
          meaning, not just keywords. Ollama runs the embedding model locally.
        </li>
        <li>
          <strong>Summarization.</strong> ctx-sys can generate concise
          summaries of functions, classes, and modules to improve search
          relevance. Ollama provides the summarization model.
        </li>
        <li>
          <strong>Completely local.</strong> Your code never leaves your
          machine. There are no API costs and no network dependency.
        </li>
      </ul>

      <h2>Installation</h2>

      <h3>macOS</h3>
      <p>Install via Homebrew or download the application directly:</p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`brew install ollama`}
          </code>
        </pre>
      </div>
      <p>
        Alternatively, download the macOS application from{' '}
        <a href="https://ollama.ai">ollama.ai</a>.
      </p>

      <h3>Linux</h3>
      <p>Use the official install script:</p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`curl -fsSL https://ollama.ai/install.sh | sh`}
          </code>
        </pre>
      </div>

      <h3>Windows</h3>
      <p>
        Download the Windows installer from{' '}
        <a href="https://ollama.ai">ollama.ai</a> and follow the setup wizard.
      </p>

      <h2>Pull Required Models</h2>
      <p>
        ctx-sys uses two models. Pull them both before indexing your codebase:
      </p>

      <h3>Embedding Model</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ollama pull nomic-embed-text`}
          </code>
        </pre>
      </div>
      <p>
        <code>nomic-embed-text</code> produces 768-dimensional vectors and is
        used by ctx-sys for all semantic search operations. It is compact and
        runs well on most hardware.
      </p>

      <h3>Summarization Model</h3>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ollama pull qwen3:0.6b`}
          </code>
        </pre>
      </div>
      <p>
        <code>qwen3:0.6b</code> is a small, fast language model used to
        generate entity summaries. Its small size means it runs quickly even
        on machines without a dedicated GPU.
      </p>

      <h2>Verify the Installation</h2>
      <p>
        Confirm that both models are available by listing your installed
        models:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ollama list`}
          </code>
        </pre>
      </div>
      <p>
        You should see both <code>nomic-embed-text</code> and{' '}
        <code>qwen3:0.6b</code> in the output.
      </p>

      <h2>Start Ollama</h2>
      <p>
        If Ollama is not already running as a background service, start the
        server manually:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ollama serve`}
          </code>
        </pre>
      </div>
      <p>
        On macOS, launching the Ollama application starts the server
        automatically. On Linux, the install script typically configures Ollama
        as a systemd service that starts on boot.
      </p>

      <h2>Configure ctx-sys</h2>
      <p>
        ctx-sys uses Ollama by default with no additional configuration
        required. As long as Ollama is running on <code>localhost:11434</code>,
        everything works out of the box.
      </p>
      <p>
        If you are running Ollama on a different host or port, add the
        following to your project&apos;s <code>config.yaml</code> (located in
        the <code>.ctx-sys</code> directory):
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ollama:
  url: http://your-host:11434`}
          </code>
        </pre>
      </div>

      <h2>Generate Embeddings</h2>
      <p>
        With Ollama running and both models pulled, generate embeddings for
        your indexed codebase:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ctx embed`}
          </code>
        </pre>
      </div>
      <p>
        This processes all indexed entities through the{' '}
        <code>nomic-embed-text</code> model and stores the resulting vectors
        for semantic search.
      </p>

      <h2>Generate Summaries</h2>
      <p>
        Optionally, generate AI summaries for your code entities to improve
        search quality:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ctx summarize`}
          </code>
        </pre>
      </div>
      <p>
        This sends each entity to the <code>qwen3:0.6b</code> model and
        stores a concise summary alongside the entity.
      </p>

      <h2>Troubleshooting</h2>

      <h3>Ollama Is Not Running</h3>
      <p>
        If ctx-sys reports that it cannot connect to Ollama, verify the server
        is reachable:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`curl http://localhost:11434/api/tags`}
          </code>
        </pre>
      </div>
      <p>
        If this returns an error or times out, start Ollama with{' '}
        <code>ollama serve</code> and try again.
      </p>

      <h3>Model Not Found</h3>
      <p>
        If you see an error about a missing model, pull it explicitly:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`ollama pull nomic-embed-text
ollama pull qwen3:0.6b`}
          </code>
        </pre>
      </div>

      <h3>Slow Performance</h3>
      <p>
        Embedding and summarization speed depends on your hardware:
      </p>
      <ul>
        <li>
          <strong>GPU acceleration</strong> is significantly faster. Ollama
          automatically uses your GPU if a compatible one is detected (NVIDIA
          CUDA or Apple Metal).
        </li>
        <li>
          <strong>CPU-only</strong> machines will be slower but still
          functional. The <code>qwen3:0.6b</code> model was chosen
          specifically for its small size to keep CPU inference reasonable.
        </li>
        <li>
          <strong>Large codebases</strong> may take several minutes to embed on
          first run. Subsequent runs are incremental and only process changed
          entities.
        </li>
      </ul>

      <h2>Alternative: Using OpenAI</h2>
      <p>
        If you prefer cloud-based embeddings instead of local ones, ctx-sys
        also supports the OpenAI API. Set the <code>OPENAI_API_KEY</code>{' '}
        environment variable and ctx-sys will use OpenAI&apos;s embedding
        model instead of Ollama:
      </p>
      <div className="not-prose rounded-xl bg-slate-800 p-5 overflow-x-auto my-4">
        <pre className="m-0 p-0 bg-transparent border-0">
          <code className="text-sm text-slate-50 font-mono">
{`export OPENAI_API_KEY=sk-your-key-here
ctx embed`}
          </code>
        </pre>
      </div>
      <p>
        Note that using OpenAI sends your code to OpenAI&apos;s servers for
        processing. If privacy is a concern, Ollama is the recommended option.
      </p>

      <h2>Next Steps</h2>
      <ul>
        <li>
          <Link href="/docs/claude-desktop">Claude Desktop Integration</Link>{' '}
          &mdash; Connect ctx-sys to Claude Desktop as an MCP server
        </li>
        <li>
          <Link href="/docs/cursor">Cursor IDE Integration</Link> &mdash;
          Use ctx-sys inside Cursor
        </li>
        <li>
          <Link href="/docs/configuration">Configuration</Link> &mdash;
          Full configuration reference including Ollama settings
        </li>
      </ul>
    </>
  );
}
