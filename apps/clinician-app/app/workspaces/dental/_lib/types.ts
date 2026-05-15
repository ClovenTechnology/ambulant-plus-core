// apps/clinician-app/app/workspaces/dental/_lib/types.ts

export type ToothSystem = 'universal' | 'FDI';

export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L';

export type EvidenceKind = 'image' | 'scan_3d' | 'video_clip';

export type EvidenceStatus = 'ready' | 'processing' | 'failed';

export type FindingSeverity = 'mild' | 'moderate' | 'severe';

export type FindingStatus = 'draft' | 'final';

export const FINDING_TYPES = [
  { key: 'caries_suspected', label: 'Caries suspected' },
  { key: 'fracture_suspected', label: 'Fracture suspected' },
  { key: 'restoration_defect', label: 'Restoration defect' },
  { key: 'periapical_lesion', label: 'Periapical lesion suspected' },
  { key: 'periodontal_bone_loss', label: 'Periodontal bone loss' },
  { key: 'impacted_tooth', label: 'Impacted tooth' },
  { key: 'missing_tooth', label: 'Missing tooth' },
  { key: 'malocclusion', label: 'Malocclusion' },
  { key: 'soft_tissue_concern', label: 'Soft tissue concern' },
  { key: 'other', label: 'Other' },
] as const;

export type FindingTypeKey = (typeof FINDING_TYPES)[number]['key'];

export type DentalLocation = {
  kind: 'dental_tooth';
  toothId: string;
  surface?: ToothSurface;
};

export type DentalFinding = {
  id: string;
  patientId?: string;
  encounterId?: string;
  specialty?: 'dental';
  status?: FindingStatus;
  title: string;
  note?: string;
  severity?: FindingSeverity;
  tags?: string[];
  location?: DentalLocation;
  toothId?: string;
  surface?: ToothSurface;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  meta?: Record<string, any>;
};

export type ScreenPinPayload = {
  kind: 'screen';
  x: number;
  y: number;
  label?: string;
};

export type ModelPinPayload = {
  kind: 'model';
  meshId: string;
  p: [number, number, number];
  n?: [number, number, number];
  label?: string;
};

export type DentalAnnotation = {
  id: string;
  patientId?: string;
  encounterId?: string;
  specialty?: 'dental';
  evidenceId?: string;
  findingId?: string | null;
  toothId?: string;
  surface?: ToothSurface;
  location?: DentalLocation;
  type: 'pin' | 'box' | 'freehand' | 'text';
  payload: ScreenPinPayload | ModelPinPayload | Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
};

export type DentalEvidence = {
  id: string;
  patientId?: string;
  encounterId?: string;
  specialty?: 'dental';
  findingId?: string | null;
  toothId?: string;
  surface?: ToothSurface;
  location?: DentalLocation;

  kind: EvidenceKind;
  status: EvidenceStatus;

  url?: string;
  thumbnailUrl?: string;
  contentType?: string;
  jobId?: string | null;

  capturedAt: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;

  meta?: {
    modality?: 'xray' | 'photo' | 'other';
    segmentation?: {
      perTooth?: boolean;
      scheme?: 'FDI' | 'universal';
    };
    [key: string]: any;
  };
};

export type PlanItem = {
  id: string;
  label: string;
  toothId?: string;
  status: 'planned' | 'done';
  createdAt: string;
  updatedAt?: string;
};