import { Suspense } from 'react';
import OrdersClient from './OrdersClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-gray-600">Loading orders...</main>}>
      <OrdersClient />
    </Suspense>
  );
}
