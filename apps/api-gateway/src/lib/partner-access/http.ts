import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../prisma';
import { requirePasswordAdmin } from '../admin-approval-auth';
import { verifyLegacyAdminSessionToken } from '../admin-session-compat';
import { deny, PartnerError } from './engine';

export const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-ambulant_partner_session' : 'ambulant_partner_session';
export function sessionToken(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer aps1_')) return bearer.slice(7);
  return req.cookies.get(cookieName())?.value || '';
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const allowed = (process.env.PARTNER_AUTH_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  allowed.push(new URL(req.url).origin);
  if (!origin || !allowed.includes(origin) || req.headers.get('sec-fetch-site') === 'cross-site') deny('same_origin_required');
}
export function response(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });
}
export function errorResponse(error: any) {
  if (error instanceof PartnerError || (typeof error?.status === 'number' && error.status >= 400 && error.status < 500)) return response({ ok: false, error: error.message }, error.status);
  if (error?.code === 'P2002') return response({ ok: false, error: 'partner_account_already_exists' }, 409);
  // Do not return database details, credentials, or tokens.
  return response({ ok: false, error: 'partner_service_unavailable' }, 503);
}
export function setSession(res: NextResponse, token = '', expires = new Date(0)) {
  res.cookies.set(cookieName(), token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires });
  return res;
}
export async function requirePartnerAdmin(req: NextRequest, write = false, requiredScope?: string) {
  const actor = await requirePasswordAdmin(req);
  const token = verifyLegacyAdminSessionToken(req.cookies.get('adm.profile')?.value);
  if (!token?.sessionId) deny('live_admin_session_required', 401);
  const session = await prisma.adminStaffSession.findFirst({ where: { id: token.sessionId, staffProfileId: actor.profileId, userId: actor.userId, endedAt: null } });
  if (!session) deny('live_admin_session_required', 401);
  const scope = requiredScope || (write ? 'compliance.verify_partners' : 'compliance.read');
  if (!actor.isSuperAdmin && !actor.scopes.includes(scope)) deny('partner_admin_scope_required');
  return actor;
}
export async function jsonInput(req: Request) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) deny('json_required', 415);
  const text = await req.text();
  if (text.length > 16384) deny('request_too_large', 413);
  try { const data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) deny('invalid_json', 400); return data; }
  catch (e) { if (e instanceof PartnerError) throw e; deny('invalid_json', 400); }
}
