import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

function getOrgId(req: Request) {
  return (req.headers.get('x-org-id') || 'org-default').trim() || 'org-default';
}
function getActor(req: Request) {
  const role = (req.headers.get('x-role') || '').trim();
  const uid = (req.headers.get('x-uid') || '').trim();
  return { role, uid };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const encounterId = (url.searchParams.get('encounterId') || '').trim();
  const patientId = (url.searchParams.get('patientId') || '').trim(); // optional filter

  if (!encounterId) {
    return NextResponse.json({ ok: false, error: 'encounterId is required' }, { status: 400 });
  }

  const orgId = getOrgId(req);

  const [artifact, findings, evidence, annotations] = await Promise.all([
    prisma.clinicalArtifact.findUnique({
      where: {
        orgId_encounterId_specialty_kind: {
          orgId,
          encounterId,
          specialty: 'std',
          kind: 'std_workspace_state',
        },
      },
    }),
    prisma.clinicalFinding.findMany({
      where: { orgId, encounterId, specialty: 'std', ...(patientId ? { patientId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    prisma.clinicalEvidence.findMany({
      where: { orgId, encounterId, specialty: 'std', ...(patientId ? { patientId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 800,
    }),
    prisma.clinicalAnnotation.findMany({
      where: { orgId, encounterId, specialty: 'std', ...(patientId ? { patientId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 1500,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    artifact: artifact ? { ...artifact, payload: artifact.payload } : null,
    findings,
    evidence,
    annotations,
  });
}

export async function POST(req: Request) {
  const orgId = getOrgId(req);
  const { role, uid } = getActor(req);

  // For now: clinician-only writes (tighten later with real auth)
  if (!uid || !role) {
    return NextResponse.json({ ok: false, error: 'missing x-uid/x-role' }, { status: 401 });
  }
  if (role !== 'clinician' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });

  const encounterId = String(body.encounterId || '').trim();
  const patientId = String(body.patientId || '').trim();
  const payload = body.payload;

  if (!encounterId || !patientId || !payload) {
    return NextResponse.json(
      { ok: false, error: 'encounterId, patientId, payload are required' },
      { status: 400 }
    );
  }

  const saved = await prisma.clinicalArtifact.upsert({
    where: {
      orgId_encounterId_specialty_kind: {
        orgId,
        encounterId,
        specialty: 'std',
        kind: 'std_workspace_state',
      },
    },
    update: { payload, clinicianId: uid, patientId, meta: body.meta ?? undefined },
    create: {
      orgId,
      encounterId,
      patientId,
      clinicianId: uid,
      specialty: 'std',
      kind: 'std_workspace_state',
      payload,
      meta: body.meta ?? undefined,
    },
  });

  // Optional: add an audit row (you already have AuditLog)
  await prisma.auditLog.create({
    data: {
      actorUserId: uid,
      actorType: role === 'admin' ? 'ADMIN' : 'CLINICIAN',
      app: 'api-gateway',
      action: 'STD_WORKSPACE_STATE_UPSERT',
      entityType: 'ClinicalArtifact',
      entityId: saved.id,
      description: `Upsert STD workspace state for encounter ${encounterId}`,
      meta: { orgId, encounterId, patientId },
    },
  });

  return NextResponse.json({ ok: true, artifact: saved });
}
