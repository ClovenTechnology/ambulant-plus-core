// apps/admin-dashboard/app/admin/clinicians/onboarding/page.tsx
import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { verifyAdminToken } from '@/src/lib/auth';
import OnboardingDispatchBoard from './OnboardingDispatchBoard';

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
  const h = headers();
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
      return {
        ok: false,
        rows: [],
        error:
          js.error || `HTTP ${res.status} loading onboarding board (${url})`,
      };
    }
    return { ok: true, rows: js.rows || [] };
  } catch (e: any) {
    console.error('fetchOnboardingBoard error', e);
    return {
      ok: false,
      rows: [],
      error: e?.message || 'fetch_failed',
    };
  }
}

export default async function AdminClinicianOnboardingPage() {
  const h = headers();
  const authHeader =
    h.get('authorization') || h.get('Authorization') || undefined;
  const v = await verifyAdminToken(authHeader);

  if (!v.ok) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">Admin — Clinician Onboarding</h1>
        <div className="mt-4 text-sm text-rose-600">
          Access denied: {v.error}
        </div>
        <div className="mt-3 text-sm">
          Sign in with an admin account and include a valid Access Token with
          the required admin scope/role.
        </div>
      </main>
    );
  }

  const board = await fetchOnboardingBoard();

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Clinicians — Onboarding &amp; Dispatch
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            End-to-end view of clinician onboarding, mandatory training and
            Ambulant+ starter kit dispatch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/calendar"
            className="rounded border bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            title="Open calendar view (training schedule)"
          >
            Calendar
          </Link>

          <div className="text-right text-xs text-gray-500">
            Signed in as admin
            <div>
              <span className="font-mono text-[11px]">
                Gateway:{' '}
                {process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
                  process.env.NEXT_PUBLIC_PATIENT_BASE ??
                  'http://localhost:3010'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {!board.ok && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Couldn&apos;t load onboarding board. Check{' '}
          <code className="font-mono">
            GET /api/admin/clinicians/onboarding-board
          </code>{' '}
          on the gateway. Error: {board.error}
        </div>
      )}

      <OnboardingDispatchBoard rows={board.rows} />
    </main>
  );
}
