import { NextRequest } from 'next/server';
import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';
import { bus } from '../_bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function patientChannel(patientId: string) {
  return `patient:${patientId}`;
}

export async function GET(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);

  if (!identity) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'unauthorized',
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  // Existing callers may continue supplying ?roomId=... while they migrate.
  // Channel authority is derived exclusively from the verified patient
  // identity and never from the browser-controlled query string.
  const channel = patientChannel(identity.patientId);

  let ka: NodeJS.Timeout | null = null;
  let onVital: ((evt: any) => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const enc = (data: any) =>
        controller.enqueue(
          new TextEncoder().encode(
            `event: vitals\ndata:${JSON.stringify(data)}\n\n`,
          ),
        );

      onVital = (evt: any) => {
        if (evt?.channel === channel) {
          enc(evt.data);
        }
      };

      bus.on('vitals', onVital);

      ka = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(':\n\n'),
          );
        } catch {
          // Ignore keepalive writes after the stream is closed.
        }
      }, 15000);
    },

    cancel() {
      if (onVital) {
        bus.off('vitals', onVital);
      }

      if (ka) {
        clearInterval(ka);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform, no-store',
      Connection: 'keep-alive',
    },
  });
}
