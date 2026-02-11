// /components/selfcheck/bodymap/BodyMapCanvas.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { BodySide } from './types';

export default function BodyMapCanvas({
  gender,
  view,
}: {
  gender: 'male' | 'female';
  view: BodySide;
}) {
  const [fromView, setFromView] = useState<BodySide>(view);
  const [toView, setToView] = useState<BodySide>(view);
  const [phase, setPhase] = useState<'idle' | 'animating'>('idle');

  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (view === toView) return;

    // Begin staged flip:
    // fromView = current toView
    // toView = new view
    // phase animates for 260ms then settles
    setFromView(toView);
    setToView(view);
    setPhase('animating');

    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setPhase('idle');
    }, 260);

    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const anim = phase === 'animating';

  // Opacity + slide
  const fromOpacity = anim ? 0.12 : 0.72;
  const toOpacity = anim ? 1 : 0.72;

  const fromShift = anim ? -10 : 0;
  const toShift = anim ? 0 : 0;

  // When idle, we still dim the non-selected one (classic behavior),
  // but during animation we crossfade more aggressively.
  const frontOpacity =
    toView === 'front' ? (anim ? toOpacity : 1) : (anim ? fromOpacity : 0.72);
  const backOpacity =
    toView === 'back' ? (anim ? toOpacity : 1) : (anim ? fromOpacity : 0.72);

  // Slide direction: if going front -> back, slide left a touch; reverse slides right
  const dir = fromView === 'front' && toView === 'back' ? -1 : 1;

  const frontTranslate =
    anim
      ? toView === 'front'
        ? `translate(${toShift}px,0)`
        : `translate(${fromShift * dir}px,0)`
      : 'translate(0,0)';

  const backTranslate =
    anim
      ? toView === 'back'
        ? `translate(${toShift}px,0)`
        : `translate(${fromShift * -dir}px,0)`
      : 'translate(0,0)';

  const commonStyle: React.CSSProperties = {
    transition: 'opacity 260ms ease, transform 260ms ease',
    transformOrigin: 'center',
  };

  return (
    <>
      {/* FRONT */}
      <g
        style={{
          ...commonStyle,
          opacity: frontOpacity,
          transform: frontTranslate,
        }}
      >
        <image
          href={`/bodymap/${gender}-front.png`}
          x={140}
          y={54}
          width={200}
          height={300}
          style={{ pointerEvents: 'none' }}
        />
      </g>

      {/* BACK */}
      <g
        style={{
          ...commonStyle,
          opacity: backOpacity,
          transform: backTranslate,
        }}
      >
        <image
          href={`/bodymap/${gender}-back.png`}
          x={340}
          y={54}
          width={200}
          height={300}
          style={{ pointerEvents: 'none' }}
        />
      </g>
    </>
  );
}
