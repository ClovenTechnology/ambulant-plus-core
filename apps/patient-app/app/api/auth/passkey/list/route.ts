// apps/patient-app/app/api/auth/passkey/list/route.ts
import { json, passkeyDisplay, prisma, requirePatientSession } from '../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requirePatientSession();
  if (!session.ok) return json(session.status, { ok: false, error: session.error });

  const passkeys = await prisma.userPasskeyCredential.findMany({
    where: { userId: session.userId, disabledAt: null },
    orderBy: { createdAt: 'desc' },
  });

  return json(200, {
    ok: true,
    passkeys: passkeys.map(passkeyDisplay),
  });
}
