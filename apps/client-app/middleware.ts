import { NextRequest, NextResponse } from "next/server";
import { canAccessClientPath } from "./src/lib/client-rbac";

type SessionPayload = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  orgType?:
    | "MEDICAL_AID"
    | "HMO"
    | "CORPORATE_SPONSOR"
    | "GYM"
    | "WELLNESS_PARTNER"
    | null;
  workspace?:
    | "payer_ops"
    | "corporate_sponsor"
    | "wellness_partner"
    | string
    | null;
  role?: string | null;
  scopes?: unknown;
};

function safeParseSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;

  try {
    const json = JSON.parse(value);
    return json && typeof json === "object" ? (json as SessionPayload) : null;
  } catch {
    return null;
  }
}

function normalizeWorkspace(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "wellness_partner" || raw === "wellness" || raw === "gym") {
    return "wellness_partner";
  }

  if (raw === "corporate_sponsor" || raw === "corporate" || raw === "sponsor") {
    return "corporate_sponsor";
  }

  if (
    raw === "payer_ops" ||
    raw === "payer" ||
    raw === "medical_aid" ||
    raw === "hmo" ||
    raw === "scheme"
  ) {
    return "payer_ops";
  }

  return null;
}

function isAuthRoute(pathname: string) {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

function isStaticRoute(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/public")
  );
}

function defaultLandingForWorkspace(workspace?: string | null) {
  return normalizeWorkspace(workspace) === "wellness_partner" ? "/wellness" : "/dashboard";
}

function isWellnessOnlyRoute(pathname: string) {
  return pathname === "/wellness" || pathname.startsWith("/wellness/");
}

function isPayerRoute(pathname: string) {
  const payerPrefixes = [
    "/dashboard",
    "/members",
    "/coverage",
    "/products",
    "/preflight",
    "/authorizations",
    "/claims",
    "/wallet",
    "/settlements",
    "/devices",
    "/careport",
    "/medreach",
    "/providers",
    "/exports",
    "/org",
  ];

  return payerPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isCorporateAllowedRoute(pathname: string) {
  const allowed = [
    "/dashboard",
    "/members",
    "/products",
    "/preflight",
    "/authorizations",
    "/claims",
    "/wallet",
    "/careport",
    "/medreach",
    "/exports",
    "/org",
  ];

  return allowed.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isStaticRoute(pathname)) {
    return NextResponse.next();
  }

  const session = safeParseSession(
    req.cookies.get("ambulant_client_session")?.value
  );
  const workspace = normalizeWorkspace(session?.workspace);

  if (isAuthRoute(pathname)) {
    if (session?.uid && workspace) {
      const url = req.nextUrl.clone();
      url.pathname = defaultLandingForWorkspace(workspace);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!session?.uid || !workspace) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = defaultLandingForWorkspace(workspace);
    return NextResponse.redirect(url);
  }

  function forbiddenRedirect(req: NextRequest, pathname: string) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("rbac", "forbidden");
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (workspace === "wellness_partner") {
    if (isPayerRoute(pathname) && !isWellnessOnlyRoute(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/wellness";
      return NextResponse.redirect(url);
    }

    if (!canAccessClientPath(session, pathname)) {
      return forbiddenRedirect(req, pathname);
    }

    return NextResponse.next();
  }

  if (workspace === "corporate_sponsor") {
    if (isWellnessOnlyRoute(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (!isCorporateAllowedRoute(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (!canAccessClientPath(session, pathname)) {
      return forbiddenRedirect(req, pathname);
    }

    return NextResponse.next();
  }

  if (workspace === "payer_ops") {
    if (isWellnessOnlyRoute(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (!canAccessClientPath(session, pathname)) {
      return forbiddenRedirect(req, pathname);
    }

    return NextResponse.next();
  }

  const fallback = req.nextUrl.clone();
  fallback.pathname = "/auth/login";
  return NextResponse.redirect(fallback);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};