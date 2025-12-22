// apps/clinician-app/app/workspaces/physio/panels/BodyMapPanel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { BodyView, EvidenceRef, RegionDef } from '../physioModel';
import { clamp, painHeatRGBA } from '../physioModel';

const BodyMap3D = dynamic(() => import('./BodyMapPanel3D'), { ssr: false });

export default function BodyMapPanel(props: {
  view: BodyView;
  onViewChange: (v: BodyView) => void;

  regions: RegionDef[];
  selectedRegionId: string;
  onSelectRegion: (id: string) => void;

  counts: Map<string, number>;
  latestPainByRegion: Map<string, number>;
  evidenceForRegion: EvidenceRef[];
}) {
  const { view, onViewChange, regions, selectedRegionId, onSelectRegion, counts, latestPainByRegion, evidenceForRegion } = props;

  const selected = useMemo(() => regions.find((r) => r.id === selectedRegionId) ?? regions[0]!, [regions, selectedRegionId]);
  const available = useMemo(() => regions.filter((r) => r.views.includes(view)), [regions, view]);

  // Keep selection valid for view
  useEffect(() => {
    if (selected.views.includes(view)) return;
    const next = regions.find((r) => r.views.includes(view));
    if (next) onSelectRegion(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Body Map</div>
        <div className="text-xs text-gray-500">3D selection · Heat shows latest pain for each region</div>
      </div>

      <div className="p-4 space-y-4">
        <BodyViewToggle view={view} onChange={onViewChange} />

        <div className="rounded-xl border bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">Interactive 3D map</div>
            <div className="text-[11px] text-gray-500">Tip: hover labels · click region to select</div>
          </div>

          <div className="mt-2 rounded-lg border bg-white overflow-hidden">
            <BodyMap3D
              view={view}
              regions={regions}
              selectedRegionId={selectedRegionId}
              counts={counts}
              latestPainByRegion={latestPainByRegion}
              onSelect={onSelectRegion}
            />
          </div>

          <div className="mt-2 text-[11px] text-gray-500">
            Heat overlay = latest pain score recorded per region (if available).
          </div>
        </div>

        <RegionPicker view={view} regionId={selectedRegionId} onChange={onSelectRegion} counts={counts} options={available} />

        <SelectedCard
          view={view}
          regionLabel={selected.label}
          findingsCount={counts.get(selectedRegionId) ?? 0}
          evidenceCount={evidenceForRegion.length}
          pain={latestPainByRegion.get(selectedRegionId)}
        />
      </div>
    </section>
  );
}

function BodyViewToggle({ view, onChange }: { view: BodyView; onChange: (v: BodyView) => void }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700">View</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['front', 'back', 'left', 'right'] as const).map((v) => (
          <button
            key={v}
            className={
              'px-3 py-1.5 rounded-full border text-xs ' +
              (view === v ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
            }
            onClick={() => onChange(v)}
            aria-pressed={view === v}
            type="button"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function RegionPicker({
  view,
  regionId,
  onChange,
  counts,
  options,
}: {
  view: BodyView;
  regionId: string;
  onChange: (id: string) => void;
  counts: Map<string, number>;
  options: RegionDef[];
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700">Regions (for this view)</div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        {options.map((r) => {
          const active = r.id === regionId;
          const c = counts.get(r.id) ?? 0;
          return (
            <button
              key={r.id}
              className={
                'rounded-lg border px-3 py-2 text-sm flex items-center justify-between ' +
                (active ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800')
              }
              onClick={() => onChange(r.id)}
              aria-pressed={active}
              type="button"
            >
              <span className="truncate">{r.label}</span>
              {c > 0 ? (
                <span className="text-[11px] rounded-full bg-emerald-600 text-white px-2 py-0.5">{c}</span>
              ) : (
                <span className="text-[11px] text-gray-400">0</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectedCard(props: {
  view: BodyView;
  regionLabel: string;
  findingsCount: number;
  evidenceCount: number;
  pain?: number;
}) {
  const { view, regionLabel, findingsCount, evidenceCount, pain } = props;
  const heat = painHeatRGBA(pain);
  const heatStyle = {
    background: `linear-gradient(90deg, rgba(${heat.r},${heat.g},${heat.b},${Math.max(0.06, heat.a)}) 0%, rgba(255,255,255,0) 70%)`,
  } as React.CSSProperties;

  return (
    <div className="rounded-lg border bg-gray-50 p-3" style={pain ? heatStyle : undefined}>
      <div className="text-xs font-semibold text-gray-700">Selected</div>
      <div className="mt-1 text-sm text-gray-800">
        Region: <span className="font-mono font-semibold">{regionLabel}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">View: {view}</div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="text-[11px] rounded-full border bg-white px-2 py-0.5 text-gray-700">
          Findings: <span className="font-mono">{findingsCount}</span>
        </span>
        <span className="text-[11px] rounded-full border bg-white px-2 py-0.5 text-gray-700">
          Evidence: <span className="font-mono">{evidenceCount}</span>
        </span>
        <span className="text-[11px] rounded-full border bg-white px-2 py-0.5 text-gray-700">
          Pain: <span className="font-mono">{typeof pain === 'number' ? pain : '—'}</span>
        </span>
      </div>
    </div>
  );
}
