// Seed minimal catalog rows. Run with: pnpm -w --filter api-gateway tsx scripts/seedDevices.ts
import { prisma } from '../src/lib/prisma';


async function main() {
const rows = [
{ slug: 'duecare.health-monitor', category: 'iomt', oem: 'DueCare', model: 'Vitals360', transport: 'ble' },
{ slug: 'duecare.stethoscope', category: 'stethoscope', oem: 'DueCare', model: 'HC21', transport: 'ble' },
{ slug: 'duecare.otoscope', category: 'otoscope', oem: 'DueCare', model: 'HD Otoscope', transport: 'usb' },
{ slug: 'duecare.nexring', category: 'wearable', oem: 'DueCare', model: 'NexRing', transport: 'ble' },
{ slug: 'duecare.nexring-ecg', category: 'wearable', oem: 'DueCare', model: 'Cardio Ring', transport: 'ble' },
];


for (const r of rows) {
await prisma.deviceCatalog.upsert({
where: { slug: r.slug },
update: r,
create: { ...r, services: {} },
});
}
console.log('Seeded device catalog.');
}


main().finally(() => process.exit(0));