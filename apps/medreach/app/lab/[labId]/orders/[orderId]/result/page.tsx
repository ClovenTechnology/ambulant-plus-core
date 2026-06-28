// apps/medreach/app/lab/[labId]/orders/[orderId]/result/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getStatusLabel,
  getStatusClasses,
  type JobStatus,
} from '@shared/fsm';

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

function normalizePatchResponse(raw: any): LabOrder {
  return normalizeOrder(unwrapGatewayData(raw));
}

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

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = normalizeLabOrdersResponse(await res.json(), labId);

      const found =
        data.assigned.find((o) => o.id === orderId || o.displayId === orderId) ||
        data.marketplace.find((o) => o.id === orderId || o.displayId === orderId) ||
        null;

      if (!found) {
        setErr('Order not found for this lab.');
        setOrder(null);
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

      setTestResults(merged.length ? merged : existing);
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

      next[index] = {
        ...next[index],
        ...patch,
      };

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
          labId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const updated = normalizePatchResponse(await res.json());

      setOrder(updated);
      setResultStatus(updated.resultStatus);
      setResultSummary(updated.resultSummary || '');
      setTestResults(updated.testResults?.length ? updated.testResults : testResults);
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
  const deliveredAt = order.deliveredToLabAt
    ? new Date(order.deliveredToLabAt)
    : null;

  return (
    <>
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

        {order.status !== 'DELIVERED_TO_LAB' ? (
          <div className="no-print mb-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            Sample has <strong>not yet been marked as delivered</strong>.
            Results are shown in read-only mode. Once the specimen is received
            at the lab, you can edit and finalise this report.
          </div>
        ) : null}

        {err ? (
          <div className="no-print mb-4 text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {err}
          </div>
        ) : null}

        <div className="report-shell bg-white border rounded-xl shadow-sm p-6 space-y-6">
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
                <div className="text-[11px] text-gray-600">
                  Tel: 078 552 6420
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-gray-600 space-y-1">
              <div className="font-semibold text-gray-900">
                Laboratory Report
              </div>
              <div>Report ID: {order.displayId}</div>
              <div>Created: {createdAt.toLocaleString()}</div>

              {order.resultReadyAt ? (
                <div>
                  Results ready: {new Date(order.resultReadyAt).toLocaleString()}
                </div>
              ) : null}

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

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-gray-800">Patient</div>
              <div className="text-gray-700">{order.patientName || '—'}</div>
              <div className="text-gray-600">DOB: {order.patientDob || '—'}</div>
              <div className="text-gray-600">
                ID / Identifier: {order.patientIdentifier || '—'}
              </div>
              <div className="text-gray-600">
                Gender: {order.patientGender || '—'}
              </div>
              <div className="text-gray-600">
                Address: {order.patientAddress || '—'}{' '}
                {order.patientArea ? `(${order.patientArea})` : ''}
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

              {deliveredAt ? (
                <div className="text-gray-600">
                  Sample received: {deliveredAt.toLocaleString()}
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="font-semibold text-gray-800">Phlebotomist</div>
              <div className="text-gray-700">{order.phlebName || '—'}</div>
              <div className="text-gray-600">
                Phleb ID: {order.phlebId || '—'}
              </div>
              <div className="text-gray-600">
                Encounter ID: {order.encounterId || '—'}
              </div>
              <div className="text-gray-600">
                Bundle ID: {order.specimenBundleId || '—'}
              </div>
            </div>
          </section>

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
                      <tr key={`${tr.code}-${idx}`} className="border-t align-top">
                        <td className="px-2 py-1">
                          {editable ? (
                            <input
                              type="text"
                              className="w-full border rounded px-1 py-0.5"
                              value={tr.category || ''}
                              onChange={(e) =>
                                updateTestResult(idx, { category: e.target.value })
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
                                updateTestResult(idx, { value: e.target.value })
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
                                updateTestResult(idx, { units: e.target.value })
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
                                  flag: e.target.value as LabTestResultFlag,
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
                              {!tr.flag || tr.flag === 'UNSPECIFIED' ? '—' : ''}
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

                  {testResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-2 py-3 text-center text-gray-500"
                      >
                        No tests defined for this order.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

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

          <footer className="pt-4 border-t text-[10px] text-gray-500 flex flex-col md:flex-row justify-between gap-2">
            <div>
              Results prepared by{' '}
              <span className="font-semibold">{niceLabName}</span> on MedReach
              Labs and Diagnostic Network via Ambulant+ © 2025
            </div>

            <div className="text-right">
              This report is intended for medical use only. Please correlate
              with clinical findings.
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}