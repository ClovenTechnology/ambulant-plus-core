// apps/clinician-app/app/dental-workspace/_components/EvidencePreview.tsx
'use client';

import React, { useRef } from 'react';
import type { DentalEvidence, DentalAnnotation, ToothSystem, ModelPinPayload } from '../_lib/types';
import { looksLikeXray } from '../_lib/helpers';
import Scan3DViewer from './Scan3DViewer';
import XRayViewer from './XRayViewer';

export default function EvidencePreview({
  selectedEvidence,
  pins,
  onAddScreenPin,
  onAddModelPin,
  busy,
  selectedToothUniversal,
  toothSystem,
  onSelectToothUniversal,
}: {
  selectedEvidence: DentalEvidence | null;
  pins: DentalAnnotation[];
  onAddScreenPin: (x01: number, y01: number) => void;
  onAddModelPin: (payload: ModelPinPayload, overrideToothId?: string) => void;
  busy?: boolean;
  selectedToothUniversal: string;
  toothSystem: ToothSystem; // display-only
  onSelectToothUniversal: (universalTooth: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  if (!selectedEvidence) {
    return (
      <div className="h-full grid place-items-center text-gray-600">
        <div className="text-center">
          <div className="text-sm font-medium">No evidence selected</div>
          <div className="text-xs text-gray-500 mt-1">Pick an item below, or stay on 3D Teeth.</div>
        </div>
      </div>
    );
  }

  if (selectedEvidence.kind === 'scan_3d') {
    return (
      <Scan3DViewer
        evidence={selectedEvidence}
        pins={pins}
        disabled={busy}
        selectedToothUniversal={selectedToothUniversal}
        toothSystem={toothSystem}
        onSelectToothUniversal={onSelectToothUniversal}
        onAddModelPin={onAddModelPin}
      />
    );
  }

  if (selectedEvidence.kind === 'image') {
    if (looksLikeXray(selectedEvidence)) {
      return <XRayViewer evidence={selectedEvidence} />;
    }

    if (!selectedEvidence.url) {
      return (
        <div className="h-full w-full grid place-items-center text-gray-700">
          <div className="text-center">
            <div className="text-sm font-medium">Snapshot pending</div>
            <div className="text-xs text-gray-500 mt-1">
              status: {selectedEvidence.status}
              {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
            </div>
            <div className="mt-2 text-[11px] text-gray-500">Capture worker will PATCH /api/evidence with the final URL.</div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={wrapRef}
        className="h-full w-full relative bg-black/5"
        onClick={(ev) => {
          if (busy) return;
          const host = wrapRef.current;
          if (!host) return;
          const rect = host.getBoundingClientRect();
          const x01 = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
          const y01 = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
          onAddScreenPin(x01, y01);
        }}
        title={busy ? 'Busy…' : 'Click image to add a pin'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selectedEvidence.url} alt="Selected evidence" className="h-full w-full object-contain" />
        {pins
          .filter((p) => p.payload?.kind === 'screen')
          .map((p) => {
            const x = Number(p.payload?.x ?? 0.5);
            const y = Number(p.payload?.y ?? 0.5);
            const label = String(p.payload?.label ?? 'Pin');
            return (
              <div
                key={p.id}
                className="absolute"
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, transform: 'translate(-50%,-50%)' }}
                title={label}
              >
                <div className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-blue-200" />
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div className="h-full w-full grid place-items-center text-gray-700">
      <div className="text-center">
        <div className="text-sm font-medium">Clip</div>
        <div className="text-xs text-gray-500 mt-1">
          status: {selectedEvidence.status}
          {selectedEvidence.jobId ? ` · job: ${selectedEvidence.jobId}` : ''}
        </div>
        <div className="mt-2 text-[11px] text-gray-500">Playback appears when the clip URL is ready.</div>
      </div>
    </div>
  );
}
