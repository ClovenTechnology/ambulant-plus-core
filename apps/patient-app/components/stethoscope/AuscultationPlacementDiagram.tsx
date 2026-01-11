//apps/patient-app/components/stethoscope/AuscultationPlacementDiagram.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

type SiteKey =
  | 'chest-apex'
  | 'chest-base'
  | 'chest-left'
  | 'chest-right'
  | 'back-upper'
  | 'back-lower'
  | 'neck'
  | 'other';

export type AuscTarget = 'heart' | 'lungs' | 'mixed';
export type BodySex = 'female' | 'male' | 'unisex';
type ViewSide = 'front' | 'back';

type Point = {
  site: SiteKey;
  view: ViewSide;
  xPct: number; // 0..100
  yPct: number; // 0..100
  label: string;
  hint?: string;
  target: Exclude<AuscTarget, 'mixed'>;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const SITE_LABEL: Record<SiteKey, { label: string; hint?: string }> = {
  'chest-apex': { label: 'Chest (apex)', hint: 'Heart focus' },
  'chest-base': { label: 'Chest (base)', hint: 'Heart/valves' },
  'chest-left': { label: 'Chest (left)', hint: 'Lung fields' },
  'chest-right': { label: 'Chest (right)', hint: 'Lung fields' },
  'back-upper': { label: 'Back (upper)', hint: 'Upper lobes' },
  'back-lower': { label: 'Back (lower)', hint: 'Lower lobes' },
  neck: { label: 'Neck', hint: 'Upper airway' },
  other: { label: 'Other', hint: 'Custom' },
};

/**
 * NOTE: marker positions are percentage-based and intentionally conservative.
 * You can fine-tune xPct/yPct later without changing consuming code.
 */
const POINTS: Point[] = [
  // FRONT
  { site: 'neck', view: 'front', xPct: 50, yPct: 23, label: 'Neck', hint: 'Upper airway', target: 'lungs' },

  { site: 'chest-base', view: 'front', xPct: 50, yPct: 38, label: 'Base', hint: 'Valves / upper', target: 'heart' },
  { site: 'chest-apex', view: 'front', xPct: 60, yPct: 52, label: 'Apex', hint: 'Apical / lower', target: 'heart' },

  { site: 'chest-right', view: 'front', xPct: 38, yPct: 46, label: 'Right lung', hint: 'Upper-mid', target: 'lungs' },
  { site: 'chest-left', view: 'front', xPct: 62, yPct: 46, label: 'Left lung', hint: 'Upper-mid', target: 'lungs' },

  // BACK
  { site: 'back-upper', view: 'back', xPct: 50, yPct: 36, label: 'Upper', hint: 'Upper lobes', target: 'lungs' },
  { site: 'back-lower', view: 'back', xPct: 50, yPct: 60, label: 'Lower', hint: 'Lower lobes', target: 'lungs' },
];

function imageSrc(sex: BodySex, view: ViewSide) {
  const base = '/diagrams/auscultation';
  const female = sex === 'female';
  if (female) {
    return view === 'front' ? `${base}/female_thorax_front.png` : `${base}/female_thorax_back.png`;
  }
  // male + unisex: use generic thorax assets you provided
  return view === 'front' ? `${base}/thorax_front_731x1024.png` : `${base}/thorax_back_731x1024.png`;
}

export default function AuscultationPlacementDiagram(props: {
  value: SiteKey;
  onChange: (v: SiteKey) => void;
  disabled?: boolean;

  /** heart | lungs | mixed (what to visually emphasize / filter) */
  mode?: AuscTarget;

  /** if provided, takes precedence for marker highlighting */
  highlightLabel?: SiteKey;

  /** optional body sex to pick image set */
  sex?: BodySex;
  onSexChange?: (s: BodySex) => void;

  /** optional className */
  className?: string;
}) {
  const {
    value,
    onChange,
    disabled = false,
    mode = 'mixed',
    highlightLabel,
    sex: sexProp,
    onSexChange,
    className,
  } = props;

  const [localSex, setLocalSex] = useState<BodySex>(sexProp || 'unisex');
  const sex = sexProp ?? localSex;

  const setSex = (s: BodySex) => {
    if (onSexChange) onSexChange(s);
    else setLocalSex(s);
  };

  const [view, setView] = useState<ViewSide>('front');

  const pointsForView = useMemo(() => {
    const all = POINTS.filter((p) => p.view === view);
    if (mode === 'mixed') return all;
    return all.filter((p) => p.target === mode);
  }, [view, mode]);

  // Auto-switch the view to keep the selected site visible (if that site exists in the other view)
  useEffect(() => {
    const allForFront = POINTS.filter((p) => p.view === 'front').map((p) => p.site);
    const allForBack = POINTS.filter((p) => p.view === 'back').map((p) => p.site);

    const visibleHere = POINTS.some((p) => p.view === view && p.site === value);
    if (visibleHere) return;

    if (view === 'front' && allForBack.includes(value)) setView('back');
    if (view === 'back' && allForFront.includes(value)) setView('front');
  }, [value, view]);

  const selected = highlightLabel ?? value;
  const selectedMeta = SITE_LABEL[selected];

  return (
    <div className={cx('rounded-2xl border border-slate-200 bg-white p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Placement diagram</div>
          <div className="mt-1 text-xs text-slate-600">
            Tap a dot to select a site. Use Front/Back. {disabled ? 'Reference-only (selection locked).' : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setView('front')}
              className={cx(
                'rounded-full px-3 py-1 font-semibold',
                view === 'front' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
              aria-label="Front view"
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setView('back')}
              className={cx(
                'rounded-full px-3 py-1 font-semibold',
                view === 'back' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
              aria-label="Back view"
            >
              Back
            </button>
          </div>

          {/* Sex toggle (optional but recommended) */}
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setSex('female')}
              className={cx(
                'rounded-full px-3 py-1 font-semibold',
                sex === 'female' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
              aria-label="Female diagram"
            >
              Female
            </button>
            <button
              type="button"
              onClick={() => setSex('male')}
              className={cx(
                'rounded-full px-3 py-1 font-semibold',
                sex === 'male' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
              aria-label="Male diagram"
            >
              Male
            </button>
          </div>
        </div>
      </div>

      {/* Diagram */}
      <div className="mt-3">
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
          style={{ aspectRatio: '731 / 1024' }}
        >
          <img
            src={imageSrc(sex, view)}
            alt={`Thorax placement diagram (${view})`}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />

          {/* Marker layer */}
          {pointsForView.map((p) => {
            const isActive = selected === p.site;
            return (
              <button
                key={`${p.view}-${p.site}`}
                type="button"
                disabled={disabled}
                onClick={() => onChange(p.site)}
                className={cx(
                  'absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition',
                  isActive ? 'z-10' : 'z-0',
                  disabled ? 'cursor-not-allowed opacity-80' : 'hover:scale-[1.03]'
                )}
                style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                aria-label={`Select ${SITE_LABEL[p.site]?.label || p.site}`}
                title={`${p.label}${p.hint ? ` — ${p.hint}` : ''}`}
              >
                <span
                  className={cx(
                    'grid place-items-center rounded-full border shadow-sm',
                    isActive
                      ? 'h-7 w-7 border-slate-900 bg-slate-900 text-white'
                      : 'h-6 w-6 border-slate-300 bg-white text-slate-700'
                  )}
                >
                  <span className={cx('block rounded-full', isActive ? 'h-2.5 w-2.5 bg-white' : 'h-2 w-2 bg-slate-300')} />
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected label */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="text-xs text-slate-600">
            Selected:{' '}
            <span className="font-semibold text-slate-900">
              {selectedMeta?.label || selected}
              {selectedMeta?.hint ? <span className="font-normal text-slate-500"> — {selectedMeta.hint}</span> : null}
            </span>
          </div>

          <div className="text-xs text-slate-500">
            View: <span className="font-semibold text-slate-700">{view}</span> · Diagram: <span className="font-semibold text-slate-700">{sex}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
