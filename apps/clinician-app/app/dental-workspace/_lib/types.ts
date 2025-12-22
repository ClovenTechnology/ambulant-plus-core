// apps/clinician-app/app/dental-workspace/_lib/types.ts
export type ToothSystem = 'universal' | 'FDI';
export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L';

export type DentalLocation = {
  kind: 'dental_tooth';
  toothSystem: ToothSystem; // NOTE: with Option A we store 'universal' in records
  toothId: string; // universal id in storage
  surface?: ToothSurface;
};

export type EvidenceKind = 'image' | 'video_clip' | 'scan_3d';
export type EvidenceStatus = 'ready' | 'processing' | 'failed';

export type DentalEvidence = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  findingId?: string | null;
  location: DentalLocation;

  kind: EvidenceKind;
  device: 'intraoral_cam' | 'otoscope' | 'upload' | 'scanner_3d' | 'other';

  url?: string | null;
  thumbnailUrl?: string | null;
  contentType?: string | null;

  status: EvidenceStatus;
  jobId?: string | null;

  capturedAt: string; // ISO
  meta?: any;
};

export type DentalFinding = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  status: 'draft' | 'final';
  title: string;
  note?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  tags?: string[];
  location: DentalLocation;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  meta?: any;
};

export type DentalAnnotation = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  evidenceId: string;
  findingId?: string | null;
  location: DentalLocation;
  type: 'pin' | 'comment';
  payload: any;
  createdAt: string;
  createdBy: string;
};

export type PlanItem = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  toothId?: string; // universal in storage
  label: string;
  status: 'planned' | 'done';
  createdAt: string;
  createdBy: string;
};

export type LabRevision = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  revisionNo: number;
  createdAt: string;
  toothId?: string; // universal in storage
  note?: string;
  evidenceIds: string[];
  annotationCount: number;
  createdBy: string;
  meta?: any;
};

export const FINDING_TYPES = [
  { key: 'caries_suspected', label: 'Caries suspected' },
  { key: 'fracture', label: 'Fracture' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'sensitivity', label: 'Sensitivity' },
  { key: 'discoloration', label: 'Discoloration' },
  { key: 'swelling', label: 'Swelling' },
  { key: 'missing_tooth', label: 'Missing tooth' },
  { key: 'other', label: 'Other' },
] as const;

export type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

/* ---------- Annotation payloads ---------- */
export type ScreenPinPayload = { kind: 'screen'; x: number; y: number; label?: string };
export type ModelPinPayload = {
  kind: 'model';
  meshId: string; // node/mesh name (e.g., tooth_11)
  p: [number, number, number];
  n?: [number, number, number];
  label?: string;
};
