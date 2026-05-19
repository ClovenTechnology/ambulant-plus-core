// apps/api-gateway/app/api/medreach/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { emitEvent } from "@/src/lib/events";
import { readIdentity } from "@/src/lib/identity";
import { push, sseKeys } from "@/src/lib/sse";
import { ensureMedReachFinancialRecord } from "@ambulant/client-core/src/medreach";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(value: unknown): Date | null {
  const raw = cleanString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (who.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const existing = await prisma.draw.findFirst({
    where: { orderId },
  });

  const nextStatus = scheduledAt ? "scheduled" : "assigned";
  const now = new Date();

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
        },
      });

  await ensureMedReachFinancialRecord({
    orderId,
    drawId: row.id,
    labId: partnerId,
    phlebId: row.phlebId ?? null,
    orgId: "org-default",
  }).catch(() => null);

  const auditKind = existing
    ? wasReassigned
      ? "draw_reassigned"
      : "draw_updated"
    : "draw_assigned";

  await prisma.auditEvent.create({
    data: {
      kind: auditKind,
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: {
        drawId: row.id,
        encounterId,
        patientId,
        clinicianId,
        partnerId,
        phlebId,
        scheduledAt: row.scheduledAt,
        previousPhlebId: existing?.phlebId ?? null,
        nextStatus,
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
      channel: "medreach",
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
    at: new Date().toISOString(),
    orderId,
    drawId: row.id,
    encounterId,
    patientId,
    clinicianId,
    partnerId,
    phlebId,
    status: row.status,
    scheduledAt: row.scheduledAt,
  };

  await Promise.allSettled([
    push(sseKeys.order(orderId), evt),
    push(sseKeys.draw(row.id), evt),
  ]);

  return NextResponse.json({
    assignment: {
      drawId: row.id,
      orderId,
      phlebId: row.phlebId,
      partnerId: row.partnerId,
      status: row.status,
      scheduledAt: row.scheduledAt,
      updatedAt: row.updatedAt,
    },
    warning: null,
    meta: {
      orderId,
      action: existing
        ? wasReassigned
          ? "reassign"
          : "update_assignment"
        : "assign",
      actorRole: who.role,
      actorId: who.uid ?? null,
      at: new Date().toISOString(),
    },
  });
}