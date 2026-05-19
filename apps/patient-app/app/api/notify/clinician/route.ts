// apps/patient-app/app/api/notify/clinician/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notifyClinicianFCM } from '@/src/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Production-safe clinician notification endpoint.
 *
 * Demo FCM token fallback has been removed. This must be wired to a real
 * clinician device-token store before push delivery is enabled.
 */
async function getClinicianTokens(_clinicianId: string): Promise<string[]> {
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const { clinicianId, title, body, data } = await req.json().catch(() => ({}));

    if (!clinicianId || !title || !body) {
      return json({ ok: false, error: 'missing_fields' }, 400);
    }

    const tokens = await getClinicianTokens(String(clinicianId));

    if (tokens.length === 0) {
      return json(
        {
          ok: false,
          error: 'clinician_push_tokens_not_configured',
        },
        503,
      );
    }

    const cleanData = Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v)]),
    );

    const result = await notifyClinicianFCM(
      tokens,
      String(title),
      String(body),
      cleanData,
    );

    return json(result, result.ok ? 200 : 503);
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: e?.message || 'notify_failed',
      },
      500,
    );
  }
}