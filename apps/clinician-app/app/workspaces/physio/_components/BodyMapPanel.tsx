/* apps/clinician-app/app/workspaces/physio/_components/BodyMapPanel.tsx */
'use client';

import React, { useMemo } from 'react';
import type { BodyView, RegionDef } from './types';
import BodyMap3D from './BodyMap3D';

export default function BodyMapPanel(props: {
  view: BodyView;
  onChangeView: (v: BodyView) => void;
  regions: RegionDef[];
  regionId: string;
  onChangeRegion: (id: string) => void;
  counts: Map<string, number>;
  latestPainByRegion: Map<string, number>;
  evidenceCount: number;
}) {
  const { view, onChangeView, regions, regionId, onChangeRegion, counts, latestPainByRegion } = props;

  const options = useMemo(() => regions.filter((r) => r.views.includes(view)), [regions, view]);
  const selected = useMemo(() => regions.find((r) => r.id === regionId) ?? options[0], [regions, regionId, options]);

  return (
    <section className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Body Map</div>
        <div className="text-xs text-gray-500">Modern 3D view (drag rotate) + fast region selection</div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="text-xs font-semibold text-gray-700">View</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['front', 'back', 'left', 'right'] as const).map((v) => (
              <button
                key={v}
                className={
                  'px-3 py-1.5 rounded-full border text-xs ' +
                  (view === v
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700')
                }
                onClick={() => onChangeView(v)}
                aria-pressed={view === v}
                type="button"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <BodyMap3D
          view={view}
          regions={regions}
          selectedRegionId={regionId}
          counts={counts}
          latestPainByRegion={latestPainByRegion}
          onSelect={onChangeRegion}
        />

        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs font-semibold text-gray-700">Selected</div>
          <div className="mt-1 text-sm text-gray-800">
            Region: <span className="font-mono font-semibold">{selected?.label ?? '—'}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">View: {view}</div>
        </div>

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
                    (active
                      ? 'border-blue-300 bg-blue-50 text-blue-800'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800')
                  }
                  onClick={() => onChangeRegion(r.id)}
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
      </div>
    </section>
  );
}
