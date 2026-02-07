import Link from 'next/link';

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        <div className="relative mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8 lg:py-40">
          <div className="text-center">
            <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400 mb-8">
              <span className="mr-2">Open Source</span>
              <span className="text-cyan-500/50">|</span>
              <span className="ml-2">MIT Licensed</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">
              Intelligent Context
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">for AI Coding</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-xl text-slate-300 leading-relaxed">
              ctx-sys gives AI assistants deep understanding of your codebase using
              <span className="text-cyan-400 font-medium"> graph-based code intelligence</span>,
              <span className="text-cyan-400 font-medium"> semantic search</span>, and
              <span className="text-cyan-400 font-medium"> conversation memory</span>.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/docs/quickstart"
                className="rounded-xl bg-cyan-500 hover:bg-cyan-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/30 transition-all hover:shadow-cyan-500/40 hover:scale-105"
              >
                Get Started
              </Link>
              <Link
                href="#"
                className="rounded-xl border border-slate-600 hover:border-slate-500 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-slate-800"
              >
                View on GitHub
              </Link>
            </div>
          </div>
        </div>

        {/* Terminal Preview */}
        <div className="relative mx-auto max-w-4xl px-4 pb-20">
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="ml-4 text-sm text-slate-400">Terminal</span>
            </div>
            <div className="p-6 font-mono text-sm">
              <p className="text-slate-400"># Install ctx-sys (also available as &apos;ctx&apos;)</p>
              <p className="text-green-400">$ npm install -g ctx-sys</p>
              <p className="text-slate-400 mt-4"># Initialize and index your codebase</p>
              <p className="text-green-400">$ ctx init &amp;&amp; ctx index --embed</p>
              <p className="text-cyan-400 mt-1">&#10003; Created project &quot;my-app&quot;</p>
              <p className="text-cyan-400">&#10003; Indexed 1,247 entities across 5 languages</p>
              <p className="text-cyan-400">&#10003; Generated embeddings with nomic-embed-text</p>
              <p className="text-slate-400 mt-4"># Search your codebase</p>
              <p className="text-green-400">$ ctx search &quot;authentication middleware&quot;</p>
              <p className="text-cyan-400 mt-1">&#10003; Found 8 relevant results (hybrid RAG)</p>
              <p className="text-slate-400 mt-4"># Start MCP server for AI assistants</p>
              <p className="text-green-400">$ ctx serve</p>
              <p className="text-cyan-400 mt-1">&#10003; MCP server running on stdio</p>
              <p className="text-white mt-1">Ready! 33 tools available for AI assistants.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-900 py-16 border-y border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            <Stat value="33" label="CLI Commands" />
            <Stat value="33" label="MCP Tools" />
            <Stat value="5" label="Languages" />
            <Stat value="MIT" label="Open Source" />
          </div>
        </div>
      </section>

      {/* Why ctx-sys - Before/After */}
      <section className="py-24 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">Why ctx-sys</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
              Before and After
            </p>
            <p className="mt-4 text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              See how ctx-sys transforms the AI coding experience.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Without ctx-sys */}
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8">
              <h3 className="text-xl font-semibold text-red-400 mb-6">Without ctx-sys</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-red-400 font-bold mt-0.5">&#10005;</span>
                  <span>Manually copy-pasting code snippets into every prompt</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-red-400 font-bold mt-0.5">&#10005;</span>
                  <span>Re-explaining architectural decisions every session</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-red-400 font-bold mt-0.5">&#10005;</span>
                  <span>AI suggestions that conflict with existing patterns</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-red-400 font-bold mt-0.5">&#10005;</span>
                  <span>Wasted tokens on irrelevant or redundant context</span>
                </li>
              </ul>
            </div>
            {/* With ctx-sys */}
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-8">
              <h3 className="text-xl font-semibold text-cyan-400 mb-6">With ctx-sys</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-cyan-400 font-bold mt-0.5">&#10003;</span>
                  <span>Automatic retrieval of relevant code, docs, and decisions</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-cyan-400 font-bold mt-0.5">&#10003;</span>
                  <span>Persistent decisions that survive across sessions</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-cyan-400 font-bold mt-0.5">&#10003;</span>
                  <span>Graph-aware context that understands code relationships</span>
                </li>
                <li className="flex items-start gap-3 text-slate-600 dark:text-slate-300">
                  <span className="text-cyan-400 font-bold mt-0.5">&#10003;</span>
                  <span>Precise context delivery with hybrid RAG search</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">Features</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
              Everything for Intelligent Context
            </p>
            <p className="mt-4 text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              A complete toolkit for giving AI assistants the right context at the right time.
            </p>
          </div>
          <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Hybrid RAG Search"
              description="Multi-strategy retrieval combining keyword search (FTS5+BM25), semantic embeddings, and graph traversal with Reciprocal Rank Fusion."
            />
            <FeatureCard
              title="Code Intelligence"
              description="Tree-sitter parsing extracts functions, classes, and relationships across TypeScript, Python, Rust, Go, and Java codebases."
            />
            <FeatureCard
              title="Conversation Memory"
              description="Track decisions across sessions. Automatically extract and surface architectural choices when they become relevant again."
            />
            <FeatureCard
              title="Agent Memory"
              description="Hot/cold memory tiering, checkpointing for resumable tasks, and reflection storage for learning from experience."
            />
            <FeatureCard
              title="LLM Summarization"
              description="Automatic AI-generated summaries for code entities, providing natural language descriptions alongside raw source code."
            />
            <FeatureCard
              title="MCP Protocol"
              description="Native Model Context Protocol integration exposes 33 tools that AI assistants can call automatically for context retrieval."
            />
            <FeatureCard
              title="Local-First"
              description="All data stays on your machine. SQLite-backed storage with no cloud dependencies. Your code never leaves your environment."
            />
            <FeatureCard
              title="Git Integration"
              description="Automatic indexing on commits via git hooks. Impact analysis shows which entities and decisions are affected by changes."
            />
            <FeatureCard
              title="Analytics"
              description="Dashboard with query performance metrics, entity usage tracking, and context retrieval statistics to optimize your workflow."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">How It Works</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
              Three Steps to Better AI Context
            </p>
          </div>
          <div className="mt-20 grid grid-cols-1 gap-12 md:grid-cols-3">
            <Step
              number="1"
              title="Index Your Codebase"
              description="Run ctx init && ctx index --embed to parse your code with tree-sitter, extract entities and relationships, and generate semantic embeddings."
            />
            <Step
              number="2"
              title="Connect Your AI"
              description="Run ctx serve and add it to your Claude Desktop or Cursor config. It exposes 33 MCP tools that your AI calls automatically."
            />
            <Step
              number="3"
              title="Ask Naturally"
              description="Ask your AI about your code as usual. ctx retrieves exactly the right context - functions, docs, past decisions - and provides it automatically."
            />
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">Architecture</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
              Hybrid RAG Pipeline
            </p>
            <p className="mt-4 text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Three retrieval strategies fused with Reciprocal Rank Fusion (RRF) for superior context retrieval.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <PipelineCard
              title="Keyword Search"
              tech="FTS5 + BM25"
              description="Full-text search with BM25 ranking finds exact matches and known identifiers. Fast and precise for specific lookups."
            />
            <PipelineCard
              title="Semantic Search"
              tech="Ollama + nomic-embed-text"
              description="Vector embeddings capture meaning beyond keywords. Finds conceptually related code even when terminology differs."
            />
            <PipelineCard
              title="Graph Traversal"
              tech="Entity Relationship Graph"
              description="Walks the code graph to find related entities through calls, imports, and implements relationships. Understands structure."
            />
          </div>
          <div className="mt-12 text-center">
            <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-6 py-2 text-sm text-cyan-400">
              Results from all three strategies are combined using Reciprocal Rank Fusion (RRF) for optimal ranking
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-24 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">Integrations</h2>
            <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
              Works With Your AI Tools
            </p>
            <p className="mt-4 text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              ctx-sys integrates with any MCP-compatible AI assistant through the standard protocol.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <IntegrationCard
              title="Claude Desktop"
              description="First-class integration with Claude Desktop. Add ctx-sys to your MCP config and get intelligent context in every conversation."
              href="/docs/claude-desktop"
            />
            <IntegrationCard
              title="Cursor IDE"
              description="Use ctx-sys as an MCP server in Cursor for enhanced code understanding and context-aware AI assistance while you code."
              href="/docs/cursor"
            />
            <IntegrationCard
              title="Any MCP Client"
              description="ctx-sys implements the Model Context Protocol standard. Any MCP-compatible client can connect and use all 33 tools."
              href="/docs/mcp-tools"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-cyan-500 to-teal-500">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-4xl font-bold text-white">
            Ready to give your AI real context?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-xl text-cyan-100">
            ctx-sys is open source and free to use. Get started in under 2 minutes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/docs/quickstart"
              className="rounded-xl bg-white hover:bg-slate-100 px-8 py-4 text-lg font-semibold text-cyan-600 shadow-xl transition-all hover:scale-105"
            >
              Quick Start Guide
            </Link>
            <Link
              href="#"
              className="rounded-xl border-2 border-white/30 hover:border-white/50 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-4xl font-bold text-cyan-400">{value}</p>
      <p className="mt-2 text-slate-400">{label}</p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 transition-all">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500 text-2xl font-bold text-white shadow-lg shadow-cyan-500/30">
        {number}
      </div>
      <h3 className="mt-6 text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
    </div>
  );
}

function PipelineCard({ title, tech, description }: { title: string; tech: string; description: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 transition-all">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm font-medium text-cyan-400">{tech}</p>
      <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
    </div>
  );
}

function IntegrationCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="group block rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 transition-all">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-cyan-400 transition-colors">{title}</h3>
      <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed">{description}</p>
      <p className="mt-4 text-sm font-medium text-cyan-400">View setup guide &rarr;</p>
    </Link>
  );
}
