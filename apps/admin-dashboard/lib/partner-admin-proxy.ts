import { NextRequest, NextResponse } from 'next/server';
// Existing proxy helpers may omit Origin when forwarding to the gateway.
// Enforce browser CSRF protection before invoking those helpers.
export function withPartnerAdminProxy<T extends (...args: any[]) => any>(handler: T): T {
  return (async (req: NextRequest, ...args: any[]) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (req.headers.get('origin') !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site')) return NextResponse.json({ error: 'same_origin_required' }, { status: 403 });
    return handler(req, ...args);
  }) as T;
}
