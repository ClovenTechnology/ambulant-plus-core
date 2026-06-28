// apps/api-gateway/app/api/medreach/metrics/route.ts
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

function sinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function projectStatusCounts(rows: Array<{ status: string; _count: { _all: number } }>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});
}

function projectEligibilityCounts(rows: Array<{ status: any; _count: { _all: number } }>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.status)] = row._count._all;
    return acc;
  }, {});
}

async function resolveMetricScope(req: NextRequest, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) {
    return {
      ok: true,
      role,
      labId: cleanString(req.headers.get('x-lab-id')) || null,
      phlebIds: [] as string[],
    };
  }

  if (role === 'lab') {
    const labId = cleanString(req.headers.get('x-lab-id'));

    if (!labId) return { ok: false, role, labId: null, phlebIds: [] as string[] };

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { id: true, active: true, ownerUserId: true },
    });

    if (!lab || !lab.active) {
      return { ok: false, role, labId: null, phlebIds: [] as string[] };
    }

    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) {
      return { ok: false, role, labId: null, phlebIds: [] as string[] };
    }

    return { ok: true, role, labId, phlebIds: [] as string[] };
  }

  if (role === 'lab_staff') {
    const labId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!labId || !who.uid) {
      return { ok: false, role, labId: null, phlebIds: [] as string[] };
    }

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    if (!staff) return { ok: false, role, labId: null, phlebIds: [] as string[] };

    return { ok: true, role, labId: staff.labId, phlebIds: [] as string[] };
  }

  if (role === 'phleb') {
    if (!who.uid) return { ok: false, role, labId: null, phlebIds: [] as string[] };

    const profile = await prisma.medReachPhlebProfile.findUnique({
      where: { userId: who.uid },
      select: { id: true, userId: true },
    });

    if (!profile) return { ok: false, role, labId: null, phlebIds: [] as string[] };

    return {
      ok: true,
      role,
      labId: null,
      phlebIds: [profile.id, profile.userId],
    };
  }

  return { ok: false, role, labId: null, phlebIds: [] as string[] };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const scope = await resolveMetricScope(req, who);

  if (!scope.ok) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = cleanInt(url.searchParams.get('days'), 30, 1, 365);
  const since = sinceDate(days);

  const drawWhere: Record<string, any> = {
    createdAt: { gte: since },
  };

  const eligibilityWhere: Record<string, any> = {
    createdAt: { gte: since },
  };

  const bundleWhere: Record<string, any> = {
    createdAt: { gte: since },
  };

  const financialWhere: Record<string, any> = {
    createdAt: { gte: since },
  };

  if (scope.labId) {
    drawWhere.partnerId = scope.labId;
    eligibilityWhere.labId = scope.labId;
    bundleWhere.labPartnerId = scope.labId;
    financialWhere.labId = scope.labId;
  }

  if (scope.phlebIds.length > 0) {
    drawWhere.phlebId = { in: scope.phlebIds };
    financialWhere.phlebId = { in: scope.phlebIds };
  }

  const [
    labCount,
    activeLabCount,
    phlebCount,
    activePhlebCount,
    testCount,
    panelCount,
    drawCount,
    drawStatusRows,
    eligibilityCount,
    eligibilityStatusRows,
    bundleCount,
    bundleStatusRows,
    financialSummary,
    locationPingCount,
    recentAuditCount,
  ] = await Promise.all([
    prisma.labPartner.count(),
    prisma.labPartner.count({ where: { active: true, status: 'ACTIVE' } }),
    prisma.medReachPhlebProfile.count(),
    prisma.medReachPhlebProfile.count({ where: { active: true, approvalStatus: 'ACTIVE' } }),
    prisma.medReachLabOfferedTest.count({
      where: scope.labId ? { labId: scope.labId, active: true } : { active: true },
    }),
    prisma.medReachLabPanel.count({
      where: scope.labId ? { labId: scope.labId, active: true } : { active: true },
    }),
    prisma.draw.count({ where: drawWhere }),
    prisma.draw.groupBy({
      by: ['status'],
      where: drawWhere,
      _count: { _all: true },
    }),
    prisma.medReachOrderEligibleLab.count({ where: eligibilityWhere }),
    prisma.medReachOrderEligibleLab.groupBy({
      by: ['status'],
      where: eligibilityWhere,
      _count: { _all: true },
    }),
    prisma.medReachSpecimenBundle.count({ where: bundleWhere }),
    prisma.medReachSpecimenBundle.groupBy({
      by: ['status'],
      where: bundleWhere,
      _count: { _all: true },
    }),
    prisma.medReachOrderFinancial.aggregate({
      where: financialWhere,
      _sum: {
        subtotalCents: true,
        logisticsFeeCents: true,
        urgentSurchargeCents: true,
        coldChainSurchargeCents: true,
        platformFeeCents: true,
        labGrossCents: true,
        phlebGrossCents: true,
        labNetCents: true,
        phlebNetCents: true,
        sponsorAmountMinor: true,
        patientCopayMinor: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.locationPing.count({
      where: {
        at: { gte: since },
        ...(scope.phlebIds.length > 0 ? { entityId: { in: scope.phlebIds } } : {}),
        ...(scope.labId ? { kind: { contains: 'lab', mode: 'insensitive' } } : {}),
      },
    }),
    prisma.auditEvent.count({
      where: {
        at: { gte: since },
        kind: { contains: 'medreach', mode: 'insensitive' },
      },
    }),
  ]);

  const sums = financialSummary._sum;

  return NextResponse.json({
    ok: true,
    data: {
      scope: {
        role: scope.role,
        labId: scope.labId,
        phlebScoped: scope.phlebIds.length > 0,
        days,
        since: since.toISOString(),
      },

      registry: {
        labs: labCount,
        activeLabs: activeLabCount,
        phlebs: phlebCount,
        activePhlebs: activePhlebCount,
        activeOfferedTests: testCount,
        activePanels: panelCount,
      },

      marketplace: {
        draws: drawCount,
        drawStatusCounts: projectStatusCounts(drawStatusRows),
        eligibleLabRows: eligibilityCount,
        eligibilityStatusCounts: projectEligibilityCounts(eligibilityStatusRows),
      },

      specimens: {
        bundles: bundleCount,
        bundleStatusCounts: projectEligibilityCounts(bundleStatusRows as any),
      },

      finance: {
        records: financialSummary._count._all,
        subtotalCents: sums.subtotalCents ?? 0,
        logisticsFeeCents: sums.logisticsFeeCents ?? 0,
        urgentSurchargeCents: sums.urgentSurchargeCents ?? 0,
        coldChainSurchargeCents: sums.coldChainSurchargeCents ?? 0,
        platformFeeCents: sums.platformFeeCents ?? 0,
        labGrossCents: sums.labGrossCents ?? 0,
        phlebGrossCents: sums.phlebGrossCents ?? 0,
        labNetCents: sums.labNetCents ?? 0,
        phlebNetCents: sums.phlebNetCents ?? 0,
        sponsorAmountMinor: sums.sponsorAmountMinor ?? 0,
        patientCopayMinor: sums.patientCopayMinor ?? 0,
      },

      operations: {
        locationPings: locationPingCount,
        auditEvents: recentAuditCount,
      },
    },
  });
}