// apps/admin-dashboard/app/admin/clinicians/[id]/fees/page.tsx
import React from 'react';
import { headers } from 'next/headers';
import { verifyAdminToken } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

type StaffRow = {
  staffId: string;
  staffName: string;
  type: 'medical' | 'non-medical';
  role?: string | null;
  flatMonthlyCents?: number | null;
  sharePercentOfClinician?: number | null;
  servicesSharePercent?: number | null;
};

type AdminClinicianFeesVM = {
  ok: boolean;
  clinicianId: string;
  clinicianName: string;
  clinicianStatus?: string | null;
  currency: string;
  services: Service[];
  staff: StaffRow[];
};

function centsToMoney(cents: number, currency: string) {
  const num = (cents || 0) / 100;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(num);
}

export default async function AdminClinicianFeesPage({
  params,
}: {
  params: { id: string };
}) {
  const h = headers();
  const authHeader =
    h.get('authorization') || h.get('Authorization') || null;

  const v = await verifyAdminToken(authHeader ?? undefined);
  if (!v.ok) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Admin — Clinician Fees</h1>
        <div className="mt-4 text-sm text-rose-600">
          Access denied: {v.error}
        </div>
        <div className="mt-3 text-sm">
          To access this page you must sign in with an admin Auth0 account
          and provide a valid Access Token.
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

  let data: AdminClinicianFeesVM | null = null;
  let error: string | null = null;

  try {
    const url = `${gateway}/api/admin/clinicians/${encodeURIComponent(
      clinicianId,
    )}/fees/extended`;
    const res = await fetch(url, {
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey,
      },
      cache: 'no-store',
    });
    const js = (await res.json().catch(() => ({}))) as AdminClinicianFeesVM;
    if (!res.ok || !js.ok) {
      throw new Error(
        (js as any)?.error || `HTTP ${res.status} loading clinician fees`,
      );
    }
    data = js;
  } catch (e: any) {
    console.error('AdminClinicianFeesPage fetch error', e);
    error = e?.message || 'Failed to load clinician fees';
  }

  if (!data) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Clinician Fees &amp; Staff Comp</h1>
        {error ? (
          <div className="mt-4 text-sm text-rose-600">{error}</div>
        ) : (
          <div className="mt-4 text-sm text-gray-600">Loading…</div>
        )}
      </main>
    );
  }

  const base = data.services.find((s) => s.kind === 'base_consult');
  const followup = data.services.find((s) => s.kind === 'followup');
  const extras = data.services.filter((s) => s.kind === 'extra');

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clinician Fees &amp; Staff Comp</h1>
          <div className="mt-1 text-sm text-gray-600">
            Per-clinician service catalog and admin staff compensation model
            (read-only for now).
          </div>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div>
            Clinician ID:{' '}
            <span className="font-mono text-[11px]">
              {data.clinicianId}
            </span>
          </div>
          <div>
            Name:{' '}
            <span className="font-medium">{data.clinicianName}</span>
          </div>
          {data.clinicianStatus && (
            <div>
              Status:{' '}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] capitalize">
                {data.clinicianStatus}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Service catalog */}
      <section className="border rounded-lg bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Service catalog (serviceFees)
          </h2>
          <div className="text-[11px] text-gray-500">
            Stored in clinician.metadata.rawProfileJson.serviceFees
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="border rounded p-3 bg-slate-50">
            <div className="text-xs font-semibold text-gray-700 mb-1">
              Base consultation
            </div>
            {base ? (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="text-lg font-semibold">
                    {centsToMoney(base.amountCents, base.currency)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {base.minMinutes && base.maxMinutes
                      ? `${base.minMinutes}-${base.maxMinutes} min`
                      : base.minMinutes
                      ? `≥ ${base.minMinutes} min`
                      : 'Duration not specified'}
                  </div>
                </div>
                {base.description && (
                  <div className="mt-1 text-xs text-gray-600">
                    {base.description}
                  </div>
                )}
                <div className="mt-2 text-[11px] text-gray-500">
                  Kind:{' '}
                  <span className="font-mono">base_consult</span> • Active:{' '}
                  <span className="font-mono">
                    {base.active ? 'true' : 'false'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">
                No base consultation service defined.
              </div>
            )}
          </div>

          <div className="border rounded p-3 bg-slate-50">
            <div className="text-xs font-semibold text-gray-700 mb-1">
              Follow-up consultation
            </div>
            {followup ? (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="text-lg font-semibold">
                    {centsToMoney(followup.amountCents, followup.currency)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {followup.minMinutes && followup.maxMinutes
                      ? `${followup.minMinutes}-${followup.maxMinutes} min`
                      : followup.minMinutes
                      ? `≥ ${followup.minMinutes} min`
                      : 'Duration not specified'}
                  </div>
                </div>
                {followup.description && (
                  <div className="mt-1 text-xs text-gray-600">
                    {followup.description}
                  </div>
                )}
                <div className="mt-2 text-[11px] text-gray-500">
                  Kind:{' '}
                  <span className="font-mono">followup</span> • Active:{' '}
                  <span className="font-mono">
                    {followup.active ? 'true' : 'false'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-gray-500">
                No follow-up consultation service defined.
              </div>
            )}
          </div>
        </div>

        <div className="border rounded p-3 text-xs">
          <div className="font-semibold text-gray-800 mb-2">
            Extra services (remote monitoring, daily check-ins, etc.)
          </div>
          {extras.length === 0 ? (
            <div className="text-gray-500">
              No extra services configured by clinician.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-2 py-1 border-b">Name</th>
                    <th className="px-2 py-1 border-b">Description</th>
                    <th className="px-2 py-1 border-b">Amount</th>
                    <th className="px-2 py-1 border-b">Duration</th>
                    <th className="px-2 py-1 border-b">Includes med staff</th>
                    <th className="px-2 py-1 border-b">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {extras.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-2 py-1 align-top">{s.name}</td>
                      <td className="px-2 py-1 align-top text-gray-600">
                        {s.description || '—'}
                      </td>
                      <td className="px-2 py-1 align-top font-mono">
                        {centsToMoney(s.amountCents, s.currency)}
                      </td>
                      <td className="px-2 py-1 align-top text-[11px] text-gray-500">
                        {s.minMinutes && s.maxMinutes
                          ? `${s.minMinutes}-${s.maxMinutes} min`
                          : s.minMinutes
                          ? `≥ ${s.minMinutes} min`
                          : '—'}
                      </td>
                      <td className="px-2 py-1 align-top text-[11px]">
                        {s.includesMedicalStaff ? 'Yes' : 'No / N/A'}
                      </td>
                      <td className="px-2 py-1 align-top text-[11px]">
                        {s.active ? 'Active' : 'Inactive'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Staff comp */}
      <section className="border rounded-lg bg-white p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Admin staff compensation (adminStaffComp)
          </h2>
          <div className="text-[11px] text-gray-500">
            Stored in clinician.metadata.rawProfileJson.adminStaffComp
          </div>
        </div>

        {data.staff.length === 0 ? (
          <div className="text-gray-500">
            No admin staff linked to this clinician.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-2 py-1 border-b">Name</th>
                  <th className="px-2 py-1 border-b">Type</th>
                  <th className="px-2 py-1 border-b">Role</th>
                  <th className="px-2 py-1 border-b">Flat monthly</th>
                  <th className="px-2 py-1 border-b">% of clinician/practice</th>
                  <th className="px-2 py-1 border-b">% of staff services</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => (
                  <tr key={s.staffId} className="border-t">
                    <td className="px-2 py-1 align-top">
                      <div className="font-medium text-gray-800">
                        {s.staffName}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {s.staffId}
                      </div>
                    </td>
                    <td className="px-2 py-1 align-top capitalize">
                      {s.type.replace('-', ' ')}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {s.role || '—'}
                    </td>
                    <td className="px-2 py-1 align-top font-mono">
                      {s.flatMonthlyCents != null
                        ? centsToMoney(s.flatMonthlyCents, data.currency)
                        : '—'}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {s.sharePercentOfClinician != null
                        ? `${s.sharePercentOfClinician.toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {s.type === 'medical'
                        ? s.servicesSharePercent != null
                          ? `${s.servicesSharePercent.toFixed(1)}%`
                          : '—'
                        : 'N/A (non-medical)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 mt-2 text-[11px] text-slate-700 space-y-1">
          <div className="font-semibold">Model recap</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <span className="font-medium">Non-medical staff</span> — flat
              monthly and/or % of clinician/practice earnings.
            </li>
            <li>
              <span className="font-medium">Medical staff</span> — same
              flat/% model <em>plus</em> optional % share of services where
              they&apos;re actively involved (e.g. remote monitoring).
            </li>
            <li>
              This page is read-only for now; later we can add inline editing
              that pushes to the same gateway route (PUT).
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
