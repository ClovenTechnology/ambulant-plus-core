// FILE: apps/api-gateway/app/api/careport/riders/[userId]/kyi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { COUNTRY_CONFIG, validateRiderKyi } from "@/src/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveOrgId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  return String(
    who.orgId ||
      req.headers.get("x-org-id") ||
      req.headers.get("x-ambulant-org-id") ||
      "",
  ).trim();
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const who = readIdentity(req.headers);
  if (who.role !== "admin" && who.role !== "rider") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const userId = String(params.userId || "").trim();
  if (!userId) return NextResponse.json({ ok: false, error: "userId_required" }, { status: 400 });

  if (who.role === "rider" && String(who.uid || "").trim() !== userId) {
    return NextResponse.json({ ok: false, error: "forbidden_rider_user_scope" }, { status: 403 });
  }

  const orgId = resolveOrgId(req, who);
  if (!orgId) return NextResponse.json({ ok: false, error: "orgId_required" }, { status: 400 });

  const existing = await prisma.carePortRiderProfile.findUnique({ where: { userId } });
  if (existing?.orgId && existing.orgId !== orgId) {
    return NextResponse.json({ ok: false, error: "cross_org_rider_profile_access_denied" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const country = String(body?.country || "ZA").toUpperCase() as keyof typeof COUNTRY_CONFIG;
  const schemaKey = String(body?.schemaKey || "ZA_RIDER_KYI_v1") as any;
  const payload = body?.payload ?? null;

  const cfg = COUNTRY_CONFIG[country];
  if (!cfg) return NextResponse.json({ ok: false, error: "unsupported_country" }, { status: 400 });

  const v = validateRiderKyi(country as any, schemaKey, payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: "invalid_payload", issues: v.errors }, { status: 400 });

  const updated = await prisma.carePortRiderProfile.upsert({
    where: { userId },
    update: {
      country,
      currency: cfg.currency,
      kyiSchemaKey: schemaKey,
      kyiPayload: v.data as any,
      kyiSubmittedAt: new Date(),
      kyiVerifiedAt: null,
      kyiRejectedReason: null,
      kyiStatus: "PENDING_REVIEW",
      isActive: false,
      isOnJob: false,
    } as any,
    create: {
      orgId,
      userId,
      country,
      currency: cfg.currency,
      kyiSchemaKey: schemaKey,
      kyiPayload: v.data as any,
      kyiSubmittedAt: new Date(),
      kyiVerifiedAt: null,
      kyiRejectedReason: null,
      kyiStatus: "PENDING_REVIEW",
      isActive: false,
      isOnJob: false,

    } as any,
  });

  return NextResponse.json({ ok: true, rider: updated }, { status: 200 });
}