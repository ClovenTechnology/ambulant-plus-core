import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity, requireTrustedAuthenticatedIdentity } from "@/src/lib/identity";


export async function POST(req: NextRequest) {
  const identity = readIdentity(req.headers);
  try { requireTrustedAuthenticatedIdentity(identity); }
  catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const uid = identity.uid!;
  const role = identity.role;

  const b = await req.json();
  const deviceId = String(b.device_id || "");
  const roomId = String(b.room_id || "");

  if (!deviceId || !roomId) {
    return NextResponse.json({ error: "device_id_and_room_id_required" }, { status: 400 });
  }

  const row = await prisma.device.findUnique({ where: { deviceId } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Patients may attach only their devices; clinicians/admins can attach any
  if (role === "patient" && ![identity.actorRefId, uid].filter(Boolean).includes(row.patientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.device.update({
    where: { deviceId },
    data: { roomId },
  });

  return NextResponse.json({ ok: true, device: updated });
}
