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
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Menu
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-10 lg:gap-14 py-10 lg:py-14">
          {/* Sidebar */}
          <aside className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-56 flex-shrink-0`}>
            <nav className="sticky top-32 space-y-8">
              {sections.map((section) => (
                <div key={section.title}>
                  <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                    {section.title}
                  </h4>
                  <ul className="space-y-0.5">
                    {section.links.map((link) => {
                      const active = pathname === link.href;
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`block px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                              active
                                ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 font-medium'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
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
          <main className="flex-1 min-w-0 max-w-3xl">
            <div className="prose prose-slate dark:prose-invert max-w-none
              prose-headings:scroll-mt-28
              prose-h1:text-4xl prose-h1:font-extrabold prose-h1:tracking-tight prose-h1:mb-2
              prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight prose-h2:border-b prose-h2:border-slate-200/70 prose-h2:dark:border-slate-700/70 prose-h2:pb-3 prose-h2:mt-14 prose-h2:mb-4
              prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-10 prose-h3:mb-3
              prose-p:leading-7 prose-p:text-slate-600 prose-p:dark:text-slate-300
              prose-code:before:content-none prose-code:after:content-none
              prose-code:bg-slate-100 prose-code:dark:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-normal
              prose-pre:bg-slate-800 prose-pre:dark:bg-slate-800/50 prose-pre:border prose-pre:border-slate-700
              prose-a:text-cyan-600 prose-a:dark:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-900 prose-strong:dark:text-white
              prose-li:text-slate-600 prose-li:dark:text-slate-300 prose-li:leading-7
              prose-ul:my-4 prose-ol:my-4
              prose-table:text-sm
            ">
              {children}
            </div>

            {/* Previous / Next navigation */}
            {(prev || next) && (
              <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                {prev ? (
                  <Link href={prev.href} className="group flex flex-col gap-1 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 dark:hover:border-cyan-500/40 transition-colors">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Previous</span>
                    <span className="text-sm text-cyan-600 dark:text-cyan-400 font-medium group-hover:underline flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      {prev.label}
                    </span>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link href={next.href} className="group flex flex-col gap-1 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 dark:hover:border-cyan-500/40 transition-colors text-right">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Next</span>
                    <span className="text-sm text-cyan-600 dark:text-cyan-400 font-medium group-hover:underline flex items-center gap-1 justify-end">
                      {next.label}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </span>
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
