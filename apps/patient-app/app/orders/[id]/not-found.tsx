// apps/patient-app/app/orders/[id]/not-found.tsx
import Link from 'next/link';

export default function NotFoundOrder() {
  return (
    <main className="max-w-3xl mx-auto p-10">
      <div className="p-6 border rounded-lg bg-white">
        <h1 className="text-xl font-bold mb-2">Order not found</h1>
        <p className="text-sm text-gray-600 mb-4">
          We couldn’t find that order. It may have been removed or the link is incorrect.
        </p>
        <Link href="/orders" className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
          Back to Orders
        </Link>
      </div>
    </main>
  );
}
