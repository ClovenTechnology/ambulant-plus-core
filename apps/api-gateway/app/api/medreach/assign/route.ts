// apps/api-gateway/app/api/medreach/assign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';
import { push, sseKeys } from '@/src/lib/sse';
import { ensureMedReachFinancialRecord } from '@ambulant/client-core/src/medreach';
import { MEDREACH_DRAW_STATUSES } from '@shared/medreach';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseOptionalDate(value: unknown): Date | null {
  const raw = cleanString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function nowIso() {
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (who.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const orderId = cleanString(body.orderId);
  const phlebId = cleanString(body.phlebId);
  const encounterId = cleanString(body.encounterId);
  const patientId = cleanString(body.patientId);
  const clinicianId = cleanString(body.clinicianId) || null;
  const partnerId = cleanString(body.partnerId) || null;
  const scheduledAt = parseOptionalDate(body.scheduledAt);

  if (!orderId || !encounterId || !patientId || !phlebId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'bad_request',
        detail: 'orderId, encounterId, patientId and phlebId are required.',
      },
      { status: 400 },
    );
  }

  const existing = await prisma.draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  /**
   * Important:
   * scheduledAt is scheduling metadata.
   * It must not become a separate lower-case workflow status.
   */
  const nextStatus = MEDREACH_DRAW_STATUSES.ASSIGNED;

  const wasReassigned =
    Boolean(existing?.phlebId) && existing?.phlebId !== phlebId;

  const row = existing
    ? await prisma.draw.update({
        where: { id: existing.id },
        data: {
          encounterId,
          patientId,
          clinicianId,
          partnerId,
          phlebId,
          status: nextStatus,
          scheduledAt,
          assignedAt: existing.assignedAt ?? now,
          updatedAt: now,
        },
      })
    : await prisma.draw.create({
        data: {
          orderId,
          encounterId,
          patientId,
          clinicianId,
          partnerId,
          phlebId,
          status: nextStatus,
          scheduledAt,
          assignedAt: now,
          updatedAt: now,
        },
      });

  await ensureMedReachFinancialRecord({
    orderId,
    drawId: row.id,
    labId: partnerId,
    phlebId: row.phlebId ?? null,
    orgId: 'org-default',
  }).catch(() => null);

  const auditKind = existing
    ? wasReassigned
      ? 'draw_reassigned'
      : 'draw_updated'
    : 'draw_assigned';

  await prisma.auditEvent.create({
    data: {
      kind: auditKind,
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: {
        orderId,
        drawId: row.id,
        encounterId,
        patientId,
        clinicianId,
        partnerId,
        phlebId,
        scheduledAt: row.scheduledAt,
        previousPhlebId: existing?.phlebId ?? null,
        status: row.status,
      },
    },
  });

  emitEvent({
    kind: auditKind,
    encounterId,
    patientId,
    clinicianId,
    payload: {
      orderId,
      drawId: row.id,
      channel: 'medreach',
      phlebId,
      partnerId,
      status: row.status,
      scheduledAt: row.scheduledAt,
    },
    targets: {
      admin: true,
      patientId,
      clinicianId,
    },
  });

  const evt = {
    kind: auditKind,
    at: nowIso(),
    orderId,
    drawId: row.id,
    phlebId,
    partnerId,
    status: row.status,
    scheduledAt: row.scheduledAt,
  };

  await Promise.allSettled([
    push(sseKeys.order(orderId), evt),
    push(sseKeys.draw(row.id), evt),
    partnerId ? push(sseKeys.lab(partnerId), evt) : Promise.resolve(),
  ]);

  return NextResponse.json({
    ok: true,
    data: row,
    meta: {
      action: auditKind,
      orderId,
      drawId: row.id,
      status: row.status,
      at: nowIso(),
    },
  });
}