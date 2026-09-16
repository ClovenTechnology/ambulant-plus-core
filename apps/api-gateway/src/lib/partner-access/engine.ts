import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const ROLES = ['pharmacy', 'rider', 'lab', 'phleb'] as const;
export type PartnerRole = typeof ROLES[number];
export const SESSION_MS = 8 * 60 * 60 * 1000;
export class PartnerError extends Error {
  status: number;
  constructor(message: string, status = 403) { super(message); this.status = status; }
}
export function deny(message = 'partner_access_denied', status = 403): never { throw new PartnerError(message, status); }
export function roleOf(value: unknown): PartnerRole {
  const role = String(value || '').toLowerCase();
  if (!(ROLES as readonly string[]).includes(role)) deny('invalid_partner_role', 400);
  return role as PartnerRole;
}
export function emailOf(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) deny('invalid_email', 400);
  return email;
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = (prefix: string) => prefix + randomBytes(32).toString('base64url');
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, key) => e ? reject(e) : resolve(key)));
}
export async function hashPassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) deny('password_must_be_12_to_128_characters', 400);
  const salt = randomBytes(16).toString('hex');
  return `scrypt$16384$8$1$${salt}$${(await derive(value, salt)).toString('hex')}`;
}
export async function verifyPassword(password: unknown, encoded: unknown) {
  const match = /^scrypt\$16384\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(String(encoded || ''));
  const valid = typeof password === 'string' && password.length <= 128;
  const actual = await derive(valid ? password as string : '', match?.[1] || '0'.repeat(32));
  return timingSafeEqual(actual, Buffer.from(match?.[2] || '0'.repeat(128), 'hex')) && !!match && valid;
}
export function view(account: any) {
  const { id, email, actorType, actorRefId, userId, orgId, status, version, createdAt, updatedAt, lastLoginAt } = account;
  return { id, email, role: String(actorType).toLowerCase(), actorRefId, userId, orgId, status, version, createdAt, updatedAt, lastLoginAt, credentialReady: !!account.passwordHash };
}
export async function profileFor(db: any, role: PartnerRole, ref: string) {
  let row: any; let email: any; let userId: any; let ready = false;
  if (role === 'pharmacy') {
    row = await db.pharmacyPartner.findUnique({ where: { id: ref } });
    email = row?.kycPayload?.responsibleContact?.email || row?.kycPayload?.contact?.email;
    userId = row?.id;
    ready = !!row?.active && row.kycStatus === 'APPROVED' && !!row.kycVerifiedAt && !['SUSPENDED', 'ARCHIVED', 'CLOSED'].includes(row.commercialStatus);
  } else if (role === 'rider') {
    row = await db.carePortRiderProfile.findFirst({ where: { OR: [{ id: ref }, { userId: ref }] } });
    email = row?.kyiPayload?.personalIdentity?.email; userId = row?.userId;
    ready = !!row?.isActive && row.kyiStatus === 'VERIFIED' && !!row.kyiVerifiedAt && !['SUSPENDED', 'ARCHIVED', 'CLOSED', 'REJECTED'].includes(row.accountStatus);
  } else if (role === 'lab') {
    row = await db.labPartner.findUnique({ where: { id: ref } });
    email = row?.operationalEmail || row?.profileMeta?.primaryContact?.email; userId = row?.ownerUserId;
    ready = !!row?.active && row.status === 'ACTIVE' && !!row.approvedAt;
  } else {
    row = await db.medReachPhlebProfile.findFirst({ where: { OR: [{ id: ref }, { userId: ref }] } });
    email = row?.profileMeta?.personalIdentity?.email; userId = row?.userId;
    ready = !!row?.active && row.approvalStatus === 'ACTIVE' && !!row.approvedAt;
  }
  if (!row || !userId) deny('partner_profile_binding_missing', 409);
  return { row, role, ref: row.id, userId, orgId: row.orgId || 'org-default', email: String(email || '').trim().toLowerCase(), ready };
}
export async function requireReady(db: any, account: any) {
  const profile = await profileFor(db, roleOf(account.actorType), account.actorRefId);
  if (!profile.ready || profile.userId !== account.userId || profile.orgId !== account.orgId || profile.email !== account.email) deny('partner_approval_required');
  return profile;
}
export function assertCurrent(session: any, now = new Date()) {
  const expiry = new Date(session?.expiresAt).getTime();
  const account = session?.account;
  if (!session || session.revokedAt || !Number.isFinite(expiry) || expiry <= now.getTime() || !account || account.status !== 'APPROVED' || !account.passwordHash || account.version !== session.version) deny('partner_session_invalid', 401);
  roleOf(account.actorType);
  return account;
}
export async function resolveSession(db: any, raw: string, now = new Date()) {
  if (!/^aps1_[A-Za-z0-9_-]{43}$/.test(raw)) deny('partner_session_required', 401);
  const session = await db.partnerAccessSession.findUnique({ where: { id: digest(raw) }, include: { account: true } });
  const account = assertCurrent(session, now);
  await requireReady(db, account);
  return { session, account };
}
export async function rateLimit(db: any, purpose: string, key: string, limit = 12, now = new Date()) {
  const scope = 'partner-auth-v1:' + purpose;
  const keyHash = digest(key);
  const windowStart = new Date(Math.floor(now.getTime() / 600000) * 600000);
  const bucket = await db.applicationAccessRateLimitBucket.upsert({
    where: { scope_keyHash_windowStart: { scope, keyHash, windowStart } },
    create: { scope, keyHash, windowStart, count: 1 }, update: { count: { increment: 1 } },
  });
  if (bucket.count > limit) deny('too_many_attempts', 429);
}
async function audit(db: any, kind: string, accountId: string, actorId: string, actorRole: string, meta: any = {}) {
  await db.auditEvent.create({ data: { kind, subjectId: accountId, actorId, actorRole, meta } });
}
export async function login(db: any, input: any) {
  const role = roleOf(input.role); const email = emailOf(input.email);
  await rateLimit(db, 'login', role + ':' + email);
  const account = await db.partnerAccessAccount.findUnique({ where: { email_actorType: { email, actorType: role.toUpperCase() } } });
  if (!await verifyPassword(input.password, account?.passwordHash)) deny('invalid_credentials', 401);
  if (account.status !== 'APPROVED') deny('partner_approval_required');
  await requireReady(db, account);
  const raw = secret('aps1_'); const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.$transaction(async (tx: any) => {
    // Row update serializes login against approval, password change and revocation.
    const changed = await tx.partnerAccessAccount.updateMany({ where: { id: account.id, version: account.version, status: 'APPROVED', passwordHash: account.passwordHash }, data: { lastLoginAt: new Date() } });
    if (changed.count !== 1) deny('account_changed_retry', 409);
    await requireReady(tx, account);
    await tx.partnerAccessSession.create({ data: { id: digest(raw), accountId: account.id, version: account.version, expiresAt } });
    await audit(tx, 'partner_login', account.id, account.userId, role);
  });
  return { token: raw, expiresAt, account: view(account) };
}
export async function logout(db: any, raw: string) {
  if (!/^aps1_[A-Za-z0-9_-]{43}$/.test(raw)) return;
  await db.$transaction(async (tx: any) => {
    const session = await tx.partnerAccessSession.findUnique({ where: { id: digest(raw) }, include: { account: true } });
    if (!session || session.revokedAt) return;
    await tx.partnerAccessSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await audit(tx, 'partner_logout', session.accountId, session.account.userId, String(session.account.actorType).toLowerCase());
  });
}
export async function activate(db: any, input: any) {
  const raw = String(input.token || '');
  if (!/^api1_[A-Za-z0-9_-]{43}$/.test(raw)) deny('invalid_setup_link', 400);
  await rateLimit(db, 'activate', raw, 8);
  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx: any) => {
    const account = await tx.partnerAccessAccount.findUnique({ where: { inviteHash: digest(raw) } });
    if (!account || !['PENDING', 'APPROVED'].includes(account.status) || !account.inviteExpiresAt || new Date(account.inviteExpiresAt).getTime() <= Date.now()) deny('invalid_setup_link', 400);
    const changed = await tx.partnerAccessAccount.updateMany({ where: { id: account.id, version: account.version, inviteHash: digest(raw), inviteExpiresAt: { gt: new Date() }, status: { in: ['PENDING', 'APPROVED'] } }, data: { passwordHash, inviteHash: null, inviteExpiresAt: null, version: { increment: 1 } } });
    if (changed.count !== 1) deny('setup_link_already_used', 409);
    await tx.partnerAccessSession.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, 'partner_credential_activated', account.id, account.userId, String(account.actorType).toLowerCase());
  });
}
export async function changePassword(db: any, raw: string, input: any) {
  const { account } = await resolveSession(db, raw);
  await rateLimit(db, 'password', account.id, 8);
  if (!await verifyPassword(input.currentPassword, account.passwordHash)) deny('invalid_credentials', 401);
  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx: any) => {
    const changed = await tx.partnerAccessAccount.updateMany({ where: { id: account.id, version: account.version, status: 'APPROVED', passwordHash: account.passwordHash }, data: { passwordHash, version: { increment: 1 }, inviteHash: null, inviteExpiresAt: null } });
    if (changed.count !== 1) deny('account_changed_retry', 409);
    await tx.partnerAccessSession.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, 'partner_password_changed', account.id, account.userId, String(account.actorType).toLowerCase());
  });
}
export async function administer(db: any, actorId: string, input: any) {
  const action = String(input.action || '');
  if (!['invite', 'approve', 'suspend', 'reject', 'reset', 'revoke_sessions'].includes(action)) deny('invalid_action', 400);
  const reason = String(input.reason || '').trim();
  if (!reason || reason.length > 1000) deny('review_reason_required', 400);
  if (['invite', 'approve', 'reset'].includes(action) && input.identityVerified !== true) deny('identity_verification_required', 400);
  return db.$transaction(async (tx: any) => {
    let account: any; let setupToken: string | undefined; let setupExpiresAt: Date | undefined;
    if (action === 'invite') {
      const role = roleOf(input.role); const profile = await profileFor(tx, role, String(input.actorRefId || ''));
      const email = emailOf(input.email);
      if (email !== profile.email) deny('email_must_match_reviewed_partner_contact', 409);
      setupToken = secret('api1_'); setupExpiresAt = new Date(Date.now() + 24 * 3600000);
      account = await tx.partnerAccessAccount.create({ data: { email, actorType: role.toUpperCase(), actorRefId: profile.ref, userId: profile.userId, orgId: profile.orgId, status: 'PENDING', inviteHash: digest(setupToken), inviteExpiresAt: setupExpiresAt } });
    } else {
      account = await tx.partnerAccessAccount.findUnique({ where: { id: String(input.accountId || '') } });
      if (!account || account.version !== input.version) deny('account_changed_refresh', 409);
      const data: any = { version: { increment: 1 } };
      if (action === 'approve') { await requireReady(tx, account); data.status = 'APPROVED'; }
      if (action === 'suspend' || action === 'reject') { data.status = action === 'suspend' ? 'SUSPENDED' : 'REJECTED'; data.inviteHash = null; data.inviteExpiresAt = null; }
      if (action === 'reset') {
        if (!['PENDING', 'APPROVED'].includes(account.status)) deny('account_not_eligible_for_reset');
        setupToken = secret('api1_'); setupExpiresAt = new Date(Date.now() + 24 * 3600000);
        data.passwordHash = null; data.inviteHash = digest(setupToken); data.inviteExpiresAt = setupExpiresAt;
      }
      const changed = await tx.partnerAccessAccount.updateMany({ where: { id: account.id, version: input.version }, data });
      if (changed.count !== 1) deny('account_changed_refresh', 409);
      await tx.partnerAccessSession.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: new Date() } });
      account = await tx.partnerAccessAccount.findUnique({ where: { id: account.id } });
    }
    await audit(tx, 'partner_admin_' + action, account.id, actorId, 'admin', { reason, identityVerified: input.identityVerified === true });
    return { account: view(account), setupToken, setupExpiresAt };
  });
}
