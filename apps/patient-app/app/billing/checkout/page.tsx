// file: apps/patient-app/app/billing/checkout/cancel/page.tsx
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import React from 'react';
import { XCircle, ArrowLeft } from 'lucide-react';

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export default function CheckoutCancelPage() {
  const sp = useSearchParams();
  const orderId = sp?.get('orderId') || '';

  return (
    <main
      className={cx(
        'min-h-screen bg-slate-50',
        'bg-[radial-gradient(1000px_circle_at_18%_-12%,rgba(16,185,129,0.18),transparent_58%),radial-gradient(820px_circle_at_102%_0%,rgba(99,102,241,0.16),transparent_55%),radial-gradient(900px_circle_at_55%_105%,rgba(2,132,199,0.12),transparent_52%),linear-gradient(to_bottom,rgba(255,255,255,0.88),rgba(248,250,252,1))]',
      )}
    >
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm shadow-black/[0.06] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-slate-500">Cancelled</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">Payment was cancelled</div>
              <div className="mt-1 text-sm text-slate-600">
                Order: <span className="font-black text-slate-900">{orderId || '—'}</span>
              </div>
            </div>
            <div className="h-12 w-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center">
              <XCircle className="h-6 w-6 text-rose-700" />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Link
              href="/billing/checkout"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to checkout
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
