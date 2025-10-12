// apps/api-gateway/src/lib/identity.ts
import type { NextRequest } from 'next/server';

export function readIdentity(headers: Headers | Partial<Record<string,string>> | any) {
  // Accept either header object or NextRequest
  try {
    const h = headers?.get ? headers : { get: (k: string) => headers?.[k] || headers?.[k.toLowerCase()] };
    const auth = h.get('authorization') || h.get('Authorization') || h.get('x-user-id') || h.get('x-subject');
    // Very small fallback: parse bearer token or x-user-id header.
    if (!auth) return { id: null, role: 'anonymous' };
    if (auth.startsWith('Bearer ')) {
      // decode if JWT used (optional)
      const token = auth.slice(7);
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64').toString('utf8'));
        return { id: payload.sub || payload.userId || null, role: payload.role || 'user' };
      } catch {
        return { id: null, role: 'user' };
      }
    }
    return { id: auth, role: 'user' };
  } catch (e) {
    return { id: null, role: 'anonymous' };
  }
}
