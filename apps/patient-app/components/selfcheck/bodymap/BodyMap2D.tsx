// apps/patient-app/components/selfcheck/bodymap/BodyMap2D.tsx
'use client';

import { useMemo } from 'react';
import clsx from 'clsx';

import BodyMapCanvas from './BodyMapCanvas';
import BodyMapMarkers from './BodyMapMarkers';
import BodyMapHintStrip from './BodyMapHintStrip';

import { ALL_MARKERS } from './bodyMapConfig';
import {
  BodyAreaKey,
  BodySide,
  BodyHint,
  BODY_AREA_LABEL,
} from './types';

/* ------------------------------------------------------------------ */
/* Re-exports (REQUIRED by other steps)                                */
/* ------------------------------------------------------------------ */

export type { BodyAreaKey, BodyHint };
export { BODY_AREA_LABEL };

/**
 * Human-readable formatter used by Results + elsewhere
 * Example: "front:lower_back" → "Lower back (FRONT)"
 */
export function labelBodyAreaKey(k: BodyAreaKey): string {
  const [side, area] = k.split(':') as [BodySide, keyof typeof BODY_AREA_LABEL];
  const nice = BODY_AREA_LABEL[area] ?? area.replaceAll('_', ' ');
  return `${nice} (${side.toUpperCase()})`;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function BodyMap2D({
  gender,
  view,
  selected,
  onChangeGender,
  onChangeView,
  onToggleKey,
  getHintForKey,
}: {
  gender: 'male' | 'female';
  view: BodySide;
  selected: BodyAreaKey[];
  onChangeGender: (g: 'male' | 'female') => void;
  onChangeView: (v: BodySide) => void;
  onToggleKey: (k: BodyAreaKey) => void;
  getHintForKey?: (k: BodyAreaKey) => BodyHint | null;
}) {
  const markers = useMemo(() => ALL_MARKERS, []);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      {/* Header */}
      <header className="flex flex-wrap justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-500">Step 2</div>
          <h2 className="text-lg font-semibold">Body Map</h2>
          <p className="text-sm text-slate-600">
            Select all areas where you feel discomfort.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Gender toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onChangeGender(g)}
                className={clsx(
                  'px-3 py-2 text-sm font-semibold',
                  gender === g
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Front / Back toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            {(['front', 'back'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChangeView(v)}
                className={clsx(
                  'px-3 py-2 text-sm font-semibold',
                  view === v
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* SVG Body Map */}
      <svg
        viewBox="0 0 640 360"
        className="w-full h-auto rounded-xl bg-slate-50"
      >
        <BodyMapCanvas gender={gender} view={view} />

        <BodyMapMarkers
          markers={markers}
          selected={selected}
          currentView={view}
          onToggle={onToggleKey}
          getHintForKey={getHintForKey}
        />
      </svg>

      {/* Smart Hint Strip (inline) */}
      <div className="mt-3">
        <BodyMapHintStrip
          selectedKeys={selected}
          getHintForKey={getHintForKey}
        />
      </div>
    </section>
  );
}
