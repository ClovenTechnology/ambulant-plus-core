import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { runCoveragePreflight } from "@ambulant/client-core/src/preflight";
import { createCoverageAuthorization } from "@ambulant/client-core/src/authorizations";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServiceType =
  | "CONSULT_STANDARD"
  | "CONSULT_FOLLOWUP"
  | "CONSULT_PROCEDURE"
  | "PHYSICAL_VISIT"
  | "LAB_TEST"
  | "PHLEB_DRAW"
  | "LAB_LOGISTICS"
  | "PHARMACY_ITEM"
  | "PHARMACY_DISPENSING"
  | "RIDER_DELIVERY"
  | "DEVICE_PURCHASE"
  | "DEVICE_RENTAL"
  | "DEVICE_ASSIGNMENT"
  | "DEVICE_MAINTENANCE"
  | "DEVICE_SWAP";

type ScopeType =
  | "APPOINTMENT"
  | "ENCOUNTER"
  | "LAB_ORDER"
  | "DRAW"
  | "ERX_ORDER"
  | "CAREPORT_ORDER"
  | "DEVICE_ORDER"
  | "DELIVERY"
  | "BUNDLE";

type Body = {
  orgId?: string;
  patientId?: string;
  clinicianId?: string;
  serviceType?: ServiceType;
  visitMode?: "TELEVISIT" | "IN_PERSON" | "HYBRID";
  requestedAmountMinor?: number;
  clientId?: string;
  scopeType?: ScopeType;
  scopeId?: string;
  requestedByUserId?: string;
};

function defaultScopeTypeForService(serviceType: string): ScopeType {
  switch (serviceType) {
    case "LAB_TEST":
      return "LAB_ORDER";
    case "PHLEB_DRAW":
      return "DRAW";
    case "PHARMACY_ITEM":
    case "PHARMACY_DISPENSING":
      return "ERX_ORDER";
    case "DEVICE_PURCHASE":
    case "DEVICE_RENTAL":
    case "DEVICE_ASSIGNMENT":
    case "DEVICE_MAINTENANCE":
    case "DEVICE_SWAP":
      return "DEVICE_ORDER";
    case "RIDER_DELIVERY":
      return "DELIVERY";
    default:
      return "ENCOUNTER";
  }
}

function cleanScopeId(value: unknown) {
  const raw = String(value || "").trim();
  return raw || null;
}

function deterministicScopeId(args: {
  patientId: string;
  serviceType: string;
  requestedAmountMinor: number;
}) {
  return [
    "preflight",
    args.patientId,
    args.serviceType,
    String(args.requestedAmountMinor),
  ]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 120);
}

function actorUserIdFrom(req: NextRequest, body: Body) {
  const actor = String(
    body.requestedByUserId ||
      req.headers.get("x-ambulant-user-id") ||
      ""
  ).trim();

  if (actor) return actor;

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return "dev-client-console-actor";
}

function isAuthorizationRequired(preflight: any) {
  return Boolean(
    preflight?.authorizationRequired === true ||
      preflight?.requiresAuthorization === true ||
      String(preflight?.decision || "").toUpperCase() === "REQUIRES_AUTHORIZATION" ||
      preflight?.ruleSnapshot?.preauthRequired === true ||
      preflight?.ruleSnapshot?.decision === "REQUIRES_AUTHORIZATION"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const orgId = body.orgId || "org-default";
    const patientId = String(body.patientId || "").trim();
    const serviceType = String(body.serviceType || "").trim() as ServiceType;
    const requestedAmountMinor = Number(body.requestedAmountMinor || 0);

    const actorUserId = actorUserIdFrom(req, body);

    if (!actorUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: "actorUserId is required.",
        },
        { status: 401 }
      );
    }

    if (!patientId || !serviceType) {
      return NextResponse.json(
        {
          ok: false,
          error: "patientId and serviceType are required.",
        },
        { status: 400 }
      );
    }

    const preflight = await runCoveragePreflight({
      orgId,
      patientId,
      clinicianId: body.clinicianId || undefined,
      serviceType,
      visitMode: body.visitMode || undefined,
      requestedAmountMinor,
      clientId: body.clientId || undefined,
    });

    if (!isAuthorizationRequired(preflight)) {
      return NextResponse.json(
        {
          ok: false,
          error: "authorization_not_required",
          preflight,
        },
        { status: 400 }
      );
    }

    if (!preflight.clientId || !preflight.clientMemberId || !preflight.coveragePlanId) {
      return NextResponse.json(
        {
          ok: false,
          error: "preflight_missing_authorization_context",
          preflight,
        },
        { status: 400 }
      );
    }

    const scopeType = body.scopeType || defaultScopeTypeForService(serviceType);
    const scopeId =
      cleanScopeId(body.scopeId) ||
      deterministicScopeId({
        patientId,
        serviceType,
        requestedAmountMinor,
      });

    const existing = await prisma.coverageAuthorization.findFirst({
      where: {
        orgId,
        patientId,
        serviceType,
        scopeType,
        scopeId,
        status: "PENDING",
      },
      orderBy: [{ requestedAt: "desc" }],
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        item: existing,
        preflight,
        duplicate: true,
      });
    }

    const item = await createCoverageAuthorization({
      orgId,
      clientId: preflight.clientId,
      coveragePlanId: preflight.coveragePlanId,
      clientMemberId: preflight.clientMemberId,
      userId: actorUserId,
      patientId,
      scopeType,
      scopeId,
      serviceType,
      requestedAmountMinor,
      currency: preflight.currency,
      ruleSnapshot: {
        ...(preflight.ruleSnapshot || {}),
        preflightDecision: preflight.decision,
        preflightReason: preflight.reason,
        sponsorAmountMinor: preflight.sponsorAmountMinor,
        patientCopayMinor: preflight.patientCopayMinor,
        uncoveredGapMinor: preflight.uncoveredGapMinor,
        authorizationRequired: true,
      },
      metadata: {
        source: "coverage.preflight",
        createdFromPreflight: true,
        preflightDecision: preflight.decision,
        preflightReason: preflight.reason,
        sponsorAmountMinor: preflight.sponsorAmountMinor,
        patientCopayMinor: preflight.patientCopayMinor,
        uncoveredGapMinor: preflight.uncoveredGapMinor,
        clinicianId: body.clinicianId || null,
        visitMode: body.visitMode || null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        item,
        preflight,
        duplicate: false,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create authorization from preflight.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}