'use client';

import { useEffect, useState } from 'react';

type CarePortStatus = 'Assigned' | 'At pharmacy' | 'Picked up' | 'Out for delivery' | 'Delivered';

export type CarePortJob = {
  id: string;
  pharmacyId: string;
  patient: string;
  address: string;
  status: CarePortStatus;
  eta?: string;
};

type JobsResponse = { jobs: CarePortJob[] };

const DEMO_RIDER_ID = 'rider-001';

export default function RiderJobsPage() {
  const [jobs, setJobs] = useState<CarePortJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs?riderId=${encodeURIComponent(DEMO_RIDER_ID)}`, {
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as JobsResponse;
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e: any) {
      console.warn('rider jobs load failed', e);
      setError('Unable to load jobs — using mock list if available.');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onUpdateStatus = async (id: string, status: CarePortStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { job: CarePortJob };
      setJobs((prev) => prev.map((j) => (j.id === id ? data.job : j)));
    } catch (e) {
      console.error(e);
      alert('Failed to update job status – please retry.');
    } finally {
      setUpdatingId(null);
    }
  };

  const patientAppBase =
    process.env.NEXT_PUBLIC_PATIENT_APP_BASE_URL || 'http://localhost:3000';

  return (
    <main className="space-y-4">
      <section className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My CarePort jobs</h2>
          <p className="text-xs text-gray-500 mt-1">
            Rider view. Updates here drive the CarePort delivery tracker in the patient app.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
        >
          Refresh
        </button>
      </section>

      {error && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500">Loading jobs…</div>
      )}

      <section className="space-y-3">
        {jobs.length === 0 ? (
          <div className="text-sm text-gray-500 bg-white border rounded p-3">
            No active jobs.
          </div>
        ) : (
          jobs.map((j) => {
            const actions: CarePortStatus[] =
              j.status === 'Assigned'
                ? ['At pharmacy']
                : j.status === 'At pharmacy'
                ? ['Picked up']
                : j.status === 'Picked up'
                ? ['Out for delivery']
                : j.status === 'Out for delivery'
                ? ['Delivered']
                : [];

            const patientLink = `${patientAppBase}/careport/track`;

            return (
              <article
                key={j.id}
                className="bg-white border rounded-lg p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {j.patient}{' '}
                      <span className="text-xs text-gray-400">• {j.id}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{j.address}</div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div className="uppercase tracking-wide text-[10px] text-gray-400">
                      Status
                    </div>
                    <div className="font-medium">{j.status}</div>
                    <div className="mt-1">ETA: {j.eta ?? '—'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-between items-center mt-2">
                  <div className="flex flex-wrap gap-2">
                    {actions.map((st) => (
                      <button
                        key={st}
                        disabled={updatingId === j.id}
                        onClick={() => onUpdateStatus(j.id, st)}
                        className="px-3 py-1 rounded border bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {updatingId === j.id ? 'Updating…' : st}
                      </button>
                    ))}
                  </div>

                  <a
                    href={patientLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1 rounded border bg-white hover:bg-gray-50"
                  >
                    Open patient tracker →
                  </a>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
