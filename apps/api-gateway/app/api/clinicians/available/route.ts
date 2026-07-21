// apps/api-gateway/app/api/clinicians/available/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

type Clin = {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  name?: string | null;
  specialty?: string | null;
  status?: string | null;
  trainingCompleted?: boolean | null;
  disabled?: boolean | null;
  archived?: boolean | null;
  onboardingStatus?: string | null;
  trainingStatus?: string | null;
  isAvailable?: boolean | null;
  discoverable?: boolean | null;
  visible?: boolean | null;
  lastSeenAt?: Date | string | null;
  updatedAt?: Date | string | null;
  meta?: any;
};

function parseMeta(raw: unknown): Record<string, any> {
  if (!raw) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function boolFromMeta(meta: Record<string, any>, keys: string[], fallback = false) {
  for (const key of keys) {
    if (typeof meta[key] === 'boolean') return meta[key];
    if (typeof meta[key] === 'string') {
      const value = meta[key].trim().toLowerCase();
      if (value === 'true') return true;
      if (value === 'false') return false;
    }
  }

  return fallback;
}

function isTrainingComplete(
  clinician: Clin,
  _meta: Record<string, any>,
) {
  return (
    clinician.trainingCompleted ===
    true
  );
}

function isDiscoverable(clinician: Clin, meta: Record<string, any>) {
  if (clinician.discoverable === false || clinician.visible === false) return false;

  if (
    meta.discoverable === false ||
    meta.visible === false ||
    meta.isDiscoverable === false ||
    meta.patientVisible === false
  ) {
    return false;
  }

  return true;
}

function isRecentlyAvailable(clinician: Clin, meta: Record<string, any>, now: number) {
  if (clinician.isAvailable === true) return true;

  if (
    boolFromMeta(meta, ['isAvailable', 'available', 'online'], false) ||
    String(meta.availabilityStatus ?? '').toLowerCase() === 'available'
  ) {
    return true;
  }

  const rawLastSeen = clinician.lastSeenAt ?? meta.lastSeenAt ?? meta.last_seen_at ?? clinician.updatedAt;
  const lastSeenMs = rawLastSeen ? new Date(rawLastSeen).getTime() : 0;

  if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) return false;

  // Consider clinician recently reachable if seen within the last 15 minutes.
  return now - lastSeenMs <= 15 * 60 * 1000;
}

async function loadClinicians(): Promise<Clin[]> {
  const delegate = (prisma as any).clinicianProfile;

  if (!delegate?.findMany) return [];

  const rows = await delegate.findMany({
    take: 200,
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return Array.isArray(rows) ? rows : [];
}

export async function GET() {
  try {
    const clinicians = await loadClinicians();
    const now = Date.now();

    const visible = clinicians
      .filter((clinician) => {
        const meta = parseMeta(clinician.meta);

        const status =
          String(clinician.status || '')
            .trim()
            .toLowerCase();

        return (
          status === 'active' &&
          clinician.disabled !== true &&
          clinician.archived !== true &&
          isDiscoverable(
            clinician,
            meta,
          ) &&
          isTrainingComplete(
            clinician,
            meta,
          ) &&
          isRecentlyAvailable(
            clinician,
            meta,
            now,
          )
        );
      })
      .map((clinician) => {
        const meta = parseMeta(clinician.meta);

        return {
          id: clinician.id,
          userId: clinician.userId ?? null,
          displayName:
            clinician.displayName ??
            clinician.name ??
            meta.displayName ??
            meta.name ??
            'Clinician',
          specialty: clinician.specialty ?? meta.specialty ?? null,
          status: clinician.status ?? null,
          available: true,
          lastSeenAt: clinician.lastSeenAt ?? meta.lastSeenAt ?? null,
        };
      });

    return NextResponse.json({
      ok: true,
      clinicians: visible,
      count: visible.length,
    });
  } catch (err: any) {
    console.error('GET /api/clinicians/available error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'failed_to_load_available_clinicians',
        clinicians: [],
        count: 0,
      },
      { status: 500 },
    );
  }
}
