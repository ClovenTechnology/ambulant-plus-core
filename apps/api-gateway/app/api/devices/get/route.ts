import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity, requireTrustedAuthenticatedIdentity } from "@/src/lib/identity";


export async function GET(req: NextRequest) {
  const identity = readIdentity(req.headers);
  try { requireTrustedAuthenticatedIdentity(identity); }
  catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const uid = identity.uid!;
  const role = identity.role;

  const id = new URL(req.url).searchParams.get("device_id") || "";
  if (!id) return NextResponse.json({ error: "device_id_required" }, { status: 400 });

  const row = await prisma.device.findUnique({ where: { deviceId: id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Patients can only read their own device
  if (role === "patient" && ![identity.actorRefId, uid].filter(Boolean).includes(row.patientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { secret, ...safe } = row as any;
  return NextResponse.json({ device: safe });
}
