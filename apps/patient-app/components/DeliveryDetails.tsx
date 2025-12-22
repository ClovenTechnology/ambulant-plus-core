// apps/patient-app/components/DeliveryDetails.tsx
'use client';
import React from 'react';

export type DeliveryDetailsProps = {
  orderNo?: string;
  eRxNo?: string;
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
  caseId?: string;
  sessionId?: string;
  trackingNo?: string;
  riderId?: string;
  bikeReg?: string;
  deliveryAmount?: number | string;
  paymentMethod?: 'Card' | 'Medical Aid' | 'Cash' | string;
  dateIso?: string; // ISO string
};

export default function DeliveryDetails({ order }: { order: DeliveryDetailsProps }) {
  const d = order;
  const date = d.dateIso ? new Date(d.dateIso) : null;
  return (
    <div className="bg-white border rounded-md p-4 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">Order No.</div>
          <div className="font-medium">{d.orderNo ?? '—'}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Tracking</div>
          <div className="font-medium">{d.trackingNo ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-600">
        <div>
          <div className="text-xxs text-gray-500">eRx No.</div>
          <div className="font-medium">{d.eRxNo ?? '—'}</div>
        </div>
        <div>
          <div className="text-xxs text-gray-500">Encounter</div>
          <div className="font-medium">{d.encounterId ?? '—'}</div>
        </div>

        <div>
          <div className="text-xxs text-gray-500">Patient</div>
          <div className="font-medium">{d.patientId ?? '—'}</div>
        </div>
        <div>
          <div className="text-xxs text-gray-500">Clinician</div>
          <div className="font-medium">{d.clinicianId ?? '—'}</div>
        </div>

        <div>
          <div className="text-xxs text-gray-500">Case ID</div>
          <div className="font-medium">{d.caseId ?? '—'}</div>
        </div>
        <div>
          <div className="text-xxs text-gray-500">Session</div>
          <div className="font-medium">{d.sessionId ?? '—'}</div>
        </div>

        <div>
          <div className="text-xxs text-gray-500">Rider / Bike</div>
          <div className="font-medium">{d.riderId ?? '—'} {d.bikeReg ? `• ${d.bikeReg}` : ''}</div>
        </div>
        <div>
          <div className="text-xxs text-gray-500">Payment</div>
          <div className="font-medium">{d.paymentMethod ?? '—'} {d.deliveryAmount ? `• ${d.deliveryAmount}` : ''}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        {date ? <div>Ordered: <span className="font-medium">{date.toLocaleString()}</span></div> : 'Date / time not available'}
      </div>
    </div>
  );
}
