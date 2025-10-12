import { prisma } from '@/src/lib/db';

export async function listUserDevices(userId: string) {
  return prisma.userDevice.findMany({ where: { userId }, include: { catalog: true } });
}

export async function upsertCatalog(items: Array<{slug:string,label:string,vendor:string,modality:string,transport:string}>) {
  for (const it of items) {
    await prisma.deviceCatalog.upsert({
      where: { slug: it.slug },
      update: { label: it.label, vendor: it.vendor, modality: it.modality, transport: it.transport },
      create: { id: it.slug, slug: it.slug, label: it.label, vendor: it.vendor, modality: it.modality, transport: it.transport },
    });
  }
}

export async function pairUserDevice(userId: string, slug: string, meta?: any) {
  const catalog = await prisma.deviceCatalog.findUnique({ where: { slug } });
  if (!catalog) throw new Error('unknown_device');
  return prisma.userDevice.create({
    data: { userId, catalogId: catalog.id, meta: meta ?? {} }
  });
}
