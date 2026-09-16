import { NextRequest } from 'next/server';
import { prisma } from '../prisma';
import { readIdentity } from '../identity';
import { partnerIdentity } from './context';
import { deny, resolveSession, roleOf } from './engine';
import { assertResources, assertRoute, publicRoute } from './policy';
import { checkOrigin, errorResponse, requirePartnerAdmin, sessionToken } from './http';

export function withPartnerBoundary<T extends (...args: any[]) => any>(handler: T, template: string): T {
  return (async (req: NextRequest, ...args: any[]) => {
    try {
      if (publicRoute(req.method, template)) return await handler(req, ...args);
      const raw = sessionToken(req);
      if (!raw) {
        const who = readIdentity(req.headers);
        if (req.cookies.get('adm.profile')?.value || ['admin', 'admin_staff'].includes(who.role)) {
          const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
          if (write && (req.headers.has('origin') || req.headers.has('sec-fetch-site'))) checkOrigin(req);
          const review = /\/ky[ci]\/|\/decision$|\/labs\/\[labId\]$|\/phlebs(?:$|\/\[phlebId\]\/profile$)/.test(template);
          const scope = review ? (write ? 'compliance.verify_partners' : 'compliance.read') : /\/(finance|payouts)/.test(template) ? (write ? 'finance.payouts.approve' : 'finance.read') : (write ? 'ops.dispatch.write' : 'ops.read');
          const actor = await requirePartnerAdmin(req, write, scope);
          return await partnerIdentity.run({ ...who, role: 'admin', uid: actor.userId, trusted: true }, () => handler(req, ...args));
        }
        if (!who.trusted || !who.uid) deny('authentication_required', 401);
        if (['pharmacy', 'pharmacy_staff', 'rider', 'lab', 'phleb'].includes(who.role)) deny('partner_session_required', 401);
        // These raw profile endpoints previously had no in-handler access check.
        if (/^\/api\/careport\/pharmacies\/\[pharmacyId\]$/.test(template)) deny();
        return await handler(req, ...args); // Existing patient/clinician/system resource checks remain in force.
      }
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.headers.get('authorization')?.startsWith('Bearer aps1_')) checkOrigin(req);
      const { account, session } = await resolveSession(prisma, raw);
      assertRoute(account, req.method, template);
      let body: any = {};
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('content-type')?.includes('application/json')) {
        body = await req.clone().json();
        if (!body || typeof body !== 'object' || Array.isArray(body)) deny('invalid_json', 400);
      }
      const url = new URL(req.url);
      await assertResources(prisma, account, template, args[0]?.params || {}, url.searchParams, body);
      const role = roleOf(account.actorType);
      const headers = new Headers(req.headers);
      for (const key of Array.from(headers.keys())) if (/^x-(?:ambulant-(?:identity|user-id|role|org-id|trusted)|user-id|uid|role|org-id|org|lab-id|staff-lab-id|actor-ref-id|network-id|staff-network-id)$/.test(key)) headers.delete(key);
      headers.set('x-user-id', account.userId); headers.set('x-role', role); headers.set('x-org-id', account.orgId); headers.set('x-actor-ref-id', account.actorRefId);
      if (role === 'lab') { headers.set('x-lab-id', account.actorRefId); if (template === '/api/medreach/phlebs') url.searchParams.set('defaultLabId', account.actorRefId); }
      const abort = new AbortController();
      const abortRequest = () => abort.abort(); if (req.signal.aborted) abort.abort(); req.signal.addEventListener('abort', abortRequest, { once: true });
      const forwarded = new NextRequest(url, { method: req.method, headers, body: req.body, signal: abort.signal, ...(req.body ? { duplex: 'half' } : {}) });
      const who = { role, uid: account.userId, orgId: account.orgId, actorRefId: account.actorRefId, sid: session.id, trusted: true, source: 'session_cookie' as const };
      const result = await partnerIdentity.run(who, () => handler(forwarded, ...args));
      if (!result.headers.get('content-type')?.includes('text/event-stream')) {
        req.signal.removeEventListener('abort', abortRequest);
        result.headers.set('cache-control', 'no-store'); return result;
      }
      // Revalidate before every emitted SSE chunk and close idle revoked streams within 15s.
      const reader = result.body.getReader();
      let finished = false; let interval: ReturnType<typeof setInterval>;
      const stop = async () => { if (finished) return; finished = true; clearInterval(interval); abort.abort(); req.signal.removeEventListener('abort', abortRequest); await reader.cancel().catch(() => {}); };
      const stream = new ReadableStream({
        start(controller) {
          interval = setInterval(async () => { try { await resolveSession(prisma, raw); } catch { await stop(); try { controller.close(); } catch {} } }, 15000);
        },
        async pull(controller) {
          try {
            const chunk = await reader.read();
            if (finished) return;
            if (chunk.done) { await stop(); controller.close(); return; }
            await resolveSession(prisma, raw);
            controller.enqueue(chunk.value);
          } catch { await stop(); try { controller.close(); } catch {} }
        },
        async cancel() { await stop(); },
      });
      return new Response(stream, { status: result.status, headers: result.headers });
    } catch (e) { return errorResponse(e); }
  }) as T;
}
