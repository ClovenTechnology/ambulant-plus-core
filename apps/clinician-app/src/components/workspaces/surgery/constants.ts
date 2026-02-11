// File: apps/clinician-app/src/components/workspaces/surgery/constants.ts

export type SurgeryDomainKey =
  | 'general'
  | 'orthopaedics'
  | 'urology'
  | 'neurosurgery'
  | 'cardiothoracic'
  | 'ent'
  | 'obgyn';

export type SurgeryPriority = 'routine' | 'urgent' | 'emergency';

export const SURGERY_DOMAINS: {
  key: SurgeryDomainKey;
  label: string;
  desc: string;
}[] = [
  {
    key: 'general',
    label: 'General Surgery (incl. GI/Abdominal)',
    desc: 'GI/abdominal, soft tissue, hernia, acute general surgery workflows.',
  },
  {
    key: 'orthopaedics',
    label: 'Orthopaedics',
    desc: 'Bone/joint procedures, fixation, arthroplasty and trauma pathways.',
  },
  {
    key: 'urology',
    label: 'Urology',
    desc: 'Genitourinary procedures, endourology and operative urology documentation.',
  },
  {
    key: 'neurosurgery',
    label: 'Neurosurgery',
    desc: 'Cranial/spinal interventions with high-acuity peri-op controls.',
  },
  {
    key: 'cardiothoracic',
    label: 'Cardiothoracic',
    desc: 'Cardiac/thoracic procedures with enhanced critical care planning.',
  },
  {
    key: 'ent',
    label: 'ENT Surgery',
    desc: 'Head & neck / airway-focused surgical workflows.',
  },
  {
    key: 'obgyn',
    label: 'OBGYN Surgery',
    desc: 'Gynaecologic/obstetric theatre workflows and post-op continuity.',
  },
];

export type SurgeryFindingTypeKey =
  | 'pre_op_assessment'
  | 'procedure_note'
  | 'post_op_plan'
  | 'peri_op_summary';

export const SURGERY_FINDING_TYPES: {
  key: SurgeryFindingTypeKey;
  label: string;
}[] = [
  { key: 'pre_op_assessment', label: 'Pre-op assessment' },
  { key: 'procedure_note', label: 'Procedure note' },
  { key: 'post_op_plan', label: 'Post-op plan' },
  { key: 'peri_op_summary', label: 'Peri-op summary' },
];

export const RISK_TONE = {
  low: 'emerald',
  moderate: 'amber',
  high: 'rose',
} as const;
