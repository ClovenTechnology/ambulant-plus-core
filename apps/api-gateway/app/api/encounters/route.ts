// apps/api-gateway/app/api/encounters/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
  type Who,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AccessContext = {
  who: Who;
  role: string;
  patientIds: string[];
  clinicianIds: string[];
  isPrivileged: boolean;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanStatus(value: unknown) {
  const raw = clean(value, 80).toLowerCase();
  if (!raw) return 'open';

  if (['open', 'active', 'in_progress', 'in-progress', 'inprogress', 'consult', 'triage'].includes(raw)) {
    return raw === 'in-progress' || raw === 'inprogress' ? 'in_progress' : raw;
  }

  if (['completed', 'complete', 'closed', 'done', 'ended'].includes(raw)) return 'completed';
  if (['scheduled', 'booked', 'pending'].includes(raw)) return 'scheduled';
  if (['cancelled', 'canceled'].includes(raw)) return 'cancelled';

  return raw;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => clean(v, 240)).filter(Boolean)));
}

function readParam(req: NextRequest, key: string) {
  return clean(req.nextUrl.searchParams.get(key), 240);
}

function parseLimit(req: NextRequest) {
  const raw = Number(req.nextUrl.searchParams.get('limit') || 50);
  if (!Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(100, Math.floor(raw)));
}

function asIso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function boolish(value: unknown) {
  const raw = clean(value, 20).toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function resolvePatientIds(who: Who) {
  const candidates = unique([who.actorRefId, who.uid]);
  if (!candidates.length) return [];

  const rows = await prisma.patientProfile.findMany({
    where: {
      OR: candidates.flatMap((id) => [{ id }, { userId: id }]),
    },
    select: { id: true, userId: true },
    take: 10,
  });

  return unique([
    who.actorRefId,
    ...rows.map((row) => row.id),
    ...rows.map((row) => row.userId),
    who.uid,
  ]);
}

async function resolveClinicianIds(who: Who) {
  const candidates = unique([who.actorRefId, who.uid]);
  if (!candidates.length) return [];

  const rows = await prisma.clinicianProfile.findMany({
    where: {
      OR: candidates.flatMap((id) => [{ id }, { userId: id }]),
    },
    select: { id: true, userId: true },
    take: 10,
  });

  return unique([
    who.actorRefId,
    ...rows.map((row) => row.id),
    ...rows.map((row) => row.userId),
    who.uid,
  ]);
}

async function resolveAccessContext(req: NextRequest): Promise<AccessContext> {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
  } catch {
    const err = new Error('unauthorized') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  if (!who.uid || who.role === 'anonymous') {
    const err = new Error('unauthorized') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  const role = String(who.role || '').toLowerCase();
  const isPrivileged = role === 'admin' || role === 'admin_staff' || role === 'system';

  if (isPrivileged) {
    return {
      who,
      role,
      patientIds: [],
      clinicianIds: [],
      isPrivileged: true,
    };
  }

  if (role === 'patient') {
    const patientIds = await resolvePatientIds(who);
    if (!patientIds.length) {
      const err = new Error('patient_profile_not_found') as Error & { status?: number };
      err.status = 404;
      throw err;
    }

    return { who, role, patientIds, clinicianIds: [], isPrivileged: false };
  }

  if (role === 'clinician') {
    const clinicianIds = await resolveClinicianIds(who);
    if (!clinicianIds.length) {
      const err = new Error('clinician_profile_not_found') as Error & { status?: number };
      err.status = 404;
      throw err;
    }

    return { who, role, patientIds: [], clinicianIds, isPrivileged: false };
  }

  const err = new Error('forbidden') as Error & { status?: number };
  err.status = 403;
  throw err;
}

function ensureRequestedScopeAllowed(ctx: AccessContext, req: NextRequest) {
  const patientId = readParam(req, 'patientId');
  const clinicianId = readParam(req, 'clinicianId');

  if (ctx.isPrivileged) return;

  if (ctx.role === 'patient') {
    if (clinicianId) {
      const err = new Error('forbidden') as Error & { status?: number };
      err.status = 403;
      throw err;
    }

    if (patientId && !ctx.patientIds.includes(patientId)) {
      const err = new Error('forbidden_patient_scope') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
  }

  if (ctx.role === 'clinician') {
    if (clinicianId && !ctx.clinicianIds.includes(clinicianId)) {
      const err = new Error('forbidden_clinician_scope') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
  }
}

function buildWhere(ctx: AccessContext, req: NextRequest) {
  ensureRequestedScopeAllowed(ctx, req);

  const where: Record<string, any> = {};
  const patientId = readParam(req, 'patientId');
  const clinicianId = readParam(req, 'clinicianId');
  const caseId = readParam(req, 'caseId');
  const status = readParam(req, 'status');
  const orgId = readParam(req, 'orgId') || clean(ctx.who.orgId, 120);

  if (ctx.isPrivileged) {
    if (patientId) where.patientId = patientId;
    if (clinicianId) where.clinicianId = clinicianId;
  } else if (ctx.role === 'patient') {
    where.patientId = patientId || { in: ctx.patientIds };
  } else if (ctx.role === 'clinician') {
    where.clinicianId = clinicianId || { in: ctx.clinicianIds };
    if (patientId) where.patientId = patientId;
  }

  if (caseId) where.caseId = caseId;
  if (status) where.status = cleanStatus(status);
  if (orgId) where.orgId = orgId;

  return where;
}

function primaryTime(row: any) {
  return (
    asIso(row.consultationEndedAt) ||
    asIso(row.consultationStartedAt) ||
    asIso(row.updatedAt) ||
    asIso(row.createdAt) ||
    new Date().toISOString()
  );
}

function shapeAppointment(appt: any) {
  if (!appt) return null;
  return {
    id: appt.id,
    startsAt: asIso(appt.startsAt),
    endsAt: asIso(appt.endsAt),
    status: appt.status ?? null,
    visitMode: appt.visitMode ?? null,
    paymentStatus: appt.paymentStatus ?? null,
  };
}

function shapePayment(payment: any) {
  if (!payment) return null;
  return {
    id: payment.id,
    status: payment.status ?? null,
    provider: payment.provider ?? null,
    providerReference: payment.providerReference ?? null,
    amountMinor: payment.amountMinor ?? payment.amountCents ?? null,
    currency: payment.currency ?? null,
    createdAt: asIso(payment.createdAt),
  };
}

function shapeDocument(doc: any) {
  if (!doc) return null;
  return {
    id: doc.id,
    title: doc.title ?? doc.fileName ?? 'Document',
    documentKind: doc.documentKind ?? null,
    fileName: doc.fileName ?? null,
    mimeType: doc.mimeType ?? null,
    sizeBytes: doc.sizeBytes ?? null,
    status: doc.status ?? null,
    createdAt: asIso(doc.createdAt),
  };
}

function parseJsonMaybe(value: unknown) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function shapeErxOrder(order: any) {
  if (!order?.id) return null;
  const notes = parseJsonMaybe(order.notes);

  return {
    id: order.id,
    kind: order.kind ?? 'medication',
    status: order.status ?? null,
    drug: order.drug ?? null,
    sig: order.sig ?? null,
    dispenseCode: order.dispenseCode ?? null,
    rxNumber: order.rxNumber ?? null,
    signedAt: asIso(order.signedAt),
    createdAt: asIso(order.createdAt),
    updatedAt: asIso(order.updatedAt),
    meds: order.meds ?? null,
    labTests: order.labTests ?? null,
    notes,
    pdfUrl: `/api/erx/${encodeURIComponent(order.id)}/pdf`,
    downloadUrl: `/api/erx/${encodeURIComponent(order.id)}/pdf`,
  };
}

function shapeLabOrder(order: any) {
  if (!order?.id) return null;

  return {
    id: order.id,
    kind: order.kind ?? 'lab',
    status: order.status ?? null,
    panel: order.panel ?? null,
    tests: order.tests ?? null,
    createdAt: asIso(order.createdAt),
    updatedAt: asIso(order.updatedAt),
  };
}

function shapeEncounter(row: any, clinicianMap: Map<string, any>) {
  const clinician = row.clinicianId ? clinicianMap.get(String(row.clinicianId)) : null;
  const latestAppointment = Array.isArray(row.appointments) ? row.appointments[0] : null;
  const latestPayment = Array.isArray(row.payments) ? row.payments[0] : null;
  const latestDocuments = Array.isArray(row.documents) ? row.documents.slice(0, 6) : [];

  return {
    id: row.id,
    caseId: row.caseId,
    patientId: row.patientId,
    clinicianId: row.clinicianId ?? null,
    status: row.status,
    visitMode: row.visitMode ?? latestAppointment?.visitMode ?? null,
    startedAt: asIso(row.consultationStartedAt),
    endedAt: asIso(row.consultationEndedAt),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
    primaryTime: primaryTime(row),
    sessionId: row.sessionId ?? null,
    orgId: row.orgId ?? null,
    clinician: clinician
      ? {
          id: clinician.id,
          userId: clinician.userId ?? null,
          name: clinician.displayName ?? clinician.name ?? 'Clinician',
          displayName: clinician.displayName ?? null,
          specialty: clinician.specialty ?? null,
          photoUrl: clinician.photoUrl ?? null,
          ratingAvg: clinician.ratingAvg ?? null,
          ratingCount: clinician.ratingCount ?? null,
        }
      : row.clinicianId
        ? { id: row.clinicianId, name: 'Clinician', specialty: null }
        : null,
    appointment: shapeAppointment(latestAppointment),
    payment: shapePayment(latestPayment),
    documents: latestDocuments.map(shapeDocument).filter(Boolean),
    erxOrders: Array.isArray(row.erxOrders) ? row.erxOrders.map(shapeErxOrder).filter(Boolean) : [],
    labOrders: Array.isArray(row.labOrders) ? row.labOrders.map(shapeLabOrder).filter(Boolean) : [],
    summaryPayload: row.summaryPayload ?? null,
    settlementSnapshot: row.settlementSnapshot ?? null,
    sponsorSnapshot: row.sponsorSnapshot ?? null,
    counts: {
      appointments: Array.isArray(row.appointments) ? row.appointments.length : 0,
      erxOrders: Array.isArray(row.erxOrders) ? row.erxOrders.length : 0,
      labOrders: Array.isArray(row.labOrders) ? row.labOrders.length : 0,
      payments: Array.isArray(row.payments) ? row.payments.length : 0,
      documents: Array.isArray(row.documents) ? row.documents.length : 0,
      diagnoses: Array.isArray(row.diagnoses) ? row.diagnoses.length : 0,
      labResults: Array.isArray(row.labResults) ? row.labResults.length : 0,
      clinicalFindings: Array.isArray(row.clinicalFindings) ? row.clinicalFindings.length : 0,
      clinicalArtifacts: Array.isArray(row.clinicalArtifacts) ? row.clinicalArtifacts.length : 0,
      collaborativeDrafts: Array.isArray(row.collaborativeDrafts) ? row.collaborativeDrafts.length : 0,
    },
  };
}

async function loadCliniciansForRows(rows: any[]) {
  const clinicianIds = unique(rows.map((row) => row.clinicianId));
  if (!clinicianIds.length) return new Map<string, any>();

  const clinicians = await prisma.clinicianProfile.findMany({
    where: {
      OR: clinicianIds.flatMap((id) => [{ id }, { userId: id }]),
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      specialty: true,
      photoUrl: true,
      ratingAvg: true,
      ratingCount: true,
    },
    take: 200,
  });

  const map = new Map<string, any>();
  for (const clinician of clinicians) {
    map.set(String(clinician.id), clinician);
    if (clinician.userId) map.set(String(clinician.userId), clinician);
  }
  return map;
}

function requireCreateRole(ctx: AccessContext) {
  if (ctx.isPrivileged || ctx.role === 'clinician') return;
  const err = new Error('forbidden') as Error & { status?: number };
  err.status = 403;
  throw err;
}

async function normalizePatientIdForCreate(patientId: string) {
  const profile = await prisma.patientProfile.findFirst({
    where: { OR: [{ id: patientId }, { userId: patientId }] },
    select: { id: true },
  });
  if (!profile?.id) {
    const err = new Error('patient_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return profile.id;
}

async function normalizeClinicianIdForCreate(ctx: AccessContext, requestedClinicianId: string) {
  const candidates = unique([requestedClinicianId, ctx.who.actorRefId, ctx.who.uid, ...ctx.clinicianIds]);
  const clinician = await prisma.clinicianProfile.findFirst({
    where: { OR: candidates.flatMap((id) => [{ id }, { userId: id }]) },
    select: { id: true, userId: true },
  });

  if (!clinician?.id) {
    const err = new Error('clinician_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  if (ctx.role === 'clinician') {
    const allowed = unique([ctx.who.uid, ctx.who.actorRefId, ...ctx.clinicianIds, clinician.id, clinician.userId]);
    if (requestedClinicianId && !allowed.includes(requestedClinicianId)) {
      const err = new Error('forbidden_clinician_scope') as Error & { status?: number };
      err.status = 403;
      throw err;
    }
  }

  return clinician.id;
}

function normalizeVisitMode(value: unknown) {
  const raw = clean(value, 60).toUpperCase();
  if (!raw) return undefined;
  if (raw === 'TELEVISIT' || raw === 'REMOTE' || raw === 'VIDEO') return 'TELEVISIT';
  if (raw === 'IN_PERSON' || raw === 'IN-PERSON' || raw === 'HOME_VISIT' || raw === 'CLINIC_VISIT') return 'IN_PERSON';
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveAccessContext(req);
    const limit = parseLimit(req);
    const where = buildWhere(ctx, req);
    const includeDetails = boolish(req.nextUrl.searchParams.get('details'));

    const rows = await prisma.encounter.findMany({
      where,
      include: {
        appointments: { orderBy: { startsAt: 'desc' }, take: includeDetails ? 20 : 1 },
        erxOrders: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        labOrders: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        payments: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        documents: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 100 : 6 },
        diagnoses: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        labResults: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        clinicalFindings: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        clinicalArtifacts: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
        collaborativeDrafts: { orderBy: { createdAt: 'desc' }, take: includeDetails ? 50 : 1 },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    const clinicianMap = await loadCliniciansForRows(rows);
    const encounters = rows.map((row) => shapeEncounter(row, clinicianMap));

    return json({
      ok: true,
      source: 'api-gateway.encounters',
      count: encounters.length,
      encounters,
    });
  } catch (err: any) {
    const status = Number(err?.status) || (String(err?.message || '').toLowerCase().includes('unauthorized') ? 401 : 500);
    return json(
      {
        ok: false,
        error: String(err?.message || 'encounters_unavailable'),
        encounters: [],
      },
      status,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveAccessContext(req);
    requireCreateRole(ctx);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'invalid_json_body' }, 400);
    }

    const requestedId = clean((body as any).id, 120);
    const patientIdRaw = clean((body as any).patientId, 120);
    const clinicianIdRaw = clean((body as any).clinicianId, 120);
    const caseId = clean((body as any).caseId, 120);

    if (!patientIdRaw) return json({ ok: false, error: 'patient_id_required' }, 400);
    if (!caseId) return json({ ok: false, error: 'case_id_required' }, 400);

    const patientId = await normalizePatientIdForCreate(patientIdRaw);
    const clinicianId = await normalizeClinicianIdForCreate(ctx, clinicianIdRaw);

    const status = cleanStatus((body as any).status || 'open');
    const visitMode = normalizeVisitMode((body as any).visitMode || (body as any).mode);
    const orgId = clean((body as any).orgId || ctx.who.orgId || '', 120);
    const id = requestedId || crypto.randomUUID();

    const row = await prisma.encounter.create({
      data: {
        id,
        caseId,
        patientId,
        clinicianId,
        status,
        orgId,
        ...(visitMode ? { visitMode: visitMode as any } : {}),
        sessionId: clean((body as any).sessionId, 120) || undefined,
        clientId: clean((body as any).clientId, 120) || undefined,
        clientMemberId: clean((body as any).clientMemberId, 120) || undefined,
        coveragePlanId: clean((body as any).coveragePlanId, 120) || undefined,
        consultationStartedAt: (body as any).consultationStartedAt ? new Date((body as any).consultationStartedAt) : undefined,
        consultationEndedAt: (body as any).consultationEndedAt ? new Date((body as any).consultationEndedAt) : undefined,
        settlementSnapshot: (body as any).settlementSnapshot ?? undefined,
        sponsorSnapshot: (body as any).sponsorSnapshot ?? undefined,
        summaryPayload: (body as any).summaryPayload ?? undefined,
      },
      include: {
        appointments: { orderBy: { startsAt: 'desc' }, take: 1 },
        erxOrders: { orderBy: { createdAt: 'desc' }, take: 1 },
        labOrders: { orderBy: { createdAt: 'desc' }, take: 1 },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        documents: { orderBy: { createdAt: 'desc' }, take: 6 },
        diagnoses: { orderBy: { createdAt: 'desc' }, take: 1 },
        labResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        clinicalFindings: { orderBy: { createdAt: 'desc' }, take: 1 },
        clinicalArtifacts: { orderBy: { createdAt: 'desc' }, take: 1 },
        collaborativeDrafts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const clinicianMap = await loadCliniciansForRows([row]);
    const encounter = shapeEncounter(row, clinicianMap);

    return json(
      {
        ok: true,
        source: 'api-gateway.encounters',
        encounter,
      },
      201,
    );
  } catch (err: any) {
    const status = Number(err?.status) || (String(err?.message || '').toLowerCase().includes('unauthorized') ? 401 : 500);
    return json(
      {
        ok: false,
        error: String(err?.message || 'encounter_create_failed'),
      },
      status,
    );
  }
}
