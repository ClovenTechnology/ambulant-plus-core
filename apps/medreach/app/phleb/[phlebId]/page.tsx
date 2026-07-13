function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

// apps/medreach/app/phleb/[phlebId]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Job = {
  id: string;
  drawId?: string;
  jobId?: string;
  orderId?: string;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  phlebId?: string | null;
  labId?: string | null;
  partnerId?: string | null;
  status?: string;
  scheduledAt?: string | null;
  assignedAt?: string | null;
  receivedByLabAt?: string | null;
  lab?: {
    id?: string;
    name?: string;
    contact?: string | null;
  } | null;
  bundle?: {
    id?: string;
    status?: string;
    specimens?: any[];
    custody?: any[];
    labelPrintedAt?: string | null;
    collectedAt?: string | null;
    sealedAt?: string | null;
    inTransitAt?: string | null;
    receivedAtLabAt?: string | null;
  } | null;
  bundleStatus?: string | null;
  finance?: {
    currency?: string;
    phlebGrossCents?: number;
    phlebNetCents?: number;
  } | null;
  latestLocation?: {
    lat?: number;
    lng?: number;
    at?: string | null;
  } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type Command =
  | 'START_JOURNEY'
  | 'ARRIVED_PATIENT'
  | 'START_COLLECTION'
  | 'PRINT_LABEL'
  | 'SPECIMEN_COLLECTED'
  | 'SEAL_BUNDLE'
  | 'DEPART_TO_LAB'
  | 'ARRIVED_AT_LAB'
  | 'LAB_HANDOFF';

const COMMANDS: Array<{
  action: Command;
  label: string;
  hint: string;
  requiresBundle?: boolean;
  specimenCustody?: boolean;
}> = [
  {
    action: 'START_JOURNEY',
    label: 'Start journey',
    hint: 'Phleb has left for patient.',
  },
  {
    action: 'ARRIVED_PATIENT',
    label: 'Arrived at patient',
    hint: 'Phleb is physically at collection site.',
  },
  {
    action: 'START_COLLECTION',
    label: 'Start collection',
    hint: 'Collection workflow has started.',
  },
  {
    action: 'PRINT_LABEL',
    label: 'Print / ensure label',
    hint: 'Create or confirm specimen bundle and barcode identity.',
  },
  {
    action: 'SPECIMEN_COLLECTED',
    label: 'Specimen collected',
    hint: 'Record collection custody event.',
    requiresBundle: true,
    specimenCustody: true,
  },
  {
    action: 'SEAL_BUNDLE',
    label: 'Seal bundle',
    hint: 'Record sealed custody event.',
    requiresBundle: true,
    specimenCustody: true,
  },
  {
    action: 'DEPART_TO_LAB',
    label: 'Depart to lab',
    hint: 'Bundle is in transit.',
    requiresBundle: true,
    specimenCustody: true,
  },
  {
    action: 'ARRIVED_AT_LAB',
    label: 'Arrived at lab',
    hint: 'Phleb arrived at receiving lab.',
    requiresBundle: true,
    specimenCustody: true,
  },
  {
    action: 'LAB_HANDOFF',
    label: 'Handoff to lab',
    hint: 'Lab receipt scan / handoff event.',
    requiresBundle: true,
    specimenCustody: true,
  },
];

function asArray(value: any): any[] {
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.jobs)) return value.jobs;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value)) return value;

  return [];
}

function normalizeJob(raw: any): Job {
  const draw = raw?.draw || raw;

  return {
    id: String(raw?.id || raw?.jobId || raw?.drawId || draw?.id || raw?.orderId || '').trim(),
    drawId: raw?.drawId || draw?.id || raw?.id,
    jobId: raw?.jobId || raw?.id || draw?.id,
    orderId: raw?.orderId || draw?.orderId,
    encounterId: raw?.encounterId || draw?.encounterId || null,
    patientId: raw?.patientId || draw?.patientId || null,
    clinicianId: raw?.clinicianId || draw?.clinicianId || null,
    phlebId: raw?.phlebId || draw?.phlebId || null,
    labId: raw?.labId || draw?.partnerId || raw?.partnerId || raw?.lab?.id || null,
    partnerId: raw?.partnerId || draw?.partnerId || raw?.labId || null,
    status: String(raw?.status || draw?.status || 'ASSIGNED'),
    scheduledAt: raw?.scheduledAt || draw?.scheduledAt || null,
    assignedAt: raw?.assignedAt || draw?.assignedAt || null,
    receivedByLabAt: raw?.receivedByLabAt || draw?.receivedByLabAt || null,
    lab: raw?.lab || null,
    bundle: raw?.bundle || raw?.specimenBundle || null,
    bundleStatus: raw?.bundleStatus || raw?.bundle?.status || null,
    finance: raw?.finance || null,
    latestLocation: raw?.latestLocation || null,
    createdAt: raw?.createdAt || draw?.createdAt || null,
    updatedAt: raw?.updatedAt || draw?.updatedAt || null,
  };
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED_TO_LAB', 'COMPLETED', 'ACCEPTED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PHLEB_EN_ROUTE_TO_PATIENT', 'PHLEB_EN_ROUTE_TO_LAB', 'IN_TRANSIT'].includes(s)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (['PHLEB_ARRIVED', 'SAMPLING_IN_PROGRESS', 'COLLECTED', 'SEALED'].includes(s)) {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function fmtDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString();
}

function money(cents?: number | null, currency = 'ZAR') {
  const value = Number(cents || 0) / 100;

  return `${currency} ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstSpecimenId(job: Job) {
  return job.bundle?.specimens?.[0]?.id || null;
}

function bundleId(job: Job) {
  return job.bundle?.id || null;
}

export default function PhlebJobsPage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const name =
    phlebId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const url = `/api/phleb-jobs?phlebId=${encodeURIComponent(phlebId)}&includeCompleted=${includeCompleted ? 'true' : 'false'}&limit=200`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setJobs(asArray(json).map(normalizeJob));
    } catch (e: any) {
      setJobs([]);
      setErr(e?.message || 'Unable to load phleb jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phlebId, includeCompleted]);

  const activeJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          !['DELIVERED_TO_LAB', 'COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED'].includes(
            String(job.status || '').toUpperCase(),
          ),
      ),
    [jobs],
  );

  async function runCommand(job: Job, action: Command) {
    const key = `${job.id}:${action}`;
    setBusyKey(key);
    setErr(null);
    setNotice(null);

    try {
      const res = await fetch('/api/phleb-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phlebId,
          jobId: job.drawId || job.jobId || job.id || job.orderId,
          orderId: job.orderId,
          drawId: job.drawId,
          bundleId: bundleId(job),
          specimenId: firstSpecimenId(job),
          action,
          meta: {
            source: 'medreach_phleb_console',
            labId: job.labId,
            partnerId: job.partnerId,
          },
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setNotice(`${action.replace(/_/g, ' ')} recorded.`);
      await load();
    } catch (e: any) {
      setErr(e?.message || `Unable to run ${action}`);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {name} — Field Command Console
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Role-safe phleb workflow for journey state, collection state, specimen bundle
            creation, custody events and lab handoff. Draw status and specimen custody are
            updated separately through the MedReach gateway.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/phleb"
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Registry
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/dashboard`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/profile`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Profile
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/payouts`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Payouts
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Jobs loaded</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : jobs.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Active jobs</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : activeJobs.length}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Bundles linked</div>
          <div className="mt-1 text-2xl font-semibold">
            {loading ? '...' : jobs.filter((job) => job.bundle?.id).length}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Delivered</div>
          <div className="mt-1 text-2xl font-semibold">
            {loading
              ? '...'
              : jobs.filter((job) => String(job.status || '').toUpperCase() === 'DELIVERED_TO_LAB')
                  .length}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(e) => setIncludeCompleted(e.target.checked)}
          />
          Include completed / closed jobs
        </label>

        <button
          type="button"
          onClick={load}
          className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-gray-50"
        >
          Refresh
        </button>
      </section>

      {notice ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {humanErrorMessage(err, "Unable to complete this request. Please try again.")}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          Loading jobs...
        </section>
      ) : jobs.length === 0 ? (
        <section className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No phleb jobs were returned by the gateway. Assign a MedReach draw to this phleb
          before using field commands.
        </section>
      ) : (
        <section className="space-y-4">
          {jobs.map((job) => {
            const id = job.drawId || job.jobId || job.id || job.orderId || '';
            const status = String(job.status || 'ASSIGNED');
            const specimenId = firstSpecimenId(job);
            const hasBundle = Boolean(bundleId(job));

            return (
              <article key={`${id}:${job.updatedAt || job.createdAt || ''}`} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-950">
                        Order {job.orderId || id}
                      </h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(status)}`}>
                        {status}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(job.bundleStatus || job.bundle?.status)}`}>
                        Bundle: {job.bundleStatus || job.bundle?.status || 'not created'}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      Lab: {job.lab?.name || job.labId || job.partnerId || 'Not assigned'} / Scheduled:{' '}
                      {fmtDate(job.scheduledAt)}
                    </div>
                  </div>

                  <Link
                    href={`/phleb/${encodeURIComponent(phlebId)}/orders/${encodeURIComponent(job.orderId || id)}/label`}
                    className="rounded border bg-white px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    Label page
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
                  <div>
                    <div className="text-gray-500">Draw ID</div>
                    <div className="truncate font-mono">{job.drawId || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Bundle ID</div>
                    <div className="truncate font-mono">{bundleId(job) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Specimen ID</div>
                    <div className="truncate font-mono">{specimenId || '-'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Phleb gross</div>
                    <div className="font-semibold">
                      {money(job.finance?.phlebGrossCents, job.finance?.currency || 'ZAR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Last update</div>
                    <div className="font-semibold">{fmtDate(job.updatedAt || job.createdAt)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                  {COMMANDS.map((command) => {
                    const disabled =
                      busyKey !== null ||
                      (command.requiresBundle && !hasBundle && command.action !== 'SPECIMEN_COLLECTED');

                    return (
                      <button
                        key={command.action}
                        type="button"
                        disabled={disabled}
                        onClick={() => runCommand(job, command.action)}
                        title={command.hint}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                          disabled
                            ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                            : command.specimenCustody
                              ? 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                              : 'bg-white text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-semibold">
                          {busyKey === `${job.id}:${command.action}` ? 'Working...' : command.label}
                        </div>
                        <div className="mt-0.5 text-[10px] opacity-75">{command.hint}</div>
                      </button>
                    );
                  })}
                </div>

                {job.bundle?.custody?.length ? (
                  <div className="mt-4 rounded-xl border bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-800">Custody timeline</div>
                    <div className="mt-2 space-y-1 text-[11px] text-gray-600">
                      {job.bundle.custody.map((event: any) => (
                        <div key={event.id || `${event.action}:${event.createdAt}`} className="flex justify-between gap-3 border-b pb-1 last:border-b-0">
                          <span className="font-mono">{event.action}</span>
                          <span>{fmtDate(event.createdAt || event.at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}