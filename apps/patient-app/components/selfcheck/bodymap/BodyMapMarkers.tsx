// components/selfcheck/bodymap/BodyMapMarkers.tsx
'use client';

import React from 'react';
import clsx from 'clsx';

import { keyFor } from './bodyMapConfig';
import type { Marker, BodyAreaKey, BodySide } from './types';
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

function PinGlyph({ x, y }: { x: number; y: number }) {
  // simple, consistent “pin” silhouette (SVG path)
  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true">
      <path
        d="M6 0c2.1 0 3.8 1.7 3.8 3.8 0 2.6-2.4 4.5-3.2 5.6L6 11 5.4 9.4C4.6 8.3 2.2 6.4 2.2 3.8 2.2 1.7 3.9 0 6 0Z"
        fill="white"
        opacity="0.95"
      />
      <circle cx="6" cy="3.8" r="1.1" fill="rgba(2,6,23,0.55)" />
    </g>
  );
}

export default function BodyMapMarkers({
  markers,
  selected,
  currentView,
  onToggle,

  // ✅ optional polish callbacks
  onRequestView,
  hoveredKey,
  pinnedKey,
  onHoverKey,
  onLeaveKey,
  onPinKey,
}: {
  markers: Marker[];
  selected: BodyAreaKey[];
  currentView: BodySide;
  onToggle: (k: BodyAreaKey) => void;

  onRequestView?: (v: BodySide) => void;
  hoveredKey?: BodyAreaKey | null;
  pinnedKey?: BodyAreaKey | null;
  onHoverKey?: (k: BodyAreaKey) => void;
  onLeaveKey?: (k: BodyAreaKey) => void;
  onPinKey?: (k: BodyAreaKey) => void;
}) {
  return (
    <>
      {markers.map((m) => {
        const k = keyFor(m.view, m.area);
        const active = selected.includes(k);
        const hovered = hoveredKey === k;
        const pinned = pinnedKey === k;

        const dimmed = m.view !== currentView;

        const activate = () => {
          // ✅ auto-flip when clicking a hidden marker
          if (dimmed && onRequestView) onRequestView(m.view);

          // keep selection behavior
          onToggle(k);

          // clicking also pins/unpins preview (luxury feel)
          if (onPinKey) onPinKey(k);
        };

        return (
          <g key={k} opacity={dimmed ? 0.4 : 1}>
            <polyline
              points={`${m.x},${m.y} ${m.lx},${m.ly}`}
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={1.5}
              fill="none"
            />

            <g
              role="checkbox"
              tabIndex={0}
              aria-checked={active}
              aria-label={`${BODY_AREA_LABEL[m.area]} (${m.view})`}
              onClick={activate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  activate();
                }
              }}
              onMouseEnter={() => onHoverKey?.(k)}
              onMouseLeave={() => onLeaveKey?.(k)}
              className="cursor-pointer focus:outline-none"
            >
              <circle
                cx={m.x}
                cy={m.y}
                r={16}
                className={clsx(
                  toneClass(m.tone, active),
                  // ✅ subtle hover glow pulse
                  (hovered || pinned) && !dimmed && 'bm-pulse'
                )}
              />

              {/* number */}
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

              {/* ✅ pin icon indicator */}
              {pinned ? <PinGlyph x={m.x + 9} y={m.y - 22} /> : null}
            </g>
          </g>
        );
      })}
    </>
  );
}
