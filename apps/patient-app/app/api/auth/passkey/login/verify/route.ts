// apps/patient-app/app/api/auth/passkey/login/verify/route.ts
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import {
  base64urlToBuffer,
  createPatientSessionResponse,
  getOrigin,
  getRequestMeta,
  getRpID,
  json,
  prisma,
  toBigIntSafe,
} from '../../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const response = body?.response;

  if (!response?.id) {
    return json(400, { ok: false, error: 'Passkey response required.' });
  }

  const credentialId = String(response.id);

  const credentialRow = await prisma.userPasskeyCredential.findUnique({
    where: { credentialId },
  });

  if (!credentialRow || credentialRow.disabledAt) {
    return json(401, { ok: false, error: 'Passkey not recognised.' });
  }

  const cred = await prisma.authCredential.findUnique({
    where: { id: credentialRow.userId },
    select: { id: true, disabled: true, actorType: true },
  });

  if (!cred || cred.disabled || cred.actorType !== 'PATIENT') {
    return json(401, { ok: false, error: 'Patient account not available.' });
  }

  const challengeRow = await prisma.webAuthnChallenge.findFirst({
    where: {
      type: 'login',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challengeRow) {
    return json(400, { ok: false, error: 'Passkey sign-in expired. Please try again.' });
  }

  let verification: any;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: getOrigin(req),
      expectedRPID: getRpID(req),
      credential: {
        id: credentialRow.credentialId,
        publicKey: base64urlToBuffer(credentialRow.publicKey),
        counter: Number(credentialRow.counter || BigInt(0)),
        transports: Array.isArray(credentialRow.transports) ? (credentialRow.transports as any) : undefined,
      },
      requireUserVerification: false,
    } as any);
  } catch (err: any) {
    return json(400, { ok: false, error: err?.message || 'Could not verify passkey.' });
  }

  if (!verification?.verified) {
    return json(401, { ok: false, error: 'Could not verify passkey.' });
  }

  const newCounter = toBigIntSafe(verification?.authenticationInfo?.newCounter ?? credentialRow.counter);

  await prisma.userPasskeyCredential.update({
    where: { id: credentialRow.id },
    data: {
      counter: newCounter,
      lastUsedAt: new Date(),
    },
  }).catch(() => null);

  await prisma.webAuthnChallenge.update({
    where: { id: challengeRow.id },
    data: { consumedAt: new Date() },
  }).catch(() => null);

  const profile = await prisma.patientProfile.findFirst({
    where: { userId: credentialRow.userId },
    select: { id: true },
  }).catch(() => null);

  const meta = getRequestMeta();

  return createPatientSessionResponse({
    userId: credentialRow.userId,
    actorRefId: profile?.id || null,
    userAgent: meta.ua,
    ip: meta.ip,
    authMethod: 'passkey',
  });
}
