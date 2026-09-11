import crypto from 'node:crypto';

export type InternalPatientIdentity = {
  uid: string;
  patientId: string;
  orgId: string;
};

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function secret() {
  return clean(
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET ||
      process.env.INTERNAL_IDENTITY_SECRET ||
      '',
    4096,
  );
}

function decodeSignedIdentity(value: string) {
  const [encodedPayload, signature, ...rest] = value.split('.');
  if (!encodedPayload || !signature || rest.length) return null;

  const key = secret();
  if (!key) return null;

  const expected = crypto
    .createHmac('sha256', key)
    .update(encodedPayload)
    .digest('base64url');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readInternalPatientIdentity(req: Request): InternalPatientIdentity | null {
  const token = clean(req.headers.get('x-ambulant-identity'), 8192);
  if (!token) return null;

  const payload = decodeSignedIdentity(token);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  const role = clean(payload.role, 80).toLowerCase();
  const exp = Number(payload.exp);
  const nbf = Number(payload.nbf);

  if (role !== 'patient') return null;
  if (!Number.isFinite(exp) || exp <= now) return null;
  if (Number.isFinite(nbf) && nbf > now + 10) return null;

  const uid = clean(payload.uid || payload.sub, 160);
  const patientId = clean(payload.patientId || payload.actorRefId, 160);
  const orgId = clean(payload.orgId, 120) || 'org-default';

  if (!uid || !patientId) return null;
  return { uid, patientId, orgId };
}

export function requireInternalPatientIdentity(req: Request) {
  const identity = readInternalPatientIdentity(req);
  if (!identity) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ ok: false, error: 'trusted_patient_identity_required' }),
        { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
      ),
    };
  }
  return { ok: true as const, identity };
}
