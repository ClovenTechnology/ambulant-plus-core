import { prisma } from '@/src/lib/db';

export async function findDeviceSecret(deviceId: string) {
  const row = await prisma.device.findUnique({ where: { deviceId } });
  return row?.secret ?? null;
}

export async function getDeviceById(deviceId: string) {
  return prisma.device.findUnique({ where: { deviceId } });
}

/** Optional helper if you add explicit fields for category/model in DB later */
export function asDeviceKey(row: any) {
  // If you don't yet have category/model columns, try to parse from a single 'vendor' field like:
  // 'linktop/iomt/health-monitor' or return vendor-only for fallback.
  const raw = String(row?.vendor || "");
  const parts = raw.split("/").map((s: string) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return { vendor: parts[0], category: parts[1], model: parts[2] };
  return { vendor: row?.vendor ?? null, category: row?.category ?? null, model: row?.model ?? null };
}

export async function storeVitals(v: Array<{
  patientId: string; deviceId: string; t: Date; vType: string; valueNum: number; unit?: string|null; roomId?: string|null;
}>) {
  if (!v.length) return;
  await prisma.vitalSample.createMany({
    data: v.map(e => ({
      patientId: e.patientId,
      deviceId: e.deviceId,
      t: e.t,
      vType: e.vType,
      valueNum: e.valueNum,
      unit: e.unit ?? null,
      roomId: e.roomId ?? null,
    })),
  });
}
