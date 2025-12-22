// apps/clinician-app/app/dental-workspace/_components/AddMediaPanel.tsx
'use client';

import React, { useState } from 'react';
import type { EvidenceKind } from '../_lib/types';

export default function AddMediaPanel(props: {
  busy?: boolean;
  onAddUrl: (opts: {
    kind: EvidenceKind;
    url: string;
    contentType?: string;
    modality?: 'xray' | 'photo' | 'other';
    segmentedTeeth?: boolean;
    segmentationScheme?: 'FDI' | 'universal';
  }) => Promise<void>;
  onUploadXrayFile: (file: File) => Promise<void>;
}) {
  const { busy, onAddUrl, onUploadXrayFile } = props;

  const [kind, setKind] = useState<EvidenceKind>('image');
  const [url, setUrl] = useState('');
  const [modality, setModality] = useState<'xray' | 'photo' | 'other'>('photo');

  const [segmentedTeeth, setSegmentedTeeth] = useState(false);
  const [segmentationScheme, setSegmentationScheme] = useState<'FDI' | 'universal'>('FDI');

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-gray-700">Add imaging / scans</div>
          <div className="text-[11px] text-gray-500">
            Upload X-ray (file) or add URL (X-ray / GLB/OBJ/STL scan). Segmented GLB: nodes tooth_11, tooth_12…
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-xs text-gray-600">
          Kind
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            disabled={busy}
          >
            <option value="image">Image (photo / X-ray)</option>
            <option value="scan_3d">3D Scan (GLB/GLTF/OBJ/STL)</option>
            <option value="video_clip">Clip (URL)</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          Modality
          <select
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={modality}
            onChange={(e) => setModality(e.target.value as any)}
            disabled={busy}
          >
            <option value="photo">Photo</option>
            <option value="xray">X-ray</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="text-xs text-gray-600">
          URL
          <input
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={kind === 'scan_3d' ? 'https://.../scan.glb (or .obj/.stl)' : 'https://.../image.jpg'}
            disabled={busy}
          />
        </label>
      </div>

      {kind === 'scan_3d' ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={segmentedTeeth}
              onChange={() => setSegmentedTeeth((v) => !v)}
              disabled={busy}
            />
            Segmented teeth (per-tooth nodes)
          </label>

          {segmentedTeeth ? (
            <label className="text-xs text-gray-700 flex items-center gap-2">
              Scheme
              <select
                className="rounded border px-2 py-1 text-xs bg-white"
                value={segmentationScheme}
                onChange={(e) => setSegmentationScheme(e.target.value as any)}
                disabled={busy}
              >
                <option value="FDI">FDI (tooth_11…)</option>
                <option value="universal">Universal (tooth_1…)</option>
              </select>
            </label>
          ) : null}

          <div className="text-[11px] text-gray-500">Click model to snap a true 3D pin (meshId + local hitpoint + normal).</div>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={busy || !url.trim()}
          onClick={async () => {
            await onAddUrl({
              kind,
              url: url.trim(),
              modality,
              segmentedTeeth: kind === 'scan_3d' ? segmentedTeeth : false,
              segmentationScheme: kind === 'scan_3d' ? segmentationScheme : undefined,
            });
            setUrl('');
          }}
        >
          Add URL
        </button>

        <label className="rounded border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              await onUploadXrayFile(f);
              e.currentTarget.value = '';
            }}
          />
          Upload X-ray (file)
        </label>

        <div className="text-[11px] text-gray-500">
          3D supported: <span className="font-mono">.glb</span> / <span className="font-mono">.gltf</span> /{' '}
          <span className="font-mono">.obj</span> / <span className="font-mono">.stl</span>
        </div>
      </div>
    </div>
  );
}
