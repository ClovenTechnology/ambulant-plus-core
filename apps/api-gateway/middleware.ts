// apps/api-gateway/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PATIENT_ORIGIN = process.env.PATIENT_ORIGIN || 'http://localhost:3000';
const CLINICIAN_ORIGIN = process.env.CLINICIAN_ORIGIN || 'http://localhost:3001';
const ALLOW = new Set([PATIENT_ORIGIN, CLINICIAN_ORIGIN]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    const res = NextResponse.json({}, { status: 200 });
    res.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'content-type,x-uid,x-role');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
  }

  // Only Patient app may POST bookings to Gateway
  if (req.method === 'POST' && pathname === '/api/appointments') {
    const origin = req.headers.get('origin') || '';
    if (origin !== PATIENT_ORIGIN) {
      return NextResponse.json({ error: 'forbidden_origin', origin }, { status: 403 });
    }
  }

  const res = NextResponse.next();
  const origin = req.headers.get('origin') || '';
  if (!origin || ALLOW.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin || '*');
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export const config = { matcher: ['/api/:path*'] };
