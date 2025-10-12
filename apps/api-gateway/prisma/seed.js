const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // clinicians used by UI/tests
  await prisma.clinicianProfile.upsert({
    where: { userId: 'clin-za-001' },
    update: {},
    create: { userId: 'clin-za-001', displayName: 'Dr Z A', feeCents: 60000, currency: 'ZAR' },
  });
  await prisma.clinicianProfile.upsert({
    where: { userId: 'clin-za-002' },
    update: {},
    create: { userId: 'clin-za-002', displayName: 'Dr Z B', feeCents: 55000, currency: 'ZAR' },
  });
  await prisma.clinicianProfile.upsert({
    where: { userId: 'doctor-12' },
    update: {},
    create: { userId: 'doctor-12', displayName: 'Dr Twelve', feeCents: 65000, currency: 'ZAR' },
  });
  // default refund policies (optional)
  await prisma.clinicianRefundPolicy.upsert({
    where: { userId: 'doctor-12' },
    update: {},
    create: { userId: 'doctor-12', within24hPercent: 50, noShowPercent: 0, clinicianMissPercent: 100, networkProrate: true },
  });
  console.log('Seed OK');
}

main().finally(() => prisma.$disconnect());
