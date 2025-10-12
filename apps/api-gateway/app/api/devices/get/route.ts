import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

function who(h: Headers) { return { uid: h.get("x-uid"), role: h.get("x-role") }; }

export async function GET(req: NextRequest) {
  const { uid, role } = who(req.headers);
  if (!uid || !role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("device_id") || "";
  if (!id) return NextResponse.json({ error: "device_id_required" }, { status: 400 });

  const row = await prisma.device.findUnique({ where: { deviceId: id } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Patients can only read their own device
  if (role === "patient" && row.patientId !== uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { secret, ...safe } = row as any;
  return NextResponse.json({ device: safe });
}
