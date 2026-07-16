// apps/api-gateway/src/clinicians/onboarding/pay-later.ts

export const CLINICIAN_PAY_LATER_PATHWAY_KEY =
  'START_NOW_PAY_LATER' as const;

export const CLINICIAN_PAY_LATER_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
  'cancelled',
] as const;

export type ClinicianPayLaterRequestStatus =
  (typeof CLINICIAN_PAY_LATER_REQUEST_STATUSES)[number];

function cleanStr(
  value: unknown,
  max = 2000,
): string | null {
  const text = String(
    value ?? '',
  ).trim();

  if (!text) {
    return null;
  }

  return text.length > max
    ? text.slice(
        0,
        max,
      )
    : text;
}

function isoDate(
  value: unknown,
): string | null {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          String(value),
        );

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toISOString()
    : null;
}

export function normaliseClinicianPayLaterRequestStatus(
  value: unknown,
): ClinicianPayLaterRequestStatus {
  const status = String(
    value || 'pending',
  )
    .trim()
    .toLowerCase();

  if (
    CLINICIAN_PAY_LATER_REQUEST_STATUSES.includes(
      status as ClinicianPayLaterRequestStatus,
    )
  ) {
    return status as ClinicianPayLaterRequestStatus;
  }

  return 'pending';
}

export function clinicianPayLaterActiveRequestKey(
  clinicianId: unknown,
): string {
  const id = cleanStr(
    clinicianId,
    120,
  );

  if (!id) {
    throw new Error(
      'clinicianId_required',
    );
  }

  return (
    'clinician:' +
    id +
    ':' +
    CLINICIAN_PAY_LATER_PATHWAY_KEY
  );
}

export function isOpenClinicianPayLaterRequest(
  value: unknown,
) {
  return (
    normaliseClinicianPayLaterRequestStatus(
      value,
    ) === 'pending'
  );
}

export function publicClinicianPayLaterRequest(
  row: any,
) {
  if (!row) {
    return null;
  }

  const status =
    normaliseClinicianPayLaterRequestStatus(
      row.status,
    );

  return {
    id: String(
      row.id || '',
    ),
    pathwayKey:
      CLINICIAN_PAY_LATER_PATHWAY_KEY,
    status,
    requestReason: cleanStr(
      row.requestReason,
      2000,
    ),
    requestedAt: isoDate(
      row.requestedAt ||
        row.createdAt,
    ),
    reviewedAt: isoDate(
      row.reviewedAt,
    ),
    reviewNotes: cleanStr(
      row.reviewNotes,
      2000,
    ),
    active:
      status === 'pending',
    approved:
      status === 'approved',
    rejected:
      status === 'rejected',
    canResubmit: [
      'rejected',
      'withdrawn',
      'cancelled',
    ].includes(status),
  };
}

export function adminClinicianPayLaterRequest(
  row: any,
) {
  const publicRequest =
    publicClinicianPayLaterRequest(
      row,
    );

  if (!publicRequest) {
    return null;
  }

  return {
    ...publicRequest,
    clinicianId: cleanStr(
      row.clinicianId,
      120,
    ),
    onboardingId: cleanStr(
      row.onboardingId,
      120,
    ),
    requestedByUserId: cleanStr(
      row.requestedByUserId,
      120,
    ),
    reviewedByUserId: cleanStr(
      row.reviewedByUserId,
      120,
    ),
    approvalPaymentId: cleanStr(
      row.approvalPaymentId,
      120,
    ),
    activeRequestKey: cleanStr(
      row.activeRequestKey,
      300,
    ),
    meta:
      row.meta &&
      typeof row.meta === 'object'
        ? row.meta
        : null,
    createdAt: isoDate(
      row.createdAt,
    ),
    updatedAt: isoDate(
      row.updatedAt,
    ),
  };
}
