import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../apps/api-gateway/src/lib/prisma';
import { withPartnerBoundary } from '../../apps/api-gateway/src/lib/partner-access/boundary';
import { checkOrigin, requirePartnerAdmin } from '../../apps/api-gateway/src/lib/partner-access/http';
import { readIdentity } from '../../apps/api-gateway/src/lib/identity';
import { signLegacyAdminSessionToken } from '../../apps/api-gateway/src/lib/admin-session-compat';
import { middleware as medreach } from '../../apps/medreach/middleware';
import { withPartnerRoute } from '../../apps/medreach/lib/partner-route';
import { GET as me, POST as authPost } from '../../apps/api-gateway/app/api/partner-auth/[action]/route';

process.env.AUTH_SESSION_SECRET = 'test-only-not-a-deployment-secret-123456789';
process.env.AMBULANT_INTERNAL_IDENTITY_SECRET = 'test-only-internal-secret-123456789';
const request = (path: string, headers: Record<string,string> = {}, method = 'GET') => new NextRequest('https://preview.example.test' + path, { method, headers });
const handler = withPartnerBoundary(async (req: NextRequest) => NextResponse.json(readIdentity(req.headers)), '/api/medreach/metrics');
function jwt(payload: any) { const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'); const p = Buffer.from(JSON.stringify(payload)).toString('base64url'); const sig = createHmac('sha256',process.env.AUTH_SESSION_SECRET!).update(h+'.'+p).digest('base64url'); return h+'.'+p+'.'+sig; }

test('Gateway rejects unsigned role headers even in development', async () => {
  const result=await handler(request('/api/medreach/metrics',{'x-role':'lab','x-user-id':'victim','x-lab-id':'other'}));assert.equal(result.status,401);
});
test('legacy signed partner JWT cannot bypass database-backed partner sessions', async () => {
  const token=jwt({sub:'victim',role:'lab',exp:Math.floor(Date.now()/1000)+300});
  const result=await handler(request('/api/medreach/metrics',{authorization:'Bearer '+token}));assert.equal(result.status,401);
});
test('trusted patient identity continues to reach existing patient resource checks', async () => {
  const token=jwt({sub:'patient-1',role:'patient',exp:Math.floor(Date.now()/1000)+300});
  const result=await handler(request('/api/medreach/metrics',{authorization:'Bearer '+token}));assert.equal(result.status,200);assert.equal((await result.json()).uid,'patient-1');
});
test('forged Admin cookie cannot become an Admin identity', async () => { const result=await handler(request('/api/medreach/metrics',{cookie:'adm.profile=forged'}));assert.equal(result.status,401); });
test('cross-origin and missing-origin credential mutations fail before parsing secrets', async () => {
  for(const headers of [{},{origin:'https://attacker.example'}]) { const res=await authPost(request('/api/partner-auth/login',headers,'POST'),{params:{action:'login'}});assert.equal(res.status,403); }
});
test('me requires a valid opaque session; unsigned role cookies do not authenticate', async () => { const res=await me(request('/api/partner-auth/me',{cookie:'role=lab'}),{params:{action:'me'}});assert.equal(res.status,401);assert.equal(res.headers.get('cache-control'),'no-store'); });
test('CSRF origin comparison is exact and rejects lookalike suffixes', () => {
  checkOrigin(request('/api', { origin:'https://preview.example.test' }));
  assert.throws(()=>checkOrigin(request('/api',{origin:'https://preview.example.test.attacker.example'})));
});
test('Admin access requires both active password profile and an unended session with the requested scope', async () => {
  const profiles=prisma.adminUserProfile as any, sessions=prisma.adminStaffSession as any;
  const originalProfile=profiles.findFirst, originalSession=sessions.findFirst;
  const profile:any={id:'admin-profile',userId:'admin-user',email:'admin@example.com',name:null,departmentId:null,designationId:null,lifecycleState:'ACTIVE',designation:null,roles:[{role:{name:'Reviewer',scopes:[{scope:'compliance.read'}]}}]};
  let ended=true;
  profiles.findFirst=async()=>profile;
  sessions.findFirst=async ({where}:any)=> { assert.equal(where.id,'admin-session');assert.equal(where.staffProfileId,profile.id);assert.equal(where.userId,profile.userId);assert.equal(where.endedAt,null);return ended?null:{id:'admin-session'}; };
  try {
    const token=signLegacyAdminSessionToken({sub:profile.userId,email:profile.email,authMethod:'password',sessionId:'admin-session'});
    const req=request('/api/admin/partner-access',{cookie:'adm.profile='+token});
    await assert.rejects(()=>requirePartnerAdmin(req),{status:401});ended=false;await requirePartnerAdmin(req);
    await assert.rejects(()=>requirePartnerAdmin(req,true),{status:403});profile.roles[0].role.scopes.push({scope:'compliance.verify_partners'});await requirePartnerAdmin(req,true);
    profile.lifecycleState='SUSPENDED';await assert.rejects(()=>requirePartnerAdmin(req,true),{status:403});
  } finally { profiles.findFirst=originalProfile;sessions.findFirst=originalSession; }
});
test('MedReach protects nested paths and rejects role-cookie spoofing', async () => {
  assert.equal((await medreach(request('/'))).headers.get('x-middleware-next'),'1');
  for(const path of ['/lab/victim','/phleb/victim/jobs','/api/labs']) { const result=await medreach(request(path,{cookie:'role=lab'}));assert.notEqual(result.headers.get('x-middleware-next'),'1'); }
});
test('middleware validates current session and binds the role and profile route', async () => {
  const originalFetch=globalThis.fetch;const originalBase=process.env.APIGW_BASE;process.env.APIGW_BASE='https://gateway.example.test';
  const cookie=(process.env.NODE_ENV==='production'?'__Host-ambulant_partner_session':'ambulant_partner_session')+'=aps1_'+'A'.repeat(43);
  globalThis.fetch=async()=>Response.json({account:{role:'lab',actorRefId:'lab1',userId:'owner1'}});
  try {
    const allowed=await medreach(request('/lab/lab1',{cookie,'x-role':'admin'}));assert.equal(allowed.headers.get('x-middleware-next'),'1');assert.equal(allowed.headers.get('x-middleware-request-x-role'),null);
    for(const path of ['/lab/lab2','/phleb/ph1','/api/admin/config']) assert.notEqual((await medreach(request(path,{cookie}))).headers.get('x-middleware-next'),'1');
    globalThis.fetch=async()=>Response.json({error:'suspended'},{status:403});assert.notEqual((await medreach(request('/lab/lab1',{cookie}))).headers.get('x-middleware-next'),'1');
  } finally {globalThis.fetch=originalFetch;if(originalBase===undefined)delete process.env.APIGW_BASE;else process.env.APIGW_BASE=originalBase;}
});
test('operational route handlers repeat authorization when middleware is skipped', async () => {
  let called=false;const guarded=withPartnerRoute(async()=>{called=true;return Response.json({ok:true});});
  const res=await guarded(request('/api/labs',{'x-middleware-subrequest':'middleware','x-role':'lab','x-user-id':'victim'}));assert.equal(res.status,401);assert.equal(called,false);
});

test('valid partner requests reach handlers with database identity and canonical headers', async () => {
  const sessions=prisma.partnerAccessSession as any, labs=prisma.labPartner as any;
  const originalSession=sessions.findUnique, originalLab=labs.findUnique;
  const a={id:'a',actorType:'LAB',actorRefId:'lab1',userId:'owner1',orgId:'org-default',email:'lab@example.com',status:'APPROVED',passwordHash:'configured',version:1};
  sessions.findUnique=async()=>({id:'s',account:a,version:1,expiresAt:new Date(Date.now()+60000),revokedAt:null});
  labs.findUnique=async()=>({id:'lab1',ownerUserId:'owner1',operationalEmail:'lab@example.com',status:'ACTIVE',active:true,approvedAt:new Date()});
  const guarded=withPartnerBoundary(async(req:NextRequest)=>NextResponse.json({who:readIdentity(req.headers),lab:req.headers.get('x-lab-id')}),'/api/medreach/metrics');
  try { const res=await guarded(request('/api/medreach/metrics',{authorization:'Bearer aps1_'+'A'.repeat(43),'x-role':'admin','x-lab-id':'victim'}));assert.equal(res.status,200);const result=await res.json();assert.equal(result.who.role,'lab');assert.equal(result.who.uid,'owner1');assert.equal(result.lab,'lab1'); }
  finally {sessions.findUnique=originalSession;labs.findUnique=originalLab;}
});

test('SSE does not emit another event after session revocation', async () => {
  const sessions=prisma.partnerAccessSession as any, labs=prisma.labPartner as any;
  const originalSession=sessions.findUnique, originalLab=labs.findUnique;let revoked=false;
  const a={id:'a',actorType:'LAB',actorRefId:'lab1',userId:'owner1',orgId:'org-default',email:'lab@example.com',status:'APPROVED',passwordHash:'configured',version:1};
  sessions.findUnique=async()=>({id:'s',account:a,version:1,expiresAt:new Date(Date.now()+60000),revokedAt:revoked?new Date():null});
  labs.findUnique=async()=>({id:'lab1',ownerUserId:'owner1',operationalEmail:'lab@example.com',status:'ACTIVE',active:true,approvedAt:new Date()});
  let source:ReadableStreamDefaultController<Uint8Array>;let aborted=false;
  const guarded=withPartnerBoundary(async(req:NextRequest)=>{req.signal.addEventListener('abort',()=>{aborted=true;});return new Response(new ReadableStream<Uint8Array>({start(c){source=c;}}),{headers:{'content-type':'text/event-stream'}});},'/api/medreach/metrics');
  try {
    const res=await guarded(request('/api/medreach/metrics',{authorization:'Bearer aps1_'+'A'.repeat(43)}));const reader=res.body!.getReader();
    source!.enqueue(new TextEncoder().encode('data: allowed\n\n'));assert.equal((await reader.read()).done,false);
    revoked=true;source!.enqueue(new TextEncoder().encode('data: must not escape\n\n'));assert.equal((await reader.read()).done,true);assert.equal(aborted,true);
  } finally {sessions.findUnique=originalSession;labs.findUnique=originalLab;}
});

test('existing Admin partner proxies enforce origin before forwarding cookie credentials', async () => {
  const { withPartnerAdminProxy } = await import('../../apps/admin-dashboard/lib/partner-admin-proxy');
  let called=false;const proxy=withPartnerAdminProxy(async()=>{called=true;return Response.json({ok:true});});
  assert.equal((await proxy(request('/api/admin/medreach/labs',{origin:'https://attacker.example'},'POST'))).status,403);assert.equal(called,false);
  assert.equal((await proxy(request('/api/admin/medreach/labs',{origin:'https://preview.example.test'},'POST'))).status,200);assert.equal(called,true);
});
