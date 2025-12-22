// apps/patient-app/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import cleanText from '@/lib/cleanText';
import { CLINICIANS as MOCK_CLINICIANS } from '@/mock/clinicians';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 25;

function mapOut(c: any) {
  return {
    id: c.id,
    name: cleanText(c.displayName ?? c.name ?? ''),
    specialty: cleanText(c.specialty ?? ''),
    location: cleanText(c.meta?.location ?? c.city ?? c.location ?? ''),
    cls: c.cls ?? 'Doctor',
    gender: c.gender ?? null,
    priceZAR: c.feeCents ? Math.round((c.feeCents ?? 0) / 100) : undefined,
    rating: typeof c.rating === 'number' ? c.rating : 0,
    online: Boolean(c.online),
    lastBookedAt: c.lastBookedAt ? +new Date(c.lastBookedAt) : null,
    lastSeenAt: c.lastSeenAt ? +new Date(c.lastSeenAt) : null,
    onlineSeq: c.onlineSeq ?? null,
    recentBookedCount: c.recentBookedCount ?? 0,
    meta: c.meta ?? {},

    // surfaced for debugging / future tools
    status: c.status ?? null,
    disabled: Boolean(c.disabled),
    archived: Boolean(c.archived),
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const specialty = url.searchParams.get('specialty') || undefined;
    const gender = url.searchParams.get('gender') || undefined;
    const location = url.searchParams.get('location') || undefined;

    // support both perPage and legacy limit
    const page = Math.max(DEFAULT_PAGE, Number(url.searchParams.get('page') || DEFAULT_PAGE));
    const perPageParam =
      url.searchParams.get('perPage') ??
      url.searchParams.get('limit') ??
      String(DEFAULT_PER_PAGE);
    const perPage = Math.min(500, Math.max(5, Number(perPageParam || DEFAULT_PER_PAGE)));

    // If Prisma is not available in dev, return mock data gracefully.
    if (!prisma) {
      const start = (page - 1) * perPage;
      let list = MOCK_CLINICIANS.slice();

      // visibility rules on mocks (missing flags => active)
      list = list.filter((c: any) => {
        const statusStr = c.status != null ? String(c.status).toLowerCase() : 'active';
        const statusOk = statusStr === 'active';
        const disabledOk = !c.disabled;
        const archivedOk = !c.archived;
        return statusOk && disabledOk && archivedOk;
      });

      // basic filtering to match UI
      if (q) {
        const qq = q.toLowerCase();
        list = list.filter((c: any) => {
          const name = (c.name || c.displayName || '').toLowerCase();
          const spec = (c.specialty || '').toLowerCase();
          const loc = (c.location || '').toLowerCase();
          return (
            name.includes(qq) ||
            spec.includes(qq) ||
            loc.includes(qq)
          );
        });
      }
      if (specialty) list = list.filter((c: any) => c.specialty === specialty);
      if (gender) list = list.filter((c: any) => (c.gender || '').trim() === gender);
      if (location) list = list.filter((c: any) => c.location === location);

      const total = list.length;
      const pageItems = list.slice(start, start + perPage).map((c: any) =>
        mapOut({
          ...c,
          feeCents: typeof c.priceZAR === 'number' ? c.priceZAR * 100 : (c.feeCents ?? 0),
          status: c.status ?? 'active',
          disabled: Boolean(c.disabled),
          archived: Boolean(c.archived),
        })
      );

      return NextResponse.json({
        ok: true,
        items: pageItems,
        clinicians: pageItems,
        meta: { total, page, perPage },
      });
    }

    // Prisma-backed path
    const where: any = {
      status: 'active',
      disabled: false,
      archived: false,
    };

    if (specialty) where.specialty = specialty;
    if (gender) where.gender = gender;
    if (location) {
      // prefer meta.location if present
      where.meta = { path: ['location'], equals: location };
    }

    if (q) {
      const clean = q.toLowerCase();
      where.OR = [
        { displayName: { contains: clean, mode: 'insensitive' } },
        { specialty: { contains: clean, mode: 'insensitive' } },
        { city: { contains: clean, mode: 'insensitive' } },
      ];
    }

    const orderBy = [
      { online: 'desc' },
      { recentBookedCount: 'asc' },
      { lastBookedAt: 'asc' },
      { onlineSeq: 'asc' },
      { rating: 'desc' },
      { displayName: 'asc' },
    ];

    const [items, total] = await Promise.all([
      prisma.clinicianProfile.findMany({
        where,
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy,
        select: {
          id: true,
          displayName: true,
          specialty: true,
          gender: true,
          feeCents: true,
          rating: true,
          online: true,
          lastBookedAt: true,
          lastSeenAt: true,
          onlineSeq: true,
          recentBookedCount: true,
          meta: true,
          city: true,

          status: true,
          disabled: true,
          archived: true,
        },
      }),
      prisma.clinicianProfile.count({ where }),
    ]);

    const mapped = items.map(mapOut);

    return NextResponse.json({
      ok: true,
      items: mapped,
      clinicians: mapped,
      meta: { total, page, perPage },
    });
  } catch (err: any) {
    console.error('clinicians GET error (fairness)', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
