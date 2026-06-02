// apps/patient-app/app/api/auth/passkey/register/verify/route.ts
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import {
  cleanStr,
  getOrigin,
  getRpID,
  json,
  passkeyDisplay,
  prisma,
  publicKeyToBase64Url,
  requirePatientSession,
  toBigIntSafe,
} from '../../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requirePatientSession();
  if (!session.ok) return json(session.status, { ok: false, error: session.error });

  const body = await req.json().catch(() => ({} as any));
  const response = body?.response;
  const deviceLabel = cleanStr(body?.deviceLabel, 80) || 'Personal passkey';

  if (!response) {
    return json(400, { ok: false, error: 'Registration response required.' });
  }

  const challengeRow = await prisma.webAuthnChallenge.findFirst({
    where: {
      userId: session.userId,
      type: 'register',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challengeRow) {
    return json(400, { ok: false, error: 'Passkey setup expired. Please try again.' });
  }

  let verification: any;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: getOrigin(req),
      expectedRPID: getRpID(req),
      requireUserVerification: false,
    } as any);
  } catch (err: any) {
    return json(400, { ok: false, error: err?.message || 'Could not verify passkey registration.' });
  }

  if (!verification?.verified || !verification?.registrationInfo) {
    return json(400, { ok: false, error: 'Could not verify passkey registration.' });
  }

  const info = verification.registrationInfo;
  const credential = info.credential || info;

  const credentialId = String(credential.id || info.credentialID || response.id || '');
  const publicKey = publicKeyToBase64Url(credential.publicKey || info.credentialPublicKey);
  const counter = toBigIntSafe(credential.counter ?? info.counter ?? 0);
  const transports = response?.response?.transports || credential.transports || null;
  const backedUp = Boolean(info.credentialBackedUp ?? credential.backedUp ?? false);

  if (!credentialId || !publicKey) {
    return json(400, { ok: false, error: 'Incomplete passkey registration response.' });
  }

  const saved = await prisma.userPasskeyCredential.upsert({
    where: { credentialId },
    update: {
      userId: session.userId,
      publicKey,
      counter,
      transports: transports ?? undefined,
      deviceLabel,
      backedUp,
      disabledAt: null,
      lastUsedAt: new Date(),
    },
    create: {
      userId: session.userId,
      credentialId,
      publicKey,
      counter,
      transports: transports ?? undefined,
      deviceLabel,
      backedUp,
      lastUsedAt: new Date(),
    },
  });

  await prisma.webAuthnChallenge.update({
    where: { id: challengeRow.id },
    data: { consumedAt: new Date() },
  }).catch(() => null);

  return json(200, { ok: true, passkey: passkeyDisplay(saved) });
}
