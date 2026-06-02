// apps/patient-app/app/api/auth/passkey/register/options/route.ts
import { generateRegistrationOptions } from '@simplewebauthn/server';
import {
  cleanStr,
  getOrigin,
  getRpID,
  getRpName,
  json,
  prisma,
  requirePatientSession,
} from '../../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requirePatientSession();
  if (!session.ok) return json(session.status, { ok: false, error: session.error });

  const body = await req.json().catch(() => ({} as any));
  const deviceLabel = cleanStr(body?.deviceLabel, 80) || 'Personal passkey';

  const cred = await prisma.authCredential.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, disabled: true, actorType: true },
  });

  if (!cred || cred.disabled || cred.actorType !== 'PATIENT') {
    return json(401, { ok: false, error: 'Patient account not available.' });
  }

  const profile = await prisma.patientProfile.findFirst({
    where: { userId: cred.id },
    select: { id: true, name: true, contactEmail: true },
  });

  const existing = await prisma.userPasskeyCredential.findMany({
    where: { userId: session.userId, disabledAt: null },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: getRpName(),
    rpID: getRpID(req),
    userID: Buffer.from(session.userId, 'utf8'),
    userName: cred.email,
    userDisplayName: profile?.name || cred.email,
    attestationType: 'none',
    excludeCredentials: existing.map((item) => ({
      id: item.credentialId,
      transports: Array.isArray(item.transports) ? (item.transports as any) : undefined,
    })) as any,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  } as any);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.webAuthnChallenge.create({
    data: {
      userId: session.userId,
      identifier: cred.email,
      challenge: options.challenge,
      type: 'register',
      expiresAt,
    },
  });

  return json(200, {
    ok: true,
    options,
    deviceLabel,
    rpID: getRpID(req),
    origin: getOrigin(req),
  });
}
