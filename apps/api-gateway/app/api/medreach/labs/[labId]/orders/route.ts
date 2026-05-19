// apps/api-gateway/app/api/medreach/labs/[labId]/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { MEDREACH_ELIGIBILITY_STATUSES } from '@shared/medreach';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LabTestResultFlag =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'ABNORMAL'
  | 'UNSPECIFIED';

type LabTestResult = {
  code: string;
  name: string;
  category?: string;
  sampleType?: string;
  value?: string;
  units?: string;
  referenceRange?: string;
  flag?: LabTestResultFlag;
  comments?: string;
};

type LabResultStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SENT';

type LabOrderProjection = {
  id: string;
  displayId: string;
  labId?: string | null;
  eligibilityStatus?: string | null;
  eligibleLabs: string[];
  declinedByLabs: string[];
  status: string;
  resultStatus: LabResultStatus;
  releasePolicy?: string | null;
  payerType?: string | null;
  resultSummary?: string;
  resultPdfUrl?: string;
  testResults?: LabTestResult[];
  patientId?: string;
  encounterId?: string;
  clinicianId?: string | null;
  patientName: string;
  patientDob: string;
  patientGender?: string;
  patientIdentifier?: string;
  patientPhone?: string;
  patientAddress: string;
  patientArea: string;
  destinationLat?: number;
  destinationLng?: number;
  tests: { code: string; name: string }[];
  panels?: { code: string; name: string }[];
  urgency?: string;
  prepNotes?: string;
  collectionWindow?: unknown;
  createdAt: string;
  collectionTime?: string;
  deliveredToLabAt?: string;
  receivedAtLabAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  specimenBundleId?: string;
  resultReadyAt?: string;
  resultSentAt?: string;
};

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function safeJson<T = any>(v: unknown): T | null {
  try {
    return JSON.parse(JSON.stringify(v ?? null));
  } catch {
    return null;
  }
}

function isLabOrderProjection(value: LabOrderProjection | null): value is LabOrderProjection {
  return value !== null;
}

function sanitizeTestResults(input?: LabTestResult[]): LabTestResult[] {
  if (!Array.isArray(input)) return [];

  return input.map((r) => ({
    code: String(r.code || '').trim(),
    name: String(r.name || '').trim(),
    category: r.category?.trim() || '',
    sampleType: r.sampleType?.trim() || '',
    value: r.value?.trim() || '',
    units: r.units?.trim() || '',
    referenceRange: r.referenceRange?.trim() || '',
    flag: r.flag || 'UNSPECIFIED',
    comments: r.comments?.trim() || '',
  }));
}

function inferResultStatusFromState(args: {
  resultAuditMeta: any;
  testResultsCount: number;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
}): LabResultStatus {
  const auditStatus = String(args.resultAuditMeta?.resultStatus || '').toUpperCase();

  if (
    auditStatus === 'PENDING' ||
    auditStatus === 'IN_PROGRESS' ||
    auditStatus === 'READY' ||
    auditStatus === 'SENT'
  ) {
    return auditStatus as LabResultStatus;
  }

  if (args.rejectedAt) return 'PENDING';
  if (args.testResultsCount > 0) return 'READY';
  if (args.acceptedAt) return 'IN_PROGRESS';

  return 'PENDING';
}

async function resolveEffectiveLabId(
  req: NextRequest,
  pathLabId: string,
  who: any,
): Promise<string | null> {
  const role = String(who.role || '').toLowerCase();

  if (role === 'admin') return pathLabId;

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));
    if (!headerLabId || headerLabId !== pathLabId) return null;

    const lab = await prisma.labPartner.findUnique({
      where: { id: headerLabId },
      select: { id: true, active: true, status: true, ownerUserId: true },
    });

    if (!lab || !lab.active || lab.status !== 'ACTIVE') return null;
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) return null;

    return lab.id;
  }

  if (role === 'lab_staff') {
    const headerLabId = cleanString(req.headers.get('x-staff-lab-id'));
    if (!headerLabId || headerLabId !== pathLabId) return null;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid ?? '',
        labId: headerLabId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return staff?.labId || null;
  }

  return null;
}

async function projectLabOrder(
  orderId: string,
  effectiveLabId: string,
): Promise<LabOrderProjection | null> {
  const draw = await prisma.draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (!draw) return null;

  const [bundle, latestResults, latestResultAudit, eligibilityRows, patient] =
    await Promise.all([
      prisma.medReachSpecimenBundle.findFirst({
        where: { OR: [{ orderId }, { drawId: draw.id }] },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.labResult.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.auditEvent.findFirst({
        where: {
          subjectId: orderId,
          kind: 'lab_result_updated',
        },
        orderBy: { at: 'desc' },
      }),
      prisma.medReachOrderEligibleLab.findMany({
        where: { orderId },
        select: {
          labId: true,
          status: true,
          notes: true,
        },
        orderBy: { invitedAt: 'asc' },
      }),
      prisma.patientProfile.findUnique({
        where: { id: draw.patientId },
        select: {
          name: true,
          dob: true,
          gender: true,
          phone: true,
          idNumber: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
        },
      }),
    ]);

  const thisRow = eligibilityRows.find((r) => r.labId === effectiveLabId) || null;
  const firstNotes = eligibilityRows.find((r) => !!r.notes)?.notes ?? null;

  const eligibilityMeta = safeJson<any>(firstNotes) || {};
  const drawPatient = safeJson<any>((draw as any).patientSnapshot) || {};
  const drawTests = safeJson<any>((draw as any).testsSnapshot) || {};
  const drawPayer = safeJson<any>((draw as any).payerSnapshot) || {};
  const drawCollectionWindow = safeJson<any>((draw as any).collectionWindow);
  const resultMeta = safeJson<any>(latestResultAudit?.meta) || {};

  const projectedTestResults: LabTestResult[] =
    Array.isArray(resultMeta?.testResults) && resultMeta.testResults.length > 0
      ? sanitizeTestResults(resultMeta.testResults)
      : latestResults.map((r) => ({
          code: r.loincCode || '',
          name: r.name || 'Unnamed test',
          value: r.valueNum != null ? String(r.valueNum) : '',
          units: r.unit || '',
          flag: (r.flag as LabTestResultFlag | null) || 'UNSPECIFIED',
        }));

  const tests =
    Array.isArray(drawTests?.tests) && drawTests.tests.length > 0
      ? drawTests.tests.map((t: any) => ({
          code: cleanString(t?.code) || cleanString(t?.name),
          name: cleanString(t?.name) || cleanString(t?.code) || 'Unnamed test',
        }))
      : projectedTestResults.length > 0
        ? projectedTestResults.map((r) => ({
            code: r.code || r.name,
            name: r.name || r.code || 'Unnamed test',
          }))
        : Array.isArray(eligibilityMeta?.tests)
          ? eligibilityMeta.tests.map((t: any) => ({
              code: cleanString(t?.code) || cleanString(t?.name),
              name: cleanString(t?.name) || cleanString(t?.code) || 'Unnamed test',
            }))
          : [];

  const panels =
    Array.isArray(drawTests?.panels) && drawTests.panels.length > 0
      ? drawTests.panels.map((p: any) => ({
          code: cleanString(p?.code) || cleanString(p?.name),
          name: cleanString(p?.name) || cleanString(p?.code) || 'Unnamed panel',
        }))
      : [];

  const resultStatus = inferResultStatusFromState({
    resultAuditMeta: resultMeta,
    testResultsCount: projectedTestResults.length,
    acceptedAt: bundle?.acceptedAt,
    rejectedAt: bundle?.rejectedAt,
  });

  const resultReadyAt =
    resultStatus === 'READY' || resultStatus === 'SENT'
      ? latestResultAudit?.at?.toISOString?.() ?? undefined
      : undefined;

  const resultSentAt =
    resultStatus === 'SENT'
      ? latestResultAudit?.at?.toISOString?.() ?? undefined
      : undefined;

  const patientAddress =
    drawPatient?.patientAddress ||
    [patient?.addressLine1 || '', patient?.addressLine2 || '']
      .filter(Boolean)
      .join(', ')
      .trim() ||
    eligibilityMeta?.patientSnapshot?.patientAddress ||
    '';

  return {
    id: orderId,
    displayId: orderId,
    labId: draw.partnerId,
    eligibilityStatus: thisRow?.status || null,
    eligibleLabs: eligibilityRows
      .filter((r) => r.status === 'ELIGIBLE' || r.status === 'ACCEPTED')
      .map((r) => r.labId),
    declinedByLabs: eligibilityRows
      .filter((r) => r.status === 'DECLINED')
      .map((r) => r.labId),
    status: draw.status,
    resultStatus,
    releasePolicy: (draw as any).releasePolicy || eligibilityMeta?.releasePolicy || null,
    payerType: (draw as any).payerType || drawPayer?.payerType || null,
    resultSummary: resultMeta?.resultSummary || undefined,
    resultPdfUrl: resultMeta?.resultPdfUrl || undefined,
    testResults: projectedTestResults,
    patientId: draw.patientId,
    encounterId: draw.encounterId,
    clinicianId: draw.clinicianId,
    patientName:
      drawPatient?.patientName ||
      patient?.name ||
      eligibilityMeta?.patientSnapshot?.patientName ||
      '',
    patientDob:
      drawPatient?.patientDob ||
      patient?.dob?.toISOString?.().slice(0, 10) ||
      eligibilityMeta?.patientSnapshot?.patientDob ||
      '',
    patientGender:
      drawPatient?.patientGender ||
      patient?.gender ||
      eligibilityMeta?.patientSnapshot?.patientGender ||
      undefined,
    patientIdentifier:
      drawPatient?.patientIdentifier ||
      patient?.idNumber ||
      eligibilityMeta?.patientSnapshot?.patientIdentifier ||
      undefined,
    patientPhone:
      drawPatient?.patientPhone ||
      patient?.phone ||
      eligibilityMeta?.patientSnapshot?.patientPhone ||
      undefined,
    patientAddress,
    patientArea:
      drawPatient?.patientArea ||
      patient?.city ||
      eligibilityMeta?.patientSnapshot?.patientArea ||
      '',
    destinationLat: drawPatient?.destinationLat ?? undefined,
    destinationLng: drawPatient?.destinationLng ?? undefined,
    tests,
    panels,
    urgency: (draw as any).urgency || undefined,
    prepNotes: (draw as any).prepNotes || undefined,
    collectionWindow: drawCollectionWindow ?? undefined,
    createdAt: draw.createdAt.toISOString(),
    collectionTime: bundle?.collectedAt?.toISOString(),
    deliveredToLabAt: bundle?.inTransitAt?.toISOString(),
    receivedAtLabAt: bundle?.receivedAtLabAt?.toISOString(),
    acceptedAt: bundle?.acceptedAt?.toISOString(),
    rejectedAt: bundle?.rejectedAt?.toISOString(),
    specimenBundleId: bundle?.id,
    resultReadyAt,
    resultSentAt,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const effectiveLabId = await resolveEffectiveLabId(req, cleanString(params.labId), who);

  if (!effectiveLabId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const lab = await prisma.labPartner.findUnique({
    where: { id: effectiveLabId },
    select: { id: true, name: true, active: true, status: true },
  });

  if (!lab || !lab.active || lab.status !== 'ACTIVE') {
    return NextResponse.json({ ok: false, error: 'lab_not_found' }, { status: 404 });
  }

  const [assignedDraws, marketplaceRows] = await Promise.all([
    prisma.draw.findMany({
      where: {
        partnerId: effectiveLabId,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.medReachOrderEligibleLab.findMany({
      where: {
        labId: effectiveLabId,
        status: MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
      },
      orderBy: { invitedAt: 'desc' },
    }),
  ]);

  const assignedOrderIds = Array.from(new Set(assignedDraws.map((d) => d.orderId)));

  const marketplaceOrderIds = Array.from(
    new Set(
      marketplaceRows
        .map((r) => r.orderId)
        .filter((orderId) => !assignedOrderIds.includes(orderId)),
    ),
  );

  const assigned = (
    await Promise.all(
      assignedOrderIds.map((orderId) => projectLabOrder(orderId, effectiveLabId)),
    )
  ).filter(isLabOrderProjection);

  const marketplace = (
    await Promise.all(
      marketplaceOrderIds.map((orderId) => projectLabOrder(orderId, effectiveLabId)),
    )
  )
    .filter(isLabOrderProjection)
    .filter((o) => !o.labId && o.eligibilityStatus === 'ELIGIBLE');

  return NextResponse.json({
    ok: true,
    data: {
      labId: effectiveLabId,
      assigned,
      marketplace,
      counts: {
        assigned: assigned.length,
        marketplace: marketplace.length,
      },
    },
    meta: {
      actorRole: who.role ?? null,
      actorId: who.uid ?? null,
      at: new Date().toISOString(),
    },
  });
}