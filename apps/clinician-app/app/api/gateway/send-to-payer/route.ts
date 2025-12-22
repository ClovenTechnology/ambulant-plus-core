// apps/clinician-app/app/api/gateway/send-to-payer/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { buildSendToPayerPayload, type BuildSendToPayerInput } from '@/lib/sendToPayer';

/**
 * POST /api/gateway/send-to-payer
 *
 * Expects a body compatible with BuildSendToPayerInput.
 * It normalizes the claim and (optionally) forwards to an external gateway.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<BuildSendToPayerInput>;

    if (!body.encounterId) {
      return NextResponse.json(
        { error: 'encounterId is required' },
        { status: 400 }
      );
    }
    if (!body.patient?.id || !body.patient?.name) {
      return NextResponse.json(
        { error: 'patient.id and patient.name are required' },
        { status: 400 }
      );
    }
    if (!body.clinician?.id) {
      return NextResponse.json(
        { error: 'clinician.id is required' },
        { status: 400 }
      );
    }

    const payload = buildSendToPayerPayload(body as BuildSendToPayerInput);

    const gatewayBase = process.env.GATEWAY_CLAIMS_URL;

    // If you haven’t wired the real gateway yet, just echo the payload.
    if (!gatewayBase) {
      console.warn('[send-to-payer] GATEWAY_CLAIMS_URL not configured. Returning payload only.');
      return NextResponse.json(
        {
          ok: true,
          forwarded: false,
          reason: 'GATEWAY_CLAIMS_URL not configured',
          payload,
        },
        { status: 200 }
      );
    }

    const url = new URL('/send-to-payer', gatewayBase).toString();

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      console.error('[send-to-payer] gateway error', res.status, parsed);
      return NextResponse.json(
        {
          ok: false,
          error: 'Gateway returned non-2xx response',
          statusCode: res.status,
          gatewayResponse: parsed,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        forwarded: true,
        gatewayResponse: parsed,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[send-to-payer] unexpected error', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to send claim to payer',
        message: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
