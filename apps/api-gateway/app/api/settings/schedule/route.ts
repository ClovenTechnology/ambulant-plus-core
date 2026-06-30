// apps/api-gateway/app/api/settings/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { getSchedule, setSchedule } from '@/src/store/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function cleanStr(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

function unique(values: unknown[]) {
  return Array.from(
    new Set(values.map((x) => String(x || '').trim()).filter(Boolean)),
  );
}

function safeParseJson(value: unknown, fallback: any) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function resolveClinicianIdentity(req: NextRequest) {
  const rawUid = cleanStr(
    req.headers.get('x-clinician-id') ||
      req.headers.get('x-ambulant-user-id') ||
      req.headers.get('x-user-id') ||
      req.headers.get('x-uid'),
  );

  if (!rawUid) {
    return {
      error: json({ ok: false, error: 'unauthorized' }, 401),
      canonicalUserId: '',
      keys: [] as string[],
    };
  }

  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: [
        { id: rawUid },
        { userId: rawUid },
        { email: rawUid },
      ],
    },
    select: {
      id: true,
      userId: true,
      email: true,
    },
    orderBy: { createdAt: 'desc' },
  }).catch(() => null);

  const canonicalUserId =
    cleanStr(clinician?.userId) ||
    cleanStr(clinician?.email) ||
    cleanStr(clinician?.id) ||
    rawUid;

  const keys = unique([
    canonicalUserId,
    clinician?.userId,
    clinician?.email,
    clinician?.id,
    rawUid,
  ]);

  return {
    error: null,
    canonicalUserId,
    keys,
  };
}

async function findScheduleRow(keys: string[], canonicalUserId: string) {
  if (!keys.length) return null;

  const rows = await (prisma as any).clinicianSchedule.findMany({
    where: { userId: { in: keys } },
    select: {
      userId: true,
      country: true,
      timezone: true,
      template: true,
      exceptions: true,
    },
  });

  if (!rows.length) return null;

  const preferred = unique([canonicalUserId, ...keys]);

  return rows
    .slice()
    .sort((a: any, b: any) => preferred.indexOf(a.userId) - preferred.indexOf(b.userId))[0];
}

function rowToSchedule(row: any) {
  return {
    country: row?.country || 'ZA',
    timezone: row?.timezone || 'Africa/Johannesburg',
    template: safeParseJson(row?.template, {}),
    exceptions: safeParseJson(row?.exceptions, []),
  };
}

export async function GET(req: NextRequest) {
  const ident = await resolveClinicianIdentity(req);
  if (ident.error) return ident.error;

  const row = await findScheduleRow(ident.keys, ident.canonicalUserId);

  if (row) {
    return json(rowToSchedule(row));
  }

  const fallback = await getSchedule(ident.canonicalUserId);
  return json(fallback);
}

export async function PUT(req: NextRequest) {
  const ident = await resolveClinicianIdentity(req);
  if (ident.error) return ident.error;

  const body = await req.json();

  await setSchedule(ident.canonicalUserId, body);

  // Keep any existing legacy/alias rows aligned so old identifiers do not drift.
  const existing = await (prisma as any).clinicianSchedule.findMany({
    where: { userId: { in: ident.keys } },
    select: { userId: true },
  }).catch(() => []);

  for (const row of existing) {
    const alias = cleanStr(row?.userId);
    if (alias && alias !== ident.canonicalUserId) {
      await setSchedule(alias, body).catch(() => null);
    }
  }

  return json({ ok: true });
}
