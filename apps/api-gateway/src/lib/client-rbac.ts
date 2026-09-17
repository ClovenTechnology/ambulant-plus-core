import { NextRequest, NextResponse } from "next/server";
import { readVerifiedClientSession } from "@/src/lib/client-session";

export type ApiClientRole =
  | "ORG_OWNER"
  | "ORG_ADMIN"
  | "FINANCE_MANAGER"
  | "CLAIMS_MANAGER"
  | "CARE_COORDINATOR"
  | "PROVIDER_MANAGER"
  | "DEVICE_REVIEWER"
  | "EXPORT_MANAGER"
  | "READ_ONLY";

export const ALL_API_CLIENT_ROLES: ApiClientRole[] = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "FINANCE_MANAGER",
  "CLAIMS_MANAGER",
  "CARE_COORDINATOR",
  "PROVIDER_MANAGER",
  "DEVICE_REVIEWER",
  "EXPORT_MANAGER",
  "READ_ONLY",
];

export type ApiClientActor = {
  uid: string | null;
  orgId: string | null;
  role: ApiClientRole;
  workspace: string | null;
  trusted: boolean;
  source: "signed_client_session" | "unsafe_dev_header" | "none";
};

function header(req: NextRequest, name: string) {
  return req.headers.get(name) || req.headers.get(name.toLowerCase()) || "";
}

export function normalizeApiClientRole(value?: string | null): ApiClientRole {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "OWNER") return "ORG_OWNER";
  if (raw === "ADMIN") return "ORG_ADMIN";
  if (raw === "ORG_OWNER") return "ORG_OWNER";
  if (raw === "ORG_ADMIN") return "ORG_ADMIN";
  if (raw === "FINANCE" || raw === "FINANCE_MANAGER") return "FINANCE_MANAGER";
  if (raw === "CLAIMS" || raw === "CLAIMS_MANAGER") return "CLAIMS_MANAGER";
  if (raw === "CARE" || raw === "CARE_COORDINATOR") return "CARE_COORDINATOR";
  if (raw === "PROVIDER" || raw === "PROVIDER_MANAGER") return "PROVIDER_MANAGER";
  if (raw === "DEVICE" || raw === "DEVICE_REVIEWER") return "DEVICE_REVIEWER";
  if (raw === "EXPORT" || raw === "EXPORT_MANAGER") return "EXPORT_MANAGER";
  if (raw === "READ_ONLY" || raw === "VIEWER") return "READ_ONLY";

  return "READ_ONLY";
}

function allowUnsafeClientHeaders() {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.ALLOW_UNSAFE_CLIENT_IDENTITY_HEADERS === "1" ||
      process.env.ALLOW_UNSAFE_CLIENT_IDENTITY_HEADERS === "true")
  );
}

export function readApiClientActor(req: NextRequest): ApiClientActor {
  const session = readVerifiedClientSession(req);

  if (session) {
    return {
      uid: session.uid,
      orgId: session.orgId,
      role: normalizeApiClientRole(session.role),
      workspace: session.workspace || null,
      trusted: true,
      source: "signed_client_session",
    };
  }

  if (allowUnsafeClientHeaders()) {
    const uid =
      header(req, "x-ambulant-user-id") ||
      header(req, "x-uid") ||
      null;

    const orgId =
      header(req, "x-ambulant-org-id") ||
      header(req, "x-org-id") ||
      null;

    return {
      uid,
      orgId,
      role: normalizeApiClientRole(
        header(req, "x-ambulant-role") || header(req, "x-role") || "READ_ONLY",
      ),
      workspace:
        header(req, "x-ambulant-workspace") ||
        header(req, "x-workspace") ||
        null,
      trusted: false,
      source: "unsafe_dev_header",
    };
  }

  return {
    uid: null,
    orgId: null,
    role: "READ_ONLY",
    workspace: null,
    trusted: false,
    source: "none",
  };
}

export function forbiddenJson(error: string, status = 403) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    { status },
  );
}

export function requireApiClientRole(
  req: NextRequest,
  allowedRoles: ApiClientRole[],
  options?: {
    orgId?: string | null;
    allowReadOnly?: boolean;
  },
):
  | { ok: true; actor: ApiClientActor }
  | { ok: false; response: NextResponse } {
  const actor = readApiClientActor(req);

  if (!actor.uid || !actor.orgId) {
    return {
      ok: false,
      response: forbiddenJson("unauthenticated_client_api", 401),
    };
  }

  if (!actor.trusted) {
    return {
      ok: false,
      response: forbiddenJson("untrusted_client_api_caller", 403),
    };
  }

  const requestedOrgId = String(options?.orgId || "").trim() || null;

  if (requestedOrgId && requestedOrgId !== actor.orgId) {
    return {
      ok: false,
      response: forbiddenJson("cross_org_access_denied", 403),
    };
  }

  if (allowedRoles.includes(actor.role)) {
    return { ok: true, actor };
  }

  if (options?.allowReadOnly && actor.role === "READ_ONLY") {
    return { ok: true, actor };
  }

  return {
    ok: false,
    response: forbiddenJson("insufficient_client_role", 403),
  };
}
