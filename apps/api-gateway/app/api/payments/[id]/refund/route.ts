// apps/api-gateway/app/api/payments/[id]/refund/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { getProvider } from '@/src/payments';
import { emitEvent } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

type StoredPaymentProvider = 'paystack' | 'payfast' | 'mock' | 'internal';

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function cleanPaymentProvider(value: unknown): StoredPaymentProvider {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'payfast') return 'payfast';
  if (s === 'paystack') return 'paystack';
  if (s === 'internal') return 'internal';
  if (s === 'mock') return 'mock';
  return 'paystack';
}

function isInternalProviderReference(provider: StoredPaymentProvider, reference: string | null | undefined) {
  const ref = String(reference || '').trim();
  return (
    provider === 'internal' ||
    (provider === 'mock' && /^(zero|voucher|medicalaid)_/.test(ref))
  );
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const who = readIdentity(req.headers);

  if (who.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const pay = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!pay) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const meta = readMeta(pay.meta);
  const providerKind = cleanPaymentProvider(meta.provider || 'paystack');
  const ref = pay.providerRef || String(meta.providerRef || '').trim();

  let refund: Awaited<ReturnType<ReturnType<typeof getProvider>['refund']>>;

  if (isInternalProviderReference(providerKind, ref)) {
    refund = {
      providerRef: ref || `internal_${pay.id}`,
      status: 'refunded',
      meta: {
        internal: true,
        amountCents: pay.amountCents,
      },
    };
  } else {
    if (!ref) {
      return NextResponse.json(
        { ok: false, error: 'payment_provider_ref_required_for_refund' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (providerKind === 'mock' && isProductionRuntime()) {
      return NextResponse.json(
        { ok: false, error: 'mock_payment_refund_disabled' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const provider = getProvider(providerKind === 'payfast' ? 'payfast' : providerKind === 'mock' ? 'mock' : 'paystack');
    refund = await provider.refund(ref, pay.amountCents);
  }

  const updated = await prisma.payment.update({
    where: { id: pay.id },
    data: {
      status: refund.status === 'refunded' ? 'refunded' : 'refund_failed',
      meta: jsonSafe({
        ...meta,
        refund: {
          providerRef: ref,
          status: refund.status,
          meta: refund.meta ?? null,
          refundedAt: new Date().toISOString(),
        },
      }),
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'payment_refunded',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: updated.id,
      meta: jsonSafe({
        encounterId: pay.encounterId,
        amountCents: pay.amountCents,
        providerRef: ref,
        refund,
      }),
    },
  });

  try {
    emitEvent({
      kind: 'payment_refunded',
      encounterId: pay.encounterId,
      patientId: null,
      clinicianId: null,
      payload: { paymentId: pay.id, amount: pay.amountCents },
    } as any);
  } catch {
    // best-effort runtime event
  }

  return NextResponse.json(
    { ok: true, payment: updated, refund },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}