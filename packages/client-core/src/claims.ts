import prisma, { PrismaTx, dbOrTx } from "./lib/prisma";

export type BuildClaimFromEventsInput = {
  orgId?: string;
  clientId: string;
  claimType: "MEDICAL_AID_CLAIM" | "CORPORATE_CLAIM" | "SPONSOR_INVOICE";
  currency?: string;
  notes?: string;
  billableEventIds?: string[];
  tx?: PrismaTx;
};

function claimNumber(prefix: string) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${yyyy}${mm}${dd}-${rand}`;
}

export async function buildClaimFromBillableEvents(input: BuildClaimFromEventsInput) {
  const orgId = input.orgId ?? "org-default";
  const db = dbOrTx(input.tx);

  const events = await db.billableEvent.findMany({
    where: {
      orgId,
      clientId: input.clientId,
      sponsorAmountMinor: { gt: 0 },
      status: { in: ["READY", "INVOICED"] },
      ...(input.billableEventIds?.length
        ? { id: { in: input.billableEventIds } }
        : {})
    },
    orderBy: [{ createdAt: "asc" }]
  });

  if (events.length === 0) {
    throw new Error("No sponsor-backed billable events found for claim creation.");
  }

  const submittedAmountMinor = events.reduce((sum, evt) => sum + (evt.sponsorAmountMinor ?? 0), 0);

  const prefix =
    input.claimType === "MEDICAL_AID_CLAIM"
      ? "CLAIM"
      : input.claimType === "CORPORATE_CLAIM"
        ? "CORP"
        : "INV";

  const run = async (tx: PrismaTx) => {
    const claim = await tx.clientClaim.create({
      data: {
        orgId,
        clientId: input.clientId,
        claimType: input.claimType,
        status: "DRAFT",
        claimNumber: claimNumber(prefix),
        currency: input.currency ?? "ZAR",
        submittedAmountMinor,
        notes: input.notes
      }
    });

    for (const evt of events) {
      await tx.clientClaimLine.create({
        data: {
          claimId: claim.id,
          billableEventId: evt.id,
          submittedAmountMinor: evt.sponsorAmountMinor ?? 0,
          approvedAmountMinor: 0,
          paidAmountMinor: 0,
          metadata: {
            serviceType: evt.serviceType,
            providerLane: evt.providerLane,
            providerId: evt.providerId
          }
        }
      });

      await tx.billableEvent.update({
        where: { id: evt.id },
        data: {
          status: "CLAIMED"
        }
      });
    }

    return tx.clientClaim.findUnique({
      where: { id: claim.id },
      include: {
        lines: true
      }
    });
  };

  if (input.tx) {
    return run(input.tx);
  }

  return prisma.$transaction(run);
}