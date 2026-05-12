// apps/api-gateway/app/api/clinicians/[id]/refund-policy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

type RefundPolicy = {
  freeCancelHours: number;
  lateCancelFeeCents: number;
  noShowFeeCents: number;
  clinicianMissRefundPercent: number;
  currency: string;
};

const DEFAULT_POLICY: RefundPolicy = {
  freeCancelHours: 24,
  lateCancelFeeCents: 0,
  noShowFeeCents: 0,
  clinicianMissRefundPercent: 100,
  currency: 'ZAR',
};

function cleanCurrency(value: unknown, fallback = 'ZAR') {
  const s = String(value ?? fallback).trim().toUpperCase();
  return s || fallback;
}

function numberValue(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function centsValue(value: unknown, fallback: number) {
  return Math.max(0, Math.round(numberValue(value, fallback)));
}

function percentValue(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, Math.round(numberValue(value, fallback))));
}

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

function normalisePolicy(raw: unknown, currencyFallback = 'ZAR'): RefundPolicy {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, any>)
    : {};

  return {
    freeCancelHours: Math.max(
      0,
      Math.round(numberValue(obj.freeCancelHours, DEFAULT_POLICY.freeCancelHours)),
    ),
    lateCancelFeeCents: centsValue(
      obj.lateCancelFeeCents,
      DEFAULT_POLICY.lateCancelFeeCents,
    ),
    noShowFeeCents: centsValue(
      obj.noShowFeeCents,
      DEFAULT_POLICY.noShowFeeCents,
    ),
    clinicianMissRefundPercent: percentValue(
      obj.clinicianMissRefundPercent,
      DEFAULT_POLICY.clinicianMissRefundPercent,
    ),
    currency: cleanCurrency(obj.currency, currencyFallback),
  };
}

async function findClinician(id: string) {
  return prisma.clinicianProfile.findFirst({
    where: {
      OR: [
        { id },
        { userId: id },
      ],
    },
    select: {
      id: true,
      userId: true,
      currency: true,
      meta: true,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: 'clinician_id_required' }, { status: 400 });
    }

    const prof = await findClinician(id);

    if (!prof) {
      return NextResponse.json({ error: 'clinician_not_found' }, { status: 404 });
    }

    const meta = parseMeta(prof.meta);
    const policy = normalisePolicy(
      meta.refundPolicy,
      prof.currency || DEFAULT_POLICY.currency,
    );

    return NextResponse.json({
      ok: true,
      clinicianId: prof.id,
      refundPolicy: policy,
      ...policy,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'failed_to_load_refund_policy' },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: 'clinician_id_required' }, { status: 400 });
    }

    const prof = await findClinician(id);

    if (!prof) {
      return NextResponse.json({ error: 'clinician_not_found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const currentMeta = parseMeta(prof.meta);

    const currentPolicy = normalisePolicy(
      currentMeta.refundPolicy,
      prof.currency || DEFAULT_POLICY.currency,
    );

    const nextPolicy: RefundPolicy = {
      freeCancelHours: Math.max(
        0,
        Math.round(numberValue(body.freeCancelHours, currentPolicy.freeCancelHours)),
      ),
      lateCancelFeeCents: centsValue(
        body.lateCancelFeeCents,
        currentPolicy.lateCancelFeeCents,
      ),
      noShowFeeCents: centsValue(
        body.noShowFeeCents,
        currentPolicy.noShowFeeCents,
      ),
      clinicianMissRefundPercent: percentValue(
        body.clinicianMissRefundPercent,
        currentPolicy.clinicianMissRefundPercent,
      ),
      currency: cleanCurrency(
        body.currency,
        currentPolicy.currency || prof.currency || DEFAULT_POLICY.currency,
      ),
    };

    const nextMeta = {
      ...currentMeta,
      refundPolicy: nextPolicy,
    };

    await prisma.clinicianProfile.update({
      where: { id: prof.id },
      data: {
        meta: nextMeta,
      },
    });

    return NextResponse.json({
      ok: true,
      clinicianId: prof.id,
      refundPolicy: nextPolicy,
      ...nextPolicy,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'failed_to_update_refund_policy' },
      { status: 500 },
    );
  }
}