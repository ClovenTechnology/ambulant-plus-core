/* apps/clinician-app/app/workspaces/physio/_components/types.ts */

export type Specialty = 'physio';
export type BodyView = 'front' | 'back' | 'left' | 'right';

export type ChartLocation = {
  kind: 'physio_body';
  regionId: string;
  side?: 'L' | 'R' | 'midline';
  view: BodyView;
};

export type EvidenceRef = {
  kind: 'video_clip';
  device: 'camera' | 'upload' | 'other';
  startTs: number;
  endTs: number;
  url: string;
  thumbnailUrl?: string;
  status?: 'ready' | 'processing' | 'failed';
  jobId?: string;
  label?: string;
  tags?: string[];
};

export type PainQuality = 'sharp' | 'dull' | 'burning' | 'tingling' | 'aching' | 'stiff' | 'other';
export type Irritability = 'low' | 'moderate' | 'high';
export type Pattern24h = 'worse_am' | 'worse_pm' | 'constant' | 'intermittent' | 'night' | 'unknown';

export type EndFeel = 'soft' | 'firm' | 'hard' | 'empty' | 'springy' | 'other';
export type SpecialTestResult = 'positive' | 'negative' | 'inconclusive';

export type PhysioMeta =
  | {
      findingType: 'pain';
      painScore0to10?: number;
      quality?: PainQuality;
      irritability?: Irritability;
      pattern24h?: Pattern24h;
      aggravators?: string;
      relievers?: string;
      distribution?: string;
    }
  | {
      findingType: 'rom';
      joint?: string;
      movement?: string;
      activeDeg?: number | null;
      passiveDeg?: number | null;
      wnl?: boolean;
      endFeel?: EndFeel;
      painfulArc?: boolean;
      painAtEndRange?: boolean;
      comparableSign?: boolean;
    }
  | {
      findingType: 'strength';
      muscleGroup?: string;
      test?: string;
      mmt0to5?: 0 | 1 | 2 | 3 | 4 | 5;
      painWithResistance?: boolean;
      inhibition?: boolean;
    }
  | {
      findingType: 'special_test';
      testName: string;
      result: SpecialTestResult;
    }
  | {
      findingType: 'other';
      kind?: string;
    };

export type FindingStatus = 'draft' | 'final';
export type FindingResolution = 'open' | 'resolved';

export type Finding = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  status: FindingStatus;
  resolution: FindingResolution;
  title: string;
  note?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  tags?: string[];
  location: ChartLocation;
  evidence: EvidenceRef[];
  meta: PhysioMeta;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type GoalMetric = 'pain' | 'rom_active';
export type GoalDirection = 'lte' | 'gte';

export type Goal = {
  id: string;
  regionId: string;
  title: string;
  metric: GoalMetric;
  direction: GoalDirection;
  target: number;
  createdAt: string;
  done?: boolean;
};

export type RegionHotspot = {
  pos: [number, number, number];
  labelPos?: [number, number, number];
};

export type RegionDef = {
  id: string;
  label: string;
  side?: 'L' | 'R' | 'midline';
  views: BodyView[];
  jointHint?: string;
  defaultMovementHint?: string;
  specialTests?: string[];
  // legacy 2D hit shapes (kept for fallback)
  shapes: Partial<Record<BodyView, string>>;
  // 3D hotspots (for modern 3D map)
  hotspot?: Partial<Record<BodyView, RegionHotspot>>;
};

// NOTE: You can expand this aggressively later. This is enough to look “premium” immediately.
export const REGIONS: RegionDef[] = [
  {
    id: 'neck',
    label: 'Neck',
    side: 'midline',
    views: ['front', 'back', 'left', 'right'],
    jointHint: 'Cervical Spine',
    defaultMovementHint: 'Rotation',
    specialTests: ['Spurling', 'Distraction', 'ULTT (Median)', 'Cervical Rotation < 60°'],
    shapes: {
      front: 'M44 8 L56 8 L60 18 L40 18 Z',
      back: 'M44 8 L56 8 L60 18 L40 18 Z',
      left: 'M42 9 L56 9 L58 18 L40 18 Z',
      right: 'M44 9 L58 9 L60 18 L42 18 Z',
    },
    hotspot: {
      front: { pos: [0, 1.35, 0.55], labelPos: [-0.65, 1.45, 0.65] },
      back: { pos: [0, 1.35, -0.55], labelPos: [0.65, 1.45, -0.65] },
      left: { pos: [-0.25, 1.35, 0.1], labelPos: [-0.95, 1.45, 0.1] },
      right: { pos: [0.25, 1.35, 0.1], labelPos: [0.95, 1.45, 0.1] },
    },
  },
  {
    id: 'left_shoulder',
    label: 'Left Shoulder',
    side: 'L',
    views: ['front', 'back', 'left'],
    jointHint: 'Shoulder',
    defaultMovementHint: 'Flexion',
    specialTests: ['Hawkins-Kennedy', 'Neer', 'Empty Can', 'Apprehension'],
    shapes: {
      front: 'M22 18 L36 18 L40 28 L24 30 Z',
      back: 'M22 18 L36 18 L40 28 L24 30 Z',
      left: 'M28 18 L44 18 L48 30 L30 30 Z',
    },
    hotspot: {
      front: { pos: [-0.55, 1.05, 0.45], labelPos: [-1.25, 1.1, 0.55] },
      back: { pos: [-0.55, 1.05, -0.45], labelPos: [-1.25, 1.1, -0.55] },
      left: { pos: [-0.75, 1.05, 0.0], labelPos: [-1.35, 1.1, 0.05] },
    },
  },
  {
    id: 'right_shoulder',
    label: 'Right Shoulder',
    side: 'R',
    views: ['front', 'back', 'right'],
    jointHint: 'Shoulder',
    defaultMovementHint: 'Flexion',
    specialTests: ['Hawkins-Kennedy', 'Neer', 'Empty Can', 'Apprehension'],
    shapes: {
      front: 'M64 18 L78 18 L76 30 L60 28 Z',
      back: 'M64 18 L78 18 L76 30 L60 28 Z',
      right: 'M56 18 L72 18 L70 30 L52 30 Z',
    },
    hotspot: {
      front: { pos: [0.55, 1.05, 0.45], labelPos: [1.25, 1.1, 0.55] },
      back: { pos: [0.55, 1.05, -0.45], labelPos: [1.25, 1.1, -0.55] },
      right: { pos: [0.75, 1.05, 0.0], labelPos: [1.35, 1.1, 0.05] },
    },
  },
  {
    id: 'left_knee',
    label: 'Left Knee',
    side: 'L',
    views: ['front', 'left'],
    jointHint: 'Knee',
    defaultMovementHint: 'Flexion',
    specialTests: ['Lachman', 'Anterior Drawer', 'McMurray', 'Valgus Stress', 'Varus Stress'],
    shapes: {
      front: 'M34 64 L44 64 L44 78 L34 78 Z',
      left: 'M44 64 L54 64 L54 78 L44 78 Z',
    },
    hotspot: {
      front: { pos: [-0.25, 0.2, 0.5], labelPos: [-0.95, 0.25, 0.6] },
      left: { pos: [-0.35, 0.2, 0.05], labelPos: [-1.05, 0.25, 0.05] },
    },
  },
  {
    id: 'right_knee',
    label: 'Right Knee',
    side: 'R',
    views: ['front', 'right'],
    jointHint: 'Knee',
    defaultMovementHint: 'Flexion',
    specialTests: ['Lachman', 'Anterior Drawer', 'McMurray', 'Valgus Stress', 'Varus Stress'],
    shapes: {
      front: 'M56 64 L66 64 L66 78 L56 78 Z',
      right: 'M46 64 L56 64 L56 78 L46 78 Z',
    },
    hotspot: {
      front: { pos: [0.25, 0.2, 0.5], labelPos: [0.95, 0.25, 0.6] },
      right: { pos: [0.35, 0.2, 0.05], labelPos: [1.05, 0.25, 0.05] },
    },
  },
  {
    id: 'left_ankle',
    label: 'Left Ankle',
    side: 'L',
    views: ['front', 'left'],
    jointHint: 'Ankle',
    defaultMovementHint: 'Dorsiflexion',
    specialTests: ['Anterior Drawer (Ankle)', 'Talar Tilt', 'Thompson', 'Squeeze (High Ankle)'],
    shapes: {
      front: 'M34 84 L44 84 L44 94 L34 94 Z',
      left: 'M44 84 L54 84 L54 94 L44 94 Z',
    },
    hotspot: {
      front: { pos: [-0.25, -0.55, 0.45], labelPos: [-0.95, -0.5, 0.55] },
      left: { pos: [-0.35, -0.55, 0.05], labelPos: [-1.05, -0.5, 0.05] },
    },
  },
  {
    id: 'right_ankle',
    label: 'Right Ankle',
    side: 'R',
    views: ['front', 'right'],
    jointHint: 'Ankle',
    defaultMovementHint: 'Dorsiflexion',
    specialTests: ['Anterior Drawer (Ankle)', 'Talar Tilt', 'Thompson', 'Squeeze (High Ankle)'],
    shapes: {
      front: 'M56 84 L66 84 L66 94 L56 94 Z',
      right: 'M46 84 L56 84 L56 94 L46 94 Z',
    },
    hotspot: {
      front: { pos: [0.25, -0.55, 0.45], labelPos: [0.95, -0.5, 0.55] },
      right: { pos: [0.35, -0.55, 0.05], labelPos: [1.05, -0.5, 0.05] },
    },
  },
];
