// apps/patient-app/components/selfcheck/bodymap/BodyMap2D.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import BodyMapCanvas from './BodyMapCanvas';
import BodyMapMarkers from './BodyMapMarkers';
import BodyMapHintStrip from './BodyMapHintStrip';

import { ALL_MARKERS } from './bodyMapConfig';
import { BodyAreaKey, BodySide, BodyHint, BODY_AREA_LABEL } from './types';

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

function tonePill(tone: BodyHint['tone']) {
  return tone === 'danger'
    ? 'bg-rose-600 text-white'
    : tone === 'warn'
    ? 'bg-amber-300 text-slate-900'
    : 'bg-slate-900 text-white';
}

function toneLabel(tone: BodyHint['tone']) {
  return tone === 'danger' ? 'Urgent' : tone === 'warn' ? 'Watch' : 'Info';
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Arrow nub with:
 * - Parallax (tiny translate3d)
 * - Elastic (passed parallax should already be “laggy” if desired)
 */
function Nub({
  side,
  parallax,
}: {
  side: 'left' | 'right';
  parallax?: { x: number; y: number };
}) {
  const rot = side === 'left' ? 'rotate(180deg)' : 'rotate(0deg)';
  const px = parallax?.x ?? 0;
  const py = parallax?.y ?? 0;

  return (
    <div
      className={clsx(
        'absolute top-5',
        side === 'left' ? '-left-[10px]' : '-right-[10px]'
      )}
      aria-hidden="true"
      style={{
        transform: `${rot} translate3d(${px}px, ${py}px, 0)`,
        willChange: 'transform',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className="block">
        <path
          d="M1 9 C6 1, 12 1, 17 9 C12 17, 6 17, 1 9 Z"
          fill="rgba(2,6,23,0.10)"
          transform="translate(0,1)"
        />
        <path
          d="M1 9 C6 1, 12 1, 17 9 C12 17, 6 17, 1 9 Z"
          fill="rgba(255,255,255,0.92)"
          stroke="rgba(148,163,184,0.55)"
        />
      </svg>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);
  return reduced;
}

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

  const [hoveredKey, setHoveredKey] = useState<BodyAreaKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<BodyAreaKey | null>(null);

  const prefersReduced = usePrefersReducedMotion();

  /* ------------------------------------------------------------------ */
  /* Magnetic bubble: target vs current                                  */
  /* ------------------------------------------------------------------ */

  const targetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(0);

  const [mag, setMag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  /* ------------------------------------------------------------------ */
  /* Nub elastic + parallax: separate spring that chases a derived target */
  /* ------------------------------------------------------------------ */

  const nubTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nubCurRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nubRafRef = useRef<number | null>(null);
  const nubLastTRef = useRef<number>(0);

  const [nubMag, setNubMag] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const activePreviewKey = pinnedKey ?? hoveredKey;

  const activeMarker = useMemo(() => {
    if (!activePreviewKey) return null;
    return markers.find((m) => `${m.view}:${m.area}` === activePreviewKey) ?? null;
  }, [activePreviewKey, markers]);

  const activeHint = useMemo(() => {
    if (!activePreviewKey || !getHintForKey) return null;
    try {
      return getHintForKey(activePreviewKey);
    } catch {
      return null;
    }
  }, [activePreviewKey, getHintForKey]);

  // Esc closes pinned
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinnedKey(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Click outside closes pinned
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.('[data-bodymap-root="1"]')) return;
      setPinnedKey(null);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  // Bubble coordinates (clamped)
  const bubblePos = useMemo(() => {
    if (!activeMarker) return null;
    const isStart = activeMarker.align === 'start';
    const x = Math.min(520, Math.max(16, activeMarker.lx + (isStart ? 10 : -262)));
    const y = Math.min(260, Math.max(10, activeMarker.ly - 14));
    const nubSide: 'left' | 'right' = isStart ? 'left' : 'right';
    return { x, y, nubSide };
  }, [activeMarker]);

  function setTarget(next: { x: number; y: number }) {
    targetRef.current = next;
    if (prefersReduced) {
      currentRef.current = next;
      setMag(next);
    }
  }

  // Bubble inertia loop
  useEffect(() => {
    if (prefersReduced) return;

    function tick(t: number) {
      if (!lastTRef.current) lastTRef.current = t;
      const dt = clamp((t - lastTRef.current) / 1000, 0.001, 0.05);
      lastTRef.current = t;

      const cur = currentRef.current;
      const tgt = targetRef.current;

      const stiffness = pinnedKey ? 14 : 18;
      const blend = clamp(stiffness * dt, 0.02, 0.35);

      const nx = cur.x + (tgt.x - cur.x) * blend;
      const ny = cur.y + (tgt.y - cur.y) * blend;

      currentRef.current = { x: nx, y: ny };
      setMag({ x: nx, y: ny });

      const settled = Math.abs(tgt.x - nx) < 0.05 && Math.abs(tgt.y - ny) < 0.05;

      if (!settled) rafRef.current = requestAnimationFrame(tick);
      else {
        rafRef.current = null;
        lastTRef.current = 0;
      }
    }

    if (activePreviewKey && rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewKey, pinnedKey, prefersReduced]);

  // Nub elastic target derives from bubble mag (parallax direction opposite bubble drift)
  useEffect(() => {
    const raw = { x: clamp(-mag.x * 0.6, -3, 3), y: clamp(-mag.y * 0.6, -2, 2) };
    nubTargetRef.current = raw;

    if (prefersReduced) {
      nubCurRef.current = raw;
      setNubMag(raw);
    }

    if (!prefersReduced && activePreviewKey && nubRafRef.current == null) {
      nubRafRef.current = requestAnimationFrame(function nubTick(t: number) {
        if (!nubLastTRef.current) nubLastTRef.current = t;
        const dt = clamp((t - nubLastTRef.current) / 1000, 0.001, 0.05);
        nubLastTRef.current = t;

        const cur = nubCurRef.current;
        const tgt = nubTargetRef.current;

        // Elastic: lower stiffness => more lag
        const stiffness = pinnedKey ? 9 : 11;
        const blend = clamp(stiffness * dt, 0.02, 0.25);

        const nx = cur.x + (tgt.x - cur.x) * blend;
        const ny = cur.y + (tgt.y - cur.y) * blend;

        nubCurRef.current = { x: nx, y: ny };
        setNubMag({ x: nx, y: ny });

        const settled = Math.abs(tgt.x - nx) < 0.03 && Math.abs(tgt.y - ny) < 0.03;

        if (!settled) nubRafRef.current = requestAnimationFrame(nubTick);
        else {
          nubRafRef.current = null;
          nubLastTRef.current = 0;
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mag.x, mag.y, pinnedKey, activePreviewKey, prefersReduced]);

  function onBubbleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);

    const max = pinnedKey ? 4.0 : 6.0;
    setTarget({
      x: clamp(dx * max, -max, max),
      y: clamp(dy * max, -max, max),
    });
  }

  function resetMag() {
    setTarget({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (!activePreviewKey) {
      setTarget({ x: 0, y: 0 });
      nubTargetRef.current = { x: 0, y: 0 };

      if (prefersReduced) {
        setMag({ x: 0, y: 0 });
        setNubMag({ x: 0, y: 0 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewKey]);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .bm-anim { transition: none !important; animation: none !important; }
        }

        .bm-bubbleShadow {
          box-shadow:
            0 2px 10px rgba(2, 6, 23, 0.08),
            0 18px 50px rgba(2, 6, 23, 0.12);
        }

        .bm-enter {
          opacity: 0;
          transform: translateY(6px) scale(0.985);
          filter: blur(0.2px);
        }
        .bm-enterActive {
          opacity: 1;
          transform: translateY(0px) scale(1);
          filter: blur(0px);
          transition:
            opacity 160ms ease,
            transform 190ms cubic-bezier(0.2, 0.9, 0.2, 1),
            filter 190ms ease;
        }

        @keyframes bmPulse {
          0% { filter: drop-shadow(0 0 0 rgba(2,6,23,0.0)); transform: translateZ(0) scale(1); }
          50% { filter: drop-shadow(0 10px 14px rgba(2,6,23,0.10)); transform: translateZ(0) scale(1.03); }
          100% { filter: drop-shadow(0 0 0 rgba(2,6,23,0.0)); transform: translateZ(0) scale(1); }
        }
        .bm-pulse { animation: bmPulse 1.35s ease-in-out infinite; }
      `}</style>

      <header className="flex flex-wrap justify-between gap-3 mb-3">
        <div>
          <div className="text-xs text-slate-500">Step 2</div>
          <h2 className="text-lg font-semibold">Body Map</h2>
          <p className="text-sm text-slate-600">Select all areas where you feel discomfort.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onChangeGender(g)}
                className={clsx(
                  'px-3 py-2 text-sm font-semibold transition-colors',
                  gender === g ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
            {(['front', 'back'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChangeView(v)}
                className={clsx(
                  'px-3 py-2 text-sm font-semibold transition-colors',
                  view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="relative" data-bodymap-root="1">
        <svg viewBox="0 0 640 360" className="w-full h-auto rounded-xl bg-slate-50">
          <BodyMapCanvas gender={gender} view={view} />

          <BodyMapMarkers
            markers={markers}
            selected={selected}
            currentView={view}
            onToggle={onToggleKey}
            onRequestView={(v) => onChangeView(v)}
            hoveredKey={hoveredKey}
            pinnedKey={pinnedKey}
            onHoverKey={(k) => setHoveredKey(k)}
            onLeaveKey={(k) => setHoveredKey((prev) => (prev === k ? null : prev))}
            onPinKey={(k) => setPinnedKey((prev) => (prev === k ? null : k))}
          />

          {activeMarker && bubblePos && (
            <foreignObject x={bubblePos.x} y={bubblePos.y} width={260} height={196}>
              <div className="pointer-events-auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                <div
                  className={clsx(
                    'bm-anim bm-enter bm-enterActive relative rounded-2xl border bg-white/85 backdrop-blur-xl px-3 py-2 bm-bubbleShadow'
                  )}
                  style={{
                    WebkitBackdropFilter: 'blur(18px)',
                    backdropFilter: 'blur(18px)',
                    borderColor: pinnedKey ? 'rgba(148,163,184,0.70)' : 'rgba(148,163,184,0.45)',
                  }}
                >
                  {/* ✅ Parallax nub + ✅ elastic lag */}
                  <Nub side={bubblePos.nubSide} parallax={nubMag} />

                  {/* ✅ Magnetic + inertia layer */}
                  <div
                    className="bm-anim"
                    onMouseMove={onBubbleMove}
                    onMouseLeave={resetMag}
                    style={{
                      transform: `translate3d(${mag.x}px, ${mag.y}px, 0)`,
                      transition: prefersReduced ? 'none' : undefined,
                      willChange: 'transform',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-slate-900">
                        {labelBodyAreaKey(`${activeMarker.view}:${activeMarker.area}` as BodyAreaKey)}
                      </div>

                      <div className="flex items-center gap-2">
                        {activeHint ? (
                          <span className={clsx('text-[11px] font-extrabold px-2 py-0.5 rounded-lg', tonePill(activeHint.tone))}>
                            {toneLabel(activeHint.tone)}
                          </span>
                        ) : null}

                        {pinnedKey ? (
                          <button
                            type="button"
                            onClick={() => setPinnedKey(null)}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-lg border border-slate-200 bg-white/90 text-slate-700 hover:bg-white"
                            aria-label="Close pinned preview"
                            title="Close (Esc)"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {activeHint ? (
                      <>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{activeHint.title}</div>
                        <div className="mt-1 text-xs text-slate-700 leading-snug">{activeHint.body}</div>

                        {activeHint.basedOn ? (
                          <div className="mt-1 text-[11px] text-slate-500">{activeHint.basedOn}</div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-slate-600">Noted — we’ll include this in your check.</div>
                    )}

                    {/* Optional Pin/Unpin hint (luxury footer) */}
                    <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>
                        {pinnedKey ? (
                          <>
                            Pinned — press <span className="font-semibold">Esc</span> to close
                          </>
                        ) : (
                          <>
                            Hover preview — click marker to <span className="font-semibold">Pin</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-700 font-semibold">{pinnedKey ? 'Unpin' : 'Pin'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </foreignObject>
          )}
        </svg>
      </div>

      <div className="mt-3">
        <BodyMapHintStrip selectedKeys={selected} getHintForKey={getHintForKey} />
      </div>
    </section>
  );
}
