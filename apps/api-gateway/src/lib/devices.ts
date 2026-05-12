// apps/api-gateway/src/lib/devices.ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';

export type DeviceCatalogSeedItem = {
  slug: string;
  label: string;
  vendor: string;
  modality: string;
  transport: string;
  services?: Prisma.InputJsonValue;
};

function cleanStr(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeJson(value: unknown): Prisma.InputJsonValue {
  if (value == null) return {};

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return {};
  }
}

function normalizeTransport(value: unknown): string {
  const transport = cleanStr(value).toLowerCase();

  if (
    transport === 'ble' ||
    transport === 'usb' ||
    transport === 'camera' ||
    transport === 'cloud' ||
    transport === 'mqtt' ||
    transport === 'manual'
  ) {
    return transport;
  }

  return 'ble';
}

export async function listUserDevices(userId: string) {
  const uid = cleanStr(userId);

  if (!uid) return [];

  return prisma.userDevice.findMany({
    where: { userId: uid },
    include: { catalog: true },
  });
}

export async function upsertCatalog(items: DeviceCatalogSeedItem[]) {
  const results = [];

  for (const it of items) {
    const slug = cleanStr(it.slug);
    if (!slug) continue;

    const label = cleanStr(it.label) || slug;
    const vendor = cleanStr(it.vendor) || 'DueCare';
    const modality = cleanStr(it.modality) || 'device';
    const transport = normalizeTransport(it.transport);

    const row = await prisma.deviceCatalog.upsert({
      where: { slug },
      update: {
        label,
        vendor,
        modality,
        transport,
        ...(it.services === undefined
          ? {}
          : { services: normalizeJson(it.services) }),
      },
      create: {
        slug,
        label,
        vendor,
        modality,
        transport,
        ...(it.services === undefined
          ? {}
          : { services: normalizeJson(it.services) }),
      },
    });

    results.push(row);
  }

  return results;
}

export async function pairUserDevice(
  userId: string,
  slug: string,
  meta?: unknown,
) {
  const uid = cleanStr(userId);
  const deviceSlug = cleanStr(slug);

  if (!uid) {
    throw new Error('userId_required');
  }

  if (!deviceSlug) {
    throw new Error('device_slug_required');
  }

  const catalog = await prisma.deviceCatalog.findUnique({
    where: { slug: deviceSlug },
    select: {
      slug: true,
      transport: true,
    },
  });

  if (!catalog) {
    throw new Error('unknown_device');
  }

  return prisma.userDevice.create({
    data: {
      userId: uid,
      transport: normalizeTransport(catalog.transport),
      catalog: {
        connect: { slug: catalog.slug },
      },
      meta: normalizeJson(meta),
    },
    include: {
      catalog: true,
    },
  });
}