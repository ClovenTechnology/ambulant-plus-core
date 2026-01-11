// components/selfcheck/bodymap/bodyMapConfig.ts

import type {
  BodyArea,
  BodySide,
  BodyAreaKey,
  Marker,
} from './types';

/* ──────────────────────────────────────────────
   Runtime-safe key helper
   (DO NOT make this type-only)
────────────────────────────────────────────── */

export const keyFor = (view: BodySide, area: BodyArea): BodyAreaKey => {
  return `${view}:${area}` as BodyAreaKey;
};

/* ──────────────────────────────────────────────
   Marker layouts
────────────────────────────────────────────── */

export const FRONT_MARKERS: Marker[] = [
  { n: 9, area: 'biceps', view: 'front', x: 210, y: 92, lx: 92, ly: 110, align: 'end', tone: 'rose' },
  { n: 4, area: 'shoulders', view: 'front', x: 265, y: 92, lx: 335, ly: 92, align: 'start', tone: 'sky' },
  { n: 6, area: 'side_abs', view: 'front', x: 188, y: 150, lx: 92, ly: 160, align: 'end', tone: 'blue' },
  { n: 7, area: 'forearms', view: 'front', x: 285, y: 150, lx: 360, ly: 150, align: 'start', tone: 'indigo' },
  { n: 8, area: 'quadriceps', view: 'front', x: 218, y: 228, lx: 92, ly: 238, align: 'end', tone: 'violet' },
  { n: 2, area: 'calves', view: 'front', x: 250, y: 282, lx: 360, ly: 286, align: 'start', tone: 'slate' },
  { n: 5, area: 'abs', view: 'front', x: 240, y: 156, lx: 92, ly: 192, align: 'end', tone: 'slate' },
];

export const BACK_MARKERS: Marker[] = [
  { n: 3, area: 'upper_back', view: 'back', x: 440, y: 110, lx: 560, ly: 110, align: 'start', tone: 'indigo' },
  { n: 1, area: 'lower_back', view: 'back', x: 440, y: 168, lx: 560, ly: 168, align: 'start', tone: 'slate' },
  { n: 10, area: 'glutes', view: 'back', x: 440, y: 228, lx: 560, ly: 228, align: 'start', tone: 'violet' },
];

export const ALL_MARKERS: Marker[] = [
  ...FRONT_MARKERS,
  ...BACK_MARKERS,
];
