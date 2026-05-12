import type { Prisma } from '@prisma/client';
import prisma, { PrismaTx, dbOrTx } from "./lib/prisma";
import { runCoveragePreflight } from "./preflight";
import { createCoverageAuthorization } from "./authorizations";
import { createBillableEvent } from "./billing";

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export type SponsorBookingInput = {
  orgId?: string;
  patientId: string;
  clinicianId: string;
  appointmentId?: string;
  encounterId?: string;
  serviceType: "CONSULT_STANDARD" | "CONSULT_FOLLOWUP" | "CONSULT_PROCEDURE" | "PHYSICAL_VISIT";
  visitMode?: "TELEVISIT" | "IN_PERSON" | "HYBRID";
  requestedAmountMinor: number;
  clientId?: string;
  userId?: string;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
};

export async function computeSponsorBooking(input: SponsorBookingInput) {
  const preflight = await runCoveragePreflight({
    orgId: input.orgId,
    patientId: input.patientId,
    clinicianId: input.clinicianId,
    serviceType: input.serviceType,
    visitMode: input.visitMode,
    requestedAmountMinor: input.requestedAmountMinor,
    clientId: input.clientId,
    tx: input.tx
  });

  let authorizationId: string | undefined;

  if (
    preflight.authorizationRequired &&
    preflight.clientId &&
    preflight.clientMemberId &&
    preflight.coveragePlanId
  ) {
    const auth = await createCoverageAuthorization({
      orgId: input.orgId,
      clientId: preflight.clientId,
      coveragePlanId: preflight.coveragePlanId,
      clientMemberId: preflight.clientMemberId,
      userId: input.userId,
      patientId: input.patientId,
      scopeType: input.appointmentId ? "APPOINTMENT" : "ENCOUNTER",
      scopeId: input.appointmentId ?? input.encounterId ?? `pending-${Date.now()}`,
      serviceType: input.serviceType,
      requestedAmountMinor: input.requestedAmountMinor,
      currency: preflight.currency,
      ruleSnapshot: preflight.ruleSnapshot,
      metadata: {
        source: "appointments.booking",
        sponsorBooking: true
      },
      tx: input.tx,
      idempotencyKey: input.idempotencyKey
    });

    authorizationId = auth.id;
  }

  return {
    ...preflight,
    authorizationId
  };
}

export async function attachSponsorToAppointment(args: {
  appointmentId: string;
  encounterId?: string | null;
  orgId?: string;
  patientId: string;
  clinicianId: string;
  serviceType: "CONSULT_STANDARD" | "CONSULT_FOLLOWUP" | "CONSULT_PROCEDURE" | "PHYSICAL_VISIT";
  visitMode?: "TELEVISIT" | "IN_PERSON" | "HYBRID";
  requestedAmountMinor: number;
  clientId?: string;
  userId?: string;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
}) {
  const db = dbOrTx(args.tx);

  const sponsor = await computeSponsorBooking({
    orgId: args.orgId,
    patientId: args.patientId,
    clinicianId: args.clinicianId,
    appointmentId: args.appointmentId,
    encounterId: args.encounterId ?? undefined,
    serviceType: args.serviceType,
    visitMode: args.visitMode,
    requestedAmountMinor: args.requestedAmountMinor,
    clientId: args.clientId,
    userId: args.userId,
    tx: args.tx,
    idempotencyKey: args.idempotencyKey
  });

  await db.appointment.update({
    where: { id: args.appointmentId },
    data: {
      clientId: sponsor.clientId,
      clientMemberId: sponsor.clientMemberId,
      coveragePlanId: sponsor.coveragePlanId,
      coverageAuthorizationId: sponsor.authorizationId,
      coverageDecision: sponsor.decision,
      sponsorAmountMinor: sponsor.sponsorAmountMinor,
      patientCopayMinor: sponsor.patientCopayMinor,
      sponsorCurrency: sponsor.currency,
      sponsorPricingSnapshot: jsonInput(sponsor.ruleSnapshot)
    }
  });

  if (args.encounterId) {
    await db.encounter.update({
      where: { id: args.encounterId },
      data: {
        clientId: sponsor.clientId,
        clientMemberId: sponsor.clientMemberId,
        coveragePlanId: sponsor.coveragePlanId,
        sponsorSnapshot: jsonInput(sponsor.ruleSnapshot)
      }
    }).catch(() => null);
  }

  return sponsor;
}

export async function buildConsultBillableEvent(args: {
  orgId?: string;
  appointmentId: string;
  encounterId?: string | null;
  patientId: string;
  userId?: string;
  clientId?: string | null;
  clientMemberId?: string | null;
  authorizationId?: string | null;
  clinicianId: string;
  serviceType: "CONSULT_STANDARD" | "CONSULT_FOLLOWUP" | "CONSULT_PROCEDURE" | "PHYSICAL_VISIT";
  grossAmountMinor: number;
  sponsorAmountMinor: number;
  patientAmountMinor: number;
  platformAmountMinor: number;
  providerAmountMinor: number;
  pricingSnapshot?: Record<string, unknown>;
  tx?: PrismaTx;
  idempotencyKey?: string | null;
}) {
  return createBillableEvent({
    orgId: args.orgId,
    clientId: args.clientId ?? undefined,
    clientMemberId: args.clientMemberId ?? undefined,
    authorizationId: args.authorizationId ?? undefined,
    encounterId: args.encounterId ?? undefined,
    appointmentId: args.appointmentId,
    patientId: args.patientId,
    userId: args.userId,
    serviceType: args.serviceType,
    providerLane: "CLINICIAN",
    providerId: args.clinicianId,
    responsibility:
      args.sponsorAmountMinor > 0 && args.patientAmountMinor > 0
        ? "SPLIT"
        : args.sponsorAmountMinor > 0
          ? "CLIENT"
          : "PATIENT",
    currency: "ZAR",
    grossAmountMinor: args.grossAmountMinor,
    sponsorAmountMinor: args.sponsorAmountMinor,
    patientAmountMinor: args.patientAmountMinor,
    platformAmountMinor: args.platformAmountMinor,
    providerAmountMinor: args.providerAmountMinor,
    pricingSnapshot: args.pricingSnapshot,
    metadata: {
      source: "appointments.book",
      lane: "consultation"
    },
    serviceAt: new Date().toISOString(),
    tx: args.tx,
    idempotencyKey: args.idempotencyKey
  });
}