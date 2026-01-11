// /components/selfcheck/bodymap/BodyMapCanvas.tsx
'use client';

import { BodySide } from './types';

export default function BodyMapCanvas({
  gender,
  view,
}: {
  gender: 'male' | 'female';
  view: BodySide;
}) {
  return (
    <>
      <g opacity={view === 'front' ? 1 : 0.72}>
        <image
          href={`/bodymap/${gender}-front.png`}
          x={140}
          y={54}
          width={200}
          height={300}
        />
      </g>

      <g opacity={view === 'back' ? 1 : 0.72}>
        <image
          href={`/bodymap/${gender}-back.png`}
          x={340}
          y={54}
          width={200}
          height={300}
        />
      </g>
    </>
  );
}
