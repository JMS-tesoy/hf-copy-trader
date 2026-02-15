'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/ThemeContext';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/master', label: 'Masters' },
  { href: '/user', label: 'Users' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 glass">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
              <span className="text-white text-sm font-black">HF</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Copy Trader</h1>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 leading-none">High-Frequency Engine</p>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-1 ml-4">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-sm"
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </div>
    </nav>
  );
}
