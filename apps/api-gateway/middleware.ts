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

const CLIENT_SESSION_TOKEN_COOKIE = "ambulant_client_session_token";
const CLIENT_SESSION_ISSUER = "ambulant-api-gateway";
const CLIENT_SESSION_AUDIENCE = "ambulant-client-app";
const CLINICIAN_SESSION_ISSUER = "ambulant-clinician-app";
const CLINICIAN_SESSION_AUDIENCE = "ambulant-clinician-app";

const GENERIC_SESSION_COOKIES = [
  "adm.profile",
  "__Host-ambulant_session",
  "ambulant_session",
  "ambulant.session",
  "auth_session",
  "session",
  "token",
];

const IDENTITY_HEADERS = [
  "x-uid",
  "x-user-id",
  "x-ambulant-user-id",
  "x-role",
  "x-user-role",
  "x-ambulant-role",
  "x-org-id",
  "x-org",
  "x-ambulant-org-id",
  "x-actor-ref-id",
  "x-patient-id",
  "x-current-patient-id",
  "x-clinician-id",
  "x-ambulant-trusted",
  "x-ambulant-workspace",
  "x-workspace",
  "x-admin-origin",
  "x-client-origin",
  "x-patient-origin",
  "x-clinician-origin",
  "x-insightcore-origin",
];

type VerifiedIdentity = {
  uid: string;
  role: string;
  orgId: string | null;
  actorRefId: string | null;
  workspace?: string | null;
  kind: "signed_internal" | "client_session" | "clinician_session" | "generic_session";
};

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
      "x-ambulant-identity",
    ].join(", "),
  );
  res.headers.set("Access-Control-Max-Age", "86400");
  res.headers.set("Vary", "Origin");

  return res;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function base64urlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeJsonSegment(value: string): Record<string, unknown> | null {
  try {
    const text = new TextDecoder().decode(base64urlToBytes(value));
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function verifyHmac(secret: string, data: string, signature: string) {
  try {
    const key = await importHmacKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(signature),
      new TextEncoder().encode(data),
    );
  } catch {
    return false;
  }
}

async function hmacBase64url(secret: string, data: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return bytesToBase64url(new Uint8Array(signature));
}

async function verifyJwtHs256(
  token: string,
  secret: string,
  constraints?: { issuer?: string; audience?: string },
) {
  try {
    const parts = clean(token).split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const header = decodeJsonSegment(encodedHeader);
    const payload = decodeJsonSegment(encodedPayload);
    if (!header || !payload) return null;
    if (String(header.alg || "").toUpperCase() !== "HS256") return null;

    const verified = await verifyHmac(
      secret,
      `${encodedHeader}.${encodedPayload}`,
      signature,
    );
    if (!verified) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp <= now) return null;
    if (typeof payload.nbf === "number" && payload.nbf > now + 30) return null;
    if (typeof payload.iat === "number" && payload.iat > now + 60) return null;
    if (constraints?.issuer && payload.iss !== constraints.issuer) return null;
    if (constraints?.audience && payload.aud !== constraints.audience) return null;

    return payload;
  } catch {
    return null;
  }
}

function parseCookies(value: string) {
  const out: Record<string, string> = {};
  for (const part of String(value || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

function normalizedGenericRole(payload: Record<string, unknown>) {
  const raw = clean(payload.actorType || payload.actor_type || payload.role || payload.type).toLowerCase();
  if (raw === "patient" || raw === "patient_user" || raw === "pat") return "patient";
  if (raw === "clinician" || raw === "doctor") return "clinician";
  if (raw === "admin") return "admin";
  if (raw === "admin_staff" || raw === "staff" || raw === "support") return "admin_staff";
  if (raw === "clinician_staff_medical") return "clinician_staff_medical";
  if (raw === "clinician_staff_non_medical") return "clinician_staff_non_medical";
  if (raw === "pharmacy") return "pharmacy";
  if (raw === "pharmacy_staff") return "pharmacy_staff";
  if (raw === "rider") return "rider";
  if (raw === "phleb") return "phleb";
  if (raw === "lab") return "lab";
  if (raw === "system") return "system";
  return "";
}

function identityFromPayload(
  payload: Record<string, unknown>,
  kind: VerifiedIdentity["kind"],
  roleOverride?: string,
): VerifiedIdentity | null {
  const uid = clean(payload.sub || payload.uid || payload.userId || payload.user_id);
  const role = clean(roleOverride || normalizedGenericRole(payload) || payload.role);
  if (!uid || !role) return null;

  return {
    uid,
    role,
    orgId: clean(payload.orgId || payload.org_id || payload.tenantId || payload.tenant_id) || null,
    actorRefId:
      clean(
        payload.actorRefId ||
          payload.actor_ref_id ||
          payload.clinicianId ||
          payload.clinician_id ||
          payload.patientId ||
          payload.patient_id,
      ) || null,
    workspace: clean(payload.workspace) || null,
    kind,
  };
}

async function readSignedInternalIdentity(req: NextRequest) {
  const value = clean(req.headers.get("x-ambulant-identity"));
  const secret = clean(
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET || process.env.INTERNAL_IDENTITY_SECRET,
  );
  if (!value || !secret) return null;

  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!(await verifyHmac(secret, encodedPayload, signature))) return null;
  const payload = decodeJsonSegment(encodedPayload);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) return null;

  return identityFromPayload(payload, "signed_internal");
}

async function readClientSessionIdentity(req: NextRequest, cookies: Record<string, string>) {
  const rawToken = clean(cookies[CLIENT_SESSION_TOKEN_COOKIE]);
  const baseSecret = clean(process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET);
  if (!rawToken || !baseSecret) return null;

  const payload = await verifyJwtHs256(rawToken, baseSecret, {
    issuer: CLIENT_SESSION_ISSUER,
    audience: CLIENT_SESSION_AUDIENCE,
  });
  if (!payload || payload.sessionType !== "client") return null;

  const role = clean(payload.role).toUpperCase();
  const identity = identityFromPayload(payload, "client_session", role);
  if (!identity || !identity.orgId) return null;
  return identity;
}

async function clinicianSessionSecret() {
  const explicit = clean(
    process.env.CLINICIAN_SESSION_SECRET ||
      process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET,
  );
  if (explicit) return explicit;

  const internal = clean(
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET || process.env.INTERNAL_IDENTITY_SECRET,
  );
  if (!internal) return "";
  return hmacBase64url(internal, "ambulant-clinician-session:v1");
}

async function readClinicianSessionIdentity(cookies: Record<string, string>) {
  const token = clean(cookies.ambulant_clinician_session);
  if (!token) return null;
  const secret = await clinicianSessionSecret();
  if (!secret) return null;

  const payload = await verifyJwtHs256(token, secret, {
    issuer: CLINICIAN_SESSION_ISSUER,
    audience: CLINICIAN_SESSION_AUDIENCE,
  });
  if (!payload) return null;

  const role = clean(payload.role).toLowerCase();
  if (!['clinician', 'admin', 'admin_staff'].includes(role)) return null;
  return identityFromPayload(payload, "clinician_session", role);
}

async function readGenericSessionIdentity(cookies: Record<string, string>) {
  const secret = clean(process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET);
  if (!secret) return null;

  for (const name of GENERIC_SESSION_COOKIES) {
    const token = clean(cookies[name]);
    if (!token) continue;
    const payload = await verifyJwtHs256(token, secret);
    if (!payload) continue;
    const identity = identityFromPayload(payload, "generic_session");
    if (identity) return identity;
  }

  return null;
}

async function resolveVerifiedIdentity(req: NextRequest) {
  const cookies = parseCookies(req.headers.get("cookie") || "");

  return (
    (await readSignedInternalIdentity(req)) ||
    (await readClientSessionIdentity(req, cookies)) ||
    (await readClinicianSessionIdentity(cookies)) ||
    (await readGenericSessionIdentity(cookies))
  );
}

function applyVerifiedIdentityHeaders(
  headers: Headers,
  identity: VerifiedIdentity,
  origins: {
    admin: boolean;
    client: boolean;
    patient: boolean;
    clinician: boolean;
    insightcore: boolean;
  },
) {
  headers.set("x-uid", identity.uid);
  headers.set("x-user-id", identity.uid);
  headers.set("x-ambulant-user-id", identity.uid);
  headers.set("x-role", identity.role);
  headers.set("x-ambulant-role", identity.role);

  if (identity.orgId) {
    headers.set("x-org-id", identity.orgId);
    headers.set("x-ambulant-org-id", identity.orgId);
  }

  if (identity.actorRefId) {
    headers.set("x-actor-ref-id", identity.actorRefId);
  }

  if (identity.role === "patient" && identity.actorRefId) {
    headers.set("x-patient-id", identity.actorRefId);
    headers.set("x-current-patient-id", identity.actorRefId);
  }

  if (identity.role === "clinician") {
    headers.set("x-clinician-id", identity.actorRefId || identity.uid);
  }

  if (identity.kind === "client_session") {
    headers.set("x-ambulant-trusted", "verified-client-session");
    if (identity.workspace) {
      headers.set("x-ambulant-workspace", identity.workspace);
    }
  } else {
    headers.set("x-ambulant-trusted", "verified-session");
  }

  if (origins.client && identity.kind === "client_session") {
    headers.set("x-client-origin", "verified-client-session");
  }
  if (origins.patient && identity.role === "patient") {
    headers.set("x-patient-origin", "verified-patient-session");
  }
  if (origins.clinician && identity.role === "clinician") {
    headers.set("x-clinician-origin", "verified-clinician-session");
  }
  if (
    origins.insightcore &&
    ["admin", "admin_staff"].includes(identity.role)
  ) {
    headers.set("x-insightcore-origin", "verified-admin-session");
  }
  if (origins.admin && ["admin", "admin_staff"].includes(identity.role)) {
    headers.set("x-admin-origin", "verified-admin-session");
  }
}

const INSIGHTCORE_AUTHORITY_VALUES = new Set([
  "manageroles",
  "tech",
  "compliance",
  "reports",
  "rnd",
  "admin",
  "superadmin",
  "super_admin",
  "owner",
]);

function canonicalAuthority(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s&_-]+/g, "");
}

async function hasInsightCoreStudioAccess(req: NextRequest) {
  try {
    const authUrl = new URL("/api/auth/me", req.nextUrl.origin);
    const response = await fetch(authUrl.toString(), {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") || "",
        authorization: req.headers.get("authorization") || "",
      },
      cache: "no-store",
    });

    if (!response.ok) return false;
    const body = (await response.json().catch(() => null)) as any;
    if (!body?.authenticated || !body?.user) return false;

    const values = [
      ...(Array.isArray(body.user.roles) ? body.user.roles : []),
      ...(Array.isArray(body.user.scopes) ? body.user.scopes : []),
    ]
      .map(canonicalAuthority)
      .filter(Boolean);

    return values.some((value) => INSIGHTCORE_AUTHORITY_VALUES.has(value));
  } catch {
    return false;
  }
}

const INSIGHTCORE_STUDIO_ALLOWED_SCOPE_OR_ROLE =
  new Set<string>(["admin","compliance","manageroles","owner","reports","rnd","super_admin","superadmin","tech"]);

type InsightCoreStudioGatewayMe = {
  authenticated?: boolean;
  user?: {
    roles?: string[];
    scopes?: string[];
  } | null;
};

type InsightCoreStudioAccess = {
  authenticated: boolean;
  allowed: boolean;
  unavailable: boolean;
};

function isInsightCoreStudioApiPath(pathname: string) {
  return (
    pathname === "/api/insightcore/studio" ||
    pathname.startsWith("/api/insightcore/studio/")
  );
}

async function resolveInsightCoreStudioAccess(
  request: NextRequest,
): Promise<InsightCoreStudioAccess> {
  try {
    const headers = new Headers({
      accept: "application/json",
    });

    const cookie =
      request.headers.get("cookie") || "";

    const authorization =
      request.headers.get("authorization") || "";

    if (cookie) {
      headers.set("cookie", cookie);
    }

    if (authorization) {
      headers.set(
        "authorization",
        authorization,
      );
    }

    /*
     * /api/auth/me is the canonical Gateway authority
     * for effective Admin roles and scopes.
     *
     * This is a same-Gateway request. The middleware guard
     * below only applies to /api/insightcore/studio/*, so
     * /api/auth/me does not recurse through this gate.
     */
    const response =
      await fetch(
        new URL(
          "/api/auth/me",
          request.url,
        ),
        {
          method: "GET",
          headers,
          cache: "no-store",
        },
      );

    if (!response.ok) {
      return {
        authenticated: false,
        allowed: false,
        unavailable: true,
      };
    }

    const me =
      (await response
        .json()
        .catch(() => null)) as
        InsightCoreStudioGatewayMe | null;

    if (!me?.authenticated || !me.user) {
      return {
        authenticated: false,
        allowed: false,
        unavailable: false,
      };
    }

    const values = [
      ...(
        Array.isArray(me.user.scopes)
          ? me.user.scopes
          : []
      ),
      ...(
        Array.isArray(me.user.roles)
          ? me.user.roles
          : []
      ),
    ]
      .map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);

    return {
      authenticated: true,
      allowed:
        values.some((value) =>
          INSIGHTCORE_STUDIO_ALLOWED_SCOPE_OR_ROLE
            .has(value),
        ),
      unavailable: false,
    };
  }
  catch {
    return {
      authenticated: false,
      allowed: false,
      unavailable: true,
    };
  }
}

export async function middleware(req: NextRequest) {
  /*
   * InsightCore Studio is privileged operational,
   * research and governance surface area.
   *
   * Frontend middleware is not a security boundary for
   * direct API Gateway callers, so enforce the same
   * canonical role/scope authority here.
   */
  if (
    req.method !== "OPTIONS" &&
    isInsightCoreStudioApiPath(
      req.nextUrl.pathname,
    )
  ) {
    const access =
      await resolveInsightCoreStudioAccess(
        req,
      );

    if (access.unavailable) {
      return applyCors(
        req,
        NextResponse.json(
          {
            ok: false,
            error:
              "insightcore_auth_authority_unavailable",
          },
          {
            status: 503,
            headers: {
              "cache-control": "no-store",
            },
          },
        ),
      );
    }

    if (!access.authenticated) {
      return applyCors(
        req,
        NextResponse.json(
          {
            ok: false,
            error:
              "insightcore_authentication_required",
          },
          {
            status: 401,
            headers: {
              "cache-control": "no-store",
            },
          },
        ),
      );
    }

    if (!access.allowed) {
      return applyCors(
        req,
        NextResponse.json(
          {
            ok: false,
            error:
              "insightcore_access_denied",
          },
          {
            status: 403,
            headers: {
              "cache-control": "no-store",
            },
          },
        ),
      );
    }
  }
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    return applyCors(req, new NextResponse(null, { status: 204 }));
  }

  if (pathname.startsWith("/api/insightcore/studio/")) {
    const allowed = await hasInsightCoreStudioAccess(req);
    if (!allowed) {
      return applyCors(
        req,
        NextResponse.json(
          { ok: false, error: "insightcore_studio_forbidden" },
          { status: 403 },
        ),
      );
    }
  }

  const requestHeaders = new Headers(req.headers);
  const originalOrigins = {
    admin: Boolean(req.headers.get("x-admin-origin")),
    client: Boolean(req.headers.get("x-client-origin")),
    patient: Boolean(req.headers.get("x-patient-origin")),
    clinician: Boolean(req.headers.get("x-clinician-origin")),
    insightcore: Boolean(req.headers.get("x-insightcore-origin")),
  };

  for (const name of IDENTITY_HEADERS) {
    requestHeaders.delete(name);
  }

  const identity = await resolveVerifiedIdentity(req);

  if (identity) {
    applyVerifiedIdentityHeaders(requestHeaders, identity, originalOrigins);
  } else {
    requestHeaders.delete("x-ambulant-identity");
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applyCors(req, response);
}

export const config = {
  matcher: ["/api/:path*"],
};
