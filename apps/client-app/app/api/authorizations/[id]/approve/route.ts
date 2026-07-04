import { NextRequest, NextResponse } from "next/server";

type SessionPayload = {
  uid?: string | null;
  userId?: string | null;
  id?: string | null;
  sub?: string | null;
  orgId?: string | null;
  role?: string | null;
  workspace?: string | null;
  email?: string | null;
};

type Params = {
  params: {
    id: string;
  };
};

function apigwBase() {
  return (
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.APIGW_BASE ||
    ((process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010')
  );
}

function safeParseSession(value: string | undefined): SessionPayload | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function sessionUserId(session: SessionPayload | null) {
  return (
    String(
      session?.uid ||
        session?.userId ||
        session?.id ||
        session?.sub ||
        ""
    ).trim() || null
  );
}

function identityHeaders(req: NextRequest, session: SessionPayload | null) {
  const actorUserId = sessionUserId(session);

  return {
    "content-type": "application/json",
    "x-idempotency-key":
      req.headers.get("x-idempotency-key") ||
      `client-auth-approve:${Date.now()}`,
    "x-ambulant-user-id": actorUserId || "dev-client-console-actor",
    "x-ambulant-org-id": session?.orgId || "org-default",
    "x-ambulant-role": session?.role || "ORG_OWNER",
    "x-ambulant-workspace": session?.workspace || "payer_ops",
    "x-ambulant-trusted": "true",
  };
}

function friendlyError(message: string) {
  if (message.includes("Can't reach database server")) {
    return "Database connection is temporarily unavailable. Please retry after the api-gateway reconnects.";
  }

  if (message.includes("actorUserId")) {
    return "This action could not be audited because the acting user was not resolved.";
  }

  if (message.includes("idempotency")) {
    return "This action could not complete because the request audit/idempotency check failed.";
  }

  return message.length > 240 ? `${message.slice(0, 240)}…` : message;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = safeParseSession(
      req.cookies.get("ambulant_client_session")?.value
    );

    if (!sessionUserId(session)) {
      return NextResponse.json(
        { ok: false, error: "Please log in again before approving authorizations." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const res = await fetch(
      `${apigwBase()}/api/authorizations/${params.id}/approve`,
      {
        method: "POST",
        headers: identityHeaders(req, session),
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || json?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error: friendlyError(json?.error || "Failed to approve authorization."),
        },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json(json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve authorization.";

    return NextResponse.json(
      { ok: false, error: friendlyError(message) },
      { status: 500 }
    );
  }
}