import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_ORIGINS = [
  "https://patient.ambulantplus.co.za",
  "https://clinician.ambulantplus.co.za",
  "https://admin.ambulantplus.co.za",
  "https://clients.ambulantplus.co.za",
  "https://medreach.ambulantplus.co.za",
  "https://careport.ambulantplus.co.za",
  "https://landing.ambulantplus.co.za",
  "https://insightcore.ambulantplus.co.za",
];

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3010",
  "http://localhost:3011",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:3010",
  "http://127.0.0.1:3011",
];

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function splitOrigins(value: string | undefined | null) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function configuredOrigins() {
  return [
    ...splitOrigins(process.env.API_CORS_ORIGINS),
    ...splitOrigins(process.env.CLIENT_APP_ORIGIN),
    ...splitOrigins(process.env.PATIENT_ORIGIN),
    ...splitOrigins(process.env.CLINICIAN_ORIGIN),
    ...splitOrigins(process.env.ADMIN_ORIGIN),
    ...splitOrigins(process.env.CLIENT_ORIGIN),
    ...splitOrigins(process.env.MEDREACH_ORIGIN),
    ...splitOrigins(process.env.CAREPORT_ORIGIN),
    ...splitOrigins(process.env.INSIGHTCORE_ORIGIN),
  ];
}

function allowedOrigins() {
  const explicit = configuredOrigins();

  if (explicit.length > 0) {
    return Array.from(new Set(explicit));
  }

  if (isProductionRuntime()) {
    return PRODUCTION_ORIGINS;
  }

  return Array.from(new Set([...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS]));
}

function corsOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();

  if (origin && allowed.includes(origin)) {
    return origin;
  }

  if (!origin && !isProductionRuntime()) {
    return allowed[0] || "";
  }

  return "";
}

function applyCors(req: NextRequest, res: NextResponse) {
  const origin = corsOrigin(req);

  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  }

  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    [
      "authorization",
      "content-type",
      "x-admin-origin",
      "x-client-origin",
      "x-patient-origin",
      "x-clinician-origin",
      "x-insightcore-origin",
      "x-requested-with",
      "x-api-key",
      "x-internal-api-key",
      "x-uid",
      "x-role",
      "x-join-token",
    ].join(", "),
  );
  res.headers.set("Access-Control-Max-Age", "86400");
  res.headers.set("Vary", "Origin");

  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    return applyCors(req, new NextResponse(null, { status: 204 }));
  }

  return applyCors(req, NextResponse.next());
}

export const config = {
  matcher: ["/api/:path*"],
};
