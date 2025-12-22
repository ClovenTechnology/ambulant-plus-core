// apps/clinician-app/app/workspaces/physio/physioModel.ts
'use client';

/**
 * Shared Physio workspace types, regions, utilities, and type guards.
 * Zero `any` reads. All persisted/localStorage loads are validated.
 */

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

// ✅ Discriminated union
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

// --------------------
// Regions (semantic; 3D uses these ids)
// --------------------
export type RegionDef = {
  id: string;
  label: string;
  side?: 'L' | 'R' | 'midline';
  views: BodyView[];
  jointHint?: string;
  defaultMovementHint?: string;
  specialTests?: string[];
};

export const REGIONS: RegionDef[] = [
  {
    id: 'neck',
    label: 'Neck',
    side: 'midline',
    views: ['front', 'back', 'left', 'right'],
    jointHint: 'Cervical Spine',
    defaultMovementHint: 'Rotation',
    specialTests: ['Spurling', 'Distraction', 'ULTT (Median)', 'Cervical Rotation < 60°'],
  },
  {
    id: 'left_shoulder',
    label: 'Left Shoulder',
    side: 'L',
    views: ['front', 'back', 'left'],
    jointHint: 'Shoulder',
    defaultMovementHint: 'Flexion',
    specialTests: ['Hawkins-Kennedy', 'Neer', 'Empty Can', 'Apprehension'],
  },
  {
    id: 'right_shoulder',
    label: 'Right Shoulder',
    side: 'R',
    views: ['front', 'back', 'right'],
    jointHint: 'Shoulder',
    defaultMovementHint: 'Flexion',
    specialTests: ['Hawkins-Kennedy', 'Neer', 'Empty Can', 'Apprehension'],
  },
  {
    id: 'thoracic_spine',
    label: 'Thoracic Spine',
    side: 'midline',
    views: ['back'],
    jointHint: 'Thoracic Spine',
    defaultMovementHint: 'Extension',
    specialTests: ['Rib Spring', 'PAIVMs (segmental)', 'Scapular Assistance (functional)'],
  },
  {
    id: 'lumbar_spine',
    label: 'Lumbar Spine',
    side: 'midline',
    views: ['back'],
    jointHint: 'Lumbar Spine',
    defaultMovementHint: 'Flexion',
    specialTests: ['SLR', 'Slump', 'Prone Instability', 'Quadrant (Kemp)'],
  },
  {
    id: 'left_knee',
    label: 'Left Knee',
    side: 'L',
    views: ['front', 'left'],
    jointHint: 'Knee',
    defaultMovementHint: 'Flexion',
    specialTests: ['Lachman', 'Anterior Drawer', 'McMurray', 'Valgus Stress', 'Varus Stress'],
  },
  {
    id: 'right_knee',
    label: 'Right Knee',
    side: 'R',
    views: ['front', 'right'],
    jointHint: 'Knee',
    defaultMovementHint: 'Flexion',
    specialTests: ['Lachman', 'Anterior Drawer', 'McMurray', 'Valgus Stress', 'Varus Stress'],
  },
  {
    id: 'left_ankle',
    label: 'Left Ankle',
    side: 'L',
    views: ['front', 'left'],
    jointHint: 'Ankle',
    defaultMovementHint: 'Dorsiflexion',
    specialTests: ['Anterior Drawer (Ankle)', 'Talar Tilt', 'Thompson', 'Squeeze (High Ankle)'],
  },
  {
    id: 'right_ankle',
    label: 'Right Ankle',
    side: 'R',
    views: ['front', 'right'],
    jointHint: 'Ankle',
    defaultMovementHint: 'Dorsiflexion',
    specialTests: ['Anterior Drawer (Ankle)', 'Talar Tilt', 'Thompson', 'Squeeze (High Ankle)'],
  },
];

// --------------------
// Utils
// --------------------
export function nowISO() {
  return new Date().toISOString();
}
export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
export function safeNum(v: unknown) {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
export function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}
export function severityFromPain(p?: number): Finding['severity'] | undefined {
  if (typeof p !== 'number' || !Number.isFinite(p)) return undefined;
  if (p >= 7) return 'severe';
  if (p >= 4) return 'moderate';
  return 'mild';
}
export function parseDegLike(s: string): number | undefined {
  const t = (s ?? '').trim().toLowerCase();
  if (!t) return undefined;
  if (t === 'wnl' || t === 'w.n.l' || t === 'within normal limits') return undefined;
  const m = t.match(/(-?\d+(\.\d+)?)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

// Heat helper for 3D overlays / badges
export function painHeatRGBA(pain0to10?: number) {
  const p = typeof pain0to10 === 'number' ? clamp(pain0to10, 0, 10) : 0;
  if (!p) return { r: 239, g: 68, b: 68, a: 0 };
  const a = 0.10 + (p / 10) * 0.55; // 0.10..0.65
  const r = 239;
  const g = Math.round(180 - (p / 10) * 112);
  const b = Math.round(68 - (p / 10) * 20);
  return { r, g, b, a };
}

// --------------------
// Type guards (no `any` meta reads)
// --------------------
function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isBodyView(v: unknown): v is BodyView {
  return v === 'front' || v === 'back' || v === 'left' || v === 'right';
}
function isStatus(v: unknown): v is FindingStatus {
  return v === 'draft' || v === 'final';
}
function isResolution(v: unknown): v is FindingResolution {
  return v === 'open' || v === 'resolved';
}
function isSpecialTestResult(v: unknown): v is SpecialTestResult {
  return v === 'positive' || v === 'negative' || v === 'inconclusive';
}
function isEndFeel(v: unknown): v is EndFeel {
  return v === 'soft' || v === 'firm' || v === 'hard' || v === 'empty' || v === 'springy' || v === 'other';
}
function isGoalMetric(v: unknown): v is GoalMetric {
  return v === 'pain' || v === 'rom_active';
}
function isGoalDirection(v: unknown): v is GoalDirection {
  return v === 'lte' || v === 'gte';
}

export function isChartLocation(v: unknown): v is ChartLocation {
  if (!isObj(v)) return false;
  if (v.kind !== 'physio_body') return false;
  if (!isStr(v.regionId)) return false;
  if (!isBodyView(v.view)) return false;
  if (v.side != null && v.side !== 'L' && v.side !== 'R' && v.side !== 'midline') return false;
  return true;
}

export function isEvidenceRef(v: unknown): v is EvidenceRef {
  if (!isObj(v)) return false;
  if (v.kind !== 'video_clip') return false;
  if (v.device !== 'camera' && v.device !== 'upload' && v.device !== 'other') return false;
  if (!isNum(v.startTs) || !isNum(v.endTs)) return false;
  if (!isStr(v.url)) return false;
  if (v.thumbnailUrl != null && !isStr(v.thumbnailUrl)) return false;
  if (v.status != null && v.status !== 'ready' && v.status !== 'processing' && v.status !== 'failed') return false;
  if (v.jobId != null && !isStr(v.jobId)) return false;
  if (v.label != null && !isStr(v.label)) return false;
  if (v.tags != null && (!Array.isArray(v.tags) || !v.tags.every(isStr))) return false;
  return true;
}

export function isPhysioMeta(v: unknown): v is PhysioMeta {
  if (!isObj(v)) return false;
  const ft = v.findingType;
  if (!isStr(ft)) return false;

  if (ft === 'pain') {
    if (v.painScore0to10 != null && !isNum(v.painScore0to10)) return false;
    if (v.quality != null && !isStr(v.quality)) return false;
    if (v.irritability != null && !isStr(v.irritability)) return false;
    if (v.pattern24h != null && !isStr(v.pattern24h)) return false;
    if (v.aggravators != null && !isStr(v.aggravators)) return false;
    if (v.relievers != null && !isStr(v.relievers)) return false;
    if (v.distribution != null && !isStr(v.distribution)) return false;
    return true;
  }

  if (ft === 'rom') {
    if (v.joint != null && !isStr(v.joint)) return false;
    if (v.movement != null && !isStr(v.movement)) return false;
    if (v.activeDeg != null && v.activeDeg !== null && !isNum(v.activeDeg)) return false;
    if (v.passiveDeg != null && v.passiveDeg !== null && !isNum(v.passiveDeg)) return false;
    if (v.wnl != null && !isBool(v.wnl)) return false;
    if (v.endFeel != null && !isEndFeel(v.endFeel)) return false;
    if (v.painfulArc != null && !isBool(v.painfulArc)) return false;
    if (v.painAtEndRange != null && !isBool(v.painAtEndRange)) return false;
    if (v.comparableSign != null && !isBool(v.comparableSign)) return false;
    return true;
  }

  if (ft === 'strength') {
    if (v.muscleGroup != null && !isStr(v.muscleGroup)) return false;
    if (v.test != null && !isStr(v.test)) return false;
    if (v.mmt0to5 != null) {
      const ok = v.mmt0to5 === 0 || v.mmt0to5 === 1 || v.mmt0to5 === 2 || v.mmt0to5 === 3 || v.mmt0to5 === 4 || v.mmt0to5 === 5;
      if (!ok) return false;
    }
    if (v.painWithResistance != null && !isBool(v.painWithResistance)) return false;
    if (v.inhibition != null && !isBool(v.inhibition)) return false;
    return true;
  }

  if (ft === 'special_test') {
    if (!isStr(v.testName)) return false;
    if (!isSpecialTestResult(v.result)) return false;
    return true;
  }

  if (ft === 'other') {
    if (v.kind != null && !isStr(v.kind)) return false;
    return true;
  }

  return false;
}

export function isFinding(v: unknown): v is Finding {
  if (!isObj(v)) return false;
  if (!isStr(v.id)) return false;
  if (!isStr(v.patientId)) return false;
  if (!isStr(v.encounterId)) return false;
  if (v.specialty !== 'physio') return false;
  if (!isStatus(v.status)) return false;
  if (!isResolution(v.resolution)) return false;
  if (!isStr(v.title)) return false;

  if (v.note != null && !isStr(v.note)) return false;
  if (v.severity != null && v.severity !== 'mild' && v.severity !== 'moderate' && v.severity !== 'severe') return false;
  if (v.tags != null && (!Array.isArray(v.tags) || !v.tags.every(isStr))) return false;

  if (!isChartLocation(v.location)) return false;
  if (!Array.isArray(v.evidence) || !v.evidence.every(isEvidenceRef)) return false;
  if (!isPhysioMeta(v.meta)) return false;

  if (!isStr(v.createdAt) || !isStr(v.updatedAt) || !isStr(v.createdBy)) return false;
  return true;
}

export function isGoal(v: unknown): v is Goal {
  if (!isObj(v)) return false;
  if (!isStr(v.id)) return false;
  if (!isStr(v.regionId)) return false;
  if (!isStr(v.title)) return false;
  if (!isGoalMetric(v.metric)) return false;
  if (!isGoalDirection(v.direction)) return false;
  if (!isNum(v.target)) return false;
  if (!isStr(v.createdAt)) return false;
  if (v.done != null && !isBool(v.done)) return false;
  return true;
}

// --------------------
// Safe meta accessors
// --------------------
export function getPainScore(meta: PhysioMeta): number | undefined {
  return meta.findingType === 'pain' ? safeNum(meta.painScore0to10) : undefined;
}
export function getRomActive(meta: PhysioMeta): number | undefined {
  if (meta.findingType !== 'rom') return undefined;
  const v = meta.activeDeg;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function pickRegion(regionId: string) {
  return REGIONS.find((r) => r.id === regionId) ?? REGIONS[0]!;
}

export function regionLabel(regionId: string) {
  return pickRegion(regionId).label;
}
