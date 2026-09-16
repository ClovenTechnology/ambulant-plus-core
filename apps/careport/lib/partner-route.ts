import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
// Repeat authorization in Node route handlers; middleware is only an early gate.
export function withPartnerRoute<T extends (...args: any[]) => any>(handler: T): T {
  return (async (req: NextRequest, ...args: any[]) => {
    const checked = await middleware(req);
    if (checked.headers.get('x-middleware-next') !== '1') return checked;
    const headers = new Headers(req.headers);
    const overrides = checked.headers.get('x-middleware-override-headers');
    if (overrides) {
      for (const key of Array.from(headers.keys())) headers.delete(key);
      for (const name of overrides.split(',')) {
        const key = name.trim();
        const value = checked.headers.get('x-middleware-request-' + key);
        if (value != null) headers.set(key, value);
      }
    }
    return handler(new NextRequest(req, { headers }), ...args);
  }) as T;
}
