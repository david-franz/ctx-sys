export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Stop Repeating Yourself
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              ctx-sys is your intelligent context librarian. It gives AI coding assistants
              exactly the context they need - nothing more, nothing less.
              Save tokens, save money, get better results.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <a
                href="/signup"
                className="rounded-md bg-indigo-600 px-6 py-3 text-lg font-semibold text-white hover:bg-indigo-500"
              >
                Get Started Free
              </a>
              <a
                href="/docs"
                className="text-lg font-semibold text-gray-900 hover:text-indigo-600"
              >
                Read the docs &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-indigo-600 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 text-center">
            <div>
              <p className="text-4xl font-bold text-white">95%</p>
              <p className="mt-2 text-indigo-200">Average token savings</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white">$2.85</p>
              <p className="mt-2 text-indigo-200">Saved per query (vs. full context)</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-white">2 min</p>
              <p className="mt-2 text-indigo-200">Time to set up</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              Intelligent Context for AI Coding
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Everything you need to give AI assistants the right context.
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <FeatureCard
              title="Graph RAG"
              description="Multi-strategy retrieval using knowledge graphs, semantic search, and keyword matching for comprehensive context."
            />
            <FeatureCard
              title="Decision Tracking"
              description="Automatically capture architectural decisions from conversations and surface them when relevant."
            />
            <FeatureCard
              title="Session Memory"
              description="Maintain context across conversations. Never lose track of what was discussed or decided."
            />
            <FeatureCard
              title="Git Integration"
              description="Automatic indexing on commits. Impact analysis for code reviews. Always up-to-date context."
            />
            <FeatureCard
              title="Token Analytics"
              description="Track your savings in real-time. See exactly how much ctx-sys saves you on every query."
            />
            <FeatureCard
              title="MCP Protocol"
              description="Native integration with Claude Desktop via Model Context Protocol. Zero friction setup."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              How It Works
            </h2>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <StepCard
              step="1"
              title="Install & Index"
              description="npm install -g ctx-sys && ctx init. Your codebase is indexed in minutes."
            />
            <StepCard
              step="2"
              title="Connect"
              description="ctx connect claude adds ctx-sys to your Claude Desktop config automatically."
            />
            <StepCard
              step="3"
              title="Ask Away"
              description="Start asking questions. ctx-sys provides the perfect context for every query."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-600 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">
            Ready to stop wasting tokens?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-200">
            Join thousands of developers using ctx-sys to get better AI assistance
            while spending less.
          </p>
          <div className="mt-8">
            <a
              href="/signup"
              className="rounded-md bg-white px-6 py-3 text-lg font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              Start Free Trial
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
        {step}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-600">{description}</p>
    </div>
  );
}
