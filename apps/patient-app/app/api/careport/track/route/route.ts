// apps/patient-app/app/api/careport/track/route/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CAREPORT_BASE =
  process.env.CAREPORT_BASE_URL ||
  process.env.CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  '';

export async function GET(req: NextRequest) {
  if (CAREPORT_BASE) {
    try {
      const url = `${CAREPORT_BASE.replace(
        /\/$/,
        '',
      )}/api/careport/track/route`;

      const headers: Record<string, string> = {};
      const cookie = req.headers.get('cookie');
      const auth = req.headers.get('authorization');
      if (cookie) headers.cookie = cookie;
      if (auth) headers.authorization = auth;

      const upstream = await fetch(url, {
        headers,
        cache: 'no-store',
      });

      if (upstream.ok) {
        const json = await upstream.json();
        return NextResponse.json(json);
      }
    } catch (err) {
      console.warn(
        '[CarePort route] Failed to proxy to backend, using mock:',
        err,
      );
    }
  }

  // Minimal static mock if backend not available
  const MOCK_ROUTE = [
    { lat: -26.082, lng: 28.034 },
    { lat: -26.0835, lng: 28.036 },
    { lat: -26.085, lng: 28.038 },
    { lat: -26.0865, lng: 28.040 },
  ];

  return NextResponse.json(MOCK_ROUTE);
}
