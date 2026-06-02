// apps/patient-app/app/api/auth/passkey/login/options/route.ts
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getOrigin, getRpID, json, prisma } from '../../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const options = await generateAuthenticationOptions({
    rpID: getRpID(req),
    userVerification: 'preferred',
  } as any);

  await prisma.webAuthnChallenge.create({
    data: {
      userId: null,
      identifier: null,
      challenge: options.challenge,
      type: 'login',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return json(200, {
    ok: true,
    options,
    rpID: getRpID(req),
    origin: getOrigin(req),
  });
}
