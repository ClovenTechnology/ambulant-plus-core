// apps/api-gateway/app/api/practice/claims/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ClaimStatus = 'initiated' | 'captured' | 'refunded' | 'failed';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Number(searchParams.get('limit') || '50') || 50,
      200,
    );

    // Try resolve clinician from headers
    const uid = req.headers.get('x-uid') || undefined;
    let clinicianProfile: { id: string; displayName: string | null } | null = null;

    if (uid) {
      clinicianProfile = await prisma.clinicianProfile.findUnique({
        where: { userId: uid },
        select: { id: true, displayName: true },
      });
    }

    // Base query: payments, newest first
    const payments = await prisma.payment.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: clinicianProfile
        ? {
            // scope to encounters for this clinician
            encounter: { clinicianId: clinicianProfile.id },
          }
        : undefined,
      select: {
        id: true,
        encounterId: true,
        caseId: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        meta: true,
      },
    });

    if (!payments.length && !clinicianProfile) {
      // Demo fallback so the UI shows *something* in local/dev
      const demo = {
        ok: true,
        demo: true,
        items: [
          {
            id: 'pay-demo-1',
            encounterId: 'enc-demo-1',
            caseId: 'CASE-001',
            patientName: 'Demo Patient',
            clinicianName: 'Demo Clinician',
            status: 'captured' as ClaimStatus,
            amountCents: 75000,
            currency: 'ZAR',
            fundingSource: 'card',
            createdAt: new Date().toISOString(),
            paidAt: new Date().toISOString(),
          },
        ],
      };
      return NextResponse.json(demo, { status: 200 });
    }

    const encounterIds = Array.from(
      new Set(payments.map((p) => p.encounterId).filter(Boolean)),
    );

    const encounters = await prisma.encounter.findMany({
      where: { id: { in: encounterIds } },
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

    const items = payments.map((p) => {
      const enc = encounters.find((e) => e.id === p.encounterId);
      const patientName = enc?.patientId
        ? patientMap.get(enc.patientId) || 'Unknown patient'
        : 'Unknown patient';

      const meta = (p.meta || {}) as any;
      const fundingSource =
        meta?.fundingSource || meta?.paymentMethod || null;

      const status = p.status as ClaimStatus;
      const paidAt =
        status === 'captured' || status === 'refunded'
          ? p.updatedAt.toISOString()
          : null;

      return {
        id: p.id,
        encounterId: p.encounterId,
        caseId: p.caseId,
        patientName,
        clinicianName,
        status,
        amountCents: p.amountCents,
        currency: p.currency,
        fundingSource,
        createdAt: p.createdAt.toISOString(),
        paidAt,
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
    console.error('[practice/claims] GET error', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'Failed to load practice claims',
      },
      { status: 500 },
    );
  }
}
