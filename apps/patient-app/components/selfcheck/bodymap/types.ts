// components/selfcheck/bodymap/types.ts

export type BodySide = 'front' | 'back';

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

export type BodyAreaKey = `${BodySide}:${BodyArea}`;

export type MarkerTone =
  | 'slate'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'rose'
  | 'blue';

export type Marker = {
  n: number;
  area: BodyArea;
  view: BodySide;
  x: number;
  y: number;
  lx: number;
  ly: number;
  align: 'start' | 'end';
  tone: MarkerTone;
};

export const BODY_AREA_LABEL: Record<BodyArea, string> = {
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  forearms: 'Forearms',
  abs: 'Abdomen',
  side_abs: 'Side abdomen',
  quadriceps: 'Quadriceps',
  calves: 'Calves',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  glutes: 'Glutes',
};

/* ──────────────────────────────────────────────
   Hints
────────────────────────────────────────────── */

export type BodyHintTone = 'info' | 'warn' | 'danger';

export type BodyHint = {
  tone: BodyHintTone;
  title: string;
  body: string;
  basedOn?: string;
};
