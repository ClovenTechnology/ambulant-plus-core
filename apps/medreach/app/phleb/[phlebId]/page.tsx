'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { PhlebJob, PhlebJobStatus } from '@/app/api/phleb-jobs/route';
import { getNextStatus, getStatusClasses, getStatusLabel } from '@shared/fsm';

export default function PhlebWorkspacePage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;
  const [jobs, setJobs] = useState<PhlebJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/phleb-jobs?phlebId=${encodeURIComponent(phlebId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setJobs(data.jobs || []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load jobs');
        setJobs([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [phlebId]);

  async function handleAdvanceStatus(job: PhlebJob) {
    if (job.status === 'DELIVERED_TO_LAB') {
      alert('This job is already delivered to the lab.');
      return;
    }

    const nextStatus = getNextStatus(job.status as PhlebJobStatus);

    setJobs((prev) =>
      prev.map((j) =>
        j.id === job.id ? { ...j, status: nextStatus } : j,
      ),
    );

    try {
      const res = await fetch('/api/jobs/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, status: nextStatus }),
      });

      if (!res.ok) {
        console.error('Status update failed', await res.text());
        alert('Unable to persist status update. It may resync from the server later.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while updating status. It may resync later.');
    }
  }

  const name =
    phlebId
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
            View, accept, and manage blood draw jobs. Status updates flow to labs and
            patient tracking.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <Link
            href="/"
            className="text-indigo-600 underline"
          >
            MedReach overview →
          </Link>
          <button
            type="button"
            onClick={() => {
              alert('TODO: open patient tracker in patient-app with proper deep link.');
            }}
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            Open Patient Tracker
          </button>
        </div>
      </header>

      {loading && (
        <div className="text-sm text-gray-500">Loading jobs…</div>
      )}

      {err && !loading && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}

      {!loading && jobs.length === 0 && !err && (
        <div className="text-sm text-gray-500 border rounded bg-white p-4">
          No active jobs right now.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="border rounded-xl bg-white p-4 space-y-2 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-gray-500">Order</div>
                <div className="font-semibold text-sm">{job.displayId}</div>
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
                {job.patientName} ({job.patientDob})
              </div>
              <div>
                <span className="font-semibold text-gray-700">Address: </span>
                {job.patientAddress} • {job.patientArea}
              </div>
              <div>
                <span className="font-semibold text-gray-700">Lab: </span>
                {job.labName}
              </div>
              {job.distanceKm !== undefined && job.etaMinutes !== undefined && (
                <div>
                  <span className="font-semibold text-gray-700">ETA: </span>
                  ~{job.etaMinutes} min • {job.distanceKm.toFixed(1)} km
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs mt-2">
              <button
                type="button"
                onClick={() => handleAdvanceStatus(job)}
                className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
              >
                Advance status
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
