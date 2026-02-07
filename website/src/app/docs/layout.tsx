'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const sections = [
  {
    title: 'Getting Started',
    links: [
      { href: '/docs', label: 'Overview' },
      { href: '/docs/quickstart', label: 'Quick Start' },
      { href: '/docs/installation', label: 'Installation' },
    ],
  },
  {
    title: 'Integration Guides',
    links: [
      { href: '/docs/claude-desktop', label: 'Claude Desktop' },
      { href: '/docs/cursor', label: 'Cursor IDE' },
      { href: '/docs/ollama', label: 'Ollama Setup' },
    ],
  },
  {
    title: 'Concepts',
    links: [
      { href: '/docs/how-it-works', label: 'How It Works' },
      { href: '/docs/configuration', label: 'Configuration' },
    ],
  },
  {
    title: 'Reference',
    links: [
      { href: '/docs/cli', label: 'CLI Commands' },
      { href: '/docs/mcp-tools', label: 'MCP Tools' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/docs/troubleshooting', label: 'Troubleshooting' },
    ],
  },
];

const allLinks = sections.flatMap(s => s.links);

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentIndex = allLinks.findIndex(l => l.href === pathname);
  const prev = currentIndex > 0 ? allLinks[currentIndex - 1] : null;
  const next = currentIndex < allLinks.length - 1 ? allLinks[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Mobile sidebar toggle */}
      <div className="sticky top-20 z-40 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg px-4 py-3 lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Documentation Menu
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-12 py-8 lg:py-12">
          {/* Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0`}>
            <nav className="sticky top-32 space-y-6">
              {sections.map((section) => (
                <div key={section.title}>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                    {section.title}
                  </h4>
                  <ul className="space-y-1">
                    {section.links.map((link) => {
                      const active = pathname === link.href;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              active
                                ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 font-medium'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {link.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <div className="prose prose-slate dark:prose-invert max-w-none
              prose-headings:scroll-mt-28
              prose-h1:text-3xl prose-h1:font-bold
              prose-h2:text-2xl prose-h2:font-semibold prose-h2:border-b prose-h2:border-slate-200 prose-h2:dark:border-slate-700 prose-h2:pb-2 prose-h2:mt-10
              prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-8
              prose-code:before:content-none prose-code:after:content-none
              prose-code:bg-slate-100 prose-code:dark:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal
              prose-pre:bg-slate-800 prose-pre:dark:bg-slate-800/50 prose-pre:border prose-pre:border-slate-700
              prose-a:text-cyan-600 prose-a:dark:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-900 prose-strong:dark:text-white
              prose-li:text-slate-600 prose-li:dark:text-slate-300
            ">
              {children}
            </div>

            {/* Previous / Next navigation */}
            {(prev || next) && (
              <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                {prev ? (
                  <Link href={prev.href} className="group flex flex-col">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Previous</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-medium group-hover:underline">{prev.label}</span>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link href={next.href} className="group flex flex-col text-right">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Next</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-medium group-hover:underline">{next.label}</span>
                  </Link>
                ) : <div />}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
