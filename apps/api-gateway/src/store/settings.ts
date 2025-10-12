import { prisma } from '@/src/lib/db';

export async function getEffectiveConsultPolicy(clinicianId: string) {
  // Read Admin policy + clinician overrides; merge on server so clients are consistent
  // Below are simple placeholders – replace with your actual tables if different
  const admin = await prisma.consultAdminPolicy.findFirst().catch(() => null);
  const clin  = await prisma.consultClinicianPolicy.findFirst({ where: { clinicianId } }).catch(() => null);

  const defaults = {
    refunds: {
      within24hPercent: 50,
      noShowPercent: 0,
      clinicianMissPercent: 100,
      networkProrate: true,
    },
    // other admin/clinician consult knobs here…
  };

  const merged = {
    refunds: {
      within24hPercent: clin?.refundsWithin24hPercent ?? admin?.refundsWithin24hPercent ?? defaults.refunds.within24hPercent,
      noShowPercent: clin?.refundsNoShowPercent ?? admin?.refundsNoShowPercent ?? defaults.refunds.noShowPercent,
      clinicianMissPercent: clin?.refundsClinicianMissPercent ?? admin?.refundsClinicianMissPercent ?? defaults.refunds.clinicianMissPercent,
      networkProrate: (clin?.refundsNetworkProrate ?? admin?.refundsNetworkProrate) ?? defaults.refunds.networkProrate,
    }
  };

  return merged;
}
