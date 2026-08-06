// apps/patient-app/src/lib/gateway-identity.ts
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

export type PatientGatewayIdentity = {
  uid: string;
  patientId: string;
  orgId: string;
  email: string;
  name: string;
};

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function pickUserPayload(payload: any) {
  return payload?.user &&
    typeof payload.user === 'object'
    ? payload.user
    : payload;
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function internalIdentitySecret() {
  const secret =
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET ||
    process.env.INTERNAL_IDENTITY_SECRET ||
    '';

  if (!secret && isProductionRuntime()) {
    throw new Error(
      'internal_identity_secret_unavailable',
    );
  }

  return secret;
}

function signInternalIdentity(
  identity: PatientGatewayIdentity,
) {
  const secret = internalIdentitySecret();
  if (!secret) return '';

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identity.uid,
    uid: identity.uid,
    role: 'patient',
    actorRefId: identity.patientId,
    patientId: identity.patientId,
    orgId: identity.orgId || 'org-default',
    iat: now,
    nbf: now - 5,
    exp: now + 90,
    sid: `patient-proxy-${crypto.randomUUID()}`,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    'utf8',
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export async function readPatientGatewayIdentity(
  req: NextRequest,
): Promise<PatientGatewayIdentity | null> {
  const authUrl = new URL('/api/auth/me', req.url);
  const response = await fetch(authUrl.toString(), {
    method: 'GET',
    headers: {
      cookie: req.headers.get('cookie') || '',
      authorization:
        req.headers.get('authorization') || '',
      accept: 'application/json',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!response || !response.ok) return null;

  const json = await response
    .json()
    .catch(() => null);

  if (!json || json.ok === false) return null;

  const user = pickUserPayload(json);
  const actorType = clean(
    json.actorType ||
      user.actorType ||
      user.actor_type,
    80,
  ).toUpperCase();

  if (actorType && actorType !== 'PATIENT') {
    return null;
  }

  const uid = clean(
    json.uid ||
      json.userId ||
      json.id ||
      user.uid ||
      user.userId ||
      user.id ||
      user.sub,
    160,
  );
  const patientId = clean(
    json.actorRefId ||
      json.actor_ref_id ||
      json.patientId ||
      json.patient_id ||
      user.actorRefId ||
      user.actor_ref_id ||
      user.patientId ||
      user.patient_id,
    160,
  );

  if (!uid || !patientId) return null;

  return {
    uid,
    patientId,
    orgId:
      clean(
        json.orgId ||
          json.org_id ||
          user.orgId ||
          user.org_id,
        120,
      ) || 'org-default',
    email: clean(
      json.email ||
        user.email ||
        user.contactEmail,
      320,
    ),
    name: clean(
      json.name ||
        json.displayName ||
        user.name ||
        user.displayName,
      240,
    ),
  };
}

export function resolveGatewayIdempotencyKey(
  req: NextRequest,
  supplied?: unknown,
) {
  const existing = clean(
    req.headers.get('idempotency-key') ||
      req.headers.get('x-idempotency-key') ||
      supplied,
    180,
  );

  if (existing) {
    if (!/^[A-Za-z0-9._:-]{8,180}$/.test(existing)) {
      throw new Error('invalid_idempotency_key');
    }
    return existing;
  }

  return `patient-${crypto.randomUUID()}`;
}

export function patientGatewayHeaders(args: {
  req: NextRequest;
  identity: PatientGatewayIdentity;
  includeJson?: boolean;
  idempotencyKey?: string | null;
}) {
  const headers = new Headers();

  for (const key of [
    'authorization',
    'cookie',
    'x-correlation-id',
    'x-request-id',
  ]) {
    const value = args.req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');
  if (args.includeJson) {
    headers.set('content-type', 'application/json');
  }

  const signedIdentity =
    signInternalIdentity(args.identity);

  if (signedIdentity) {
    headers.set(
      'x-ambulant-identity',
      signedIdentity,
    );
  }

  headers.set('x-role', 'patient');
  headers.set('x-ambulant-role', 'patient');
  headers.set('x-uid', args.identity.uid);
  headers.set('x-user-id', args.identity.uid);
  headers.set(
    'x-ambulant-user-id',
    args.identity.uid,
  );
  headers.set(
    'x-actor-ref-id',
    args.identity.patientId,
  );
  headers.set(
    'x-patient-id',
    args.identity.patientId,
  );
  headers.set(
    'x-current-patient-id',
    args.identity.patientId,
  );
  headers.set(
    'x-org-id',
    args.identity.orgId || 'org-default',
  );
  headers.set(
    'x-ambulant-org-id',
    args.identity.orgId || 'org-default',
  );

  if (args.identity.email) {
    headers.set('x-email', args.identity.email);
  }
  if (args.identity.name) {
    headers.set('x-name', args.identity.name);
    headers.set(
      'x-display-name',
      args.identity.name,
    );
  }

  if (args.idempotencyKey) {
    headers.set(
      'idempotency-key',
      args.idempotencyKey,
    );
    headers.set(
      'x-idempotency-key',
      args.idempotencyKey,
    );
  }

  return headers;
}
