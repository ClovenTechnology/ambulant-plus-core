import { prisma } from '@/src/lib/prisma';
import type { CheckRow } from '@/src/lib/credentialing/readiness';

export async function loadClinicianComplianceChecks(args: {
  clinicianId: string;
  orgId?: string;
}): Promise<CheckRow[]> {
  const orgId = args.orgId ?? 'org-default';

  const rows = await prisma.clinicianComplianceCheck.findMany({
    where: {
      clinicianId: args.clinicianId,
      orgId,
    },
    select: {
      kind: true,
      regulator: true,
      status: true,
      expiresAt: true,
    },
  });

  return rows.map((r) => ({
    kind: r.kind as any,
    regulator: r.regulator as any,
    status: r.status as any,
    expiresAt: r.expiresAt ?? null,
  }));
}