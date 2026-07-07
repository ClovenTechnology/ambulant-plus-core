// apps/medreach/app/lab/[labId]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  getStatusClasses,
  getStatusLabel,
  type JobStatus,
} from '@shared/fsm';
import {
  getDefaultEarningsConfig,
  computeJobEarnings,
} from '@/lib/earnings';

type LabTestResultFlag =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'ABNORMAL'
  | 'UNSPECIFIED';

type LabTestResult = {
  code: string;
  name: string;
  category?: string;
  sampleType?: string;
  value?: string;
  units?: string;
  referenceRange?: string;
  flag?: LabTestResultFlag;
  comments?: string;
};

type LabResultStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SENT';

type LabOrder = {
  id: string;
  displayId: string;
  labId?: string | null;
  eligibleLabs: string[];
  declinedByLabs: string[];
  status: JobStatus;
  rawStatus?: string;
  resultStatus: LabResultStatus;
  resultSummary?: string;
  resultPdfUrl?: string;
  testResults?: LabTestResult[];
  patientId?: string;
  encounterId?: string;
  patientName: string;
  patientDob: string;
  patientGender?: string;
  patientIdentifier?: string;
  patientAddress: string;
  patientArea: string;
  labNameHint?: string;
  labCityHint?: string;
  phlebId?: string;
  phlebName?: string;
  tests: { code: string; name: string }[];
  createdAt: string;
  collectionTime?: string;
  deliveredToLabAt?: string;
  receivedAtLabAt?: string;
  resultReadyAt?: string;
  resultSentAt?: string;
  specimenBundleId?: string;
  distanceKm?: number;
};

type LabOrdersResponse = {
  labId: string;
  assigned: LabOrder[];
  marketplace: LabOrder[];
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

function normalizeResultStatus(value: unknown): LabResultStatus {
  const status = String(value || '').toUpperCase();

  if (
    status === 'PENDING' ||
    status === 'IN_PROGRESS' ||
    status === 'READY' ||
    status === 'SENT'
  ) {
    return status;
  }

  return 'PENDING';
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

  return map[status] || 'WAITING_LAB_SELECTION';
}

function normalizeTest(raw: any): { code: string; name: string } {
  return {
    code: String(raw?.code || raw?.loincCode || raw?.name || '').trim(),
    name: String(raw?.name || raw?.code || raw?.loincCode || 'Unnamed test').trim(),
  };
}

function normalizeTestResult(raw: any): LabTestResult {
  return {
    code: String(raw?.code || raw?.loincCode || raw?.name || '').trim(),
    name: String(raw?.name || raw?.code || raw?.loincCode || 'Unnamed test').trim(),
    category: String(raw?.category || '').trim(),
    sampleType: String(raw?.sampleType || raw?.specimenType || '').trim(),
    value:
      raw?.value != null
        ? String(raw.value)
        : raw?.valueNum != null
          ? String(raw.valueNum)
          : '',
    units: String(raw?.units || raw?.unit || '').trim(),
    referenceRange: String(raw?.referenceRange || '').trim(),
    flag: normalizeResultFlag(raw?.flag),
    comments: String(raw?.comments || raw?.comment || '').trim(),
  };
}

function normalizeResultFlag(value: unknown): LabTestResultFlag {
  const flag = String(value || '').toUpperCase();

  if (
    flag === 'LOW' ||
    flag === 'NORMAL' ||
    flag === 'HIGH' ||
    flag === 'ABNORMAL'
  ) {
    return flag;
  }

  return 'UNSPECIFIED';
}

function normalizeOrder(raw: any): LabOrder {
  const tests = asArray(raw?.tests).map(normalizeTest);
  const testResults = asArray(raw?.testResults).map(normalizeTestResult);
  const status = normalizeJobStatus(raw?.status);

  return {
    id: String(raw?.id || raw?.orderId || raw?.displayId || '').trim(),
    displayId: String(raw?.displayId || raw?.id || raw?.orderId || '').trim(),
    labId: raw?.labId ?? null,
    eligibleLabs: asArray(raw?.eligibleLabs).map(String),
    declinedByLabs: asArray(raw?.declinedByLabs).map(String),
    status,
    rawStatus: String(raw?.status || ''),
    resultStatus: normalizeResultStatus(raw?.resultStatus),
    resultSummary: raw?.resultSummary || undefined,
    resultPdfUrl: raw?.resultPdfUrl || undefined,
    testResults,
    patientId: raw?.patientId || undefined,
    encounterId: raw?.encounterId || undefined,
    patientName: String(raw?.patientName || '').trim(),
    patientDob: String(raw?.patientDob || '').trim(),
    patientGender: raw?.patientGender || undefined,
    patientIdentifier: raw?.patientIdentifier || undefined,
    patientAddress: String(raw?.patientAddress || '').trim(),
    patientArea: String(raw?.patientArea || '').trim(),
    labNameHint: raw?.labNameHint || raw?.labName || undefined,
    labCityHint: raw?.labCityHint || undefined,
    phlebId: raw?.phlebId || undefined,
    phlebName: raw?.phlebName || undefined,
    tests,
    createdAt: raw?.createdAt || new Date().toISOString(),
    collectionTime: raw?.collectionTime || undefined,
    deliveredToLabAt:
      raw?.deliveredToLabAt || raw?.receivedAtLabAt || raw?.acceptedAt || undefined,
    receivedAtLabAt: raw?.receivedAtLabAt || undefined,
    resultReadyAt: raw?.resultReadyAt || undefined,
    resultSentAt: raw?.resultSentAt || undefined,
    specimenBundleId: raw?.specimenBundleId || undefined,
    distanceKm:
      typeof raw?.distanceKm === 'number'
        ? raw.distanceKm
        : raw?.distanceKm != null
          ? Number(raw.distanceKm)
          : undefined,
  };
}

function normalizeLabOrdersResponse(raw: any, labId: string): LabOrdersResponse {
  const payload = unwrapGatewayData(raw);

  return {
    labId: String(payload?.labId || labId),
    assigned: asArray(payload?.assigned || payload?.items || payload?.orders)
      .map(normalizeOrder)
      .filter((order) => Boolean(order.id)),
    marketplace: asArray(payload?.marketplace)
      .map(normalizeOrder)
      .filter((order) => Boolean(order.id)),
  };
}

function displayHttpError(status: number, body: string) {
  if (status === 501) {
    return 'The MedReach gateway has not exposed this operation yet.';
  }

  return body || `HTTP ${status}`;
}

export default function LabWorkspacePage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [data, setData] = useState<LabOrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  const earningsConfig = useMemo(() => getDefaultEarningsConfig(), []);

  const niceLabName = useMemo(
    () =>
      labId
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
    [labId],
  );

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/lab-orders?labId=${encodeURIComponent(labId)}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(displayHttpError(res.status, text));
      }

      const json = await res.json();
      setData(normalizeLabOrdersResponse(json, labId));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load lab orders');
      setData(null);
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
  }, [labId]);

  async function callPatch(body: any) {
    setSavingOrderId(body.orderId);

    try {
      const res = await fetch('/api/lab-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          labId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('PATCH /api/lab-orders failed', text);
        alert(displayHttpError(res.status, text));
      } else {
        await load();
      }
    } catch (e) {
      console.error(e);
      alert('Network error while updating order.');
    } finally {
      setSavingOrderId(null);
    }
  }

  async function handleAccept(orderId: string) {
    await callPatch({ orderId, action: 'accept' });
  }

  async function handleDecline(orderId: string) {
    await callPatch({ orderId, action: 'decline' });
  }

  const incomingCount = data?.marketplace.length ?? 0;
  const activeCount =
    data?.assigned.filter((o) => o.status !== 'DELIVERED_TO_LAB').length ?? 0;
  const resultsReadyCount =
    data?.assigned.filter((o) => o.resultStatus === 'READY').length ?? 0;

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading lab workspace…
      </main>
    );
  }

  if (err || !data) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load lab workspace.'}
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {niceLabName} — Lab Workspace
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Accept incoming MedReach orders, track sample logistics, and upload
            structured results once samples have been delivered to the lab.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Incoming marketplace orders</div>
          <div className="text-2xl font-semibold mt-1">{incomingCount}</div>
        </div>

        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Active lab orders</div>
          <div className="text-2xl font-semibold mt-1">{activeCount}</div>
        </div>

        <div className="rounded-xl bg-white border p-4 shadow-sm">
          <div className="text-xs text-gray-500">Results ready</div>
          <div className="text-2xl font-semibold mt-1">
            {resultsReadyCount}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Incoming Marketplace Orders
          </h2>
          <div className="text-xs text-gray-500">
            Orders visible to this lab but not yet accepted by any lab.
          </div>
        </div>

        {data.marketplace.length === 0 ? (
          <div className="text-xs text-gray-500 border rounded bg-white p-4">
            No marketplace orders for this lab right now.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {data.marketplace.map((order) => {
              const logisticsZar = computeJobEarnings(
                order.distanceKm,
                earningsConfig,
              );

              return (
                <div
                  key={order.id}
                  className="border rounded-xl bg-white p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-gray-500">Order</div>
                      <div className="font-semibold text-sm">
                        {order.displayId}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {order.patientName || 'Patient'} •{' '}
                        {order.patientArea || 'Area unavailable'}
                      </div>
                    </div>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-slate-50 text-slate-700 border-slate-200">
                      Waiting for lab
                    </span>
                  </div>

                  <div className="text-xs text-gray-600">
                    <div className="font-semibold text-gray-700 mb-1">
                      Requested tests
                    </div>

                    {order.tests.length ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {order.tests.map((t, idx) => (
                          <li key={`${t.code}-${idx}`}>
                            {t.name} ({t.code || '—'})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-gray-400">No tests listed.</div>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">
                      Est. logistics cost:
                    </span>{' '}
                    R {logisticsZar.toFixed(2)}{' '}
                    <span className="text-[11px] text-gray-400">
                      (base {earningsConfig.baseCalloutFeeZAR} +{' '}
                      {earningsConfig.perKmAfterFreeZAR} per km after{' '}
                      {earningsConfig.freeKm} km)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs mt-2">
                    <button
                      type="button"
                      onClick={() => handleAccept(order.id)}
                      disabled={savingOrderId === order.id}
                      className={
                        'px-3 py-1 rounded border text-xs ' +
                        (savingOrderId === order.id
                          ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                          : 'bg-black text-white hover:bg-gray-900')
                      }
                    >
                      {savingOrderId === order.id
                        ? 'Accepting…'
                        : 'Accept for this lab'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDecline(order.id)}
                      disabled={savingOrderId === order.id}
                      className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
                    >
                      Skip / decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Lab Orders for {niceLabName}
          </h2>
          <div className="text-xs text-gray-500">
            Track logistics and open structured MedReach reports once samples are
            delivered to the lab.
          </div>
        </div>

        {data.assigned.length === 0 ? (
          <div className="text-xs text-gray-500 border rounded bg-white p-4">
            No orders assigned to this lab yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.assigned.map((order) => {
              const logisticsZar = computeJobEarnings(
                order.distanceKm,
                earningsConfig,
              );
              const canWorkOnResults = order.status === 'DELIVERED_TO_LAB';

              return (
                <div
                  key={order.id}
                  className="border rounded-xl bg-white p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-gray-500">Order</div>
                      <div className="font-semibold text-sm">
                        {order.displayId}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {order.patientName || 'Patient'} •{' '}
                        {order.patientArea || 'Area unavailable'}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Created: {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ' +
                          getStatusClasses(order.status)
                        }
                      >
                        {getStatusLabel(order.status)}
                      </span>

                      <span
                        className={
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ' +
                          (order.resultStatus === 'PENDING'
                            ? 'bg-slate-50 text-slate-700 border-slate-200'
                            : order.resultStatus === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : order.resultStatus === 'READY'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200')
                        }
                      >
                        {order.resultStatus === 'PENDING' && 'Results pending'}
                        {order.resultStatus === 'IN_PROGRESS' && 'In processing'}
                        {order.resultStatus === 'READY' && 'Results ready'}
                        {order.resultStatus === 'SENT' && 'Results sent'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-700">
                    <div>
                      <div className="font-semibold text-gray-700 mb-1">
                        Requested tests
                      </div>

                      {order.tests.length ? (
                        <ul className="list-disc list-inside space-y-0.5">
                          {order.tests.map((t, idx) => (
                            <li key={`${t.code}-${idx}`}>
                              {t.name} ({t.code || '—'})
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-gray-400">No tests listed.</div>
                      )}
                    </div>

                    <div>
                      <div className="font-semibold text-gray-700 mb-1">
                        Logistics
                      </div>
                      <div>
                        Distance:{' '}
                        {order.distanceKm != null &&
                        Number.isFinite(order.distanceKm)
                          ? `${order.distanceKm.toFixed(1)} km`
                          : '—'}
                      </div>
                      <div>
                        Est. logistics cost:{' '}
                        <span className="font-semibold">
                          R {logisticsZar.toFixed(2)}
                        </span>
                      </div>

                      {order.deliveredToLabAt ? (
                        <div>
                          Delivered to lab:{' '}
                          {new Date(order.deliveredToLabAt).toLocaleString()}
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <div className="font-semibold text-gray-700 mb-1">
                        Results (summary)
                      </div>

                      {order.resultSummary ? (
                        <div className="text-[11px] text-gray-700 mb-1 line-clamp-3">
                          {order.resultSummary}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400 mb-1">
                          No summary yet.
                        </div>
                      )}

                      {order.testResults && order.testResults.length > 0 ? (
                        <div className="text-[11px] text-gray-500">
                          {order.testResults.length} structured test
                          {order.testResults.length > 1 ? 's' : ''} captured.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t pt-3 mt-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="text-[11px] text-gray-500">
                      {canWorkOnResults ? (
                        <span className="text-emerald-700">
                          Sample has been delivered to the lab. You can now
                          capture results.
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          Waiting for sample delivery from phlebotomist before
                          results can be recorded.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      <Link
                        href={`/lab/${encodeURIComponent(
                          labId,
                        )}/orders/${encodeURIComponent(order.id)}/result`}
                        className={
                          'px-3 py-1 rounded border text-xs ' +
                          (canWorkOnResults
                            ? 'bg-black text-white hover:bg-gray-900'
                            : 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none')
                        }
                      >
                        Open MedReach report
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}