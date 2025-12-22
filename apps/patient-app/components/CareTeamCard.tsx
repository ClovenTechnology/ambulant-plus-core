'use client';

import React from 'react';

interface Props {
  clinician: any;
  isFav?: boolean;
  onToggleFav?: () => void;
}

export default function CareTeamCard({ clinician, isFav = false, onToggleFav }: Props) {
  return (
    <div className="min-w-[220px] p-3 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-3">
        <img src={clinician.avatarUrl || '/images/clinician-placeholder.png'} className="w-12 h-12 rounded-full object-cover" alt="clinician" />
        <div className="flex-1">
          <div className="font-semibold">{clinician.name}</div>
          <div className="text-sm text-gray-500">{clinician.role} • {clinician.specialty}</div>
        </div>
        <button onClick={onToggleFav} aria-label="toggle favourite" className={`px-2 py-1 rounded ${isFav ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
          {isFav ? '★' : '☆'}
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <a className="text-sm border rounded px-2 py-1" href={`mailto:${clinician.email}`}>Email</a>
        <a className="text-sm border rounded px-2 py-1" href={`tel:${clinician.phone}`}>Call</a>
        <a className="text-sm border rounded px-2 py-1" href={`/clinicians/${clinician.id}`}>Profile</a>
      </div>
    </div>
  );
}
