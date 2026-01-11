// apps/api-gateway/src/lib/credentialing/ensureChecks.ts

import { prisma } from '@/src/lib/db';
import { getPolicy } from './policies';

export async function ensureDefaultComplianceChecks(args: {
  clinicianId: string;
  orgId?: string;
  professionKey: string;
}) {
  const { clinicianId } = args;
  const orgId = args.orgId ?? 'org-default';

  const policy = getPolicy(args.professionKey);
  if (!policy) return;

  const required = policy.requiredChecks
    .filter((c) => c.kind !== 'TRAINING_COMPLETION') // training completion is derived from ClinicianProfile
    .map((c) => ({
      kind: c.kind,
      regulator: c.regulator ?? null,
    }));

  await prisma.$transaction(
    required.map((r) =>
      prisma.clinicianComplianceCheck.upsert({
        where: {
          orgId_clinicianId_kind_regulator: {
            orgId,
            clinicianId,
            kind: r.kind as any,
            regulator: r.regulator as any,
          },
        },
        create: {
          orgId,
          clinicianId,
          kind: r.kind as any,
          regulator: r.regulator as any,
          status: 'missing' as any,
        },
        update: {}, // don’t overwrite existing decisions
      }),
    ),
  );
}
