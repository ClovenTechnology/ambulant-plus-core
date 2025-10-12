import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/db';

function idFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$|-{2,}/g, '').slice(0, 40);
}

async function run() {
  const csv = fs.readFileSync(path.join(process.cwd(), 'prisma', 'clinicians.csv'), 'utf8'); // name,city,specialty,priceZAR
  const rows = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(1); // skip header
  for (const line of rows) {
    const [name, city, specialty='General Practice', price='650'] = line.split(',');
    const userId = idFromName(name);
    await prisma.clinicianProfile.upsert({
      where: { userId },
      update: { displayName: name, city, specialty, feeCents: Math.round(Number(price) * 100), currency: 'ZAR' },
      create: { userId, displayName: name, city, specialty, feeCents: Math.round(Number(price) * 100), currency: 'ZAR' },
    });
  }
  console.log('Seeded clinicians:', rows.length);
}

run().catch(e => { console.error(e); process.exit(1); });
