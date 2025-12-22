//apps/admin-dashboard/app/forbidden/page.tsx
export default function Forbidden() {
  return (
    <main className="min-h-[70vh] grid place-items-center px-4">
      <div className="max-w-lg text-center">
        <div className="text-7xl">🚫</div>
        <h1 className="text-2xl font-semibold mt-2">Access denied</h1>
        <p className="text-gray-600 mt-2">
          You don’t have permission to view this page. Contact an admin to grant the required scope.
        </p>
        <a href="/" className="inline-block mt-4 px-4 py-2 rounded bg-black text-white hover:bg-black/90">
          Go to dashboard
        </a>
      </div>
    </main>
  );
}
