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

type StoredVital = {
  patientId: string;
  deviceId: string;
  t: Date;
  vType: string;
  valueNum: number;
  unit?: string | null;
  roomId?: string | null;
  metadata?: any | null;
  observationId: string;
  receivedAt: Date;
  timeAuthority: 'SOURCE_REPORTED' | 'SERVER_RECEIVED_FALLBACK';
  interpretationStatus: 'ACTIVE' | 'SUSPECT';
  statusReasonCode?: string | null;
};

type StoreVitalsContext = {
  requestId?: string | null;
  app?: string | null;
  source?: string | null;
};

export async function storeVitals(
  v: StoredVital[],
  context: StoreVitalsContext = {},
) {
  if (!v.length) return [];

  return prisma.$transaction(async (tx) => {
    const created = [];

    for (const e of v) {
      const row = await tx.vitalSample.create({
        data: {
          patientId: e.patientId,
          deviceId: e.deviceId,
          t: e.t,
          vType: e.vType,
          valueNum: e.valueNum,
          unit: e.unit ?? null,
          roomId: e.roomId ?? null,
          metadata: e.metadata ?? null,
          observationId: e.observationId,
          receivedAt: e.receivedAt,
          timeAuthority: e.timeAuthority,
          interpretationStatus: e.interpretationStatus,
          statusChangedAt: e.interpretationStatus === 'SUSPECT' ? e.receivedAt : null,
          statusReasonCode: e.statusReasonCode ?? null,
        },
      });

      created.push(row);

      if (e.interpretationStatus === 'SUSPECT') {
        await tx.vitalSampleTrustEvent.create({
          data: {
            vitalSampleId: row.id,
            observationId: e.observationId,
            patientId: e.patientId,
            fromStatus: null,
            toStatus: 'SUSPECT',
            reasonCode: e.statusReasonCode ?? null,
            app: context.app ?? 'api-gateway',
            requestId: context.requestId ?? null,
            meta: {
              automatic: true,
              source: context.source ?? null,
              timeAuthority: e.timeAuthority,
            },
          },
        });
      }
    }

    return created;
  });
}
