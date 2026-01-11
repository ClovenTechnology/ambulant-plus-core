// apps/clinician-app/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  // If you later add httpOnly cookies, clear them here:
  const res = NextResponse.json({ ok: true });
  // res.cookies.set('ambulant.session', '', { path: '/', expires: new Date(0) });
  return res;
}
