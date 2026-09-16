import { NextRequest } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { activate, changePassword, login, logout, rateLimit, resolveSession, view } from '@/src/lib/partner-access/engine';
import { checkOrigin, errorResponse, jsonInput, response, sessionToken, setSession } from '@/src/lib/partner-access/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest, { params }: { params: { action: string } }) {
  try {
    if (params.action !== 'me') return response({ ok: false, error: 'not_found' }, 404);
    const { account, session } = await resolveSession(prisma, sessionToken(req));
    return response({ ok: true, account: view(account), expiresAt: session.expiresAt });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  try {
    checkOrigin(req);
    if (!['login', 'activate', 'logout', 'password'].includes(params.action)) return response({ ok: false, error: 'not_found' }, 404);
    await rateLimit(prisma, 'request:' + params.action, req.headers.get('x-vercel-forwarded-for') || 'shared', 100);
    if (params.action === 'logout') { await logout(prisma, sessionToken(req)); return setSession(response({ ok: true })); }
    const input = await jsonInput(req);
    if (params.action === 'login') {
      const result = await login(prisma, input);
      return setSession(response({ ok: true, account: result.account, expiresAt: result.expiresAt }), result.token, result.expiresAt);
    }
    if (params.action === 'activate') await activate(prisma, input);
    if (params.action === 'password') await changePassword(prisma, sessionToken(req), input);
    return setSession(response({ ok: true }));
  } catch (e) { return errorResponse(e); }
}
