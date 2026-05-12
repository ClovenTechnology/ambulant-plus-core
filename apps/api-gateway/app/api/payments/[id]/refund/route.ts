// apps/api-gateway/app/api/payments/[id]/refund/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function asJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

async function refundViaProvider(ref: string, amountCents: number) {
  try {
    const mod: any = await import('@/src/payments/provider');

    const provider =
      typeof mod.getProvider === 'function'
        ? mod.getProvider()
        : typeof mod.default === 'function'
          ? mod.default()
          : mod.provider ?? null;

    if (provider && typeof provider.refund === 'function') {
      await provider.refund(ref, amountCents);
      return { ok: true, providerRefunded: true };
    }

    return {
      ok: true,
      providerRefunded: false,
      reason: 'refund_provider_not_available',
    };
  } catch (err: any) {
    return {
      ok: true,
      providerRefunded: false,
      reason: err?.message || 'refund_provider_import_failed',
    };
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const pay = await prisma.payment.findUnique({
      where: { id: params.id },
    });

    if (!pay) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const meta = asJsonObject(pay.meta);

    const ref =
      typeof meta.providerRef === 'string' && meta.providerRef.trim()
        ? meta.providerRef.trim()
        : `mock_${pay.id}`;

    const refundResult = await refundViaProvider(ref, pay.amountCents);

    const updated = await prisma.payment.update({
      where: { id: pay.id },
      data: {
        status: 'refunded',
        meta: {
          ...meta,
          refundedAt: new Date().toISOString(),
          refundProviderRef: ref,
          refundProviderResult: refundResult,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      payment: updated,
      refundProviderResult: refundResult,
    });
  } catch (err: any) {
    console.error('payment refund error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'refund_failed',
      },
      { status: 500 },
    );
  }
}