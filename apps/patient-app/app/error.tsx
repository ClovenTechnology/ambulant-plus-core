'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optional: log to monitoring service
    console.error('App crashed:', error);
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
      <h1 className="text-3xl font-bold text-red-600">Something went wrong</h1>
      <p className="text-gray-600 max-w-md">
        We hit an unexpected error. You can try again or go back to the home page.
      </p>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-4 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
        >
          Back to Home
        </Link>
      </div>

      {error?.digest && (
        <p className="text-xs text-gray-400">Error ID: {error.digest}</p>
      )}
    </main>
  );
}
