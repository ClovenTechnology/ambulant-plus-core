'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type {
  LabOrder,
} from '@/app/api/lab-orders/route';
import { getStatusClasses, getStatusLabel } from '@shared/fsm';
import {
  getDefaultEarningsConfig,
  computeJobEarnings,
} from '@/lib/earnings';

type LabOrdersResponse = {
  labId: string;
  assigned: LabOrder[];
  marketplace: LabOrder[];
};

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LabOrdersResponse;
      setData(json);
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
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error('PATCH /api/lab-orders failed', await res.text());
        alert('Unable to update order. It may resync later.');
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
    await callPatch({ orderId, action: 'accept', labId });
  }

  async function handleDecline(orderId: string) {
    await callPatch({ orderId, action: 'decline', labId });
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

      {/* Top summary cards */}
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

      {/* Marketplace section */}
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
                        {order.patientName} • {order.patientArea}
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
                    <ul className="list-disc list-inside space-y-0.5">
                      {order.tests.map((t) => (
                        <li key={t.code}>
                          {t.name} ({t.code})
                        </li>
                      ))}
                    </ul>
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

      {/* Assigned orders section */}
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
                        {order.patientName} • {order.patientArea}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Created:{' '}
                        {new Date(order.createdAt).toLocaleString()}
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
                      <ul className="list-disc list-inside space-y-0.5">
                        {order.tests.map((t) => (
                          <li key={t.code}>
                            {t.name} ({t.code})
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-700 mb-1">
                        Logistics
                      </div>
                      <div>
                        Distance:{' '}
                        {order.distanceKm != null
                          ? `${order.distanceKm.toFixed(1)} km`
                          : '—'}
                      </div>
                      <div>
                        Est. logistics cost:{' '}
                        <span className="font-semibold">
                          R {logisticsZar.toFixed(2)}
                        </span>
                      </div>
                      {order.deliveredToLabAt && (
                        <div>
                          Delivered to lab:{' '}
                          {new Date(
                            order.deliveredToLabAt,
                          ).toLocaleString()}
                        </div>
                      )}
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
                      {order.testResults && order.testResults.length > 0 && (
                        <div className="text-[11px] text-gray-500">
                          {order.testResults.length} structured test
                          {order.testResults.length > 1 ? 's' : ''} captured.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Results actions */}
                  <div className="border-t pt-3 mt-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="text-[11px] text-gray-500">
                      {canWorkOnResults ? (
                        <span className="text-emerald-700">
                          Sample has been delivered to the lab. You can now capture
                          results.
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          Waiting for sample delivery from phlebotomist before results
                          can be recorded.
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Link
                        href={`/lab/${encodeURIComponent(
                          labId,
                        )}/orders/${encodeURIComponent(
                          order.id,
                        )}/result`}
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
