import './globals.css'; // 👈 Add this import
import type { ReactNode } from 'react';

export const metadata = {
  title: 'MedReach – Lab & Phlebotomy',
  description: 'Lab marketplace and phlebotomist console for MedReach.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <header className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-semibold">MedReach</h1>
              <p className="text-xs text-gray-500">
                Lab &amp; phlebotomy operations.
              </p>
            </div>
            <nav className="flex gap-2 text-xs">
              <a href="/" className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50">
                Overview
              </a>
              <a href="/phleb" className="px-3 py-1 rounded-full border bg-white hover:bg-gray-50">
                Phleb jobs
              </a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
