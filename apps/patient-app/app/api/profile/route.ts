import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/src/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || '';

  // If we have an API Gateway configured, try to fetch a normalized patient profile.
  if (API) {
    try {
      // Adjust this path to match your API-Gateway; this is a conservative guess.
      const r = await fetch(`${API}/patient/profile?userId=${encodeURIComponent(userId)}`, {
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
      });
      if (r.ok) {
        const data = await r.json().catch(() => ({}));
        // Normalize a simple shape for the client
        const name =
          data?.name ||
          data?.displayName ||
          data?.patient?.name ||
          data?.profile?.name ||
          null;
        return NextResponse.json({ userId, name, patient: data });
      }
    } catch (e) {
      // fall through to stub
    }
  }

  // Dev stub: allow client to still render a reasonable "Generated for"
  return NextResponse.json({ userId, name: null });
}
