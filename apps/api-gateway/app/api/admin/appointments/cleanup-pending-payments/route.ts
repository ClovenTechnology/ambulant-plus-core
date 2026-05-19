import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canCleanup(role: unknown) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'admin_staff' || r === 'system';
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function readMeta(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function shouldSkip(appt: any) {
  const status = String(appt?.status || '').toLowerCase();
  const paymentStatus = String(appt?.paymentStatus || '').toUpperCase();

  if (paymentStatus === 'CAPTURED' || paymentStatus === 'PAID' || paymentStatus === 'SETTLED') {
    return true;
  }

  if (status === 'confirmed' || status === 'in_consult' || status === 'completed') {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const ident = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, ident);

    if (!ident?.uid || !canCleanup(ident.role)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const olderThanMinutes = intParam(url.searchParams.get('olderThanMinutes'), 30, 5, 24 * 60);
    const limit = intParam(url.searchParams.get('limit'), 50, 1, 250);
    const dryRun =
      url.searchParams.get('dryRun') === '1' ||
      url.searchParams.get('dryRun') === 'true';

    const body = await req.json().catch(() => ({} as any));
    const reason =
      String(body?.reason || '').trim().slice(0, 500) ||
      `stale pending payment cleanup after ${olderThanMinutes} minutes`;

    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const now = new Date();

    const candidates = await prisma.appointment.findMany({
      where: {
        updatedAt: { lt: cutoff },
        OR: [
          { status: 'pending_payment' },
          { status: 'payment_init_failed' },
          { paymentStatus: 'PENDING' as any },
          { paymentStatus: 'FAILED' as any },
        ],
        NOT: [
          { paymentStatus: 'CAPTURED' as any },
          { status: 'confirmed' },
          { status: 'in_consult' },
          { status: 'completed' },
        ],
      } as any,
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    const eligible = candidates.filter((appt: any) => !shouldSkip(appt));

    if (dryRun) {
      return NextResponse.json(
        {
          ok: true,
          dryRun: true,
          olderThanMinutes,
          cutoff: cutoff.toISOString(),
          count: eligible.length,
          appointments: eligible.map((a: any) => ({
            id: a.id,
            status: a.status,
            paymentStatus: a.paymentStatus,
            paymentProvider: a.paymentProvider,
            paymentRef: a.paymentRef,
            startsAt: a.startsAt,
            endsAt: a.endsAt,
            updatedAt: a.updatedAt,
            priceCents: a.priceCents,
            currency: a.currency,
          })),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const cleaned: any[] = [];

    for (const appt of eligible as any[]) {
      const before = {
        status: appt.status,
        paymentStatus: appt.paymentStatus,
        paymentProvider: appt.paymentProvider,
        paymentRef: appt.paymentRef,
        updatedAt: appt.updatedAt,
      };

      const meta = readMeta(appt.meta);

      const nextStatus =
        String(appt.status || '').toLowerCase() === 'payment_init_failed'
          ? 'payment_init_failed'
          : 'payment_expired';

      const updated = await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          status: nextStatus,
          paymentStatus: 'FAILED' as any,
          cancelledAt: now,
          cancelledByUserId: ident.uid,
          cancelReason: reason,
          meta: jsonSafe({
            ...meta,
            paymentCleanup: {
              at: now.toISOString(),
              actorUid: ident.uid,
              actorRole: ident.role,
              reason,
              olderThanMinutes,
              previousStatus: appt.status,
              previousPaymentStatus: appt.paymentStatus,
              paymentProvider: appt.paymentProvider ?? null,
              paymentRef: appt.paymentRef ?? null,
            },
          }),
        } as any,
      });

      await prisma.appointmentAuditEvent
        .create({
          data: {
            appointmentId: appt.id,
            action: 'payment_expired',
            actorType: String(ident.role || 'admin'),
            actorUserId: ident.uid,
            reason,
            beforeJson: before,
            afterJson: {
              status: updated.status,
              paymentStatus: updated.paymentStatus,
              cancelledAt: updated.cancelledAt,
              cancelReason: updated.cancelReason,
              cleanupAt: now.toISOString(),
            },
            orgId: appt.orgId ?? 'org-default',
          } as any,
        })
        .catch(() => null);

      cleaned.push({
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        paymentProvider: updated.paymentProvider,
        paymentRef: updated.paymentRef,
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        cancelledAt: updated.cancelledAt,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        dryRun: false,
        olderThanMinutes,
        cutoff: cutoff.toISOString(),
        scanned: candidates.length,
        cleanedCount: cleaned.length,
        cleaned,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const msg = String(err?.message || 'cleanup_pending_payments_failed');

    if (msg === 'unauthorized' || msg === 'Unauthorized') {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    console.error('[admin.appointments.cleanup-pending-payments] failed', { message: msg });

    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}