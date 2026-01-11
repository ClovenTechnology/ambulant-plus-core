// apps/api-gateway/src/lib/credentialing/readiness.ts

import { getPolicy, type ComplianceCheckKind, type RegulatorBody } from './policies';

export type ComplianceStatus =
  | 'missing'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'waived';

export type CheckRow = {
  kind: ComplianceCheckKind;
  regulator: RegulatorBody | null;
  status: ComplianceStatus;
  expiresAt: Date | null;
};

export type ClinicianCore = {
  id: string;
  status: string; // pending | active | rejected | disabled | etc
  disabled: boolean;
  archived: boolean;
  trainingCompleted: boolean;
  professionKey: string | null;

  // optional if you add these fields (recommended)
  bookingEnabled?: boolean | null;
};

export type ClinicianReadiness = {
  okToBook: boolean;
  bucket: 'ready' | 'awaiting_training' | 'missing_compliance' | 'rejected' | 'disabled' | 'unknown_policy';
  blockers: string[];
  missingChecks: Array<{ kind: ComplianceCheckKind; regulator?: RegulatorBody | null }>;
};

/** Treat approved OR waived as “passed”. Also treat expiredAt in the past as expired. */
function isPassed(status: ComplianceStatus) {
  return status === 'approved' || status === 'waived';
}

function isExpired(expiresAt: Date | null) {
  return !!expiresAt && expiresAt.getTime() < Date.now();
}

function keyOf(kind: ComplianceCheckKind, regulator?: RegulatorBody | null) {
  return `${kind}:${regulator ?? ''}`;
}

export function computeClinicianReadiness(input: {
  clinician: ClinicianCore;
  checks: CheckRow[];
}): ClinicianReadiness {
  const { clinician, checks } = input;

  // Hard blocks
  if (clinician.archived || clinician.disabled) {
    return {
      okToBook: false,
      bucket: 'disabled',
      blockers: ['Clinician is disabled/archived'],
      missingChecks: [],
    };
  }
  if (String(clinician.status).toLowerCase() === 'rejected') {
    return {
      okToBook: false,
      bucket: 'rejected',
      blockers: ['Clinician application rejected'],
      missingChecks: [],
    };
  }

  const policy = getPolicy(clinician.professionKey);
  if (!policy) {
    return {
      okToBook: false,
      bucket: 'unknown_policy',
      blockers: ['No policy mapped for this professionKey'],
      missingChecks: [],
    };
  }

  // Build lookup of current checks
  const map = new Map<string, CheckRow>();
  for (const c of checks) {
    map.set(keyOf(c.kind, c.regulator), c);
  }

  const missing: Array<{ kind: ComplianceCheckKind; regulator?: RegulatorBody | null }> = [];
  const blockers: string[] = [];

  // Required checks from policy
  for (const req of policy.requiredChecks) {
    // training handled explicitly below
    if (req.kind === 'TRAINING_COMPLETION') continue;

    const row = map.get(keyOf(req.kind, req.regulator ?? null));
    if (!row) {
      missing.push({ kind: req.kind, regulator: req.regulator ?? null });
      continue;
    }
    if (isExpired(row.expiresAt)) {
      missing.push({ kind: req.kind, regulator: req.regulator ?? null });
      continue;
    }
    if (!isPassed(row.status)) {
      missing.push({ kind: req.kind, regulator: req.regulator ?? null });
      continue;
    }
  }

  // Training gate (mandatory for clinical; optional for wellness unless you decide otherwise)
  const trainingRequired = policy.track === 'CLINICAL';
  if (trainingRequired && !clinician.trainingCompleted) {
    blockers.push('Training not completed');
  }

  // Must be “active” before booking (your operational rule)
  const active = String(clinician.status).toLowerCase() === 'active';
  if (!active) blockers.push('Clinician is not approved/active');

  const okToBook = blockers.length === 0 && missing.length === 0;

  if (okToBook) {
    return { okToBook: true, bucket: 'ready', blockers: [], missingChecks: [] };
  }
  if (blockers.includes('Training not completed')) {
    return { okToBook: false, bucket: 'awaiting_training', blockers, missingChecks: missing };
  }
  return { okToBook: false, bucket: 'missing_compliance', blockers, missingChecks: missing };
}
