import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
} from "@/src/lib/identity";


export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const role = who.role;
  const subjectPatientId = String(who.actorRefId || who.uid || "").trim();

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("device_id") ?? undefined;
  const patientId = url.searchParams.get("patient_id") ?? undefined;
  const roomId = url.searchParams.get("room_id") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const sinceIso = url.searchParams.get("since") ?? undefined;

  // Patient reads are always narrowed to the authenticated patient subject.
  // Other authenticated roles retain the pre-existing query semantics here.
  let effectivePatientId = patientId;

  if (role === "patient") {
    if (!subjectPatientId) {
      return NextResponse.json({ error: "patient_subject_required" }, { status: 403 });
    }

    if (patientId && patientId !== subjectPatientId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (deviceId) {
      const d = await prisma.device.findUnique({ where: { deviceId } });
      if (!d || d.patientId !== subjectPatientId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    effectivePatientId = subjectPatientId;
  }

  const where: any = { interpretationStatus: "ACTIVE" };
  if (deviceId) where.deviceId = deviceId;
  if (effectivePatientId) where.patientId = effectivePatientId;
  if (roomId) where.roomId = roomId;
  if (type) where.vType = type;
  if (sinceIso) where.t = { gte: new Date(sinceIso) };

  const rows = await prisma.vitalSample.findMany({
    where,
    orderBy: { t: "desc" },
    take: limit,
  });

  return NextResponse.json({
    items: rows.map(r => ({
      t: r.t.toISOString(),
      type: r.vType,
      value: r.valueNum,
      unit: r.unit ?? undefined,
      device_id: r.deviceId,
      room_id: r.roomId ?? undefined,
    })),
  });
}
