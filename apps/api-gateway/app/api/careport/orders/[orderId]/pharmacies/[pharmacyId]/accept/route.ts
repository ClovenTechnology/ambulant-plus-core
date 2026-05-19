//apps/api-gateway/app/api/careport/orders/[orderId]/pharmacies/[pharmacyId]/accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import {
  correlationIdFromHeaders,
  ensureCurrency,
  orgIdFromHeaders,
  pharmacyIdForStaff,
  requireRole,
} from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StockFlag = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string; pharmacyId: string } }
) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    // Enforce pharmacy staff RBAC via CarePortPharmacyStaff mapping
    requireRole(who, ["admin", "pharmacy", "pharmacy_staff"]);
    const orderId = String(params.orderId || "").trim();
    const pharmacyId = String(params.pharmacyId || "").trim();
    if (!orderId || !pharmacyId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

    if (who.role !== "admin") {
      const staffPharmacyId = await pharmacyIdForStaff(orgId, who.uid || "");
      if (!staffPharmacyId || staffPharmacyId !== pharmacyId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const b = await req.json().catch(() => ({}));
    const prepEtaMin = b?.prepEtaMin != null ? Number(b.prepEtaMin) : null;
    const stockFlags: Record<string, StockFlag> = (b?.stockFlags ?? {}) as any;

    const pharmacy = await prisma.pharmacyPartner.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) return NextResponse.json({ error: "pharmacy_not_found" }, { status: 404 });

    if (!pharmacy.country || !pharmacy.currency) {
      return NextResponse.json({ error: "pharmacy_missing_country_or_currency" }, { status: 409 });
    }

    const order = await prisma.carePortOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

    // Load catalog once
    const [skus, links] = await Promise.all([
      prisma.carePortPharmacySku.findMany({
        where: { pharmacyId, orgId, isActive: true },
        orderBy: [{ isGeneric: "asc" }, { priceCents: "asc" }],
      }),
      prisma.carePortGenericLink.findMany({ where: { pharmacyId, orgId } }),
    ]);

    // Enforce SKU currency correctness
    for (const s of skus) ensureCurrency(pharmacy.currency, s.currency, `sku:${s.id}`);

    const linksByOriginal = new Map<string, string[]>();
    for (const l of links) {
      const list = linksByOriginal.get(l.originalSkuId) ?? [];
      list.push(l.genericSkuId);
      linksByOriginal.set(l.originalSkuId, list);
    }

    function matchSkusForItem(item: any) {
      const drugCode = String(item.drugCode ?? "").trim();
      let matches = drugCode ? skus.filter((s) => (s.drugCode ?? "") === drugCode) : [];

      if (!matches.length) {
        // fallback: soft match by name token overlap
        const needle = String(item.name ?? "").toLowerCase();
        matches = skus.filter((s) => String(s.name).toLowerCase().includes(needle.split(" ")[0] || needle));
      }

      const options: { skuId: string; isGeneric: boolean; priceCents: number; currency: string }[] = [];

      const originals = matches.filter((m) => !m.isGeneric);
      const genericsDirect = matches.filter((m) => m.isGeneric);

      for (const o of originals) {
        options.push({ skuId: o.id, isGeneric: false, priceCents: o.priceCents, currency: o.currency });
        const gens = linksByOriginal.get(o.id) ?? [];
        for (const gid of gens) {
          const g = skus.find((x) => x.id === gid);
          if (g) options.push({ skuId: g.id, isGeneric: true, priceCents: g.priceCents, currency: g.currency });
        }
      }

      for (const g of genericsDirect) {
        if (!options.some((x) => x.skuId === g.id)) {
          options.push({ skuId: g.id, isGeneric: true, priceCents: g.priceCents, currency: g.currency });
        }
      }

      // Stable ordering: original first, then cheaper generics
      options.sort((a, b) => Number(a.isGeneric) - Number(b.isGeneric) || a.priceCents - b.priceCents);

      return options;
    }

    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.carePortOffer.upsert({
        where: { orderId_pharmacyId: { orderId, pharmacyId } },
        update: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          prepEtaMin: prepEtaMin && Number.isFinite(prepEtaMin) ? Math.max(1, Math.floor(prepEtaMin)) : null,
          currency: pharmacy.currency!, // enforce
        } as any,
        create: {
          orgId,
          orderId,
          pharmacyId,
          status: "ACCEPTED",
          acceptedAt: new Date(),
          prepEtaMin: prepEtaMin && Number.isFinite(prepEtaMin) ? Math.max(1, Math.floor(prepEtaMin)) : null,
          currency: pharmacy.currency!,
        } as any,
      });

      // Replace lines/options (keeps constraints sane)
      await tx.carePortOfferLineOption.deleteMany({ where: { line: { offerId: offer.id } } as any });
      await tx.carePortOfferLine.deleteMany({ where: { offerId: offer.id } });

      let isPartial = false;
      let subtotalMin = 0;

      for (const item of order.items) {
        const options = matchSkusForItem(item);

        let flag: StockFlag = "AVAILABLE";
        const keyCandidates = [item.id, item.erxMedKey, item.drugCode].filter(Boolean).map(String);
        for (const k of keyCandidates) {
          const v = stockFlags[k];
          if (v) {
            flag = v;
            break;
          }
        }

        if (!options.length) flag = "UNAVAILABLE";
        if (flag !== "AVAILABLE") isPartial = true;

        const line = await tx.carePortOfferLine.create({
          data: {
            offerId: offer.id,
            orderItemId: item.id,
            stockFlag: flag,
          },
        });

        if (options.length) {
          await tx.carePortOfferLineOption.createMany({
            data: options.map((o) => ({
              lineId: line.id,
              skuId: o.skuId,
              isGeneric: o.isGeneric,
              priceCents: o.priceCents,
              currency: o.currency,
            })),
            skipDuplicates: true,
          });

          const cheapest = options.reduce((min, o) => Math.min(min, o.priceCents), options[0].priceCents);
          subtotalMin += cheapest * item.quantity;
        }
      }

      const updated = await tx.carePortOffer.update({
        where: { id: offer.id },
        data: { isPartial, subtotalCents: subtotalMin },
      });

      await tx.auditEvent.create({
        data: {
          kind: "careport_offer_accepted",
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: offer.id,
          meta: { correlationId, orgId, orderId, pharmacyId, prepEtaMin, isPartial },
        },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, offer: result }, { status: 200, headers: { "access-control-allow-origin": "*" } });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "error", correlationId }, { status });
  }
}