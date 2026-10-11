import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/use-toast';
import AppNavigation from '@/components/layout/AppNavigation';
import ModelStatusBanner from '@/components/layout/ModelStatusBanner';

// Import font
const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Personalized Movie Recommendation System',
  description: 'Gen AI-powered movie recommendation app with evolving taste formula',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} style={{ minHeight: '100vh' }}>
        <ToastProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path className="stroke-2" strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6-6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v2m6 6v10a2 2 0 002-2h-2v-4h2a2 2 0 002-2V7a2 2 0 00-2-2h-2v14zm-4-14a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Movie Recommender
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <AppNavigation />
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300">
                  U
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Welcome!
                </span>
              </div>
            </div>
          </header>

          <ModelStatusBanner />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>

          <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            <p>Personalized Movie Recommendation System • Powered by Gen AI</p>
          </footer>
        </div>
        </ToastProvider>
      </body>
    </html>
  );
}