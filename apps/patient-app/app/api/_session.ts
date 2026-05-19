import crypto from "node:crypto";
import { cookies } from "next/headers";

export type PatientAppSession = {
  userId: string;
  actorType: string | null;
  role: string;
  orgId: string | null;
  actorRefId: string | null;
  sid: string | null;
};

const COOKIE_CANDIDATES = [
  "__Host-ambulant_session",
  "ambulant_session",
  "ambulant.session",
  "auth_session",
  "session",
  "token",
];

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

function safeJsonParse(buf: Buffer) {
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

function verifyJwtHs256(token: string, secret: string): any | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const data = `${h}.${p}`;

    const expected = crypto.createHmac("sha256", secret).update(data).digest();
    const got = base64urlToBuffer(sig);

    if (got.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(got, expected)) return null;

    const payload = safeJsonParse(base64urlToBuffer(p));
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function resolvePatientAppSession(): PatientAppSession | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return null;

  const jar = cookies();

  let token = "";
  for (const name of COOKIE_CANDIDATES) {
    const value = jar.get(name)?.value;
    if (value) {
      token = value;
      break;
    }
  }

  if (!token) return null;

  const payload = verifyJwtHs256(token, secret);
  if (!payload) return null;

  const userId = String(payload.sub || payload.userId || payload.uid || "").trim();
  if (!userId) return null;

  const actorType = payload.actorType ? String(payload.actorType) : null;
  const role =
    String(actorType || payload.role || "")
      .trim()
      .toLowerCase() === "patient" ||
    String(actorType || "").trim().toUpperCase() === "PATIENT"
      ? "patient"
      : String(payload.role || "patient").trim().toLowerCase();

  return {
    userId,
    actorType,
    role: role || "patient",
    orgId: payload.orgId ? String(payload.orgId) : null,
    actorRefId: payload.actorRefId ? String(payload.actorRefId) : null,
    sid: payload.sid ? String(payload.sid) : null,
  };
}

export function applyPatientSessionHeaders(headers: Headers, session: PatientAppSession | null) {
  if (!session) return headers;

  if (session.userId) {
    if (!headers.get("x-uid")) headers.set("x-uid", session.userId);
    if (!headers.get("x-user-id")) headers.set("x-user-id", session.userId);
    if (!headers.get("x-ambulant-user-id")) headers.set("x-ambulant-user-id", session.userId);
  }

  if (session.orgId) {
    if (!headers.get("x-org-id")) headers.set("x-org-id", session.orgId);
    if (!headers.get("x-ambulant-org-id")) headers.set("x-ambulant-org-id", session.orgId);
  }

  if (!headers.get("x-role")) headers.set("x-role", session.role || "patient");
  if (!headers.get("x-ambulant-role")) headers.set("x-ambulant-role", session.role || "patient");

  return headers;
}