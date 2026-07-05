export const CANONICAL_APIGW_BASE = "https://api-gateway.ambulantplus.co.za";

export function normaliseApigwOrigin(rawValue?: string | null, currentHost?: string | null) {
  const raw = String(rawValue || CANONICAL_APIGW_BASE).trim() || CANONICAL_APIGW_BASE;

  try {
    const parsed = new URL(raw);
    const host = parsed.host.toLowerCase();
    const current = String(currentHost || "").toLowerCase();

    if (
      host === current ||
      host.includes("clients.ambulantplus.co.za") ||
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1")
    ) {
      return CANONICAL_APIGW_BASE;
    }

    return parsed.origin.replace(/\/+$/, "");
  } catch {
    return CANONICAL_APIGW_BASE;
  }
}

export function clientApigwOrigin(reqUrl?: string) {
  let currentHost = "";

  try {
    currentHost = reqUrl ? new URL(reqUrl).host : "";
  } catch {
    currentHost = "";
  }

  return normaliseApigwOrigin(
    process.env.APIGW_BASE ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      CANONICAL_APIGW_BASE,
    currentHost,
  );
}

export function errorMessage(value: unknown, fallback: string) {
  if (!value) return fallback;
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    const record = value as Record<string, any>;
    return String(record.message || record.code || JSON.stringify(record));
  }

  return String(value);
}