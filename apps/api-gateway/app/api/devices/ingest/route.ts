import { NextRequest, NextResponse } from "next/server";
import * as nodeCrypto from "node:crypto";
import { findDeviceSecret, getDeviceById, storeVitals, asDeviceKey } from "@/src/store/devices";
import { getMapperByKey, getMapperFromLegacyVendor } from "@/src/devices/registry";
import { pushToRoom } from "@/src/lib/televisit-hub";

function verifyHmac(raw: Buffer, signatureHex: string, secret: string) {
  if (!signatureHex || !secret) return false;
  // Only allow even-length hex; avoid throws on invalid hex
  if (signatureHex.length % 2 !== 0) return false;

  let sig: Buffer;
  try {
    sig = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }

  const calc = nodeCrypto.createHmac("sha256", secret).update(raw).digest(); // raw bytes
  if (sig.length !== calc.length) return false;

  try {
    return nodeCrypto.timingSafeEqual(sig, calc);
  } catch {
    return false;
  }
}

function toDbRow(e: any) {
  return {
    patientId: e.patient_id,
    deviceId: e.device_id,
    t: new Date(e.t),
    vType: e.type,
    valueNum: Number(e.value),
    unit: e.unit ?? null,
    roomId: e.room_id ?? null,
  };
}

export async function POST(req: NextRequest) {
  // We need both raw bytes (for HMAC) and a re-readable stream (for formData)
  const clone = req.clone();
  const rawAb = await req.arrayBuffer();
  const raw = Buffer.from(rawAb);

  const deviceId = req.headers.get("x-device-id") || "";
  const signatureHex = req.headers.get("x-signature") || "";
  if (!deviceId) return NextResponse.json({ error: "missing_device_id" }, { status: 400 });

  const secret = await findDeviceSecret(deviceId);
  if (!secret) return NextResponse.json({ error: "unknown_device" }, { status: 401 });
  if (!verifyHmac(raw, signatureHex, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  // Load device metadata to select mapper
  const device = await getDeviceById(deviceId);
  const key = asDeviceKey(device);

  // Prefer hierarchical mapping; fall back to legacy single-vendor style
  const mapper =
    key.vendor || key.category || key.model ? getMapperByKey(key) : getMapperFromLegacyVendor(device?.vendor);

  const ct = (req.headers.get("content-type") || "").toLowerCase();
  let payload: any = null;

  if (ct.includes("application/json")) {
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }
  } else if (ct.includes("multipart/form-data")) {
    // Expect a "meta" field containing the JSON payload; files handled separately upstream
    try {
      const form = await clone.formData();
      const meta = form.get("meta");
      if (typeof meta === "string") {
        payload = JSON.parse(meta);
      } else if (meta instanceof Blob) {
        payload = JSON.parse(await (meta as Blob).text());
      } else {
        payload = {};
      }
    } catch (e) {
      return NextResponse.json(
        { error: "bad_formdata", details: (e as Error).message },
        { status: 400 }
      );
    }
  } else {
    // Help QA: reject unknown media types explicitly
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 415 });
  }

  const events = mapper(payload, deviceId);

  await storeVitals(
    events
      .filter((e: any) => e.patient_id && typeof e.value === "number" && Number.isFinite(e.value))
      .map(toDbRow)
  );

  for (const e of events) {
    if (e.room_id) {
      await pushToRoom(e.room_id, { t: e.t, type: e.type, value: e.value, unit: e.unit });
    }
  }

  return NextResponse.json({ ok: true, count: events.length });
}
