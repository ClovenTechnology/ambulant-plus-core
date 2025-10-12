// apps/api-gateway/src/devices/seed.ts
import { PrismaClient } from '@prisma/client';
import { SERVICE_MAPS } from './serviceMap';

const prisma = new PrismaClient();

/**
 * Seed (or upsert) the DeviceCatalog table from SERVICE_MAPS.
 * - services JSON is stored as string (per current schema)
 */
export async function seedDeviceCatalog() {
  const entries = Object.entries(SERVICE_MAPS);
  for (const [slug, sm] of entries) {
    const labelGuess =
      slug.includes('stethoscope') ? 'DueCare Stethoscope' :
      slug.includes('otoscope') ? 'DueCare HD Otoscope' :
      slug.includes('nexring-ecg') ? 'NexRing ECG' :
      slug.includes('nexring') ? 'NexRing' :
      slug.includes('vitals-360') ? 'Vitals 360' :
      slug.includes('health-monitor') ? 'Health Monitor' :
      slug;

    const modality =
      slug.includes('stethoscope') ? 'stethoscope' :
      slug.includes('otoscope') ? 'otoscope' :
      slug.includes('nexring') ? 'wearable' :
      slug.includes('vitals') || slug.includes('monitor') ? 'iomt' : 'iomt';

    const services = JSON.stringify(sm);

    await prisma.deviceCatalog.upsert({
      where: { slug },
      create: {
        slug,
        label: labelGuess,
        vendor: 'DueCare',
        modality,
        transport: sm.transport,
        services,
      },
      update: {
        label: labelGuess,
        vendor: 'DueCare',
        modality,
        transport: sm.transport,
        services,
      },
    });
  }
}

if (require.main === module) {
  seedDeviceCatalog()
    .then(() => {
      console.log('[devices/seed] seeded DeviceCatalog from SERVICE_MAPS');
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('[devices/seed] error', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
