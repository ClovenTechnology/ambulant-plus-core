// apps/admin-dashboard/app/signout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// keep in sync with whatever you set elsewhere
const CLEAR = [
  'adm.profile',          // dev session profile (used by Gateway cookie check)
  'next.authz',           // your NEXT_AUTHZ_COOKIE (roles/scopes)
  'next.profile',         // your NEXT_PROFILE_COOKIE (name/email for UI)
  // add any legacy/dev tokens to be safe:
  'adm.token',
  'auth_token',
];

export async function GET() {
  const jar = cookies();
  for (const k of CLEAR) {
    jar.delete(k);
  }

  // back to sign-in (use home '/' if you prefer)
  return NextResponse.redirect(new URL('/auth/signin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'), {
    headers: {
      // helpful if you want to prevent caching of the redirect page in some proxies
      'cache-control': 'no-store',
    },
  });
}
