import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/_next'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // get user from cookie/session (stub: replace with real)
  const role = request.cookies.get('role')?.value;

  if (!role) {
    // not authenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role‑based routing example:
  if (pathname.startsWith('/lab/') && role !== 'admin' && role !== 'lab') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (pathname.startsWith('/phleb/') && role !== 'admin' && role !== 'phleb') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}
