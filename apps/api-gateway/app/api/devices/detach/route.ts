import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

function who(h: Headers) {
  return { uid: h.get("x-uid"), role: h.get("x-role") };
}

export async function POST(req: NextRequest) {
  const { uid, role } = who(req.headers);
  if (!uid || !role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json();
  const deviceId = String(b.device_id || "");
  if (!deviceId) return NextResponse.json({ error: "device_id_required" }, { status: 400 });

  const row = await prisma.device.findUnique({ where: { deviceId } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "patient" && row.patientId !== uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.device.update({
    where: { deviceId },
    data: { roomId: null },
  });

  return NextResponse.json({ ok: true, device: updated });
}
