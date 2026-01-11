//apps/admin-dashboard/app/admin/calendar/page.tsx
import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { verifyAdminToken } from '@/src/lib/auth';
import TrainingCalendarClient from './training/TrainingCalendarClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OnboardingBoardRow = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  createdAt: string;

  onboarding: {
    id: string;
    stage:
      | 'applied'
      | 'screened'
      | 'approved'
      | 'rejected'
      | 'training_scheduled'
      | 'training_completed';
    notes?: string | null;
  };

  trainingSlot?: {
    id: string;
    startAt: string;
    endAt: string;
    mode: 'virtual' | 'in_person';
    status: 'scheduled' | 'completed' | 'canceled';
    joinUrl?: string | null;
  } | null;

  dispatch?: {
    id: string;
    status: 'pending' | 'packed' | 'shipped' | 'delivered' | 'canceled';
    courierName?: string | null;
    trackingCode?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
};

type BoardResponse = {
  ok: boolean;
  rows: OnboardingBoardRow[];
  error?: string;
};

async function fetchOnboardingBoard(): Promise<BoardResponse> {
  const gateway =
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
    process.env.NEXT_PUBLIC_PATIENT_BASE ??
    'http://localhost:3010';

  const url = `${gateway}/api/admin/clinicians/onboarding-board`;
  const adminKey = process.env.ADMIN_API_KEY ?? '';

  try {
    const res = await fetch(url, {
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey,
      },
      cache: 'no-store',
    });
    const js = (await res.json().catch(() => ({}))) as BoardResponse;
    if (!res.ok || js.ok === false) {
      return { ok: false, rows: [], error: js.error || `HTTP ${res.status}` };
    }
    return { ok: true, rows: js.rows || [] };
  } catch (e: any) {
    return { ok: false, rows: [], error: e?.message || 'fetch_failed' };
  }
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const h = headers();
  const authHeader = h.get('authorization') || h.get('Authorization') || undefined;
  const v = await verifyAdminToken(authHeader);

  if (!v.ok) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">Admin — Calendar</h1>
        <div className="mt-4 text-sm text-rose-600">Access denied: {v.error}</div>
      </main>
    );
  }

  const board = await fetchOnboardingBoard();

  const focusRaw = searchParams?.focus;
  const focus = typeof focusRaw === 'string' ? focusRaw : '';

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar — Training schedule</h1>
          <p className="mt-1 text-sm text-gray-600">
            Month view + day agenda for clinician training slots.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Link
              href="/admin/clinicians/onboarding"
              className="rounded border bg-white px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50"
            >
              ← Back to onboarding board
            </Link>
          </div>
        </div>

        <div className="text-right text-xs text-gray-500">
          Signed in as admin
          <div className="mt-1 font-mono text-[11px]">
            Gateway:{' '}
            {process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
              process.env.NEXT_PUBLIC_PATIENT_BASE ??
              'http://localhost:3010'}
          </div>
        </div>
      </header>

      {!board.ok && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Couldn&apos;t load onboarding board from gateway. Error: {board.error}
        </div>
      )}

      <TrainingCalendarClient rows={board.rows} focusClinicianId={focus} />
    </main>
  );
}
