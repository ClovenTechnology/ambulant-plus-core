// apps/patient-app/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readIdentity(req: NextRequest) {
  const h = req.headers;

  const id =
    h.get('x-ambulant-user-id') ||
    h.get('x-user-id') ||
    h.get('x-uid') ||
    '';

  const email =
    h.get('x-email') ||
    h.get('x-ambulant-email') ||
    '';

  const name =
    h.get('x-name') ||
    h.get('x-display-name') ||
    h.get('x-ambulant-name') ||
    '';

  return { id, email, name };
}

export async function GET(req: NextRequest) {
  const identity = readIdentity(req);

  if (!identity.id && !identity.email) {
    return NextResponse.json(
      {
        ok: false,
        error: 'patient_identity_not_available',
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: identity.id || null,
      email: identity.email || null,
      name: identity.name || null,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}