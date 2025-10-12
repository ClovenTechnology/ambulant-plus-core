// apps/api-gateway/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function upsertClinician(userId: string, displayName: string, feeCents = 60000) {
  await prisma.clinicianProfile.upsert({
    where: { userId },
    update: { displayName, feeCents, currency: 'ZAR' },
    create: { userId, displayName, feeCents, currency: 'ZAR' },
  });
  await prisma.clinicianSchedule.upsert({
    where: { userId },
    update: { country: 'ZA', timezone: 'Africa/Johannesburg', template: JSON.stringify({}), exceptions: JSON.stringify({}) },
    create: { userId, country: 'ZA', timezone: 'Africa/Johannesburg', template: JSON.stringify({}), exceptions: JSON.stringify({}) },
  });
  await prisma.clinicianConsultSettings.upsert({
    where: { userId },
    update: { defaultStandardMin: 45, defaultFollowupMin: 20, minAdvanceMinutes: 30, maxAdvanceDays: 30 },
    create: { userId, defaultStandardMin: 45, defaultFollowupMin: 20, minAdvanceMinutes: 30, maxAdvanceDays: 30 },
  });
  await prisma.clinicianRefundPolicy.upsert({
    where: { userId },
    update: { within24hPercent: 50, noShowPercent: 0, clinicianMissPercent: 100, networkProrate: true },
    create: { userId, within24hPercent: 50, noShowPercent: 0, clinicianMissPercent: 100, networkProrate: true },
  });
}

async function main() {
  await upsertClinician('clin-za-001', 'Dr A', 60000);
  await upsertClinician('clin-za-002', 'Dr B', 70000);
  console.log('Seeded clinicians + settings.');
}
main().then(()=>prisma.$disconnect());
