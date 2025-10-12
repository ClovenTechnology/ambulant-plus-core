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
  const roomId = String(b.room_id || "");

  if (!deviceId || !roomId) {
    return NextResponse.json({ error: "device_id_and_room_id_required" }, { status: 400 });
  }

  const row = await prisma.device.findUnique({ where: { deviceId } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Patients may attach only their devices; clinicians/admins can attach any
  if (role === "patient" && row.patientId !== uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.device.update({
    where: { deviceId },
    data: { roomId },
  });

  return NextResponse.json({ ok: true, device: updated });
}
