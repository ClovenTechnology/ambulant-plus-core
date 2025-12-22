'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

// Simple placeholder lookup; later you'll fetch real data by orderId
function buildLabelData(orderId: string) {
  // In a real system you'd call something like:
  // GET /api/orders/:orderId or /api/order-label?orderId=...
  return {
    orderId,
    displayId: 'MR-2025-0001',
    erxNumber: 'eRx-123456',
    priority: 'Urgent',
    patient: {
      name: 'John Doe',
      dob: '1985-04-12',
      idNumber: '850412-1234-08-3',
      encounterId: 'ENC-0001',
    },
    lab: {
      id: 'lancet-cresta',
      name: 'Lancet Cresta',
      locationCode: 'LC-CR',
    },
    timestamps: {
      createdAt: new Date().toISOString(),
      collectionTime: new Date().toISOString(),
    },
    tests: ['FBC', 'CRP', 'U&E'],
  };
}

export default function LabelPage() {
  const params = useParams<{ phlebId: string; orderId: string }>();
  const phlebId = params.phlebId;
  const orderId = params.orderId;

  const label = useMemo(() => buildLabelData(orderId), [orderId]);

  useEffect(() => {
    document.title = `Sample Label – ${label.displayId}`;
  }, [label.displayId]);

  return (
    <>
      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .label-page {
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-gray-100 flex flex-col items-center py-6">
        <div className="no-print mb-4 w-full max-w-xl px-4 flex items-center justify-between text-xs text-gray-600">
          <div>
            <div className="font-semibold text-gray-800">Sample label preview</div>
            <div>
              Phleb: <span className="font-mono">{phlebId}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1 rounded border bg-white hover:bg-gray-50 text-xs"
            >
              Print label
            </button>
          </div>
        </div>

        <section className="label-page bg-white border rounded-lg shadow max-w-xl w-full px-6 py-4 text-xs text-gray-900">
          {/* Header row */}
          <div className="flex justify-between items-start gap-4 border-b pb-2 mb-2">
            <div>
              <div className="text-[10px] uppercase text-gray-500">Lab</div>
              <div className="font-semibold text-sm">{label.lab.name}</div>
              <div className="text-[10px] text-gray-600">
                Lab ID: {label.lab.id} • Location: {label.lab.locationCode}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500">Order</div>
              <div className="font-semibold text-sm">{label.displayId}</div>
              <div className="text-[10px] text-gray-600">
                eRx: {label.erxNumber}
              </div>
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] border border-red-200">
                  {label.priority}
                </span>
              </div>
            </div>
          </div>

          {/* Patient + timestamps row */}
          <div className="flex justify-between gap-4 mb-2">
            <div className="flex-1 space-y-1">
              <div>
                <span className="font-semibold">Patient: </span>
                {label.patient.name}
              </div>
              <div>
                <span className="font-semibold">DOB: </span>
                {label.patient.dob}
              </div>
              <div>
                <span className="font-semibold">ID: </span>
                {label.patient.idNumber}
              </div>
              <div>
                <span className="font-semibold">Encounter: </span>
                {label.patient.encounterId}
              </div>
            </div>
            <div className="flex-1 space-y-1 text-right">
              <div>
                <span className="font-semibold">Created: </span>
                {new Date(label.timestamps.createdAt).toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">Collection: </span>
                {new Date(label.timestamps.collectionTime).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Tests */}
          <div className="border-t pt-2 mt-1 mb-3">
            <div className="font-semibold mb-1">Tests</div>
            <div className="flex flex-wrap gap-1">
              {label.tests.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* QR code + barcode placeholder row */}
          <div className="flex justify-between items-center gap-4 mt-2">
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 mb-1">
                Sample/Order Code
              </div>
              <div className="font-mono text-xs">
                {label.displayId} • {label.lab.id}
              </div>
            </div>
            <div className="w-24 h-24 border border-dashed border-gray-300 flex items-center justify-center text-[9px] text-gray-400">
              QR / Barcode
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
