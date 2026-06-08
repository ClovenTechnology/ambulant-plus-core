// apps/api-gateway/app/api/admin/clinicians/onboarding/generate-authorisation/route.ts
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(value: unknown, max = 500): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function hashCode(code: string) {
  const salt = process.env.CLINICIAN_PAYMENT_AUTH_CODE_SALT || process.env.NEXTAUTH_SECRET || 'ambulant-local-dev-salt';
  return crypto.createHash('sha256').update(`${salt}:${code.trim().toUpperCase()}`).digest('hex');
}

function makeCode() {
  const a = crypto.randomBytes(3).toString('hex').toUpperCase();
  const b = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `AMB-${a}-${b}`;
}

function expiryDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (isAdmin.ok === false) return isAdmin.response;

    const body = (await req.json().catch(() => ({}))) as any;
    const paymentId = cleanStr(body.paymentId, 120);
    const clinicianId = cleanStr(body.clinicianId, 120);
    const paymentReference = cleanStr(body.paymentReference, 180);
    const expiresInDays = Math.max(1, Math.min(90, Math.round(Number(body.expiresInDays || 30))));

    const payment = paymentId
      ? await prisma.clinicianOnboardingPayment.findUnique({ where: { id: paymentId } })
      : await prisma.clinicianOnboardingPayment.findFirst({
          where: {
            clinicianId: clinicianId || undefined,
            paymentReference: paymentReference || undefined,
            status: 'confirmed',
            provider: { in: ['eft', 'manual'] },
          },
          orderBy: { confirmedAt: 'desc' },
        });

    if (!payment) return NextResponse.json({ ok: false, error: 'confirmed_payment_not_found' }, { status: 404 });
    if (!['eft', 'manual'].includes(String(payment.provider))) {
      return NextResponse.json({ ok: false, error: 'authorisation_only_for_manual_or_eft' }, { status: 409 });
    }
    if (payment.status !== 'confirmed') {
      return NextResponse.json({ ok: false, error: 'payment_not_confirmed' }, { status: 409 });
    }
    if (payment.authorisationUsedAt) {
      return NextResponse.json({ ok: false, error: 'authorisation_already_used' }, { status: 409 });
    }

    let code = makeCode();
    let codeHash = hashCode(code);

    for (let i = 0; i < 3; i += 1) {
      const exists = await prisma.clinicianOnboardingPayment.findUnique({
        where: { authorisationCodeHash: codeHash },
      });
      if (!exists) break;
      code = makeCode();
      codeHash = hashCode(code);
    }

    const adminUid = cleanStr((isAdmin as any)?.uid || (isAdmin as any)?.userId || body.generatedByUserId, 120);
    const expiresAt = expiryDate(expiresInDays);
    const updated = await prisma.clinicianOnboardingPayment.update({
      where: { id: payment.id },
      data: {
        authorisationCodeHash: codeHash,
        authorisationCodeHint: code.slice(-4),
        authorisationExpiresAt: expiresAt,
        confirmedByUserId: payment.confirmedByUserId || adminUid,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        payment: {
          id: updated.id,
          clinicianId: updated.clinicianId,
          onboardingId: updated.onboardingId,
          status: updated.status,
          provider: updated.provider,
          paymentReference: updated.paymentReference,
          authorisationCodeHint: updated.authorisationCodeHint,
          authorisationExpiresAt: updated.authorisationExpiresAt?.toISOString() ?? null,
        },
        authorisationCode: code,
        warning: 'Show this code once to the clinician. The code is stored only as a hash.',
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[admin-generate-clinician-authorisation] error', err);
    return NextResponse.json({ ok: false, error: err?.message || 'generate_authorisation_failed' }, { status: 500 });
  }
}
