import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Only touch API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  const allowOrigin = process.env.CORS_ALLOW_ORIGIN ?? '*';
  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-UID');

  // Preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }
  return res;
}

export const config = { matcher: ['/api/:path*'] };
