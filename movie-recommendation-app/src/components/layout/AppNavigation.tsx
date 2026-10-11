'use client';

import Link from 'next/link';
import { useState } from 'react';
import DiagnosticsControls from './DiagnosticsControls';

const links = [
  { href: '/', label: 'Watchlist' },
  { href: '/movie-explorer', label: 'Movie Explorer' },
  { href: '/recommendations', label: 'Movie Recommendations' },
  { href: '/formula', label: 'Taste Formula' },
];

export default function AppNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-outline"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="app-navigation-menu"
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">{open ? '×' : '☰'}</span>
        <span className="sr-only">Menu</span>
      </button>
      {open && (
        <nav
          id="app-navigation-menu"
          aria-label="Main navigation"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {link.label}
            </Link>
          ))}
          <DiagnosticsControls />
        </nav>
      )}
    </div>
  );
}
