import { NextRequest, NextResponse } from "next/server";

function allowedOrigins() {
  return (
    process.env.API_CORS_ORIGINS ||
    process.env.CLIENT_APP_ORIGIN ||
    "http://localhost:3011"
  )
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function corsOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();

  if (origin && allowed.includes(origin)) {
    return origin;
  }

  return allowed[0] || "http://localhost:3011";
}

function applyCors(req: NextRequest, res: NextResponse) {
  const origin = corsOrigin(req);

  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS"
  );
  res.headers.set(
    "Access-Control-Allow-Headers",
    [
      "content-type",
      "authorization",
      "x-idempotency-key",
      "x-ambulant-user-id",
      "x-ambulant-org-id",
      "x-ambulant-role",
      "x-ambulant-workspace",
      "x-ambulant-trusted",
    ].join(",")
  );
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