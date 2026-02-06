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
              <span className="mr-2">v0.1.0</span>
              <span className="text-cyan-500/50">|</span>
              <span className="ml-2">1271 passing tests</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl bg-clip-text">
              Stop Repeating
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">Yourself</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-xl text-slate-300 leading-relaxed">
              ctx-sys is your intelligent context librarian for AI coding assistants.
              It gives Claude, Copilot, and other AI tools exactly the context they need -
              <span className="text-cyan-400 font-medium"> saving 95% on tokens</span> while getting better results.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/docs"
                className="rounded-xl bg-cyan-500 hover:bg-cyan-600 px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/30 transition-all hover:shadow-cyan-500/40 hover:scale-105"
              >
                Get Started Free
              </Link>
              <Link
                href="https://github.com/davidfranz/ctx-sys"
                className="rounded-xl border border-slate-600 hover:border-slate-500 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-slate-800"
              >
                View on GitHub
              </Link>
            </div>
          </div>
        </div>

        {/* Code preview */}
        <div className="relative mx-auto max-w-4xl px-4 pb-20">
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="ml-4 text-sm text-slate-400">Terminal</span>
            </div>
            <div className="p-6 font-mono text-sm">
              <p className="text-slate-400"># Install ctx-sys</p>
              <p className="text-green-400">$ npm install -g ctx-sys</p>
              <p className="text-slate-400 mt-4"># Initialize in your project</p>
              <p className="text-green-400">$ ctx-sys init</p>
              <p className="text-cyan-400 mt-1">✓ Created .ctx-sys/config.yaml</p>
              <p className="text-cyan-400">✓ Indexed 1,234 files (45 seconds)</p>
              <p className="text-cyan-400">✓ Generated 892 entity summaries</p>
              <p className="text-slate-400 mt-4"># Connect to Claude Desktop</p>
              <p className="text-green-400">$ ctx-sys connect claude</p>
              <p className="text-cyan-400 mt-1">✓ Added to Claude Desktop MCP config</p>
              <p className="text-white mt-4">Ready! ctx-sys is now providing context to Claude.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-900 py-16 border-y border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 text-center">
            <Stat value="95%" label="Token Savings" />
            <Stat value="1271" label="Passing Tests" />
            <Stat value="9" label="Development Phases" />
            <Stat value="MIT" label="Open Source" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-slate-900">
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
              icon="🔍"
              title="Graph RAG"
              description="Multi-strategy retrieval combining knowledge graphs, semantic embeddings, and keyword search with Reciprocal Rank Fusion."
            />
            <FeatureCard
              icon="💬"
              title="Conversation Memory"
              description="Track decisions across sessions. Automatically extract and surface architectural choices when they become relevant."
            />
            <FeatureCard
              icon="🧠"
              title="Agent Memory"
              description="Hot/cold memory tiering, checkpointing for resumable tasks, and reflection storage for learning from experience."
            />
            <FeatureCard
              icon="📊"
              title="Token Analytics"
              description="Real-time dashboards showing token savings, cost reduction, and ROI metrics for every query."
            />
            <FeatureCard
              icon="🔗"
              title="Git Integration"
              description="Automatic indexing on commits. Impact analysis shows which entities and decisions are affected by changes."
            />
            <FeatureCard
              icon="🔌"
              title="MCP Protocol"
              description="Native integration with Claude Desktop, Cursor, and any MCP-compatible AI assistant."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-slate-50 dark:bg-slate-800/50">
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
              description="ctx-sys parses your code with tree-sitter, extracts entities and relationships, and generates embeddings for semantic search."
            />
            <Step
              number="2"
              title="Connect Your AI"
              description="Add ctx-sys to your Claude Desktop or Cursor config. It exposes MCP tools that your AI can call automatically."
            />
            <Step
              number="3"
              title="Ask Questions"
              description="When you ask about your code, ctx-sys retrieves exactly the right context - functions, docs, past decisions - and provides it to the AI."
            />
          </div>
        </div>
      </section>

      {/* Thesis Section */}
      <section className="py-24 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-sm font-semibold text-cyan-500 uppercase tracking-wider">Research</h2>
          <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-white">
            Read the Thesis
          </p>
          <p className="mt-4 text-xl text-slate-600 dark:text-slate-300">
            ctx-sys is built on solid research foundations. The complete architecture, algorithms,
            and evaluation are documented in the accompanying thesis paper.
          </p>
          <div className="mt-8">
            <Link
              href="/thesis.pdf"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 px-6 py-3 text-lg font-semibold text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-cyan-500 to-teal-500">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-4xl font-bold text-white">
            Ready to stop wasting tokens?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-xl text-cyan-100">
            ctx-sys is open source and free to use. Get started in under 2 minutes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/docs"
              className="rounded-xl bg-white hover:bg-slate-100 px-8 py-4 text-lg font-semibold text-cyan-600 shadow-xl transition-all hover:scale-105"
            >
              Read the Docs
            </Link>
            <Link
              href="https://github.com/davidfranz/ctx-sys"
              className="rounded-xl border-2 border-white/30 hover:border-white/50 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10"
            >
              Star on GitHub
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

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 transition-all">
      <div className="text-4xl mb-4">{icon}</div>
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
