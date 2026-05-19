import { NextRequest, NextResponse } from "next/server";
import { runCoveragePreflight } from "@ambulant/client-core/src/preflight";

type Body = {
  orgId?: string;
  patientId: string;
  clinicianId?: string;
  serviceType:
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
  visitMode?: "TELEVISIT" | "IN_PERSON" | "HYBRID";
  requestedAmountMinor?: number;
  clientId?: string;
};

function isValidBody(body: unknown): body is Body {
  if (!body || typeof body !== "object") return false;
  const x = body as Record<string, unknown>;
  return typeof x.patientId === "string" && typeof x.serviceType === "string";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;

    if (!isValidBody(body)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid request body. patientId and serviceType are required."
        },
        { status: 400 }
      );
    }

    const result = await runCoveragePreflight(body);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while running coverage preflight.";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}