import Link from 'next/link';

function DocCard({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 hover:border-cyan-500/50 transition-colors">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-0 mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        {description}
      </p>
      <ul className="space-y-2 list-none pl-0 mb-0">
        {links.map((link) => (
          <li key={link.href} className="pl-0">
            <Link
              href={link.href}
              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-sm font-medium no-underline hover:underline flex items-center gap-1.5"
            >
              <span aria-hidden="true">&rarr;</span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DocsPage() {
  return (
    <>
      {/* Header */}
      <h1>Documentation</h1>
      <p className="lead text-lg text-slate-600 dark:text-slate-300">
        Everything you need to get started with ctx-sys and integrate it into
        your development workflow.
      </p>

      {/* Quick Start Guide */}
      <h2>Quick Start</h2>
      <p>
        Get up and running in under 5 minutes.
      </p>

      <div className="not-prose rounded-2xl bg-slate-800 p-6 overflow-x-auto">
        <div className="font-mono text-sm space-y-4">
          {/* Step 1 */}
          <div>
            <p className="text-slate-400 mb-1">
              # 1. Install ctx-sys and pull the embedding model
            </p>
            <p className="text-green-400">npm install -g ctx-sys</p>
            <p className="text-green-400">ollama pull mxbai-embed-large:latest</p>
          </div>

          {/* Step 2 */}
          <div>
            <p className="text-slate-400 mb-1">
              # 2. Initialize and index your project (includes docs + embeddings)
            </p>
            <p className="text-green-400">cd your-project</p>
            <p className="text-green-400">ctx-sys init &amp;&amp; ctx-sys index</p>
          </div>

          {/* Step 3 */}
          <div>
            <p className="text-slate-400 mb-1">
              # 3. Search your codebase
            </p>
            <p className="text-green-400">ctx-sys search &quot;how does authentication work&quot;</p>
          </div>

          {/* Step 4 */}
          <div>
            <p className="text-slate-400 mb-1">
              # 4. Start the MCP server for your AI assistant
            </p>
            <p className="text-green-400">ctx-sys serve</p>
          </div>
        </div>
      </div>

      <p>
        See the{' '}
        <Link href="/docs/claude-desktop">Claude Desktop guide</Link> for
        detailed instructions on connecting ctx-sys as an MCP server.
      </p>

      {/* Documentation Sections */}
      <h2>Browse Documentation</h2>

      <div className="not-prose grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <DocCard
          title="Getting Started"
          description="Install ctx-sys, initialize your first project, and run your first query."
          links={[
            { label: 'Quick Start', href: '/docs/quickstart' },
            { label: 'Installation', href: '/docs/installation' },
          ]}
        />
        <DocCard
          title="Integration Guides"
          description="Connect ctx-sys with your favorite AI tools and editors."
          links={[
            { label: 'Claude Desktop', href: '/docs/claude-desktop' },
            { label: 'Cursor IDE', href: '/docs/cursor' },
            { label: 'Ollama Setup', href: '/docs/ollama' },
          ]}
        />
        <DocCard
          title="Reference"
          description="Complete reference for CLI commands, MCP tools, and configuration."
          links={[
            { label: 'CLI Commands', href: '/docs/cli' },
            { label: 'MCP Tools', href: '/docs/mcp-tools' },
            { label: 'Configuration', href: '/docs/configuration' },
          ]}
        />
        <DocCard
          title="Concepts"
          description="Understand how ctx-sys works under the hood."
          links={[
            { label: 'How It Works', href: '/docs/how-it-works' },
          ]}
        />
        <DocCard
          title="Help"
          description="Troubleshooting guides for common issues and edge cases."
          links={[
            { label: 'Troubleshooting', href: '/docs/troubleshooting' },
          ]}
        />
      </div>

      {/* Additional Resources */}
      <h2>Additional Resources</h2>

      <div className="not-prose grid gap-4 sm:grid-cols-2">
        <Link
          href="/whitepaper.pdf"
          className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors no-underline"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Whitepaper
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Research whitepaper and system design documentation
            </p>
          </div>
        </Link>

        <Link
          href="https://github.com/davidfranz/ctx-sys"
          className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors no-underline"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-cyan-600 dark:text-cyan-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              GitHub
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Source code, issues, and contributions
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}
