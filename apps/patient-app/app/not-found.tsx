// apps/patient-app/app/not-found.tsx
import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-6">
      <h1 className="text-4xl font-bold text-red-600">404</h1>
      <h2 className="text-2xl font-semibold">Page Not Found</h2>
      <p className="text-gray-600 max-w-md">
        The page you're looking for doesn't exist or may have been moved. Contact Ambulant+ Support at support@cloventechnology.com if in need of any assistance.
      </p>
      <Link
        href="/"
        className="inline-block mt-4 px-4 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
      >
        Back to Home
      </Link>
    </main>
  );
}
