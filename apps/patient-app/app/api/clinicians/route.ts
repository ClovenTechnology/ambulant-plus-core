// apps/patient-app/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import cleanText from '@/lib/cleanText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapOut(c: any) {
  return {
    id: String(c.id ?? ''),
    name: cleanText(c.displayName ?? c.name ?? ''),
    specialty: cleanText(c.specialty ?? ''),
    location: cleanText(c.meta?.location ?? c.city ?? c.location ?? ''),
    cls: c.cls ?? c.meta?.class ?? 'Doctor',
    gender: c.gender ?? null,
    priceZAR:
      typeof c.feeCents === 'number'
        ? Math.round(c.feeCents / 100)
        : typeof c.priceZAR === 'number'
          ? c.priceZAR
          : undefined,
    priceCents: typeof c.feeCents === 'number' ? c.feeCents : undefined,
    currency: c.currency ?? 'ZAR',
    rating: typeof c.rating === 'number' ? c.rating : 0,
    ratingCount:
      typeof c.ratingCount === 'number'
        ? c.ratingCount
        : typeof c.ratingsCount === 'number'
          ? c.ratingsCount
          : undefined,
    online: Boolean(c.online),
    lastBookedAt: c.lastBookedAt ? +new Date(c.lastBookedAt) : null,
    lastSeenAt: c.lastSeenAt ? +new Date(c.lastSeenAt) : null,
    onlineSeq: c.onlineSeq ?? null,
    recentBookedCount: c.recentBookedCount ?? 0,
    status: c.status ?? null,
    disabled: Boolean(c.disabled),
    archived: Boolean(c.archived),
    acceptsMedicalAid:
      typeof c.acceptsMedicalAid === 'boolean'
        ? c.acceptsMedicalAid
        : Boolean(c.meta?.acceptsMedicalAid),
    acceptedSchemes: Array.isArray(c.acceptedSchemes)
      ? c.acceptedSchemes
      : Array.isArray(c.meta?.acceptedSchemes)
        ? c.meta.acceptedSchemes
        : [],
    practiceName: c.practiceName ?? c.meta?.practiceName ?? undefined,
    country: c.country ?? c.meta?.country ?? 'ZA',
    speaks: Array.isArray(c.speaks)
      ? c.speaks
      : Array.isArray(c.meta?.speaks)
        ? c.meta.speaks
        : undefined,
    yearsExp:
      typeof c.yearsExp === 'number'
        ? c.yearsExp
        : typeof c.meta?.yearsExp === 'number'
          ? c.meta.yearsExp
          : undefined,
    joinedAt: c.createdAt ?? c.joinedAt ?? null,
    meta: c.meta ?? {},
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const q = (url.searchParams.get('q') ?? '').trim();
    const specialty = url.searchParams.get('specialty') || undefined;
    const gender = url.searchParams.get('gender') || undefined;
    const location = url.searchParams.get('location') || undefined;
    const country = url.searchParams.get('country') || undefined;

    const page = Math.max(
      DEFAULT_PAGE,
      safeNumber(url.searchParams.get('page'), DEFAULT_PAGE),
    );

    const perPage = Math.min(
      500,
      Math.max(
        5,
        safeNumber(
          url.searchParams.get('perPage') ??
            url.searchParams.get('limit') ??
            DEFAULT_PER_PAGE,
          DEFAULT_PER_PAGE,
        ),
      ),
    );

    if (!prisma || !(prisma as any).clinicianProfile?.findMany) {
      return json({
        ok: true,
        items: [],
        clinicians: [],
        meta: {
          total: 0,
          page,
          perPage,
          source: 'store_unavailable',
        },
      });
    }

    const where: any = {
      status: {
        in: ['active', 'ACTIVE'],
      },
      disabled: false,
      archived: false,
    };

    if (specialty) {
      where.specialty = { contains: specialty, mode: 'insensitive' };
    }

    if (gender) {
      where.gender = gender;
    }

    if (country) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { country },
            { meta: { path: ['country'], equals: country } },
          ],
        },
      ];
    }

    if (location) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { city: { contains: location, mode: 'insensitive' } },
            { location: { contains: location, mode: 'insensitive' } },
            { meta: { path: ['location'], string_contains: location } },
          ],
        },
      ];
    }

    if (q) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { specialty: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const orderBy: any[] = [
      { online: 'desc' },
      { recentBookedCount: 'asc' },
      { lastBookedAt: 'asc' },
      { onlineSeq: 'asc' },
      { rating: 'desc' },
      { displayName: 'asc' },
    ];

    const [items, total] = await Promise.all([
      (prisma as any).clinicianProfile.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy,
      }),
      (prisma as any).clinicianProfile.count({ where }),
    ]);

    const mapped = Array.isArray(items)
      ? items
          .map(mapOut)
          .filter((x) => {
            if (!x.id) return false;

            const status = String(x.status || '').toLowerCase();
            if (status !== 'active') return false;

            if (x.disabled || x.archived) return false;

            const op = (x as any).meta?.operational ?? (x as any).operational;
            if (op) {
              if (op.canBeListed === false) return false;
              if (op.canBeBooked === false) return false;
            }

            return true;
          })
      : [];

    return json({
      ok: true,
      items: mapped,
      clinicians: mapped,
      meta: {
        total,
        page,
        perPage,
        source: 'database',
      },
    });
  } catch (err: any) {
    console.error('GET /api/clinicians error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_load_clinicians',
        items: [],
        clinicians: [],
        meta: {
          total: 0,
          page: DEFAULT_PAGE,
          perPage: DEFAULT_PER_PAGE,
        },
      },
      500,
    );
  }
}