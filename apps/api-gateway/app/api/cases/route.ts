import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canonical(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

function hasAnyAuthority(actor: any, required: string[]) {
  if (actor?.isSuperAdmin) return true;
  const values = new Set(
    [...(actor?.roles || []), ...(actor?.scopes || [])]
      .map(canonical)
      .filter(Boolean),
  );
  if (values.has('superadmin') || values.has('adminall') || values.has('*')) {
    return true;
  }
  return required.some((value) => values.has(canonical(value)));
}

function requireCaseRead(actor: any) {
  if (
    !hasAnyAuthority(actor, [
      'clinical:read',
      'clinical:write',
      'patients:read',
      'patients:manage',
      'admin:read',
    ])
  ) {
    const error = new Error('case_read_forbidden') as Error & { status?: number };
    error.status = 403;
    throw error;
  }
}

function requireCaseWrite(actor: any) {
  if (
    !hasAnyAuthority(actor, [
      'clinical:write',
      'patients:manage',
      'admin:write',
    ])
  ) {
    const error = new Error('case_write_forbidden') as Error & { status?: number };
    error.status = 403;
    throw error;
  }
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req);
    requireCaseRead(actor);

    const q = clean(req.nextUrl.searchParams.get('q'), 160);
    const patientId = clean(req.nextUrl.searchParams.get('patientId'), 180);
    const clinicianId = clean(req.nextUrl.searchParams.get('clinicianId'), 180);
    const status = clean(req.nextUrl.searchParams.get('status'), 80).toLowerCase();
    const limitRaw = Number(req.nextUrl.searchParams.get('limit') || 100);
    const limit = Math.max(
      1,
      Math.min(Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 100, 500),
    );

    let patientMatches: string[] = [];
    if (q) {
      const patients = await prisma.patientProfile.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { contactEmail: { contains: q, mode: 'insensitive' } },
            { mrn: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      patientMatches = patients.map((item) => item.id);
    }

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (clinicianId) where.leadClinicianId = clinicianId;
    if (status && status !== 'all') where.status = status;
    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { patientId: { contains: q, mode: 'insensitive' } },
        { leadClinicianId: { contains: q, mode: 'insensitive' } },
        ...(patientMatches.length ? [{ patientId: { in: patientMatches } }] : []),
      ];
    }

    const rows = await prisma.clinicalCase.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        _count: { select: { encounters: true } },
        encounters: {
          select: {
            id: true,
            status: true,
            clinicianId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    const patientIds = Array.from(new Set(rows.map((row) => row.patientId)));
    const clinicianIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [
            row.leadClinicianId,
            row.encounters[0]?.clinicianId,
          ])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [patients, clinicians] = await Promise.all([
      patientIds.length
        ? prisma.patientProfile.findMany({
            where: { id: { in: patientIds } },
            select: {
              id: true,
              name: true,
              mrn: true,
              contactEmail: true,
              phone: true,
            },
          })
        : [],
      clinicianIds.length
        ? prisma.clinicianProfile.findMany({
            where: { id: { in: clinicianIds } },
            select: { id: true, displayName: true, specialty: true },
          })
        : [],
    ]);

    const patientMap = new Map(patients.map((item) => [item.id, item]));
    const clinicianMap = new Map(clinicians.map((item) => [item.id, item]));

    const items = rows.map((row) => ({
      id: row.id,
      patientId: row.patientId,
      leadClinicianId: row.leadClinicianId,
      title: row.title,
      summary: row.summary,
      status: row.status,
      priority: row.priority,
      orgId: row.orgId,
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      lastEncounterAt: row.lastEncounterAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      patient: patientMap.get(row.patientId) || null,
      leadClinician: row.leadClinicianId
        ? clinicianMap.get(row.leadClinicianId) || null
        : null,
      encounterCount: row._count.encounters,
      latestEncounter: row.encounters[0] || null,
    }));

    return json({
      ok: true,
      source: 'clinical-case',
      count: items.length,
      items,
    });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    return json(
      { ok: false, error: String(error?.message || 'case_list_failed') },
      Number(error?.status) || 500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req);
    requireCaseWrite(actor);

    const body = await req.json().catch(() => ({}));
    const patientId = clean(body?.patientId, 180);
    if (!patientId) return json({ ok: false, error: 'patientId_required' }, 400);

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) return json({ ok: false, error: 'patient_not_found' }, 404);

    const requestedStatus = clean(body?.status, 80).toLowerCase() || 'open';
    if (!['open', 'active', 'in_progress', 'closed', 'archived'].includes(requestedStatus)) {
      return json({ ok: false, error: 'invalid_case_status' }, 400);
    }

    const item = await prisma.clinicalCase.create({
      data: {
        id: clean(body?.id, 180) || `case-${crypto.randomUUID()}`,
        patientId,
        leadClinicianId: clean(body?.leadClinicianId, 180) || null,
        title: clean(body?.title, 240) || 'Clinical case',
        summary: clean(body?.summary, 4000) || null,
        notes: clean(body?.notes, 12000) || null,
        status: requestedStatus,
        priority: clean(body?.priority, 80).toLowerCase() || 'routine',
        orgId: 'org-default',
        closedAt: ['closed', 'archived'].includes(requestedStatus)
          ? new Date()
          : null,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          actorUserId: actor.userId,
          actorType: 'ADMIN',
          actorRefId: actor.profileId,
          app: 'admin-dashboard',
          action: 'clinical_case.created',
          entityType: 'ClinicalCase',
          entityId: item.id,
          description: 'Longitudinal clinical Case created',
          userAgent: req.headers.get('user-agent'),
          meta: { patientId: item.patientId, status: item.status },
        },
      })
      .catch(() => undefined);

    return json({ ok: true, source: 'clinical-case', item }, 201);
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    return json(
      { ok: false, error: String(error?.message || 'case_create_failed') },
      Number(error?.status) || 500,
    );
  }
}
