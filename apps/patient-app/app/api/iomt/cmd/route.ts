import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Legacy Patient App MQTT command surface.
 *
 * This endpoint previously accepted a browser-supplied device/topic identifier
 * and published directly to MQTT. The only in-repo callers are unused legacy
 * components, so the surface is intentionally retired rather than preserving
 * an unauthorised actuation path.
 *
 * Future remote device command/control must be reintroduced through a
 * canonical server-side device-authority contract that resolves the
 * authenticated actor, persisted device ownership, and command policy before
 * any broker publication occurs.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'iomt_command_surface_retired',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
