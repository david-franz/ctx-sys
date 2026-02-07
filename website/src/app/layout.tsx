'use client';

import './globals.css';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [darkMode, setDarkMode] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(saved ? saved === 'true' : prefersDark);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  return (
    <html lang="en" className={darkMode ? 'dark' : ''}>
      <head>
        <title>ctx-sys - Intelligent Context Management for AI Coding</title>
        <meta name="description" content="Stop repeating yourself. ctx-sys gives AI assistants the perfect context - save tokens, save money, get better results." />
        <link rel="icon" href="/logo.png" />
      </head>
      <body className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-20 justify-between items-center">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-3">
                <img src="/logo.png" alt="ctx-sys" className="h-12 w-auto" />
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex md:items-center md:gap-8">
                <Link href="/docs" className="text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium">
                  Docs
                </Link>
                <Link href="/whitepaper.pdf" className="text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium">
                  Whitepaper
                </Link>
                <a href="#" target="_blank" rel="noopener noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium">
                  GitHub
                </a>

                {/* Dark Mode Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>

                <Link
                  href="/docs/quickstart"
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25"
                >
                  Get Started
                </Link>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col gap-4">
                  <Link href="/docs" className="text-slate-600 dark:text-slate-300 font-medium">Docs</Link>
                  <Link href="/whitepaper.pdf" className="text-slate-600 dark:text-slate-300 font-medium">Whitepaper</Link>
                  <a href="#" className="text-slate-600 dark:text-slate-300 font-medium">GitHub</a>
                  <Link href="/docs/quickstart" className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white text-center">Get Started</Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Main Content */}
        {children}

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Product</h3>
                <ul className="mt-4 space-y-3">
                  <li><Link href="/docs" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">Documentation</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Resources</h3>
                <ul className="mt-4 space-y-3">
                  <li><Link href="/docs/quickstart" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">Guides</Link></li>
                  <li><Link href="/whitepaper.pdf" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">Whitepaper</Link></li>
                  <li><Link href="/docs/cli" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">API Reference</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Open Source</h3>
                <ul className="mt-4 space-y-3">
                  <li><a href="#" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">GitHub</a></li>
                  <li><a href="#" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">Issues</a></li>
                  <li><a href="#" className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400">Discussions</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="ctx-sys" className="h-8 w-auto" />
                <span className="text-sm text-slate-500 dark:text-slate-400">&copy; 2026 ctx-sys. MIT License.</span>
              </div>
              <div className="flex items-center gap-4">
                <a href="#" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
