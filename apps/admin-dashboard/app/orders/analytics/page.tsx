// apps/admin-dashboard/app/orders/analytics/page.tsx
import { Suspense } from 'react';
import OrdersAnalyticsClient from './OrdersAnalyticsClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function OrdersAnalyticsFallback() {
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>
    </main>
  );
}

export default function OrdersAnalyticsPage() {
  return (
    <Suspense fallback={<OrdersAnalyticsFallback />}>
      <OrdersAnalyticsClient />
    </Suspense>
  );
}