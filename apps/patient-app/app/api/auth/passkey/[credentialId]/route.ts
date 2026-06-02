// apps/patient-app/app/api/auth/passkey/[credentialId]/route.ts
import { json, prisma, requirePatientSession } from '../_lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_: Request, ctx: { params: { credentialId: string } }) {
  const session = await requirePatientSession();
  if (!session.ok) return json(session.status, { ok: false, error: session.error });

  const id = String(ctx.params.credentialId || '').trim();
  if (!id) return json(400, { ok: false, error: 'Passkey id required.' });

  const existing = await prisma.userPasskeyCredential.findFirst({
    where: {
      id,
      userId: session.userId,
      disabledAt: null,
    },
  });

  if (!existing) {
    return json(404, { ok: false, error: 'Passkey not found.' });
  }

  await prisma.userPasskeyCredential.update({
    where: { id: existing.id },
    data: { disabledAt: new Date() },
  });

  return json(200, { ok: true });
}
