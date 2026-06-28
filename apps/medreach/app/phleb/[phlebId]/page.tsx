// apps/medreach/app/phleb/[phlebId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getNextStatus,
  getStatusClasses,
  getStatusLabel,
  type JobStatus,
} from '@shared/fsm';

type PhlebJobStatus = JobStatus;

type PhlebJob = {
  id: string;
  displayId: string;
  status: PhlebJobStatus;
  priority: 'normal' | 'urgent';
  patientName: string;
  patientDob: string;
  patientAddress: string;
  patientArea: string;
  labId: string;
  labName: string;
  createdAt: string;
  scheduledFor?: string;
  distanceKm?: number;
  etaMinutes?: number;
  bundleId?: string;
  specimenBundleId?: string;
  specimenIds?: string[];
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
};

function unwrapGatewayData(value: any) {
  if (value && typeof value === 'object' && 'data' in value) {
    return value.data;
  }

  return value;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeJobStatus(value: unknown): JobStatus {
  const status = String(value || '').trim();

  const map: Record<string, JobStatus> = {
    WAITING_LAB_SELECTION: 'WAITING_LAB_SELECTION',
    MARKETPLACE_OPEN: 'WAITING_LAB_SELECTION',
    pending_lab: 'WAITING_LAB_SELECTION',

    WAITING_PHLEB: 'WAITING_PHLEB',
    ASSIGNED: 'WAITING_PHLEB',
    assigned: 'WAITING_PHLEB',
    waiting_phleb: 'WAITING_PHLEB',

    PHLEB_EN_ROUTE_TO_PATIENT: 'PHLEB_EN_ROUTE_TO_PATIENT',
    EN_ROUTE: 'PHLEB_EN_ROUTE_TO_PATIENT',
    phleb_en_route: 'PHLEB_EN_ROUTE_TO_PATIENT',

    PHLEB_ARRIVED: 'PHLEB_ARRIVED',
    ARRIVED: 'PHLEB_ARRIVED',
    phleb_arrived: 'PHLEB_ARRIVED',

    SAMPLING_IN_PROGRESS: 'SAMPLING_IN_PROGRESS',
    SPECIMEN_COLLECTED: 'SAMPLING_IN_PROGRESS',
    collected: 'SAMPLING_IN_PROGRESS',

    PHLEB_EN_ROUTE_TO_LAB: 'PHLEB_EN_ROUTE_TO_LAB',
    IN_TRANSIT_TO_LAB: 'PHLEB_EN_ROUTE_TO_LAB',
    IN_TRANSIT: 'PHLEB_EN_ROUTE_TO_LAB',

    DELIVERED_TO_LAB: 'DELIVERED_TO_LAB',
    RECEIVED_AT_LAB: 'DELIVERED_TO_LAB',
    received_at_lab: 'DELIVERED_TO_LAB',
  };

  return map[status] || 'WAITING_PHLEB';
}

function normalizePriority(value: unknown): 'normal' | 'urgent' {
  const text = String(value || '').toLowerCase();

  return text === 'urgent' || text === 'stat' ? 'urgent' : 'normal';
}

function normalizeNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;

  const n = Number(value);

  return Number.isFinite(n) ? n : undefined;
}

function normalizeJob(raw: any): PhlebJob {
  const draw = raw?.draw || raw;
  const patient = raw?.patient || {};
  const lab = raw?.lab || {};
  const bundle = raw?.bundle || raw?.specimenBundle || null;

  return {
    id: String(
      raw?.id ||
        raw?.jobId ||
        raw?.orderId ||
        draw?.id ||
        draw?.orderId ||
        '',
    ).trim(),
    displayId: String(
      raw?.displayId ||
        raw?.orderDisplayId ||
        raw?.orderId ||
        draw?.orderId ||
        draw?.id ||
        '',
    ).trim(),
    status: normalizeJobStatus(raw?.status || draw?.status),
    priority: normalizePriority(raw?.priority || raw?.urgency),
    patientName: String(
      raw?.patientName ||
        patient?.name ||
        raw?.patient?.fullName ||
        '',
    ).trim(),
    patientDob: String(raw?.patientDob || patient?.dob || '').trim(),
    patientAddress: String(
      raw?.patientAddress ||
        patient?.address ||
        raw?.collectionAddress ||
        '',
    ).trim(),
    patientArea: String(
      raw?.patientArea ||
        patient?.area ||
        raw?.collectionArea ||
        '',
    ).trim(),
    labId: String(raw?.labId || lab?.id || draw?.partnerId || '').trim(),
    labName: String(
      raw?.labName ||
        lab?.name ||
        raw?.labNameHint ||
        'Assigned lab',
    ).trim(),
    createdAt: String(
      raw?.createdAt ||
        draw?.createdAt ||
        new Date().toISOString(),
    ),
    scheduledFor: raw?.scheduledFor || draw?.scheduledAt || undefined,
    distanceKm: normalizeNumber(raw?.distanceKm),
    etaMinutes: normalizeNumber(raw?.etaMinutes),
    bundleId: raw?.bundleId || bundle?.id || undefined,
    specimenBundleId: raw?.specimenBundleId || bundle?.id || undefined,
    specimenIds: asArray(raw?.specimenIds || bundle?.specimens).map((item) =>
      typeof item === 'string' ? item : String(item?.id || ''),
    ).filter(Boolean),
    encounterId: raw?.encounterId || draw?.encounterId || undefined,
    patientId: raw?.patientId || draw?.patientId || patient?.id || undefined,
    clinicianId: raw?.clinicianId || draw?.clinicianId || undefined,
  };
}

function normalizeJobsResponse(raw: any): PhlebJob[] {
  const payload = unwrapGatewayData(raw);

  const list = asArray(
    payload?.jobs ||
      payload?.items ||
      payload?.orders ||
      payload?.draws ||
      payload,
  );

  return list.map(normalizeJob).filter((job) => Boolean(job.id));
}

function displayHttpError(status: number, body: string) {
  if (status === 501) {
    return 'This MedReach gateway endpoint is not implemented yet.';
  }

  return body || `HTTP ${status}`;
}

export default function PhlebWorkspacePage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [jobs, setJobs] = useState<PhlebJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(
        `/api/phleb-jobs?phlebId=${encodeURIComponent(phlebId)}`,
        {
          cache: 'no-store',
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(displayHttpError(res.status, text));
      }

      const data = await res.json();

      setJobs(normalizeJobsResponse(data));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await load();
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phlebId]);

  async function handleAdvanceStatus(job: PhlebJob) {
    if (job.status === 'DELIVERED_TO_LAB') {
      alert('This job is already delivered to the lab.');
      return;
    }

    const nextStatus = getNextStatus(job.status);

    setSavingJobId(job.id);

    const previousJobs = jobs;

    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id
          ? {
              ...j,
              status: nextStatus,
            }
          : j,
      ),
    );

    try {
      const res = await fetch('/api/jobs/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId: job.id,
          orderId: job.id,
          status: nextStatus,
          phlebId,
          bundleId: job.specimenBundleId || job.bundleId,
          specimenId: job.specimenIds?.[0],
          encounterId: job.encounterId,
          patientId: job.patientId,
          clinicianId: job.clinicianId,
          partnerId: job.labId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        setJobs(previousJobs);
        alert(displayHttpError(res.status, text));
        return;
      }

      await load();
    } catch (e) {
      console.error(e);
      setJobs(previousJobs);
      alert('Network error while updating status.');
    } finally {
      setSavingJobId(null);
    }
  }

  const name = phlebId
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {name} — Phleb Console
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage assigned MedReach home-draw work: travel to patient, collect
            specimen, maintain bundle custody, and deliver to the assigned lab.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <Link href="/" className="text-indigo-600 underline">
            MedReach overview →
          </Link>

          <button
            type="button"
            onClick={() => {
              alert(
                'Patient tracker deep link should open from patient-app once tracking route is finalised.',
              );
            }}
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            Open Patient Tracker
          </button>
        </div>
      </header>

      {loading ? (
        <div className="text-sm text-gray-500">Loading jobs…</div>
      ) : null}

      {err && !loading ? (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      ) : null}

      {!loading && jobs.length === 0 && !err ? (
        <div className="text-sm text-gray-500 border rounded bg-white p-4">
          No active jobs right now.
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="border rounded-xl bg-white p-4 space-y-2 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-gray-500">Order / Draw</div>
                <div className="font-semibold text-sm">
                  {job.displayId || job.id}
                </div>

                <div className="text-xs text-gray-500">
                  {job.priority === 'urgent' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] border border-red-200">
                      Urgent
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 text-[10px] border border-slate-200">
                      Normal
                    </span>
                  )}
                </div>
              </div>

              <span
                className={
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ' +
                  getStatusClasses(job.status)
                }
              >
                {getStatusLabel(job.status)}
              </span>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="font-semibold text-gray-700">Patient: </span>
                {job.patientName || '—'}
                {job.patientDob ? ` (${job.patientDob})` : ''}
              </div>

              <div>
                <span className="font-semibold text-gray-700">Address: </span>
                {job.patientAddress || '—'}
                {job.patientArea ? ` • ${job.patientArea}` : ''}
              </div>

              <div>
                <span className="font-semibold text-gray-700">Lab: </span>
                {job.labName || job.labId || '—'}
              </div>

              {job.specimenBundleId || job.bundleId ? (
                <div>
                  <span className="font-semibold text-gray-700">Bundle: </span>
                  {job.specimenBundleId || job.bundleId}
                </div>
              ) : null}

              {job.distanceKm !== undefined && job.etaMinutes !== undefined ? (
                <div>
                  <span className="font-semibold text-gray-700">ETA: </span>~
                  {job.etaMinutes} min • {job.distanceKm.toFixed(1)} km
                </div>
              ) : null}

              {job.scheduledFor ? (
                <div>
                  <span className="font-semibold text-gray-700">
                    Scheduled:{' '}
                  </span>
                  {new Date(job.scheduledFor).toLocaleString()}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 text-xs mt-2">
              <button
                type="button"
                onClick={() => handleAdvanceStatus(job)}
                disabled={savingJobId === job.id}
                className={
                  'px-3 py-1 rounded border ' +
                  (savingJobId === job.id
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-50')
                }
              >
                {savingJobId === job.id ? 'Updating…' : 'Advance status'}
              </button>

              <Link
                href={`/phleb/${encodeURIComponent(
                  phlebId,
                )}/orders/${encodeURIComponent(job.id)}/label`}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              >
                Print label
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}