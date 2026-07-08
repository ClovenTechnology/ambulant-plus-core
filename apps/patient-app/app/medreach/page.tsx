// apps/patient-app/app/medreach/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import StatusBadge from '../../components/StatusBadge';
import { toast } from '../../components/ToastMount';
import PhlebContactSheet from '../../components/PhlebContactSheet';

import type {
  PhlebProfile,
  CollectionLocation,
  Coord,
} from '../../components/PhlebMap';

type MedReachStatus = 'Idle' | 'Preparing' | 'Out for delivery' | 'Collected';
type Delivery = {
  id: string;
  patient?: string;
  test?: string;
  status?: MedReachStatus | string;
  eta?: string;
  collectionWindow?: string;
  area?: string;
  patientId?: string;
  [key: string]: any;
};
type FilterKey = 'all' | 'pending' | 'today' | 'collected';

type LabReport = {
  id?: string;
  orderId?: string;
  type?: string;
  createdAt?: string;
  resultStatus?: string;
  resultSummary?: string | null;
  resultPdfUrl?: string | null;
  testResults?: Array<{
    code?: string;
    name?: string;
    value?: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
  }>;
  labName?: string;
  source?: string;
  [key: string]: any;
};

/* ---------- small UI helpers ---------- */

function LiveBadge({
  connected,
  error,
}: {
  connected: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5 text-xs">
      <div
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium ${
          connected
            ? 'bg-green-50 text-green-700 border border-green-100'
            : 'bg-gray-100 text-gray-600 border border-gray-200'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-green-500' : 'bg-gray-400'
          }`}
          aria-hidden
        />
        {connected ? 'Live' : 'Offline'}
      </div>
      {error ? (
        <div className="text-[11px] text-rose-600 max-w-xs">{error}</div>
      ) : (
        <div className="text-[10px] text-gray-400">
          Jobs update in real time when connected.
        </div>
      )}
    </div>
  );
}


function cleanText(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function resultStatusLabel(report: LabReport) {
  return cleanText(report.resultStatus || 'PENDING', 40).toUpperCase();
}

function reportIsVisible(report: LabReport) {
  const status = resultStatusLabel(report);

  return Boolean(report.orderId || report.id) && ['READY', 'SENT', 'COMPLETED'].includes(status);
}

function reportCanBeReviewed(report: LabReport) {
  const status = resultStatusLabel(report);

  return Boolean(report.orderId || report.id) && ['SENT', 'COMPLETED'].includes(status);
}

function reportTitle(report: LabReport) {
  const first = Array.isArray(report.testResults) ? report.testResults[0] : null;

  return cleanText(report.type || first?.name || first?.code || 'MedReach lab report', 160);
}

function reportSummary(report: LabReport) {
  const first = Array.isArray(report.testResults) ? report.testResults[0] : null;

  return cleanText(
    report.resultSummary ||
      (first ? [first.name, first.value, first.unit].filter(Boolean).join(' ') : '') ||
      resultStatusLabel(report),
    240,
  );
}

function reportDateLabel(report: LabReport) {
  const d = new Date(String(report.createdAt || ''));

  if (Number.isNaN(d.getTime())) return 'Date not available';

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ---------- mapping helpers ---------- */

function jobToPhlebProfile(job: Delivery): PhlebProfile {
  const anyJob = job as any;
  return {
    id: anyJob.phlebId || job.id,
    name: anyJob.phlebName || anyJob.phlebotomist || 'Phlebotomist',
    avatar: anyJob.phlebAvatar || anyJob.avatar || undefined,
    rating: anyJob.phlebRating || undefined,
    vehicle: anyJob.phlebVehicle || anyJob.vehicle || 'MedReach fleet',
    phoneMasked: anyJob.phlebPhoneMasked || anyJob.phoneMasked || undefined,
    phone: anyJob.phlebPhone || anyJob.phone || undefined,
    regPlate: anyJob.phlebRegPlate || anyJob.regPlate || undefined,
    visitsCount: anyJob.phlebVisitsCount || undefined,
    labName: anyJob.labName || undefined,
  };
}

function jobToPatientLocation(job: Delivery): CollectionLocation {
  const anyJob = job as any;
  const lat =
    anyJob.patientLat ??
    anyJob.lat ??
    anyJob.locationLat ??
    anyJob.coords?.patient?.lat ??
    null;
  const lng =
    anyJob.patientLng ??
    anyJob.lng ??
    anyJob.locationLng ??
    anyJob.coords?.patient?.lng ??
    null;

  return {
    id: anyJob.patientId || undefined,
    name: job.patient || 'Home collection',
    address:
      anyJob.address ||
      anyJob.location ||
      anyJob.area ||
      'Patient home / collection address',
    coords:
      typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng }
        : null,
    notes: anyJob.collectionWindow || anyJob.slot || undefined,
  };
}

function jobToLabLocation(job: Delivery): CollectionLocation | null {
  const anyJob = job as any;
  const lat = anyJob.labLat ?? anyJob.coords?.lab?.lat ?? null;
  const lng = anyJob.labLng ?? anyJob.coords?.lab?.lng ?? null;
  if (!anyJob.labName && (lat == null || lng == null)) return null;
  return {
    id: anyJob.labId || undefined,
    name: anyJob.labName || 'Lab',
    address: anyJob.labAddress || undefined,
    coords:
      typeof lat === 'number' && typeof lng === 'number'
        ? { lat, lng }
        : null,
  };
}

function jobToCoords(job: Delivery): Coord[] {
  const anyJob = job as any;

  if (Array.isArray(anyJob.coords) && anyJob.coords.length > 0) {
    const arr = anyJob.coords as any[];
    if (typeof arr[0].lat === 'number' && typeof arr[0].lng === 'number') {
      return arr.map((c) => ({
        lat: Number(c.lat),
        lng: Number(c.lng),
        ts: c.ts ? Number(c.ts) : Date.now(),
      }));
    }
  }

  const patientLoc = jobToPatientLocation(job);
  const labLoc = jobToLabLocation(job);

  if (patientLoc.coords && labLoc?.coords) {
    return [
      {
        lat: labLoc.coords.lat,
        lng: labLoc.coords.lng,
        ts: Date.now() - 10 * 60_000,
      },
      {
        lat: patientLoc.coords.lat,
        lng: patientLoc.coords.lng,
        ts: Date.now(),
      },
    ];
  }

  if (patientLoc.coords) {
    const { lat, lng } = patientLoc.coords;
    return [
      { lat: lat + 0.002, lng: lng - 0.002 },
      { lat: lat + 0.001, lng: lng + 0.001 },
      { lat, lng },
    ].map((c, i) => ({ ...c, ts: Date.now() - (3 - i) * 3 * 60_000 }));
  }

  // No synthetic route if live coordinates are unavailable.
  return [];
}

/* ---------- component ---------- */

export default function MedReachPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [reports, setReports] = useState<LabReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null);
  const [submittedReviewOrderIds, setSubmittedReviewOrderIds] = useState<string[]>([]);

  const [sseConnected, setSseConnected] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('pending');

  // Contact state only (no map)
  const [activePhleb, setActivePhleb] = useState<PhlebProfile | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  /* ---------- initial live jobs load ---------- */

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        const res = await fetch('/api/medreach/jobs', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const jobs = Array.isArray(json)
          ? json
          : Array.isArray(json?.jobs)
            ? json.jobs
            : Array.isArray(json?.items)
              ? json.items
              : Array.isArray(json?.data)
                ? json.data
                : [];

        if (!abort) setDeliveries(jobs);
      } catch {
        if (!abort) setDeliveries([]);
      }
    })();

    return () => {
      abort = true;
    };
  }, []);


  /* ---------- initial lab reports load ---------- */

  useEffect(() => {
    let abort = false;

    (async () => {
      setReportsLoading(true);

      try {
        const res = await fetch('/api/medreach/reports', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const rows = Array.isArray(json?.reports)
          ? json.reports
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.data)
              ? json.data
              : [];

        if (!abort) {
          setReports(rows.filter(reportIsVisible));
        }
      } catch {
        if (!abort) setReports([]);
      } finally {
        if (!abort) setReportsLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, []);

  /* ---------- SSE: jobs stream ---------- */

  useEffect(() => {
    let mounted = true;
    let backoff = 500;
    let reconnectTimer: number | null = null;

    const connect = () => {
      try {
        const es = new EventSource('/api/medreach/stream');

        es.onopen = () => {
          if (!mounted) return;
          setSseConnected(true);
          setSseError(null);
          backoff = 500;
        };

        es.onmessage = (e) => {
          if (!mounted) return;
          try {
            const updated = JSON.parse(e.data) as Delivery[];
            if (Array.isArray(updated)) {
              setDeliveries(updated);
            }
          } catch (err) {
            console.warn('MedReach SSE parse failed', err);
          }
        };

        es.onerror = () => {
          if (!mounted) return;
          setSseConnected(false);
          setSseError('Connection error — trying to reconnect');
          try {
            es.close();
          } catch {
            // ignore
          }
          if (reconnectTimer) window.clearTimeout(reconnectTimer);
          reconnectTimer = window.setTimeout(() => {
            backoff = Math.min(30_000, Math.round(backoff * 1.8));
            connect();
          }, backoff);
        };

        (window as any).__medreachEs = es;
      } catch (err: any) {
        if (!mounted) return;
        setSseConnected(false);
        setSseError(String(err));
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try {
        const es = (window as any).__medreachEs as EventSource | undefined;
        es?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  /* ---------- actions ---------- */

  const handleCollect = async (id: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`Mark sample for ${id} as collected?`);
      if (!ok) return;
    }

    setLoadingIds((prev) => [...prev, id]);
    try {
      const res = await fetch('/api/medreach/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Collection failed');
      toast(`MedReach: ${id} marked as collected`, 'success');

      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'Collected' as MedReachStatus,
                eta: (d.eta === 'Delivered' ? d.eta : 'Collected') as any,
              }
            : d,
        ),
      );
    } catch (err) {
      console.error(err);
      toast(`Failed to mark ${id} as collected`, 'error');
    } finally {
      setLoadingIds((prev) => prev.filter((i) => i !== id));
    }
  };


  const handleReportReview = async (report: LabReport, stars: number) => {
    const orderId = cleanText(report.orderId || report.id, 160);

    if (!orderId || !reportCanBeReviewed(report)) return;

    setReviewingOrderId(orderId);

    try {
      const res = await fetch('/api/medreach/lab-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, stars }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || 'Review could not be submitted.');
      }

      setSubmittedReviewOrderIds((prev) => (prev.includes(orderId) ? prev : [...prev, orderId]));
      toast('Thank you - your lab service review has been submitted for moderation.', 'success');
    } catch (error: any) {
      toast(error?.message || 'Review submission failed.', 'error');
    } finally {
      setReviewingOrderId(null);
    }
  };

  /* ---------- filtering ---------- */

  const filteredDeliveries = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    let list = deliveries.slice();

    if (filter === 'pending') {
      list = list.filter((d) => d.status !== 'Collected');
    } else if (filter === 'collected') {
      list = list.filter((d) => d.status === 'Collected');
    } else if (filter === 'today') {
      list = list.filter((d: any) => {
        const t =
          d.collectionWindowStart ||
          d.createdAt ||
          d.at ||
          d.scheduledAt ||
          null;
        if (!t) return true;
        const dt = new Date(t);
        return dt >= startOfToday && dt <= endOfToday;
      });
    }

    list.sort((a: any, b: any) => {
      const ta = a.etaAt || a.scheduledAt || a.at || 0;
      const tb = b.etaAt || b.scheduledAt || b.at || 0;
      if (!ta || !tb) return 0;
      return new Date(ta).getTime() - new Date(tb).getTime();
    });

    return list;
  }, [deliveries, filter]);

  const filterLabel = (key: FilterKey) => {
    switch (key) {
      case 'pending':
        return 'Pending';
      case 'today':
        return 'Today';
      case 'collected':
        return 'Collected';
      default:
        return 'All';
    }
  };


  const visibleReports = useMemo(() => {
    return reports.filter(reportIsVisible).slice(0, 5);
  }, [reports]);

  /* ---------- render ---------- */

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* HEADER + NAV */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">MedReach Lab Dispatch</h1>
          <p className="text-sm text-gray-500 mt-1">
            Phlebotomy dispatch &amp; home sample collection for lab eRx.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border bg-white shadow-sm overflow-hidden text-xs md:text-sm">
              <span className="px-3 py-2 border-r bg-indigo-50 text-indigo-700">
                Dispatch
              </span>
              <Link
                href="/medreach/timeline"
                className="px-3 py-2 border-r hover:bg-gray-50"
              >
                Timeline
              </Link>
              <Link
                href="/medreach/track"
                className="px-3 py-2 hover:bg-gray-50"
              >
                Track
              </Link>
            </div>

            <Link
              href="/careport"
              className="px-3 py-2 border rounded-full bg-white hover:bg-gray-50 text-xs md:text-sm"
            >
              Back to CarePort
            </Link>
          </div>

          <LiveBadge connected={sseConnected} error={sseError} />
        </div>
      </header>


      {/* RESULTS */}
      <section className="rounded-2xl border bg-white shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-950">Recent lab results</h2>
            <p className="text-xs text-gray-500">
              Results published by MedReach labs also appear in Health Records.
            </p>
          </div>

          <Link
            href="/medical-records"
            className="text-xs px-3 py-1.5 border rounded-full bg-white hover:bg-gray-50"
          >
            Open Health Records
          </Link>
        </div>

        {reportsLoading ? (
          <div className="text-sm text-gray-500 border rounded-lg bg-gray-50 p-3">
            Loading lab results...
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="text-sm text-gray-500 border rounded-lg bg-gray-50 p-3">
            No published MedReach lab results yet. Completed reports will appear here after the lab releases them.
          </div>
        ) : (
          <div className="space-y-2">
            {visibleReports.map((report) => {
              const orderId = cleanText(report.orderId || report.id, 160);
              const status = resultStatusLabel(report);
              const canReview = reportCanBeReviewed(report);
              const alreadySubmitted = submittedReviewOrderIds.includes(orderId);
              const isReviewing = reviewingOrderId === orderId;

              return (
                <article
                  key={orderId || report.id || reportTitle(report)}
                  className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-gray-950">{reportTitle(report)}</div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {status}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {reportDateLabel(report)}
                      {orderId ? ' - Order ' + orderId : ''}
                    </div>

                    <div className="mt-2 text-sm text-gray-700">{reportSummary(report)}</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {report.resultPdfUrl ? (
                      <a
                        href={report.resultPdfUrl}
                        className="text-xs px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
                      >
                        View report
                      </a>
                    ) : (
                      <Link
                        href="/medical-records"
                        className="text-xs px-3 py-1.5 border rounded bg-white hover:bg-gray-50"
                      >
                        View in records
                      </Link>
                    )}

                    {canReview ? (
                      alreadySubmitted ? (
                        <span className="text-xs px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Review submitted
                        </span>
                      ) : (
                        <div className="flex items-center gap-1 rounded border bg-white px-2 py-1">
                          <span className="text-[11px] text-gray-500 mr-1">Review</span>
                          {[1, 2, 3, 4, 5].map((stars) => (
                            <button
                              key={stars}
                              type="button"
                              disabled={isReviewing}
                              onClick={() => handleReportReview(report, stars)}
                              className="text-xs font-bold text-amber-600 disabled:opacity-50"
                              aria-label={'Rate lab service ' + stars + ' star' + (stars === 1 ? '' : 's')}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* FILTERS */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs md:text-sm">
          {(['pending', 'today', 'all', 'collected'] as FilterKey[]).map(
            (key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 border-r last:border-r-0 ${
                  filter === key ? 'bg-indigo-50 text-indigo-700' : 'bg-white'
                }`}
              >
                {filterLabel(key)}
              </button>
            ),
          )}
        </div>

        <div className="text-xs text-gray-500">
          Showing {filteredDeliveries.length} of {deliveries.length} jobs
        </div>
      </section>

      {/* JOB CARDS */}
      <section className="space-y-4" aria-live="polite">
        {filteredDeliveries.length === 0 ? (
          <div className="text-sm text-gray-500 border rounded-lg bg-white p-4">
            No MedReach jobs in this view. Try changing filters or check back
            later.
          </div>
        ) : (
          filteredDeliveries.map((d) => {
            const isLoading = loadingIds.includes(d.id);
            const status = d.status as MedReachStatus;
            const anyJob = d as any;

            const testOrPanel = anyJob.testPanel || anyJob.tests || d.drug;
            const address =
              anyJob.address ||
              anyJob.location ||
              anyJob.area ||
              'Home collection';
            const windowLabel = anyJob.collectionWindow || anyJob.slot || null;
            const phlebName = anyJob.phlebName || anyJob.phlebotomist || null;

            const phleb = jobToPhlebProfile(d);

            return (
              <article
                key={d.id}
                className="p-4 bg-white border rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="space-y-1 text-sm">
                  <div className="font-medium">
                    {d.patient || 'Patient'}{' '}
                    <span className="text-xs text-gray-400">• {d.id}</span>
                  </div>
                  {testOrPanel && (
                    <div className="text-gray-700">
                      {typeof testOrPanel === 'string'
                        ? testOrPanel
                        : JSON.stringify(testOrPanel)}
                    </div>
                  )}
                  {d.sig && (
                    <div className="text-gray-500 text-xs">{d.sig}</div>
                  )}
                  <div className="text-gray-500 text-xs">
                    {address}
                    {windowLabel ? ` • ${windowLabel}` : ''}
                  </div>
                  {phlebName && (
                    <div className="text-gray-500 text-xs">
                      Phlebotomist:{' '}
                      <span className="font-medium">{phlebName}</span>
                    </div>
                  )}
                  <div className="text-gray-400 text-xs mt-1">
                    ETA: {d.eta ?? '—'}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-[230px]">
                  <StatusBadge status={status} />

                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePhleb(phleb);
                        setContactOpen(true);
                      }}
                      className="text-xs px-3 py-1 border rounded bg-white hover:bg-gray-50"
                    >
                      Contact
                    </button>

                    <Link
                      href={`/medreach/timeline?id=${encodeURIComponent(
                        d.id,
                      )}`}
                      className="text-xs px-3 py-1 border rounded bg-white hover:bg-gray-50"
                    >
                      Timeline
                    </Link>

                    <Link
                      href={`/medreach/track?id=${encodeURIComponent(d.id)}`}
                      className="text-xs px-3 py-1 border rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    >
                      Patient view
                    </Link>

                    {status !== 'Collected' && (
                      <button
                        type="button"
                        onClick={() => handleCollect(d.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isLoading ? 'Processing…' : 'Mark sample collected'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Contact sheet */}
      <PhlebContactSheet
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        phleb={activePhleb}
      />
    </main>
  );
}
