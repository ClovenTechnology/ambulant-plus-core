// apps/admin-dashboard/app/admin/clinicians/[id]/page.tsx
import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { verifyAdminToken } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OnboardingStage =
  | 'applied'
  | 'screened'
  | 'approved'
  | 'rejected'
  | 'training_scheduled'
  | 'training_completed';

type OnboardingBoardRow = {
  clinicianId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  createdAt: string;

  onboarding: {
    id: string;
    stage: OnboardingStage;
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

type ServiceKind = 'base_consult' | 'followup' | 'extra';

type Service = {
  id: string;
  kind: ServiceKind;
  name: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  active: boolean;
  includesMedicalStaff?: boolean;
};

type FeesExtendedVM = {
  ok: boolean;
  clinicianId: string;
  clinicianName: string;
  clinicianStatus?: string | null;
  currency: string;
  services: Service[];
  staff: any[];
  error?: string;
};

function money(cents: number, currency: string) {
  const num = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(num);
  } catch {
    return `${currency} ${(num).toFixed(2)}`;
  }
}

function toneForStage(stage: OnboardingStage) {
  if (stage === 'approved' || stage === 'training_completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }
  if (stage === 'rejected') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function prettyStage(stage: OnboardingStage) {
  if (stage === 'training_scheduled') return 'Training scheduled';
  if (stage === 'training_completed') return 'Training completed';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

async function fetchOnboardingBoard(gateway: string, adminKey: string): Promise<BoardResponse> {
  const url = `${gateway}/api/admin/clinicians/onboarding-board`;
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
        error: js.error || `HTTP ${res.status} loading onboarding board`,
      };
    }

    return { ok: true, rows: js.rows || [] };
  } catch (e: any) {
    console.error('fetchOnboardingBoard error', e);
    return { ok: false, rows: [], error: e?.message || 'fetch_failed' };
  }
}

async function fetchFeesExtended(
  gateway: string,
  adminKey: string,
  clinicianId: string,
): Promise<FeesExtendedVM | null> {
  const url = `${gateway}/api/admin/clinicians/${encodeURIComponent(clinicianId)}/fees/extended`;
  try {
    const res = await fetch(url, {
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey,
      },
      cache: 'no-store',
    });
    const js = (await res.json().catch(() => ({}))) as FeesExtendedVM;
    if (!res.ok || !js.ok) return null;
    return js;
  } catch (e) {
    console.error('fetchFeesExtended error', e);
    return null;
  }
}

export default async function AdminClinicianDetailPage({ params }: { params: { id: string } }) {
  const h = headers();
  const authHeader = h.get('authorization') || h.get('Authorization') || null;

  const v = await verifyAdminToken(authHeader ?? undefined);
  if (!v.ok) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold">Admin — Clinician</h1>
        <div className="mt-4 text-sm text-rose-600">Access denied: {v.error}</div>
        <div className="mt-3 text-sm text-gray-700">
          Sign in with an admin Auth0 account and include a valid Access Token.
        </div>
      </main>
    );
  }

  const clinicianId = params.id;

  const gateway =
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
    process.env.APIGW_BASE ??
    process.env.GATEWAY_URL ??
    'http://localhost:3010';

  const adminKey = process.env.ADMIN_API_KEY ?? '';

  const board = await fetchOnboardingBoard(gateway, adminKey);
  const row = board.ok ? board.rows.find((r) => r.clinicianId === clinicianId) : null;

  // Best-effort: fees summary (optional)
  const fees = await fetchFeesExtended(gateway, adminKey, clinicianId);

  const base = fees?.services?.find((s) => s.kind === 'base_consult') ?? null;
  const followup = fees?.services?.find((s) => s.kind === 'followup') ?? null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs text-gray-500">
            <Link href="/admin/clinicians" className="hover:underline">
              Clinicians
            </Link>
            <span className="mx-2">/</span>
            <span className="font-mono">{clinicianId}</span>
          </div>
          <h1 className="text-2xl font-bold">Clinician profile</h1>
          <p className="text-sm text-gray-600">
            Single clinician view (onboarding, training, dispatch, and quick links).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/clinicians/onboarding"
            className="rounded border bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
          >
            Onboarding board
          </Link>
          <Link
            href={`/admin/clinicians/${encodeURIComponent(clinicianId)}/fees`}
            className="rounded border bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
          >
            Fees &amp; staff comp
          </Link>
        </div>
      </header>

      {!board.ok && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Couldn&apos;t load onboarding board from the gateway.
          <div className="mt-1">
            Check <code className="font-mono">GET /api/admin/clinicians/onboarding-board</code> and{' '}
            <code className="font-mono">ADMIN_API_KEY</code>. Error: {board.error}
          </div>
        </div>
      )}

      {!row ? (
        <section className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Clinician not found</div>
          <div className="mt-1 text-sm text-gray-600">
            This clinician ID wasn&apos;t found in the onboarding board response.
          </div>
          <div className="mt-3 text-xs text-gray-600 space-y-1">
            <div>
              • If this clinician is older / pre-onboarding-model, you may need a dedicated endpoint like{' '}
              <code className="font-mono">GET /api/admin/clinicians/:id</code>.
            </div>
            <div>
              • Or confirm the clinician exists in DB and is included by the onboarding-board route.
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin/clinicians"
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
            >
              Back to list
            </Link>
            <Link
              href="/admin/clinicians/onboarding"
              className="rounded border bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
            >
              Open onboarding board
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-3">
          {/* Left: Identity */}
          <div className="rounded-xl border bg-white p-4 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-gray-900">{row.displayName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="rounded-full border px-2 py-0.5">{row.specialty || 'Unknown specialty'}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${toneForStage(
                      row.onboarding.stage,
                    )}`}
                  >
                    {prettyStage(row.onboarding.stage)}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Signed up: {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="text-right text-xs text-gray-600">
                <div>
                  ID: <span className="font-mono text-[11px]">{row.clinicianId}</span>
                </div>
                {row.email && <div className="mt-0.5">{row.email}</div>}
                {row.phone && <div className="mt-0.5">{row.phone}</div>}
              </div>
            </div>

            {row.onboarding.notes && (
              <div className="mt-3 rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span className="font-semibold">Notes:</span> {row.onboarding.notes}
              </div>
            )}

            {/* Training */}
            <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Training</div>
                <div className="text-[11px] text-gray-500 font-mono">ClinicianTrainingSlot</div>
              </div>
              {row.trainingSlot ? (
                <div className="mt-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-700">
                      {row.trainingSlot.mode === 'virtual' ? 'Virtual' : 'In person'} • {row.trainingSlot.status}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      {new Date(row.trainingSlot.startAt).toLocaleString()} →{' '}
                      {new Date(row.trainingSlot.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {row.trainingSlot.joinUrl && (
                    <div className="text-[11px] text-blue-700 break-all">
                      Join URL: {row.trainingSlot.joinUrl}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-gray-600">No training slot scheduled yet.</div>
              )}
            </div>

            {/* Dispatch */}
            <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">Starter kit dispatch</div>
                <div className="text-[11px] text-gray-500 font-mono">ClinicianDispatch</div>
              </div>

              {row.dispatch ? (
                <div className="mt-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] capitalize text-gray-800">
                      Status: {row.dispatch.status}
                    </span>
                    {row.dispatch.courierName && (
                      <span className="text-[11px] text-gray-600">Courier: {row.dispatch.courierName}</span>
                    )}
                    {row.dispatch.trackingCode && (
                      <span className="text-[11px] text-gray-600">Tracking: {row.dispatch.trackingCode}</span>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-600">
                    {row.dispatch.shippedAt && (
                      <span>Shipped: {new Date(row.dispatch.shippedAt).toLocaleString()}</span>
                    )}
                    {row.dispatch.shippedAt && row.dispatch.deliveredAt && <span> • </span>}
                    {row.dispatch.deliveredAt && (
                      <span>Delivered: {new Date(row.dispatch.deliveredAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-gray-600">No dispatch created yet.</div>
              )}
            </div>
          </div>

          {/* Right: Quick summary / Fees */}
          <aside className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Quick summary</div>

            <div className="mt-3 space-y-2 text-xs text-gray-700">
              <div className="rounded border bg-slate-50 p-2">
                <div className="text-[11px] font-semibold text-gray-800">Fees snapshot</div>
                {!fees ? (
                  <div className="mt-1 text-[11px] text-gray-600">
                    Couldn&apos;t load fees summary (endpoint may not exist yet or clinician has no fees data).
                  </div>
                ) : (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-600">Base consult</span>
                      <span className="font-mono text-[11px]">
                        {base ? money(base.amountCents, base.currency) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-600">Follow-up</span>
                      <span className="font-mono text-[11px]">
                        {followup ? money(followup.amountCents, followup.currency) : '—'}
                      </span>
                    </div>
                    <div className="pt-1 text-[11px] text-gray-500">
                      Currency: <span className="font-mono">{fees.currency}</span>
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  <Link
                    href={`/admin/clinicians/${encodeURIComponent(clinicianId)}/fees`}
                    className="inline-flex rounded bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800"
                  >
                    Open full fees page
                  </Link>
                </div>
              </div>

              <div className="rounded border bg-slate-50 p-2">
                <div className="text-[11px] font-semibold text-gray-800">Next best actions</div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-gray-600">
                  <li>Schedule training if not scheduled.</li>
                  <li>Create dispatch after training scheduled.</li>
                  <li>Mark training complete after attendance.</li>
                </ul>
                <div className="mt-2">
                  <Link
                    href="/admin/clinicians/onboarding"
                    className="inline-flex rounded border bg-white px-3 py-1.5 text-[11px] font-medium text-gray-800 hover:bg-gray-50"
                  >
                    Do actions on onboarding board
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
