import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

function who(h: Headers) { return { uid: h.get("x-uid"), role: h.get("x-role") }; }

export async function GET(req: NextRequest) {
  const { uid, role } = who(req.headers);
  if (!uid || !role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("device_id") ?? undefined;
  const patientId = url.searchParams.get("patient_id") ?? undefined;
  const roomId = url.searchParams.get("room_id") ?? undefined;
  const type = url.searchParams.get("type") ?? undefined;
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const sinceIso = url.searchParams.get("since") ?? undefined;

  // Basic access rules: patient can only read own; clinician/admin unrestricted
  if (role === "patient" && patientId && patientId !== uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (role === "patient" && !patientId && deviceId) {
    const d = await prisma.device.findUnique({ where: { deviceId } });
    if (!d || d.patientId !== uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const where: any = {};
  if (deviceId) where.deviceId = deviceId;
  if (patientId) where.patientId = patientId;
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
