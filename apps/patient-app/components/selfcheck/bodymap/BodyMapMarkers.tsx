// components/selfcheck/bodymap/BodyMapMarkers.tsx
'use client';

import React from 'react';
import clsx from 'clsx';

import { keyFor } from './bodyMapConfig';
import type {
  Marker,
  BodyAreaKey,
} from './types';
import { BODY_AREA_LABEL } from './types';

function toneClass(tone: Marker['tone'], active: boolean) {
  const base =
    tone === 'rose' ? 'fill-rose-500'
    : tone === 'sky' ? 'fill-sky-400'
    : tone === 'indigo' ? 'fill-indigo-500'
    : tone === 'violet' ? 'fill-violet-500'
    : tone === 'blue' ? 'fill-blue-500'
    : 'fill-slate-400';

  return clsx(base, active && 'ring-4 ring-black/10');
}

export default function BodyMapMarkers({
  markers,
  selected,
  currentView,
  onToggle,
}: {
  markers: Marker[];
  selected: BodyAreaKey[];
  currentView: 'front' | 'back';
  onToggle: (k: BodyAreaKey) => void;
}) {
  return (
    <>
      {markers.map((m) => {
        const k = keyFor(m.view, m.area);
        const active = selected.includes(k);

        return (
          <g key={k} opacity={m.view === currentView ? 1 : 0.4}>
            {/* Connector line */}
            <polyline
              points={`${m.x},${m.y} ${m.lx},${m.ly}`}
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={1.5}
              fill="none"
            />

            {/* Marker */}
            <g
              role="checkbox"
              tabIndex={0}
              aria-checked={active}
              aria-label={`${BODY_AREA_LABEL[m.area]} (${m.view})`}
              onClick={() => onToggle(k)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(k);
                }
              }}
              className="cursor-pointer focus:outline-none"
            >
              <circle
                cx={m.x}
                cy={m.y}
                r={16}
                className={toneClass(m.tone, active)}
              />

              <text
                x={m.x}
                y={m.y + 5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="white"
                pointerEvents="none"
              >
                {m.n}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
}
