export type ClientWorkspace =
  | "payer_ops"
  | "corporate_sponsor"
  | "wellness_partner"
  | string
  | null
  | undefined;

export type ClientSessionLike = {
  uid?: string | null;
  orgId?: string | null;
  email?: string | null;
  orgType?: string | null;
  workspace?: ClientWorkspace;
  role?: string | null;
  scopes?: unknown;
};

export type ClientRole =
  | "ORG_OWNER"
  | "ORG_ADMIN"
  | "FINANCE_MANAGER"
  | "CLAIMS_MANAGER"
  | "CARE_COORDINATOR"
  | "PROVIDER_MANAGER"
  | "DEVICE_REVIEWER"
  | "EXPORT_MANAGER"
  | "READ_ONLY";

const ALL_ROLES: ClientRole[] = [
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

function pathMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeClientRole(value?: string | null): ClientRole {
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

export function normalizeClientWorkspace(value?: ClientWorkspace) {
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

export function hasClientScope(session: ClientSessionLike, scope: string) {
  const scopes = Array.isArray(session.scopes) ? session.scopes.map(String) : [];
  return scopes.includes(scope) || scopes.includes("*") || scopes.includes("admin:*");
}

type RouteRule = {
  prefixes: string[];
  roles: ClientRole[];
  scope?: string;
};

const ROUTE_RULES: RouteRule[] = [
  {
    prefixes: ["/org"],
    roles: ["ORG_OWNER", "ORG_ADMIN"],
  },
  {
    prefixes: ["/exports"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "EXPORT_MANAGER"],
    scope: "exports:read",
  },
  {
    prefixes: ["/wallet", "/settlements"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "FINANCE_MANAGER"],
  },
  {
    prefixes: ["/authorizations"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "CARE_COORDINATOR"],
  },
  {
    prefixes: ["/claims"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "FINANCE_MANAGER", "READ_ONLY"],
  },
  {
    prefixes: ["/coverage", "/products", "/preflight"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "CARE_COORDINATOR", "READ_ONLY"],
  },
  {
    prefixes: ["/providers"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "PROVIDER_MANAGER", "FINANCE_MANAGER", "READ_ONLY"],
  },
  {
    prefixes: ["/devices"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "DEVICE_REVIEWER", "CARE_COORDINATOR", "READ_ONLY"],
  },
  {
    prefixes: ["/careport", "/medreach"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "CARE_COORDINATOR", "FINANCE_MANAGER", "READ_ONLY"],
  },
  {
    prefixes: ["/members"],
    roles: ["ORG_OWNER", "ORG_ADMIN", "CLAIMS_MANAGER", "CARE_COORDINATOR", "DEVICE_REVIEWER", "EXPORT_MANAGER", "READ_ONLY"],
  },
  {
    prefixes: ["/dashboard", "/wellness"],
    roles: ALL_ROLES,
  },
];

export function rolesForClientPath(pathname: string): ClientRole[] {
  const rule = ROUTE_RULES.find((r) =>
    r.prefixes.some((prefix) => pathMatches(pathname, prefix))
  );

  return rule?.roles || ALL_ROLES;
}

export function canAccessClientPath(session: ClientSessionLike, pathname: string) {
  if (!session?.uid) return false;

  const role = normalizeClientRole(session.role);
  const rule = ROUTE_RULES.find((r) =>
    r.prefixes.some((prefix) => pathMatches(pathname, prefix))
  );

  if (!rule) return true;

  if (rule.roles.includes(role)) return true;

  if (rule.scope && hasClientScope(session, rule.scope)) return true;

  return false;
}