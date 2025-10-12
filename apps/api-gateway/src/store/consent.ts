import { prisma } from '@/src/lib/db';

export async function grantConsent(patientId: string, delegateId: string, scope: string, endsAt?: Date) {
  return prisma.consentGrant.create({ data: { patientId, delegateId, scope, endsAt: endsAt ?? null } });
}
export async function revokeConsent(id: string) {
  return prisma.consentGrant.update({ where: { id }, data: { revokedAt: new Date() } });
}
