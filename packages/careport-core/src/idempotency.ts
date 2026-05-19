import crypto from "node:crypto";

export function hashRequest(body: unknown): string {
  const json = JSON.stringify(body ?? null);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function normalizeIdempotencyKey(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  return v ? v : null;
}
