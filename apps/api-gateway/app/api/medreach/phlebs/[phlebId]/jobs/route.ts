// apps/api-gateway/app/api/medreach/phlebs/[phlebId]/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function splitCsv(value: unknown) {
  return cleanString(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

async function findPhleb(phlebId: string) {
  return prisma.medReachPhlebProfile.findFirst({
    where: {
      OR: [{ id: phlebId }, { userId: phlebId }],
    },
    include: {
      defaultLab: true,
    },
  });
}

async function canSeePhlebJobs(req: NextRequest, phleb: any, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;

  if (role === 'phleb') {
    return Boolean(who.uid && phleb.userId === who.uid);
  }

  if (role === 'lab') {
    const labId = cleanString(req.headers.get('x-lab-id'));

    if (!labId) return false;

    if (phleb.defaultLabId === labId) return true;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: {
        active: true,
        ownerUserId: true,
      },
    });

    return Boolean(lab?.active && lab.ownerUserId && who.uid && lab.ownerUserId === who.uid);
  }

  if (role === 'lab_staff') {
    const labId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!labId || !who.uid) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return Boolean(staff?.labId && phleb.defaultLabId === staff.labId);
  }

  return false;
}

function buildEligibilityMap(rows: any[]) {
  const byOrderId = new Map<string, any[]>();

  for (const row of rows) {
    const list = byOrderId.get(row.orderId) ?? [];
    list.push(row);
    byOrderId.set(row.orderId, list);
  }

  return byOrderId;
}

function projectBundle(bundle: any | null) {
  if (!bundle) return null;

  return {
    id: bundle.id,
    orderId: bundle.orderId ?? null,
    encounterId: bundle.encounterId ?? null,
    patientId: bundle.patientId ?? null,
    clinicianId: bundle.clinicianId ?? null,
    drawId: bundle.drawId ?? null,
    labPartnerId: bundle.labPartnerId ?? null,
    status: bundle.status,
    labelPrintedAt: bundle.labelPrintedAt?.toISOString?.() ?? null,
    collectedAt: bundle.collectedAt?.toISOString?.() ?? null,
    sealedAt: bundle.sealedAt?.toISOString?.() ?? null,
    inTransitAt: bundle.inTransitAt?.toISOString?.() ?? null,
    receivedAtLabAt: bundle.receivedAtLabAt?.toISOString?.() ?? null,
    acceptedAt: bundle.acceptedAt?.toISOString?.() ?? null,
    rejectedAt: bundle.rejectedAt?.toISOString?.() ?? null,
    notes: bundle.notes ?? null,
    meta: bundle.meta ?? null,
    createdAt: bundle.createdAt?.toISOString?.() ?? null,
    updatedAt: bundle.updatedAt?.toISOString?.() ?? null,
  };
}

function projectJob(params: {
  draw: any;
  bundle: any | null;
  financial: any | null;
  eligibilityRows: any[];
  latestLocation: any | null;
}) {
  const { draw, bundle, financial, eligibilityRows, latestLocation } = params;

  const acceptedLab =
    eligibilityRows.find((row) => row.status === 'ACCEPTED') ??
    eligibilityRows.find((row) => row.labId === draw.partnerId) ??
    eligibilityRows[0] ??
    null;

  const lab = acceptedLab?.lab ?? null;

  return {
    id: draw.id,
    drawId: draw.id,
    jobId: draw.id,
    orderId: draw.orderId,
    encounterId: draw.encounterId,
    patientId: draw.patientId,
    clinicianId: draw.clinicianId ?? null,
    phlebId: draw.phlebId ?? null,

    labId: draw.partnerId ?? acceptedLab?.labId ?? null,
    partnerId: draw.partnerId ?? null,
    lab: lab
      ? {
          id: lab.id,
          name: lab.name,
          active: lab.active,
          status: lab.status,
          country: lab.country,
          currency: lab.currency,
          contact: lab.contact ?? null,
        }
      : null,

    status: draw.status,
    scheduledAt: draw.scheduledAt?.toISOString?.() ?? null,
    assignedAt: draw.assignedAt?.toISOString?.() ?? null,
    receivedByLabAt: draw.receivedByLabAt?.toISOString?.() ?? null,

    bundle: projectBundle(bundle),
    bundleStatus: bundle?.status ?? null,

    finance: financial
      ? {
          id: financial.id,
          currency: financial.currency,
          subtotalCents: financial.subtotalCents,
          logisticsFeeCents: financial.logisticsFeeCents,
          urgentSurchargeCents: financial.urgentSurchargeCents,
          coldChainSurchargeCents: financial.coldChainSurchargeCents,
          platformFeeCents: financial.platformFeeCents,
          labGrossCents: financial.labGrossCents,
          phlebGrossCents: financial.phlebGrossCents,
          labNetCents: financial.labNetCents,
          phlebNetCents: financial.phlebNetCents,
          sponsorAmountMinor: financial.sponsorAmountMinor ?? null,
          patientCopayMinor: financial.patientCopayMinor ?? null,
        }
      : null,

    latestLocation: latestLocation
      ? {
          id: latestLocation.id,
          kind: latestLocation.kind,
          entityId: latestLocation.entityId,
          orderId: latestLocation.orderId ?? null,
          lat: latestLocation.lat,
          lng: latestLocation.lng,
          at: latestLocation.at?.toISOString?.() ?? null,
        }
      : null,

    createdAt: draw.createdAt?.toISOString?.() ?? null,
    updatedAt: draw.updatedAt?.toISOString?.() ?? null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const who = readIdentity(req.headers);
  const phlebId = cleanString(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  const phleb = await findPhleb(phlebId);

  if (!phleb) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  const allowed = await canSeePhlebJobs(req, phleb, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusCsv = splitCsv(url.searchParams.get('status'));
  const limit = cleanInt(url.searchParams.get('limit'), 100, 1, 300);
  const includeCompleted = cleanString(url.searchParams.get('includeCompleted')) === 'true';

  const possiblePhlebIds = Array.from(new Set([phleb.id, phleb.userId, phlebId].filter(Boolean)));

  const where: Record<string, any> = {
    phlebId: { in: possiblePhlebIds },
  };

  if (statusCsv.length > 0) {
    where.status = { in: statusCsv };
  } else if (!includeCompleted) {
    where.NOT = {
      status: {
        in: ['COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED'],
      },
    };
  }

  const draws = await prisma.draw.findMany({
    where,
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  });

  if (!draws.length) {
    return NextResponse.json({
      ok: true,
      data: [],
      meta: {
        phlebProfileId: phleb.id,
        userId: phleb.userId,
        count: 0,
      },
    });
  }

  const drawIds = draws.map((draw) => draw.id);
  const orderIds = Array.from(new Set(draws.map((draw) => draw.orderId).filter(Boolean)));

  const [bundles, financials, eligibilityRows] = await Promise.all([
    prisma.medReachSpecimenBundle.findMany({
      where: {
        drawId: { in: drawIds },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.medReachOrderFinancial.findMany({
      where: {
        OR: [{ drawId: { in: drawIds } }, { orderId: { in: orderIds } }],
      },
    }),
    prisma.medReachOrderEligibleLab.findMany({
      where: {
        orderId: { in: orderIds },
      },
      include: {
        lab: true,
      },
      orderBy: { invitedAt: 'asc' },
    }),
  ]);

  const bundleByDrawId = new Map(bundles.filter((bundle) => bundle.drawId).map((bundle) => [bundle.drawId, bundle]));
  const financialByDrawId = new Map(financials.filter((row) => row.drawId).map((row) => [row.drawId, row]));
  const financialByOrderId = new Map(financials.map((row) => [row.orderId, row]));
  const eligibilityByOrderId = buildEligibilityMap(eligibilityRows);

  const latestLocations = await Promise.all(
    draws.map((draw) =>
      prisma.locationPing.findFirst({
        where: {
          OR: [
            { orderId: draw.orderId },
            { entityId: phleb.userId },
            { entityId: phleb.id },
          ],
        },
        orderBy: { at: 'desc' },
      }),
    ),
  );

  const jobs = draws.map((draw, index) =>
    projectJob({
      draw,
      bundle: bundleByDrawId.get(draw.id) ?? null,
      financial: financialByDrawId.get(draw.id) ?? financialByOrderId.get(draw.orderId) ?? null,
      eligibilityRows: eligibilityByOrderId.get(draw.orderId) ?? [],
      latestLocation: latestLocations[index] ?? null,
    }),
  );

  return NextResponse.json({
    ok: true,
    data: jobs,
    meta: {
      phlebProfileId: phleb.id,
      userId: phleb.userId,
      count: jobs.length,
    },
  });
}