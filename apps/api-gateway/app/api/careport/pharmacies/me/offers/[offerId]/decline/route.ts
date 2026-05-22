// apps/api-gateway/app/api/careport/pharmacies/me/offers/[offerId]/decline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { correlationIdFromHeaders, orgIdFromHeaders, pharmacyIdForStaff, requireRole } from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = cleanString(req.nextUrl.searchParams.get("pharmacyId"));

  if (who.role === "admin" && explicit) return explicit;
  if (who.role === "pharmacy" && who.uid) return String(who.uid);

  if (who.role === "pharmacy_staff" && who.uid) {
    const pid = await pharmacyIdForStaff(orgId, who.uid);
    return pid ? String(pid) : null;
  }

  return null;
}

export async function POST(req: NextRequest, { params }: { params: { offerId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);

    const offerId = cleanString(params.offerId);
    if (!offerId) {
      return NextResponse.json({ ok: false, error: "offerId_required" }, { status: 400 });
    }

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) {
      return NextResponse.json({ ok: false, error: "pharmacyId_unresolved" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = cleanString(body?.reason) || null;

    const offer = await prisma.carePortOffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.orgId !== orgId || offer.pharmacyId !== pharmacyId) {
      return NextResponse.json({ ok: false, error: "offer_not_found" }, { status: 404 });
    }

    if (offer.status !== "INVITED") {
      return NextResponse.json({ ok: false, error: `offer_not_declineable:${offer.status}` }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.carePortOffer.update({
        where: { id: offerId },
        data: { status: "DECLINED" },
      });

      await tx.auditEvent.create({
        data: {
          kind: "careport_offer_declined",
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: offerId,
          meta: {
            correlationId,
            orgId,
            orderId: offer.orderId,
            pharmacyId,
            reason,
          },
        },
      });

      return row;
    });

    return NextResponse.json({ ok: true, offer: updated }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "error", correlationId },
      { status: e?.status || 500 },
    );
  }
}
