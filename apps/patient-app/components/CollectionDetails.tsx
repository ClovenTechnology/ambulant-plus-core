'use client';
import React from 'react';

export type CollectionDetailsProps = {
  labOrderNo?: string;      // LAB-2001
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
  caseId?: string;
  sessionId?: string;
  collectionId?: string;    // internal MedReach job ID
  trackingNo?: string;
  phlebId?: string;
  phlebName?: string;
  collectionWindow?: string; // "09:00–11:00"
  address?: string;
  notes?: string;
  dateIso?: string;         // when ordered
};

export default function CollectionDetails({ order }: { order: CollectionDetailsProps }) {
  const d = order;
  const date = d.dateIso ? new Date(d.dateIso) : null;

  return (
    <div className="bg-white border rounded-md p-4 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">Lab order</div>
          <div className="font-medium">{d.labOrderNo ?? '—'}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">MedReach job</div>
          <div className="font-medium">{d.collectionId ?? d.trackingNo ?? '—'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-600">
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
          <div className="text-xxs text-gray-500">Collection window</div>
          <div className="font-medium">{d.collectionWindow ?? '—'}</div>
        </div>

        <div>
          <div className="text-xxs text-gray-500">Phlebotomist</div>
          <div className="font-medium">
            {d.phlebName ?? d.phlebId ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-xxs text-gray-500">Address</div>
          <div className="font-medium line-clamp-2">
            {d.address ?? '—'}
          </div>
        </div>
      </div>

      {d.notes && (
        <div className="mt-3 text-xs text-gray-600">
          <div className="text-xxs text-gray-500 mb-0.5">Notes</div>
          <div>{d.notes}</div>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        {date ? (
          <div>
            Ordered:{' '}
            <span className="font-medium">{date.toLocaleString()}</span>
          </div>
        ) : (
          'Date / time not available'
        )}
      </div>
    </div>
  );
}
