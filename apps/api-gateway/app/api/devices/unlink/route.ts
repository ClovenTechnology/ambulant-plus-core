import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity, requireTrustedAuthenticatedIdentity } from "@/src/lib/identity";


export async function DELETE(req: NextRequest) {
  const identity = readIdentity(req.headers);
  try { requireTrustedAuthenticatedIdentity(identity); }
  catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const uid = identity.uid!;
  const role = identity.role;

  const b = await req.json();
  const deviceId = String(b.device_id || "");
  if (!deviceId) return NextResponse.json({ error: "device_id_required" }, { status: 400 });

  const row = await prisma.device.findUnique({ where: { deviceId } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Patients may unlink only their devices; clinicians/admins can unlink any
  if (role === "patient" && ![identity.actorRefId, uid].filter(Boolean).includes(row.patientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.device.delete({ where: { deviceId } });
  return NextResponse.json({ ok: true });
}
