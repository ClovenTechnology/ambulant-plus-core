// apps/clinician-app/app/api/_workspacesStore.ts
// Simple in-memory store for demo/server-truth.
// NOTE: In serverless this may reset between reloads — fine for now.
// Later: swap to Prisma/Postgres.

/* -----------------------------
   Shared types
--------------------------------*/
export type Specialty = 'dental' | 'ent' | 'optometry' | 'physio' | 'xray' | string;

export type ToothSystem = 'universal' | 'FDI';
export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L';

export type DentalLocation = {
  kind: 'dental_tooth';
  toothSystem: ToothSystem;
  toothId: string;
  surface?: ToothSurface;
};

// Generic imaging location for X-ray / etc (extend later as needed)
export type ImagingLocation = {
  kind: 'imaging';
  modality: 'xray' | 'ct' | 'mri' | 'ultrasound' | string;
  studyId?: string;
  imageId?: string;
  view?: string; // e.g. "PA", "LAT"
  region?: string; // e.g. "Chest"
};

export type WorkspaceLocation = DentalLocation | ImagingLocation | Record<string, any> | null;

export type EvidenceKind = 'image' | 'video_clip' | 'scan_3d';
export type EvidenceStatus = 'ready' | 'processing' | 'failed';

/* -----------------------------
   Dental-specific (kept as-is)
--------------------------------*/
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

/* -----------------------------
   Multi-specialty evidence/annotation/revision
   (Dental aliases maintained)
--------------------------------*/
export type WorkspaceEvidence = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  findingId?: string | null;
  location?: WorkspaceLocation;

  kind: EvidenceKind;
  device: 'intraoral_cam' | 'otoscope' | 'upload' | 'scanner_3d' | 'other' | string;

  url?: string | null;
  thumbnailUrl?: string | null;
  contentType?: string | null;

  status: EvidenceStatus;
  jobId?: string | null;

  capturedAt: string; // ISO
  meta?: any;
};

// Backward-compatible aliases (so existing dental code / mental model remains intact)
export type DentalEvidence = WorkspaceEvidence;

export type WorkspaceAnnotation = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  evidenceId: string;
  findingId?: string | null;
  location?: WorkspaceLocation;
  type: 'pin' | 'comment';
  payload: any;
  createdAt: string;
  createdBy: string;
};

export type DentalAnnotation = WorkspaceAnnotation;

export type PlanItem = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: 'dental';
  toothId?: string;
  label: string;
  status: 'planned' | 'done';
  createdAt: string;
  createdBy: string;
};

export type WorkspaceRevision = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  revisionNo: number;
  createdAt: string;
  toothId?: string;
  note?: string;
  evidenceIds: string[];
  annotationCount: number;
  createdBy: string;
  meta?: any;
};

export type LabRevision = WorkspaceRevision;

/* -----------------------------
   Store
--------------------------------*/
type Store = {
  findings: DentalFinding[];
  evidence: WorkspaceEvidence[];
  annotations: WorkspaceAnnotation[];
  planItems: PlanItem[];
  revisions: WorkspaceRevision[];
};

function nowISO() {
  return new Date().toISOString();
}
function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getStore(): Store {
  const g = globalThis as any;
  if (!g.__AMB_WORKSPACES_STORE__) {
    g.__AMB_WORKSPACES_STORE__ = {
      findings: [],
      evidence: [],
      annotations: [],
      planItems: [],
      revisions: [],
    } satisfies Store;
  }
  return g.__AMB_WORKSPACES_STORE__ as Store;
}

export function store() {
  return getStore();
}

/* -----------------------------
   Dental finding (unchanged)
--------------------------------*/
export function createFinding(input: Partial<DentalFinding>) {
  const s = getStore();
  const created: DentalFinding = {
    id: input.id ?? uid('fd'),
    patientId: String(input.patientId ?? 'pat_demo_001'),
    encounterId: String(input.encounterId ?? 'enc_demo_001'),
    specialty: 'dental',
    status: (input.status as any) ?? 'draft',
    title: String(input.title ?? 'Finding'),
    note: input.note,
    severity: input.severity,
    tags: input.tags ?? ['dental'],
    location: input.location as DentalLocation,
    createdAt: input.createdAt ?? nowISO(),
    updatedAt: input.updatedAt ?? nowISO(),
    createdBy: String(input.createdBy ?? 'clin_demo_001'),
    meta: input.meta ?? {},
  };
  s.findings.unshift(created);
  return created;
}

export function patchFinding(id: string, patch: Partial<DentalFinding>) {
  const s = getStore();
  const idx = s.findings.findIndex((f) => f.id === id);
  if (idx < 0) return null;
  const cur = s.findings[idx];
  const updated: DentalFinding = {
    ...cur,
    ...patch,
    id: cur.id,
    specialty: 'dental',
    updatedAt: nowISO(),
  };
  s.findings[idx] = updated;
  return updated;
}

/* -----------------------------
   Evidence (multi-specialty)
--------------------------------*/
export function createEvidence(input: Partial<WorkspaceEvidence>) {
  const s = getStore();
  const created: WorkspaceEvidence = {
    id: input.id ?? uid('ev'),
    patientId: String(input.patientId ?? 'pat_demo_001'),
    encounterId: String(input.encounterId ?? 'enc_demo_001'),
    specialty: (input.specialty ?? 'dental') as any,
    findingId: (input.findingId ?? null) as any,
    location: (input.location ?? null) as any,

    kind: (input.kind as any) ?? 'image',
    device: (input.device as any) ?? 'other',

    url: input.url ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    contentType: input.contentType ?? null,

    status: (input.status as any) ?? 'ready',
    jobId: input.jobId ?? null,

    capturedAt: input.capturedAt ?? nowISO(),
    meta: input.meta ?? {},
  };
  s.evidence.unshift(created);
  return created;
}

export function patchEvidence(id: string, patch: Partial<WorkspaceEvidence>) {
  const s = getStore();
  const idx = s.evidence.findIndex((e) => e.id === id);
  if (idx < 0) return null;
  const cur = s.evidence[idx];
  const updated: WorkspaceEvidence = {
    ...cur,
    ...patch,
    id: cur.id,
    specialty: (patch.specialty ?? cur.specialty) as any,
  };
  s.evidence[idx] = updated;
  return updated;
}

/* -----------------------------
   Annotation (multi-specialty)
--------------------------------*/
export function createAnnotation(input: Partial<WorkspaceAnnotation>) {
  const s = getStore();
  const created: WorkspaceAnnotation = {
    id: input.id ?? uid('an'),
    patientId: String(input.patientId ?? 'pat_demo_001'),
    encounterId: String(input.encounterId ?? 'enc_demo_001'),
    specialty: (input.specialty ?? 'dental') as any,
    evidenceId: String(input.evidenceId ?? ''),
    findingId: (input.findingId ?? null) as any,
    location: (input.location ?? null) as any,
    type: (input.type as any) ?? 'pin',
    payload: input.payload ?? {},
    createdAt: input.createdAt ?? nowISO(),
    createdBy: String(input.createdBy ?? 'clin_demo_001'),
  };
  s.annotations.unshift(created);
  return created;
}

/* -----------------------------
   Plan items (dental-only, unchanged)
--------------------------------*/
export function createPlanItem(input: Partial<PlanItem>) {
  const s = getStore();
  const created: PlanItem = {
    id: input.id ?? uid('pl'),
    patientId: String(input.patientId ?? 'pat_demo_001'),
    encounterId: String(input.encounterId ?? 'enc_demo_001'),
    specialty: 'dental',
    toothId: input.toothId,
    label: String(input.label ?? 'Plan item'),
    status: (input.status as any) ?? 'planned',
    createdAt: input.createdAt ?? nowISO(),
    createdBy: String(input.createdBy ?? 'clin_demo_001'),
  };
  s.planItems.unshift(created);
  return created;
}

export function patchPlanItem(id: string, patch: Partial<PlanItem>) {
  const s = getStore();
  const idx = s.planItems.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const cur = s.planItems[idx];
  const updated: PlanItem = { ...cur, ...patch, id: cur.id, specialty: 'dental' };
  s.planItems[idx] = updated;
  return updated;
}

/* -----------------------------
   Revisions (multi-specialty)
--------------------------------*/
export function createRevision(input: Partial<WorkspaceRevision>) {
  const s = getStore();

  const patientId = String(input.patientId ?? 'pat_demo_001');
  const encounterId = String(input.encounterId ?? 'enc_demo_001');
  const specialty = (input.specialty ?? 'dental') as any;

  const existingMax =
    s.revisions
      .filter((r) => r.patientId === patientId && r.encounterId === encounterId && r.specialty === specialty)
      .reduce((m, r) => Math.max(m, r.revisionNo), 0) || 0;

  const created: WorkspaceRevision = {
    id: input.id ?? uid('rev'),
    patientId,
    encounterId,
    specialty,
    revisionNo: input.revisionNo ?? existingMax + 1,
    createdAt: input.createdAt ?? nowISO(),
    toothId: input.toothId,
    note: input.note,
    evidenceIds: (input.evidenceIds ?? []) as any,
    annotationCount: Number(input.annotationCount ?? 0),
    createdBy: String(input.createdBy ?? 'clin_demo_001'),
    meta: input.meta ?? {},
  };

  s.revisions.unshift(created);
  return created;
}

/* -----------------------------
   Query filter (already generic)
--------------------------------*/
export function filterByQuery<T extends { patientId: string; encounterId: string; specialty: string }>(
  items: T[],
  q: URLSearchParams,
) {
  const patientId = q.get('patientId');
  const encounterId = q.get('encounterId');
  const specialty = q.get('specialty');

  return items.filter((x) => {
    if (patientId && x.patientId !== patientId) return false;
    if (encounterId && x.encounterId !== encounterId) return false;
    if (specialty && x.specialty !== specialty) return false;
    return true;
  });
}
