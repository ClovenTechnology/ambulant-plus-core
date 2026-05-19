import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const orgId = searchParams.get("orgId") ?? "org-default";
    const type = searchParams.get("type") ?? undefined;
    const country = searchParams.get("country") ?? undefined;
    const includeInactive = searchParams.get("includeInactive") === "true";
    const status = searchParams.get("status") ?? undefined;

    const items = await prisma.client.findMany({
      where: {
        orgId,
        ...(includeInactive
          ? status
            ? { status: status as any }
            : {}
          : { status: "ACTIVE" as any }),
        ...(type ? { type: type as any } : {}),
        ...(country ? { country } : {}),
      },
      orderBy: [{ legalName: "asc" }],
      take: 300,
      select: {
        id: true,
        orgId: true,
        type: true,
        status: true,
        legalName: true,
        tradingName: true,
        code: true,
        country: true,
        defaultCurrency: true,
        billingMode: true,
        claimsSubmissionMode: true,
        eligibilityMode: true,
        supportsTelevisit: true,
        supportsInPerson: true,
        requiresConsentForClaims: true,
        requiresConsentForVitals: true,
        requiresConsentForReports: true,
        allowsClaims: true,
        allowsWalletFunding: true,
        allowsHybridFunding: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { ok: true, items },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch clients.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.type) {
      return NextResponse.json({ ok: false, error: "type_required" }, { status: 400 });
    }

    if (!body?.legalName) {
      return NextResponse.json({ ok: false, error: "legalName_required" }, { status: 400 });
    }

    if (!body?.code) {
      return NextResponse.json({ ok: false, error: "code_required" }, { status: 400 });
    }

    const item = await prisma.client.create({
      data: {
        orgId: body.orgId ?? "org-default",
        type: body.type,
        status: body.status ?? "DRAFT",
        legalName: body.legalName,
        tradingName: body.tradingName ?? null,
        code: body.code,
        billingMode: body.billingMode ?? "HYBRID",
        defaultCurrency: body.defaultCurrency ?? "ZAR",
        country: body.country ?? "ZA",

        claimsSubmissionMode: body.claimsSubmissionMode ?? "MANUAL_REVIEW",
        eligibilityMode: body.eligibilityMode ?? "UPLOAD",

        supportsTelevisit: body.supportsTelevisit ?? true,
        supportsInPerson: body.supportsInPerson ?? true,
        requiresConsentForClaims: body.requiresConsentForClaims ?? false,
        requiresConsentForVitals: body.requiresConsentForVitals ?? true,
        requiresConsentForReports: body.requiresConsentForReports ?? true,

        allowsClaims: body.allowsClaims ?? true,
        allowsWalletFunding: body.allowsWalletFunding ?? true,
        allowsHybridFunding: body.allowsHybridFunding ?? true,

        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        apiBaseUrl: body.apiBaseUrl ?? null,

        contractStartAt: body.contractStartAt ? new Date(body.contractStartAt) : undefined,
        contractEndAt: body.contractEndAt ? new Date(body.contractEndAt) : undefined,
        paymentTermsDays: body.paymentTermsDays ?? 30,

        contactsJson: body.contactsJson ?? undefined,
        configJson: body.configJson ?? undefined,
        metadata: body.metadata ?? undefined,
        payerMetadata: body.payerMetadata ?? undefined,
      } as any,
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create client.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}