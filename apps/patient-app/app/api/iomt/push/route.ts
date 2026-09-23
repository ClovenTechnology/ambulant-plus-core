import { NextRequest, NextResponse } from 'next/server';
import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';
import { bus } from '../_bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function patientChannel(patientId: string) {
  return `patient:${patientId}`;
}

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);

  if (!identity) {
    return json(
      {
        ok: false,
        error: 'unauthorized',
      },
      401,
    );
  }

  const body = await req.json().catch(() => null);

  // Keep the established roomId request shape for existing callers, but it is
  // compatibility metadata only. It is never used as channel authority.
  if (
    !body?.roomId ||
    !body?.type ||
    typeof body?.value !== 'number'
  ) {
    return json(
      {
        ok: false,
        error: 'bad_payload',
      },
      400,
    );
  }

  bus.emit('vitals', {
    channel: patientChannel(identity.patientId),
    data: {
      t: new Date().toISOString(),
      type: body.type,
      value: body.value,
      unit: body.unit,
    },
  });

  return json({ ok: true });
}
