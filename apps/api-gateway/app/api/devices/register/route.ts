import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import * as nodeCrypto from "node:crypto";
import { readIdentity, requireTrustedAuthenticatedIdentity } from "@/src/lib/identity";

function randomId(prefix: string) {
  return `${prefix}-${nodeCrypto.randomBytes(6).toString("hex")}`; // 12 hex chars
}
function randomSecret() {
  return nodeCrypto.randomBytes(24).toString("hex"); // 48 hex chars
}


export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  try { requireTrustedAuthenticatedIdentity(who); }
  catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }

  const body = await req.json();
  const vendor    = String(body.vendor || "").trim();   // e.g. "linktop"
  const category  = String(body.category || "").trim(); // e.g. "iomt"
  const model     = String(body.model || "").trim();    // e.g. "health-monitor"
  const patientId = String(body.patient_id || body.patientId || who.actorRefId || who.uid);
  const roomId    = body.room_id ? String(body.room_id) : null;

  if (!vendor || !category || !model) {
    return NextResponse.json({ error: "missing_vendor_category_model" }, { status: 400 });
  }

  // Patient can only register for self; admin/clinician can register for others
  if (who.role === "patient" && ![who.actorRefId, who.uid].filter(Boolean).includes(patientId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const deviceId = randomId("dev");
  const secret = randomSecret();

  const row = await prisma.device.create({
    data: {
      deviceId,
      secret,
      patientId,
      roomId,
      vendor,   // keep all three columns for foundation
      category,
      model,
    },
  });

  return NextResponse.json({
    ok: true,
    device: {
      device_id: row.deviceId,
      secret: row.secret,
      vendor: row.vendor,
      category: (row as any).category,
      model: (row as any).model,
      patient_id: row.patientId,
      room_id: row.roomId,
    },
    // convenience value patients can encode as a QR
    qr_payload: {
      device_id: row.deviceId,
      secret: row.secret,
    },
  });
}
