'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LabOrder, LabTestResult, LabResultStatus } from '@/app/api/lab-orders/route';
import { getStatusLabel, getStatusClasses } from '@shared/fsm';

type LabOrdersResponse = {
  labId: string;
  assigned: LabOrder[];
  marketplace: LabOrder[];
};

export default function LabResultReportPage() {
  const params = useParams<{ labId: string; orderId: string }>();
  const router = useRouter();
  const labId = params.labId;
  const orderId = params.orderId;

  const [order, setOrder] = useState<LabOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [testResults, setTestResults] = useState<LabTestResult[]>([]);
  const [resultStatus, setResultStatus] = useState<LabResultStatus>('PENDING');
  const [resultSummary, setResultSummary] = useState('');

  const niceLabName = useMemo(
    () =>
      labId
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' '),
    [labId],
  );

  const canEdit = order?.status === 'DELIVERED_TO_LAB';

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lab-orders?labId=${encodeURIComponent(labId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LabOrdersResponse;

      const found =
        data.assigned.find((o) => o.id === orderId) ||
        data.marketplace.find((o) => o.id === orderId) ||
        null;

      if (!found) {
        setErr('Order not found for this lab.');
        setOrder(null);
        setLoading(false);
        return;
      }

      setOrder(found);
      setResultStatus(found.resultStatus);
      setResultSummary(found.resultSummary || '');

      const existing = found.testResults || [];
      const merged: LabTestResult[] = found.tests.map((t) => {
        const match = existing.find((r) => r.code === t.code) || null;
        return {
          code: t.code,
          name: t.name,
          category: match?.category || '',
          sampleType: match?.sampleType || '',
          value: match?.value || '',
          units: match?.units || '',
          referenceRange: match?.referenceRange || '',
          flag: match?.flag || 'UNSPECIFIED',
          comments: match?.comments || '',
        };
      });

      setTestResults(merged);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load order');
      setOrder(null);
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
  }, [labId, orderId]);

  function updateTestResult(index: number, patch: Partial<LabTestResult>) {
    setTestResults((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function handleSave(statusOverride?: LabResultStatus) {
    if (!order) return;

    const finalStatus = statusOverride ?? resultStatus;

    setSaving(true);
    setErr(null);

    try {
      const res = await fetch('/api/lab-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          action: 'updateResult',
          resultStatus: finalStatus,
          resultSummary,
          testResults,
        }),
      });

      if (!res.ok) {
        console.error('updateResult failed', await res.text());
        throw new Error(`HTTP ${res.status}`);
      }

      const updated = (await res.json()) as LabOrder;
      setOrder(updated);
      setResultStatus(updated.resultStatus);
      setResultSummary(updated.resultSummary || '');
      setTestResults(updated.testResults || testResults);
      alert('Results saved.');
    } catch (e: any) {
      setErr(e?.message || 'Unable to save results');
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading report…
      </main>
    );
  }

  if (err || !order) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load report.'}
      </main>
    );
  }

  const createdAt = new Date(order.createdAt);
  const deliveredAt = order.deliveredToLabAt ? new Date(order.deliveredToLabAt) : null;

  return (
    <>
      {/* Print styles */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
          }
          main {
            margin: 0;
            padding: 0;
          }
          .report-shell {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Top action bar (only shows on-screen) */}
        <div className="no-print mb-4 flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
          >
            ← Back to lab workspace
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !canEdit}
              className={
                'px-3 py-1 rounded border ' +
                (canEdit
                  ? 'bg-white hover:bg-gray-50'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed') +
                (saving ? ' opacity-70' : '')
              }
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('READY')}
              disabled={saving || !canEdit}
              className={
                'px-3 py-1 rounded border ' +
                (canEdit
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed') +
                (saving ? ' opacity-70' : '')
              }
            >
              Mark results ready
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        {order.status !== 'DELIVERED_TO_LAB' && (
          <div className="no-print mb-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            Sample has <strong>not yet been marked as delivered</strong>. Results are
            shown in read-only mode. Once the phlebotomist marks the job as{' '}
            <code>DELIVERED_TO_LAB</code>, you can edit and finalise this report.
          </div>
        )}

        {err && (
          <div className="no-print mb-4 text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {err}
          </div>
        )}

        {/* Report shell */}
        <div className="report-shell bg-white border rounded-xl shadow-sm p-6 space-y-6">
          {/* Header */}
          <header className="flex items-start justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-3">
              <img
                src="/medreach-logo.png"
                alt="MedReach"
                className="w-10 h-10 object-contain"
              />
              <div>
                <div className="font-semibold text-gray-900 text-sm">
                  MedReach Labs &amp; Diagnostics
                </div>
                <div className="text-[11px] text-gray-600">
                  0B Meadowbrook Ln, Bryanston 2021
                </div>
                <div className="text-[11px] text-gray-600">Tel: 078 552 6420</div>
              </div>
            </div>
            <div className="text-right text-[11px] text-gray-600 space-y-1">
              <div className="font-semibold text-gray-900">
                Laboratory Report
              </div>
              <div>Report ID: {order.displayId}</div>
              <div>Created: {createdAt.toLocaleString()}</div>
              {order.resultReadyAt && (
                <div>
                  Results ready:{' '}
                  {new Date(order.resultReadyAt).toLocaleString()}
                </div>
              )}
              <div className="mt-1">
                <span
                  className={
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ' +
                    getStatusClasses(order.status)
                  }
                >
                  {getStatusLabel(order.status)}
                </span>
              </div>
            </div>
          </header>

          {/* Patient / lab / phleb details */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-gray-800">Patient</div>
              <div className="text-gray-700">{order.patientName}</div>
              <div className="text-gray-600">
                DOB: {order.patientDob || '—'}
              </div>
              <div className="text-gray-600">
                ID / Identifier: {order.patientIdentifier || '—'}
              </div>
              <div className="text-gray-600">
                Gender: {order.patientGender || '—'}
              </div>
              <div className="text-gray-600">
                Address: {order.patientAddress} ({order.patientArea})
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-gray-800">Laboratory</div>
              <div className="text-gray-700">{niceLabName}</div>
              <div className="text-gray-600">
                Lab hint: {order.labNameHint || '—'}
              </div>
              <div className="text-gray-600">
                Lab city: {order.labCityHint || '—'}
              </div>
              {deliveredAt && (
                <div className="text-gray-600">
                  Sample received: {deliveredAt.toLocaleString()}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-gray-800">Phlebotomist</div>
              <div className="text-gray-700">
                {order.phlebName || '—'}
              </div>
              <div className="text-gray-600">
                Phleb ID: {order.phlebId || '—'}
              </div>
              <div className="text-gray-600">
                Encounter ID: {order.encounterId || '—'}
              </div>
            </div>
          </section>

          {/* Tests table */}
          <section>
            <div className="font-semibold text-gray-800 text-sm mb-2">
              Test Results
            </div>
            <div className="border rounded overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Category
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Test
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Result
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Units
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Reference range
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Flag
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Sample
                    </th>
                    <th className="px-2 py-1 text-left font-medium text-gray-600">
                      Comments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((tr, idx) => {
                    const editable = canEdit;
                    return (
                      <tr
                        key={tr.code}
                        className="border-t align-top"
                      >
                        <td className="px-2 py-1">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.category || ''}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  category: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span>{tr.category || '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <div className="font-medium text-gray-800">
                            {tr.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {tr.code}
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.value || ''}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  value: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span>{tr.value || '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.units || ''}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  units: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span>{tr.units || '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.referenceRange || ''}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  referenceRange: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span>{tr.referenceRange || '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <select
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.flag || 'UNSPECIFIED'}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  flag: e.target.value as LabTestResult['flag'],
                                })
                              }
                            >
                              <option value="UNSPECIFIED">—</option>
                              <option value="LOW">Low</option>
                              <option value="NORMAL">Normal</option>
                              <option value="HIGH">High</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          ) : (
                            <span>
                              {tr.flag === 'LOW' && 'Low'}
                              {tr.flag === 'NORMAL' && 'Normal'}
                              {tr.flag === 'HIGH' && 'High'}
                              {tr.flag === 'ABNORMAL' && 'Abnormal'}
                              {!tr.flag || tr.flag === 'UNSPECIFIED'
                                ? '—'
                                : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.sampleType || ''}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  sampleType: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span>{tr.sampleType || '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          {editable ? (
                            <textarea
                              className="w-full border rounded px-1 py-0.5 min-h-[40px]"
                              value={tr.comments || ''}
                              onChange={(e) =>
                                updateTestResult(idx, {
                                  comments: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span>{tr.comments || '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {testResults.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-2 py-3 text-center text-gray-500"
                      >
                        No tests defined for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Overall comments / interpretation */}
          <section className="space-y-1 text-xs">
            <div className="font-semibold text-gray-800">
              Comments / Interpretation
            </div>
            {canEdit ? (
              <textarea
                className="w-full border rounded px-2 py-1 min-h-[80px] text-xs"
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
              />
            ) : (
              <div className="text-gray-700 whitespace-pre-wrap min-h-[40px]">
                {resultSummary || 'No comments yet.'}
              </div>
            )}
          </section>

          {/* Footer */}
          <footer className="pt-4 border-t text-[10px] text-gray-500 flex flex-col md:flex-row justify-between gap-2">
            <div>
              Results prepared by <span className="font-semibold">{niceLabName}</span>{' '}
              on MedReach Labs and Diagnostic Network via Ambulant+ © 2025
            </div>
            <div className="text-right">
              This report is intended for medical use only. Please correlate with
              clinical findings.
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
