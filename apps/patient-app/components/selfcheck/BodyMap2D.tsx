'use client';

import React, { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

export type BodyArea =
  | 'shoulders'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'side_abs'
  | 'quadriceps'
  | 'calves'
  | 'upper_back'
  | 'lower_back'
  | 'glutes';

export type BodySide = 'front' | 'back';
export type BodyAreaKey = `${BodySide}:${BodyArea}`;

export const BODY_AREA_LABEL: Record<BodyArea, string> = {
  shoulders: 'SHOULDERS',
  biceps: 'BICEPS',
  forearms: 'FOREARMS',
  abs: 'ABS',
  side_abs: 'SIDE ABS',
  quadriceps: 'QUADRICEPS',
  calves: 'CALVES',
  upper_back: 'UPPER BACK',
  lower_back: 'LOWER BACK',
  glutes: 'GLUTES',
};

type Marker = {
  n: number;
  area: BodyArea;
  view: BodySide;
  x: number;
  y: number;
  lx: number;
  ly: number;
  align: 'start' | 'end';
  tone: 'slate' | 'sky' | 'indigo' | 'violet' | 'rose' | 'blue';
};

export type BodyHintTone = 'info' | 'warn' | 'danger';
export type BodyHint = {
  tone: BodyHintTone;
  title: string;
  body: string;
  basedOn?: string;
};

const FRONT: Marker[] = [
  { n: 9, area: 'biceps', view: 'front', x: 210, y: 92, lx: 92, ly: 110, align: 'end', tone: 'rose' },
  { n: 4, area: 'shoulders', view: 'front', x: 265, y: 92, lx: 335, ly: 92, align: 'start', tone: 'sky' },
  { n: 6, area: 'side_abs', view: 'front', x: 188, y: 150, lx: 92, ly: 160, align: 'end', tone: 'blue' },
  { n: 7, area: 'forearms', view: 'front', x: 285, y: 150, lx: 360, ly: 150, align: 'start', tone: 'indigo' },
  { n: 8, area: 'quadriceps', view: 'front', x: 218, y: 228, lx: 92, ly: 238, align: 'end', tone: 'violet' },
  { n: 2, area: 'calves', view: 'front', x: 250, y: 282, lx: 360, ly: 286, align: 'start', tone: 'slate' },
  { n: 5, area: 'abs', view: 'front', x: 240, y: 156, lx: 92, ly: 192, align: 'end', tone: 'slate' },
];

const BACK: Marker[] = [
  { n: 3, area: 'upper_back', view: 'back', x: 440, y: 110, lx: 560, ly: 110, align: 'start', tone: 'indigo' },
  { n: 1, area: 'lower_back', view: 'back', x: 440, y: 168, lx: 560, ly: 168, align: 'start', tone: 'slate' },
  { n: 10, area: 'glutes', view: 'back', x: 440, y: 228, lx: 560, ly: 228, align: 'start', tone: 'violet' },
];

function keyFor(m: { view: BodySide; area: BodyArea }): BodyAreaKey {
  return `${m.view}:${m.area}`;
}

function toneClasses(tone: Marker['tone'], active: boolean, hovered: boolean) {
  const base =
    tone === 'rose'
      ? 'bg-rose-500'
      : tone === 'sky'
      ? 'bg-sky-400'
      : tone === 'indigo'
      ? 'bg-indigo-500'
      : tone === 'violet'
      ? 'bg-violet-500'
      : tone === 'blue'
      ? 'bg-blue-500'
      : 'bg-slate-400';

  return clsx(
    base,
    active
      ? 'ring-4 ring-black/10 shadow-[0_10px_30px_rgba(0,0,0,0.18)]'
      : hovered
      ? 'ring-4 ring-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
      : 'ring-2 ring-white/35'
  );
}

function Figure({ x, gender, variant }: { x: number; gender: 'male' | 'female'; variant: BodySide }) {
  const torsoW = gender === 'female' ? 64 : 70;
  const hipW = gender === 'female' ? 78 : 66;
  const shoulderW = gender === 'female' ? 86 : 92;

  const torsoX = x - torsoW / 2;
  const headCx = x;
  const headCy = 50;

  return (
    <g>
      <circle cx={headCx} cy={headCy} r={16} fill="#cbd5e1" opacity={0.95} />

      <path
        d={`
          M ${x - shoulderW / 2} 78
          C ${x - shoulderW / 3} 68, ${x + shoulderW / 3} 68, ${x + shoulderW / 2} 78
          L ${x + torsoW / 2} 98
          C ${x + torsoW / 2} 98, ${x} 108, ${x - torsoW / 2} 98
          Z
        `}
        fill="#cbd5e1"
        opacity={0.9}
      />

      <path
        d={`
          M ${torsoX} 98
          C ${torsoX - 6} 138, ${torsoX - 2} 160, ${x - hipW / 2} 188
          C ${x - 32} 205, ${x - 28} 226, ${x - 18} 244
          L ${x + 18} 244
          C ${x + 28} 226, ${x + 32} 205, ${x + hipW / 2} 188
          C ${torsoX + torsoW + 2} 160, ${torsoX + torsoW + 6} 138, ${torsoX + torsoW} 98
          Z
        `}
        fill="#cbd5e1"
        opacity={0.92}
      />

      <path
        d={`
          M ${x - shoulderW / 2 + 6} 84
          C ${x - shoulderW / 2 - 10} 112, ${x - shoulderW / 2 - 12} 140, ${x - shoulderW / 2 - 2} 168
          C ${x - shoulderW / 2 + 8} 192, ${x - shoulderW / 2 + 10} 210, ${x - shoulderW / 2 + 2} 228
        `}
        stroke="#cbd5e1"
        strokeWidth={16}
        strokeLinecap="round"
        opacity={0.9}
        fill="none"
      />
      <path
        d={`
          M ${x + shoulderW / 2 - 6} 84
          C ${x + shoulderW / 2 + 10} 112, ${x + shoulderW / 2 + 12} 140, ${x + shoulderW / 2 + 2} 168
          C ${x + shoulderW / 2 - 8} 192, ${x + shoulderW / 2 - 10} 210, ${x + shoulderW / 2 - 2} 228
        `}
        stroke="#cbd5e1"
        strokeWidth={16}
        strokeLinecap="round"
        opacity={0.9}
        fill="none"
      />

      <path
        d={`
          M ${x - 18} 244
          C ${x - 36} 270, ${x - 36} 292, ${x - 22} 322
        `}
        stroke="#cbd5e1"
        strokeWidth={18}
        strokeLinecap="round"
        opacity={0.92}
        fill="none"
      />
      <path
        d={`
          M ${x + 18} 244
          C ${x + 36} 270, ${x + 36} 292, ${x + 22} 322
        `}
        stroke="#cbd5e1"
        strokeWidth={18}
        strokeLinecap="round"
        opacity={0.92}
        fill="none"
      />

      <g opacity={0.35} stroke="#0f172a" strokeWidth={1.2} fill="none">
        {variant === 'front' ? (
          <>
            <path d={`M ${x - 12} 128 L ${x + 12} 128`} />
            <path d={`M ${x - 16} 146 L ${x + 16} 146`} />
            <path d={`M ${x - 14} 164 L ${x + 14} 164`} />
            <path d={`M ${x - 10} 182 L ${x + 10} 182`} />
            <path d={`M ${x} 114 L ${x} 206`} />
          </>
        ) : (
          <>
            <path d={`M ${x - 20} 118 C ${x} 132, ${x} 132, ${x + 20} 118`} />
            <path d={`M ${x - 18} 166 C ${x} 178, ${x} 178, ${x + 18} 166`} />
            <path d={`M ${x - 16} 226 C ${x} 238, ${x} 238, ${x + 16} 226`} />
          </>
        )}
      </g>
    </g>
  );
}

function viewToneOpacity(side: BodySide, current: BodySide) {
  return side === current ? 1 : 0.72;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toneChip(tone: BodyHintTone) {
  const cls =
    tone === 'danger'
      ? 'bg-rose-600 text-white'
      : tone === 'warn'
      ? 'bg-amber-300 text-slate-900'
      : 'bg-slate-900 text-white';
  const label = tone === 'danger' ? 'Urgent' : tone === 'warn' ? 'Watch' : 'Info';
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-extrabold', cls)}>{label}</span>;
}

export default function BodyMap2D(props: {
  gender: 'male' | 'female';
  view: BodySide;
  selected: BodyAreaKey[];
  onChangeGender: (g: 'male' | 'female') => void;
  onChangeView: (v: BodySide) => void;
  onToggleKey: (k: BodyAreaKey) => void;
  getHintForKey?: (k: BodyAreaKey) => BodyHint | null;
}) {
  const { gender, view, selected, onChangeGender, onChangeView, onToggleKey, getHintForKey } = props;

  const markers = useMemo(() => [...FRONT, ...BACK], []);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [hovered, setHovered] = useState<Marker | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  function setTooltipFromEvent(e: React.MouseEvent) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    setTipPos({
      x: clamp(x, 12, r.width - 12),
      y: clamp(y, 12, r.height - 12),
    });
  }

  const hoveredKey = hovered ? keyFor(hovered) : null;
  const hint = hoveredKey && getHintForKey ? getHintForKey(hoveredKey) : null;

  return (
    <div className="bg-white/80 border border-slate-200 rounded-2xl shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-500">Step 2</div>
          <div className="text-lg font-semibold">Body Map</div>
          <div className="text-sm text-slate-600">Hover (or tap) a numbered point to preview. Click to select.</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => onChangeGender('male')}
              className={clsx(
                'px-3 py-2 text-sm font-semibold',
                gender === 'male' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              Male
            </button>
            <button
              type="button"
              onClick={() => onChangeGender('female')}
              className={clsx(
                'px-3 py-2 text-sm font-semibold',
                gender === 'female' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              Female
            </button>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => onChangeView('front')}
              className={clsx(
                'px-3 py-2 text-sm font-semibold',
                view === 'front' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => onChangeView('back')}
              className={clsx(
                'px-3 py-2 text-sm font-semibold',
                view === 'back' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              Back
            </button>
          </div>

          <button
            type="button"
            onClick={() => selected.forEach((k) => onToggleKey(k))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
            title="Clear selected areas"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 overflow-hidden"
        onMouseLeave={() => {
          setHovered(null);
          setTipPos(null);
        }}
      >
        {/* Tooltip */}
        {hovered && tipPos && (
          <div
            className="pointer-events-none absolute z-10"
            style={{ left: tipPos.x, top: tipPos.y, transform: 'translate(12px, -12px)' }}
          >
            <div className="rounded-xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(0,0,0,0.35)] px-3 py-2 max-w-[290px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Preview • {hovered.view === 'front' ? 'Front' : 'Back'}
                </div>
                {hint ? toneChip(hint.tone) : null}
              </div>

              <div className="mt-1 text-sm font-extrabold text-slate-900 leading-tight">
                {BODY_AREA_LABEL[hovered.area]}{' '}
                <span className="text-slate-500 font-bold">({hovered.view === 'front' ? 'FRONT' : 'BACK'})</span>
              </div>

              <div className="mt-1 text-xs text-slate-600">
                Click to {selected.includes(keyFor(hovered)) ? 'remove' : 'add'} this area.
              </div>

              {hint && (
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-900">{hint.title}</div>
                  <div className="mt-1 text-xs text-slate-700 leading-snug">{hint.body}</div>
                  {hint.basedOn ? <div className="mt-2 text-[11px] text-slate-500">{hint.basedOn}</div> : null}
                </div>
              )}
            </div>
          </div>
        )}

        <svg viewBox="0 0 640 360" className="w-full h-auto block">
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="640" height="360" fill="url(#grid)" />

          <text x="320" y="28" textAnchor="middle" fill="rgba(255,255,255,0.88)" fontSize="16" fontWeight="700">
            Body Map
          </text>
          <text x="320" y="46" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11">
            {gender === 'female' ? 'Female' : 'Male'} · hover/tap any numbered area
          </text>

          {/* both visible */}
          <g opacity={viewToneOpacity('front', view)}>
            <Figure x={240} gender={gender} variant="front" />
          </g>
          <g opacity={viewToneOpacity('back', view)}>
            <Figure x={440} gender={gender} variant="back" />
          </g>

          {markers.map((m, idx) => {
            const k = keyFor(m);
            const active = selected.includes(k);
            const isHovered = hovered?.area === m.area && hovered?.view === m.view;

            const textX = m.lx;
            const textY = m.ly;
            const lineMidX = m.align === 'end' ? textX + 18 : textX - 18;

            const emphasis = m.view === view ? 1 : 0.75;
            const sideTag = m.view === 'front' ? 'FRONT' : 'BACK';

            return (
              <g key={`${k}-${idx}`} opacity={emphasis}>
                <polyline
                  points={`${m.x},${m.y} ${lineMidX},${textY} ${textX},${textY}`}
                  fill="none"
                  stroke={active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'}
                  strokeWidth={isHovered ? 2.0 : 1.5}
                />

                <text
                  x={textX}
                  y={textY - 6}
                  textAnchor={m.align}
                  fill={active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.68)'}
                  fontSize="10.5"
                  fontWeight="700"
                  letterSpacing="0.12em"
                >
                  {BODY_AREA_LABEL[m.area]} <tspan opacity={0.8}>({sideTag})</tspan>
                </text>

                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`${BODY_AREA_LABEL[m.area]} ${sideTag}`}
                  onMouseEnter={(e) => {
                    setHovered(m);
                    setTooltipFromEvent(e);
                  }}
                  onMouseMove={(e) => {
                    if (!hovered) return;
                    setTooltipFromEvent(e);
                  }}
                  onFocus={() => {
                    setHovered(m);
                    setTipPos({ x: (m.view === 'front' ? 0.36 : 0.69) * 640, y: (m.y / 360) * 360 });
                  }}
                  onBlur={() => {
                    setHovered(null);
                    setTipPos(null);
                  }}
                  onClick={() => onToggleKey(k)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleKey(k);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {isHovered && <circle cx={m.x} cy={m.y} r={20} fill="rgba(255,255,255,0.10)" />}

                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={15}
                    className={toneClasses(m.tone, active, isHovered)}
                    opacity={active ? 1 : 0.92}
                  />
                  <text x={m.x} y={m.y + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="800">
                    {m.n}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        Selected:{' '}
        <span className="text-slate-800 font-semibold">
          {selected.length
            ? selected
                .map((k) => {
                  const [side, area] = k.split(':');
                  const nice = BODY_AREA_LABEL[area as BodyArea] ?? area.replaceAll('_', ' ').toUpperCase();
                  return `${nice} (${side.toUpperCase()})`;
                })
                .join(', ')
            : '—'}
        </span>
      </div>
    </div>
  );
}
