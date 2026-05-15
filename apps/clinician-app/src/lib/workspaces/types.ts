/*
File: apps/clinician-app/src/lib/workspaces/types.ts

Shared workspace contracts for:
- POST /findings
- POST /evidence
- POST /annotations
*/

export type Specialty =
  | 'dental'
  | 'physio'
  | 'ent'
  | 'optometry'
  | 'cardiology'
  | 'dermatology'
  | 'endocrinology'
  | 'fertility'
  | 'neurology'
  | 'obgyn'
  | 'occupational_therapy'
  | 'paediatric'
  | 'speech_therapy'
  | 'substance-abuse';

export type EvidenceStatus = 'ready' | 'processing' | 'failed';

export type EvidenceKind = 'image' | 'video_clip' | 'scan_3d';

export type CardioMode = 'ECG' | 'AUSC';

export type CardioZone =
  | '12_lead'
  | 'lead_I'
  | 'lead_II'
  | 'lead_III'
  | 'v1'
  | 'v2'
  | 'v3'
  | 'v4'
  | 'v5'
  | 'v6'
  | 'aortic'
  | 'pulmonic'
  | 'tricuspid'
  | 'mitral';

export type DermView =
  | 'FACE_NECK'
  | 'TORSO'
  | 'ARMS'
  | 'LEGS'
  | 'GENERAL';

export type EndocrinePanel =
  | 'GLUCOSE'
  | 'THYROID'
  | 'FOOT'
  | 'WEIGHT';

export type FertilitySubject = 'female' | 'male' | 'couple';

export type NeuroSystem =
  | 'cns'
  | 'pns'
  | 'headache'
  | 'seizure'
  | 'stroke'
  | 'movement'
  | 'other';

export type NeuroSide = 'L' | 'R' | 'bilateral';

export type OBGYNTrack = 'ob' | 'gyn';

export type OTDomain =
  | 'ADL'
  | 'IADL'
  | 'FINE_MOTOR'
  | 'GROSS_MOTOR'
  | 'SENSORY'
  | 'COGNITION'
  | 'EXEC_FUNCTION'
  | 'WORK_SCHOOL'
  | 'ENVIRONMENT'
  | 'GENERAL';

export type PedsSection =
  | 'triage'
  | 'resp'
  | 'gi'
  | 'skin'
  | 'neuro'
  | 'growth'
  | 'general';

export type SpeechDomain =
  | 'ARTICULATION'
  | 'LANGUAGE'
  | 'FLUENCY'
  | 'VOICE'
  | 'SWALLOWING'
  | 'COGNITION'
  | 'GENERAL';

export type SubstanceUseContext =
  | 'intake'
  | 'follow_up'
  | 'harm_reduction';

export type Location =
  | {
      kind: 'dental_tooth';
      toothId: string;
      surface?: string;
      toothSystem?: 'universal' | 'FDI';
    }
  | {
      kind: 'ent_ear';
      ear: 'L' | 'R';
      zoneId?: string;
    }
  | {
      kind: 'eye';
      eye: 'OD' | 'OS';
      zoneId?: string;
    }
  | {
      kind: 'physio_body';
      regionId: string;
      side?: 'L' | 'R' | 'midline';
      view: 'front' | 'back' | 'left' | 'right';
    }
  | {
      kind: 'cardio_site';
      mode: CardioMode;
      zone: CardioZone;
    }
  | {
      kind: 'derm_region';
      view: DermView;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'endocrine_panel';
      panel: EndocrinePanel;
      metric?: string;
      laterality?: 'L' | 'R' | 'bilateral';
      bodySite?: string;
    }
  | {
      kind: 'fertility';
      subject: FertilitySubject;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'neuro';
      system: NeuroSystem;
      side: NeuroSide;
      bodySite?: string;
    }
  | {
      kind: 'obgyn';
      track: OBGYNTrack;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'obgyn_finding';
      track: OBGYNTrack;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'ot_domain';
      domain: OTDomain;
      activity?: string;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'peds_section';
      section: PedsSection;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'speech_domain';
      domain: SpeechDomain;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    }
  | {
      kind: 'substance_use';
      context: SubstanceUseContext;
      bodySite?: string;
      laterality?: 'L' | 'R' | 'bilateral' | 'midline';
    };

export type FindingStatus = 'draft' | 'final';

export type FindingSeverity = 'mild' | 'moderate' | 'severe';

export type Finding = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  status: FindingStatus;
  title: string;
  note?: string;
  severity?: FindingSeverity;
  tags?: string[];
  location: Location;
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type EvidenceDevice =
  | 'otoscope'
  | 'camera'
  | 'upload'
  | 'other'
  | 'ecg'
  | 'stethoscope'
  | 'intraoral_cam'
  | 'scanner_3d'
  | 'glucometer'
  | 'cgm'
  | 'microphone';

export type EvidenceSource =
  | {
      type: 'live_capture';
      device: EvidenceDevice;
      roomId?: string;
      trackId?: string;
      startTs?: number;
      endTs?: number;
    }
  | {
      type: 'upload';
      device?: EvidenceDevice;
    }
  | {
      type: 'manual';
      device?: EvidenceDevice;
    };

export type EvidenceMedia = {
  kind: EvidenceKind;
  url?: string | null;
  thumbnailUrl?: string | null;
  contentType?: string;
  startTs?: number;
  endTs?: number;
};

export type Evidence = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  findingId?: string | null;
  location: Location;

  /**
   * Flattened fields used by existing workspace UI components.
   */
  kind: EvidenceKind;
  device: EvidenceDevice;
  status: EvidenceStatus;
  capturedAt: string;
  startTs?: number;
  endTs?: number;
  url?: string | null;
  thumbnailUrl?: string | null;
  contentType?: string | null;
  jobId?: string | null;

  /**
   * Nested request/response fields used by newer workspace POST contracts.
   */
  source?: EvidenceSource;
  media?: EvidenceMedia;

  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  meta?: Record<string, any>;
};

export type AnnotationType = 'pin' | 'box' | 'freehand' | 'text' | 'comment';

export type Annotation = {
  id: string;
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  evidenceId: string;
  findingId?: string | null;
  location: Location;
  type: AnnotationType;
  payload: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
};

export type CreateFindingRequest = {
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  title: string;
  status?: FindingStatus;
  severity?: FindingSeverity;
  note?: string;
  tags?: string[];
  location: Location;
  createdBy?: string;
  meta?: Record<string, any>;
};

export type CreateEvidenceRequest = {
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  findingId?: string | null;
  location: Location;
  source: EvidenceSource;
  media: EvidenceMedia;
  status?: EvidenceStatus;
  createdBy?: string;
  meta?: Record<string, any>;
};

export type CreateAnnotationRequest = {
  patientId: string;
  encounterId: string;
  specialty: Specialty;
  evidenceId: string;
  findingId?: string | null;
  location: Location;
  type: AnnotationType;
  payload: Record<string, any>;
  createdBy?: string;
};