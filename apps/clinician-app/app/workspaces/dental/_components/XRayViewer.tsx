// apps/clinician-app/app/dental-workspace/_components/XRayViewer.tsx
'use client';

import React, { useState } from 'react';
import type { DentalEvidence } from '../_lib/types';

export default function XRayViewer({ evidence }: { evidence: DentalEvidence }) {
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(true);
  const [contrast, setContrast] = useState(1.25);

  const url = evidence.url || '';
  if (!url) {
    return (
      <div className="h-full w-full grid place-items-center text-gray-700">
        <div className="text-center">
          <div className="text-sm font-medium">X-ray pending</div>
          <div className="text-xs text-gray-500 mt-1">
            status: {evidence.status}
            {evidence.jobId ? ` · job: ${evidence.jobId}` : ''}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative bg-black">
      <div className="absolute left-2 top-2 z-10 rounded-lg border border-white/15 bg-black/40 backdrop-blur px-2 py-2 text-[11px] text-white/90 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">X-ray</span>
          <button
            type="button"
            className="rounded border border-white/20 bg-white/10 px-2 py-1 hover:bg-white/15"
            onClick={() => {
              setZoom(1);
              setInvert(true);
              setContrast(1.25);
            }}
          >
            Reset
          </button>
        </div>

        <label className="block">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-44"
          />
        </label>

        <label className="block">
          Contrast
          <input
            type="range"
            min={0.8}
            max={2.2}
            step={0.05}
            value={contrast}
            onChange={(e) => setContrast(Number(e.target.value))}
            className="w-44"
          />
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={invert} onChange={() => setInvert((v) => !v)} />
          Invert
        </label>
      </div>

      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="X-ray"
          className="select-none"
          style={{
            transform: `scale(${zoom})`,
            filter: `${invert ? 'invert(1)' : ''} contrast(${contrast})`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>
    </div>
  );
}
