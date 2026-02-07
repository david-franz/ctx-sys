import Link from 'next/link';

export default function DocsPage() {
  return (
    <main className="py-16 bg-white dark:bg-slate-900 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            Documentation
          </h1>
          <p className="mt-4 text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Everything you need to get started with ctx-sys and integrate it into your workflow.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Quick Start</h2>
          <div className="rounded-2xl bg-slate-800 p-6 overflow-hidden">
            <div className="font-mono text-sm space-y-2">
              <p className="text-slate-400"># Install ctx-sys globally</p>
              <p className="text-green-400">npm install -g ctx-sys</p>
              <p className="text-slate-400 mt-4"># Navigate to your project and initialize</p>
              <p className="text-green-400">cd your-project</p>
              <p className="text-green-400">ctx-sys init</p>
              <p className="text-slate-400 mt-4"># Start the MCP server for Claude Desktop</p>
              <p className="text-green-400">ctx-sys serve</p>
            </div>
          </div>
        </section>

        {/* Documentation Sections */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <DocCard
            title="Getting Started"
            description="Installation, initialization, and basic configuration."
            links={[
              { label: 'Installation', href: '/docs/getting-started/installation' },
              { label: 'Quick Start', href: '/docs/getting-started/quickstart' },
              { label: 'Configuration', href: '/docs/getting-started/configuration' },
            ]}
          />
          <DocCard
            title="Integration Guides"
            description="Connect ctx-sys with your favorite AI tools."
            links={[
              { label: 'Claude Desktop', href: '/docs/guides/claude-integration' },
              { label: 'Cursor IDE', href: '/docs/guides/cursor-integration' },
              { label: 'VS Code', href: '/docs/guides/vscode-integration' },
            ]}
          />
          <DocCard
            title="Core Concepts"
            description="Understand how ctx-sys works under the hood."
            links={[
              { label: 'Graph RAG', href: '/docs/concepts/graph-rag' },
              { label: 'Entity Model', href: '/docs/concepts/entities' },
              { label: 'Retrieval Strategies', href: '/docs/concepts/retrieval' },
            ]}
          />
          <DocCard
            title="API Reference"
            description="Complete reference for MCP tools and CLI commands."
            links={[
              { label: 'MCP Tools', href: '/docs/api/mcp-tools' },
              { label: 'CLI Commands', href: '/docs/api/cli' },
              { label: 'Configuration', href: '/docs/api/configuration' },
            ]}
          />
          <DocCard
            title="Advanced Topics"
            description="Deep dives into advanced features."
            links={[
              { label: 'Agent Memory', href: '/docs/advanced/agent-memory' },
              { label: 'Token Analytics', href: '/docs/advanced/analytics' },
              { label: 'Git Hooks', href: '/docs/advanced/git-hooks' },
            ]}
          />
          <DocCard
            title="Troubleshooting"
            description="Common issues and how to resolve them."
            links={[
              { label: 'Common Issues', href: '/docs/troubleshooting/common-issues' },
              { label: 'FAQ', href: '/docs/troubleshooting/faq' },
              { label: 'Getting Help', href: '/docs/troubleshooting/support' },
            ]}
          />
        </div>

        {/* Additional Resources */}
        <section className="mt-16 p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Additional Resources</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/whitepaper.pdf" className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Whitepaper</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Complete research documentation</p>
              </div>
            </Link>
            <Link href="https://github.com/davidfranz/ctx-sys" className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors">
              <span className="text-2xl">💻</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">GitHub Repository</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Source code and issues</p>
              </div>
            </Link>
            <Link href="https://github.com/davidfranz/ctx-sys/discussions" className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors">
              <span className="text-2xl">💬</span>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Discussions</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Community Q&A</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function DocCard({ title, description, links }: { title: string; description: string; links: { label: string; href: string }[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 hover:border-cyan-500/50 transition-colors">
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{description}</p>
      <ul className="mt-4 space-y-2">
        {links.map((link, index) => (
          <li key={index}>
            <Link href={link.href} className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1">
              <span>→</span>
              <span>{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
