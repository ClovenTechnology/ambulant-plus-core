// apps/api-gateway/app/api/practice/cases/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Number(searchParams.get('limit') || '50') || 50,
      200,
    );

    const uid = req.headers.get('x-uid') || undefined;
    let clinicianProfile: { id: string; displayName: string | null } | null = null;

    if (uid) {
      clinicianProfile = await prisma.clinicianProfile.findUnique({
        where: { userId: uid },
        select: { id: true, displayName: true },
      });
    }

    const encounters = await prisma.encounter.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: clinicianProfile
        ? { clinicianId: clinicianProfile.id }
        : undefined,
      select: {
        id: true,
        caseId: true,
        patientId: true,
        clinicianId: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      },
    });

    if (!encounters.length && !clinicianProfile) {
      // Basic demo case so the UI renders on a fresh DB
      const demo = {
        ok: true,
        demo: true,
        items: [
          {
            encounterId: 'enc-demo-1',
            caseId: 'CASE-001',
            patientName: 'Demo Patient',
            clinicianName: 'Demo Clinician',
            status: 'closed',
            openedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            totalPaymentsCents: 75000,
            currency: 'ZAR',
            claimCount: 1,
          },
        ],
      };
      return NextResponse.json(demo, { status: 200 });
    }

    const encounterIds = encounters.map((e) => e.id);
    const payments = await prisma.payment.findMany({
      where: { encounterId: { in: encounterIds } },
      select: {
        id: true,
        encounterId: true,
        amountCents: true,
        currency: true,
        status: true,
      },
    });

    const paymentsByEncounter = new Map<
      string,
      { total: number; currency: string; count: number }
    >();

    for (const p of payments) {
      const prev = paymentsByEncounter.get(p.encounterId) || {
        total: 0,
        currency: p.currency,
        count: 0,
      };
      paymentsByEncounter.set(p.encounterId, {
        total: prev.total + (p.status === 'captured' ? p.amountCents : 0),
        currency: p.currency,
        count: prev.count + 1,
      });
    }

    const patientIds = Array.from(
      new Set(
        encounters
          .map((e) => e.patientId)
          .filter((x): x is string => !!x),
      ),
    );

    const patients = patientIds.length
      ? await prisma.patientProfile.findMany({
          where: { id: { in: patientIds } },
          select: { id: true, name: true },
        })
      : [];

    const patientMap = new Map(
      patients.map((p) => [p.id, p.name || 'Unknown patient']),
    );

    const clinicianName =
      clinicianProfile?.displayName || 'My practice';

    const items = encounters.map((e) => {
      const paymentsAgg = paymentsByEncounter.get(e.id) || {
        total: 0,
        currency: 'ZAR',
        count: 0,
      };
      const patientName = e.patientId
        ? patientMap.get(e.patientId) || 'Unknown patient'
        : 'Unknown patient';

      return {
        encounterId: e.id,
        caseId: e.caseId,
        patientName,
        clinicianName,
        status: e.status,
        openedAt: e.createdAt.toISOString(),
        lastUpdated: e.updatedAt.toISOString(),
        totalPaymentsCents: paymentsAgg.total,
        currency: paymentsAgg.currency,
        claimCount: paymentsAgg.count,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        demo: false,
        items,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[practice/cases] GET error', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'Failed to load practice cases',
      },
      { status: 500 },
    );
  }
}
