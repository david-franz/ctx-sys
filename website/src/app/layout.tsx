import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ctx-sys - Intelligent Context Management',
  description: 'Stop repeating yourself. Let ctx-sys provide the perfect context for AI-assisted coding.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">
        <nav className="border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between items-center">
              <div className="flex items-center">
                <a href="/" className="text-xl font-bold text-gray-900">
                  ctx-sys
                </a>
              </div>
              <div className="hidden md:flex md:items-center md:space-x-6">
                <a href="/docs" className="text-gray-600 hover:text-gray-900">
                  Docs
                </a>
                <a href="/pricing" className="text-gray-600 hover:text-gray-900">
                  Pricing
                </a>
                <a href="/login" className="text-gray-600 hover:text-gray-900">
                  Login
                </a>
                <a
                  href="/signup"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
        </nav>
        {children}
        <footer className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Product</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="/docs" className="text-gray-600 hover:text-gray-900">Documentation</a></li>
                  <li><a href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</a></li>
                  <li><a href="/changelog" className="text-gray-600 hover:text-gray-900">Changelog</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Resources</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="/guides" className="text-gray-600 hover:text-gray-900">Guides</a></li>
                  <li><a href="/api" className="text-gray-600 hover:text-gray-900">API Reference</a></li>
                  <li><a href="/support" className="text-gray-600 hover:text-gray-900">Support</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Company</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="/about" className="text-gray-600 hover:text-gray-900">About</a></li>
                  <li><a href="/blog" className="text-gray-600 hover:text-gray-900">Blog</a></li>
                  <li><a href="/careers" className="text-gray-600 hover:text-gray-900">Careers</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Legal</h3>
                <ul className="mt-4 space-y-2">
                  <li><a href="/privacy" className="text-gray-600 hover:text-gray-900">Privacy</a></li>
                  <li><a href="/terms" className="text-gray-600 hover:text-gray-900">Terms</a></li>
                </ul>
              </div>
            </div>
            <div className="mt-8 border-t border-gray-200 pt-8">
              <p className="text-sm text-gray-500">&copy; 2024 ctx-sys. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
