import test from 'node:test';
import assert from 'node:assert/strict';
import * as auth from '../../apps/api-gateway/src/lib/partner-access/engine.ts';
import { assertResources, assertRoute, assertSelectors, publicRoute } from '../../apps/api-gateway/src/lib/partner-access/policy.ts';
import { partnerIdentity } from '../../apps/api-gateway/src/lib/partner-access/context.ts';

function fixture(role = 'pharmacy') {
  const profile = { id: 'profile-1', userId: 'user-1', ownerUserId: 'user-1', orgId: 'org-default', email: 'partner@example.com', active: true, isActive: true, kycStatus: 'APPROVED', kycVerifiedAt: new Date(), kyiStatus: 'VERIFIED', kyiVerifiedAt: new Date(), status: 'ACTIVE', approvalStatus: 'ACTIVE', approvedAt: new Date(), kycPayload: { responsibleContact: { email: 'partner@example.com' } }, kyiPayload: { personalIdentity: { email: 'partner@example.com' } }, operationalEmail: 'partner@example.com', profileMeta: { personalIdentity: { email: 'partner@example.com' } } };
  let state = { accounts: [], sessions: [], audit: [], limits: {} };
  let auditFails = false; let serial = Promise.resolve();
  const copy = x => structuredClone(x);
  const matches = (row, where) => Object.entries(where).every(([k,v]) => v && typeof v === 'object' && !(v instanceof Date) ? ('in' in v ? v.in.includes(row[k]) : 'gt' in v ? row[k] > v.gt : matches(row, v)) : row[k] === v);
  const patch = (row, data) => { for (const [k,v] of Object.entries(data)) row[k] = v?.increment ? row[k] + v.increment : v; return copy(row); };
  const account = {
    async findUnique({ where }) { return copy(state.accounts.find(a => matches(a, where)) || null); },
    async create({ data }) { if (state.accounts.some(a => (a.email === data.email && a.actorType === data.actorType) || (a.actorType === data.actorType && a.actorRefId === data.actorRefId))) throw Object.assign(new Error('unique'), { code: 'P2002' }); const row = { id: 'account-' + (state.accounts.length + 1), version: 1, passwordHash: null, ...data }; state.accounts.push(row); return copy(row); },
    async updateMany({ where, data }) { const rows = state.accounts.filter(a => matches(a, where)); rows.forEach(row => patch(row, data)); return { count: rows.length }; },
  };
  const sessions = {
    async findUnique({ where }) { const row = state.sessions.find(s => matches(s, where)); return row ? { ...copy(row), account: copy(state.accounts.find(a => a.id === row.accountId)) } : null; },
    async create({ data }) { state.sessions.push({ revokedAt: null, ...data }); return copy(data); },
    async update({ where, data }) { return patch(state.sessions.find(s => matches(s, where)), data); },
    async updateMany({ where, data }) { const rows = state.sessions.filter(s => matches(s, where)); rows.forEach(s => patch(s, data)); return { count: rows.length }; },
  };
  const profiles = { async findUnique({ where }) { return where.id === profile.id ? copy(profile) : null; }, async findFirst({ where }) { return where.OR.some(w => matches(profile, w)) ? copy(profile) : null; } };
  const db = { partnerAccessAccount: account, partnerAccessSession: sessions, pharmacyPartner: profiles, carePortRiderProfile: profiles, labPartner: profiles, medReachPhlebProfile: profiles,
    auditEvent: { async create({ data }) { if (auditFails) throw new Error('audit unavailable'); state.audit.push(copy(data)); } },
    applicationAccessRateLimitBucket: { async upsert({ where }) { const key = JSON.stringify(where); return { count: state.limits[key] = (state.limits[key] || 0) + 1 }; } },
    async $transaction(fn) { let release; const previous = serial; serial = new Promise(resolve => { release = resolve; }); await previous; const before = copy(state); try { return await fn(db); } catch(e) { state = before; throw e; } finally { release(); } },
  };
  return { db, profile, state: () => state, failAudit: () => { auditFails = true; }, role };
}
const password = 'correct horse battery staple';
const invite = f => auth.administer(f.db, 'admin-1', { action: 'invite', role: f.role, actorRefId: f.profile.id, email: f.profile.email, reason: 'Reviewed registration and contact authority', identityVerified: true });
async function ready(f) {
  const invitation = await invite(f);
  await auth.activate(f.db, { token: invitation.setupToken, password });
  const a = f.state().accounts[0];
  await auth.administer(f.db, 'admin-1', { action: 'approve', accountId: a.id, version: a.version, reason: 'Compliance verified', identityVerified: true });
  return auth.login(f.db, { role: f.role, email: f.profile.email, password });
}
const rejects = (fn, status) => assert.rejects(fn, e => e instanceof auth.PartnerError && e.status === status);

test('password hashing uses independent salts and rejects wrong/malformed passwords', async () => {
  const a = await auth.hashPassword(password), b = await auth.hashPassword(password);
  assert.notEqual(a,b); assert.equal(await auth.verifyPassword(password,a),true); assert.equal(await auth.verifyPassword('wrong',a),false); assert.equal(await auth.verifyPassword(password,'bad'),false);
  await rejects(() => auth.hashPassword('short'),400); await rejects(() => auth.hashPassword('x'.repeat(129)),400);
});
for (const role of auth.ROLES) test(role + ': invite, activate, approve, login, current session, logout', async () => {
  const f = fixture(role), result = await ready(f); assert.match(result.token,/^aps1_/);
  assert.equal(f.state().sessions[0].id,auth.digest(result.token)); assert.equal(JSON.stringify(f.state()).includes(result.token),false);
  const { account } = await auth.resolveSession(f.db,result.token); assert.equal(account.actorType,role.toUpperCase());
  assert.equal('passwordHash' in result.account,false); assert.equal('inviteHash' in result.account,false);
  await auth.logout(f.db,result.token); await rejects(() => auth.resolveSession(f.db,result.token),401); await auth.logout(f.db,result.token);
});
test('activation grants no session and pending accounts cannot login', async () => {
  const f = fixture(), i = await invite(f); await auth.activate(f.db,{ token:i.setupToken,password }); assert.equal(f.state().sessions.length,0); await rejects(() => auth.login(f.db,{role:f.role,email:f.profile.email,password}),403);
});
test('Admin invitation cannot bind an unreviewed email, missing identity or missing reason', async () => {
  const f=fixture(); const body={action:'invite',role:f.role,actorRefId:f.profile.id,email:'attacker@example.com',reason:'review',identityVerified:true};
  await rejects(()=>auth.administer(f.db,'admin',body),409);
  await rejects(()=>auth.administer(f.db,'admin',{...body,email:f.profile.email,identityVerified:false}),400);
  await rejects(()=>auth.administer(f.db,'admin',{...body,email:f.profile.email,reason:''}),400);
});
test('one-time invitation rejects concurrent replay and expired setup', async () => {
  const f=fixture(), i=await invite(f); const outcomes=await Promise.allSettled([auth.activate(f.db,{token:i.setupToken,password}),auth.activate(f.db,{token:i.setupToken,password})]); assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  const g=fixture(), j=await invite(g);g.state().accounts[0].inviteExpiresAt=new Date(0);await rejects(()=>auth.activate(g.db,{token:j.setupToken,password}),400);
});
test('approval requires live domain approval and stale review versions cannot overwrite decisions', async () => {
  const f=fixture();await ready(f);const a=f.state().accounts[0]; const version=a.version;f.profile.active=false;
  await rejects(()=>auth.administer(f.db,'admin',{action:'approve',accountId:a.id,version,reason:'review',identityVerified:true}),403);
  f.profile.active=true;await auth.administer(f.db,'admin',{action:'suspend',accountId:a.id,version,reason:'suspended'});
  await rejects(()=>auth.administer(f.db,'admin',{action:'approve',accountId:a.id,version,reason:'stale',identityVerified:true}),409);
});
test('forged, expired and version-mismatched sessions fail closed', async () => {
  const f=fixture(),r=await ready(f);await rejects(()=>auth.resolveSession(f.db,'aps1_'+'A'.repeat(43)),401);
  const s=f.state().sessions[0];s.expiresAt=new Date(0);await rejects(()=>auth.resolveSession(f.db,r.token),401);
  s.expiresAt=new Date(Date.now()+60000);s.version--;await rejects(()=>auth.resolveSession(f.db,r.token),401);
});
test('domain suspension and identity/contact reassignment invalidate existing sessions', async () => {
  const f=fixture('lab'),r=await ready(f); f.profile.active=false;await rejects(()=>auth.resolveSession(f.db,r.token),403);
  f.profile.active=true;f.profile.ownerUserId='other';await rejects(()=>auth.resolveSession(f.db,r.token),403);
  f.profile.ownerUserId='user-1';f.profile.operationalEmail='changed@example.com';await rejects(()=>auth.resolveSession(f.db,r.token),403);
});
test('password change invalidates every session and old password', async () => {
  const f=fixture(),r=await ready(f),r2=await auth.login(f.db,{role:f.role,email:f.profile.email,password});
  await auth.changePassword(f.db,r.token,{currentPassword:password,password:'a different long password'});
  await rejects(()=>auth.resolveSession(f.db,r.token),401);await rejects(()=>auth.resolveSession(f.db,r2.token),401);await rejects(()=>auth.login(f.db,{role:f.role,email:f.profile.email,password}),401);
  assert.ok((await auth.login(f.db,{role:f.role,email:f.profile.email,password:'a different long password'})).token);
});
test('reset invalidates existing credentials and sessions; suspension consumes pending links', async () => {
  const f=fixture(),r=await ready(f),a=f.state().accounts[0];
  const reset=await auth.administer(f.db,'admin',{action:'reset',accountId:a.id,version:a.version,reason:'contact identity verified',identityVerified:true});
  await rejects(()=>auth.resolveSession(f.db,r.token),401);await rejects(()=>auth.login(f.db,{role:f.role,email:f.profile.email,password}),401);
  await auth.administer(f.db,'admin',{action:'suspend',accountId:a.id,version:reset.account.version,reason:'hold'});
  await rejects(()=>auth.activate(f.db,{token:reset.setupToken,password}),400);
});
test('audit failure rolls back credential and Admin mutations', async () => {
  const f=fixture(),i=await invite(f);f.failAudit();await assert.rejects(()=>auth.activate(f.db,{token:i.setupToken,password}));assert.equal(f.state().accounts[0].passwordHash,null);assert.equal(f.state().accounts[0].inviteHash,auth.digest(i.setupToken));
  await assert.rejects(()=>auth.administer(f.db,'admin',{action:'suspend',accountId:i.account.id,version:i.account.version,reason:'hold'}));assert.equal(f.state().accounts[0].status,'PENDING');
});
test('audit failure rolls back login session issuance', async () => {
  const f=fixture();await ready(f);const n=f.state().sessions.length;f.failAudit();await assert.rejects(()=>auth.login(f.db,{role:f.role,email:f.profile.email,password}));assert.equal(f.state().sessions.length,n);
});
test('rate limits are persisted and actor role namespaces are separate', async () => {
  const f=fixture();for(let i=0;i<12;i++)await auth.rateLimit(f.db,'login','lab:user');await rejects(()=>auth.rateLimit(f.db,'login','lab:user'),429);await auth.rateLimit(f.db,'login','phleb:user');
});
test('patient or Admin roles cannot be used for partner credentials', async () => { for(const role of ['patient','admin','system','lab_staff']) assert.throws(()=>auth.roleOf(role)); });
test('route and selector checks reject cross-role, cross-partner, forged audit identity and tenant access', () => {
  const a={actorType:'PHARMACY',actorRefId:'p1',userId:'p1',orgId:'o1'};
  assertRoute(a,'GET','/api/careport/pharmacies/me/inventory');
  for(const route of ['/api/careport/admin/finance','/api/medreach/labs','/api/careport/riders/me/jobs']) assert.throws(()=>assertRoute(a,'GET',route));
  for(const values of [{pharmacyId:'p2'},{orgId:'o2'},{actorId:'u2'},{actorRole:'admin'}]) assert.throws(()=>assertSelectors(a,values));
  assert.equal(publicRoute('POST','/api/careport/partners/rider/apply'),true);assert.equal(publicRoute('GET','/api/careport/pharmacies/[pharmacyId]'),false);assert.equal(publicRoute('GET','/'),false);
});
test('a phlebotomist cannot act on an unassigned draw or mix specimens across bundles', async () => {
  const a={actorType:'PHLEB',actorRefId:'ph1',userId:'u1',orgId:'o1'};const draw={id:'d1',phlebId:'u1',orderId:'o'};
  const db={draw:{findFirst:async()=>draw},medReachSpecimenBundle:{findUnique:async()=>({id:'b1',orgId:'o1',drawId:'d1',draw})},medReachSpecimen:{findUnique:async()=>({bundle:{id:'b2',orgId:'o1',drawId:'d1',draw}})}};
  await assertResources(db,a,'/api/medreach/bundles/[bundleId]/custody',{bundleId:'b1'},new URLSearchParams(),{});
  await rejects(()=>assertResources(db,a,'/api/medreach/bundles/[bundleId]/custody',{bundleId:'b1'},new URLSearchParams(),{specimenId:'s2'}),403);
  draw.phlebId='other';await rejects(()=>assertResources(db,a,'/api/medreach/location',{},new URLSearchParams(),{orderId:'o'}),403);
});
test('lab profile reads require assigned phlebotomist; partner self-approval is blocked', async () => {
  const a={actorType:'LAB',actorRefId:'lab1',userId:'u1',orgId:'o1'};
  const db={medReachPhlebProfile:{findFirst:async()=>({defaultLabId:'lab2'})}};
  await rejects(()=>assertResources(db,a,'/api/medreach/phlebs/[phlebId]/profile',{phlebId:'p2'},new URLSearchParams(),{}),403);
  await rejects(()=>assertResources(db,a,'/api/medreach/labs/[labId]',{labId:'lab1'},new URLSearchParams(),{active:true}),403);
});
test('request identity contexts do not leak across concurrent requests', async () => {
  await Promise.all(['one','two'].map(uid=>partnerIdentity.run({uid,role:'phleb',trusted:true},async()=>{await new Promise(r=>setTimeout(r,5));assert.equal(partnerIdentity.getStore().uid,uid);})));assert.equal(partnerIdentity.getStore(),undefined);
});
