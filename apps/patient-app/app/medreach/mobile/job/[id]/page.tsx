// apps/patient-app/app/medreach/mobile/job/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JobStatusPill from '../../../../components/JobStatusPill';
import { normalizeToJobStatus } from '../../../../lib/medreachStatus';

type Job = {
  id: string;
  patient?: string;
  address?: string;
  collectionWindow?: string;
  status?: string;
  eta?: string;
  coords?: { patient?: { lat: number; lng: number } };
};

export default function PhlebJobMobilePage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(params.id as string);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/medreach/jobs/${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setJob((json.job || json) as Job);
      } catch (e) {
        console.warn('phleb mobile: load failed', e);
        setJob(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!job) return;
    setSaving(true);
    try {
      await fetch('/api/medreach/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, status }),
      }).catch(() => {});
      // optimistically update; SSE will reconcile when it arrives
      setJob({ ...job, status });
    } finally {
      setSaving(false);
    }
  };

  const openNav = () => {
    if (!job?.coords?.patient) return;
    const { lat, lng } = job.coords.patient;
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(gmaps, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading job…
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm">
        <div className="text-red-500 font-medium">Job not found</div>
        <button
          className="px-4 py-2 rounded bg-indigo-600 text-white"
          onClick={() => router.back()}
        >
          Back
        </button>
      </main>
    );
  }

  const jobStatus = normalizeToJobStatus(job.status);
  const patientName = job.patient || 'Home collection';

  return (
    <main className="min-h-screen max-w-md mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-400">MedReach</div>
          <h1 className="text-lg font-semibold">{patientName}</h1>
          <div className="text-xs text-gray-500 mt-1">
            Job <span className="font-mono">{job.id}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <JobStatusPill status={jobStatus} />
          <div className="text-[11px] text-gray-500">
            ETA: <span className="font-medium">{job.eta || '—'}</span>
          </div>
        </div>
      </header>

      <section className="bg-white border rounded-lg p-3 text-sm space-y-2">
        <div>
          <div className="text-xxs text-gray-500">Address</div>
          <div className="font-medium">{job.address || '—'}</div>
        </div>
        <div>
          <div className="text-xxs text-gray-500">Collection window</div>
          <div className="font-medium">{job.collectionWindow || '—'}</div>
        </div>
      </section>

      <section className="bg-white border rounded-lg p-3 space-y-2">
        <button
          className="w-full px-4 py-2 rounded bg-indigo-600 text-white text-sm"
          onClick={openNav}
        >
          Open in Google Maps
        </button>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <button
            className="px-3 py-2 rounded bg-gray-100"
            disabled={saving}
            onClick={() => updateStatus('PHLEB_ARRIVED')}
          >
            Arrived
          </button>
          <button
            className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
            disabled={saving}
            onClick={() => updateStatus('SAMPLE_COLLECTED')}
          >
            Sample collected
          </button>
        </div>
      </section>
    </main>
  );
}
