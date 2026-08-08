
// apps/admin-dashboard/app/admin/patients/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Patient = Record<string, any>;

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function fmt(value: unknown) {
  const s = clean(value, 1000);
  return s || '—';
}

function fmtDate(value: unknown) {
  const s = clean(value);
  if (!s) return '—';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleString();
}

function initials(name: string) {
  const parts = clean(name).split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || 'P';
}

function Avatar({ patient }: { patient: Patient }) {
  const avatar = clean(patient.avatarUrl || patient.photoUrl, 2000);
  const name = clean(patient.name || patient.displayName || 'Patient');

  if (avatar) {
    return <img src={avatar} alt="" className="h-20 w-20 rounded-3xl object-cover ring-1 ring-slate-200" />;
  }

  return (
    <div className="grid h-20 w-20 place-items-center rounded-3xl bg-slate-100 text-xl font-semibold text-slate-700 ring-1 ring-slate-200">
      {initials(name)}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
      {children}
    </span>
  );
}

export default function AdminPatientDetailPage({ params }: { params: { id: string } }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    setErr('');

    try {
      const res = await fetch(
        '/api/admin/patients/' + encodeURIComponent(params.id),
        { cache: 'no-store' },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setPatient(json?.patient || null);
    } catch (e: any) {
      setErr(e?.message || 'patient_detail_load_failed');
      setPatient(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const name = useMemo(() => {
    return clean(patient?.name || patient?.displayName || 'Patient');
  }, [patient]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            <Link href="/admin/patients" className="hover:underline">Admin Patients</Link>
            <span> / {params.id}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Patient profile
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Administrative patient intelligence, payment, device, sponsor and care-readiness summary.
          </p>
        </div>

        <Link href="/admin/patients" className="rounded-xl border bg-white px-4 py-2 text-sm">
          Back to patients
        </Link>
      </header>

      {busy && (
        <div className="rounded-3xl border bg-white p-8 text-sm text-slate-500">
          Loading patient...
        </div>
      )}

      {err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {err}
        </div>
      )}

      {!busy && !patient && !err && (
        <div className="rounded-3xl border bg-white p-8 text-sm text-slate-500">
          Patient not found.
        </div>
      )}

      {patient && (
        <>
          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar patient={patient} />
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold text-slate-950">{name}</h2>
                  <div className="mt-1 text-sm text-slate-500">
                    {fmt(patient.email)} · {fmt(patient.phone)}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-400">
                    {fmt(patient.id)} {patient.userId ? ' · user: ' + patient.userId : ''}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill>{fmt(patient.riskLevel)} risk</Pill>
                <Pill>{Number(patient.totalAppointments || 0)} appointments</Pill>
                <Pill>{Number(patient.deviceCount || 0)} devices</Pill>
                <Pill>{Number(patient.medicalAidCount || 0)} medical aid</Pill>
                <Pill>{Number(patient.sponsorLinkCount || 0)} sponsor links</Pill>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">Identity</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-slate-500">MRN</dt><dd>{fmt(patient.mrn)}</dd></div>
                <div><dt className="text-slate-500">Gender</dt><dd>{fmt(patient.gender)}</dd></div>
                <div><dt className="text-slate-500">DOB</dt><dd>{fmtDate(patient.dob)}</dd></div>
                <div><dt className="text-slate-500">City</dt><dd>{fmt(patient.city)}</dd></div>
              </dl>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">Care activity</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-slate-500">Total appointments</dt><dd>{Number(patient.totalAppointments || 0)}</dd></div>
                <div><dt className="text-slate-500">Upcoming</dt><dd>{Number(patient.upcomingAppointments || 0)}</dd></div>
                <div><dt className="text-slate-500">Past</dt><dd>{Number(patient.pastAppointments || 0)}</dd></div>
                <div><dt className="text-slate-500">Last seen</dt><dd>{fmtDate(patient.lastSeenAt)}</dd></div>
              </dl>
            </div>

            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">Finance and cover</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div><dt className="text-slate-500">Payment pending</dt><dd>{Number(patient.paymentPendingAppointments || 0)}</dd></div>
                <div><dt className="text-slate-500">Medical aid</dt><dd>{patient.hasMedicalAid ? 'Yes' : 'No'}</dd></div>
                <div><dt className="text-slate-500">Sponsor links</dt><dd>{Number(patient.sponsorLinkCount || 0)}</dd></div>
                <div><dt className="text-slate-500">Total spend</dt><dd>{Number(patient.totalSpendMinor || 0) / 100} {patient.currency || 'ZAR'}</dd></div>
              </dl>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-950">Operational flags</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {patient.recentlyOnboarded && <Pill>recently onboarded</Pill>}
              {patient.profileIncomplete && <Pill>profile incomplete: {(patient.missingFields || []).join(', ')}</Pill>}
              {patient.stale && <Pill>stale</Pill>}
              {patient.hasDevices && <Pill>devices: {(patient.deviceTypes || []).join(', ') || patient.deviceCount}</Pill>}
              {patient.insightAlertCount > 0 && <Pill>{patient.insightAlertCount} InsightCore alerts</Pill>}
              {!patient.recentlyOnboarded && !patient.profileIncomplete && !patient.stale && !patient.hasDevices && !patient.insightAlertCount && (
                <Pill>No active operational flags</Pill>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
