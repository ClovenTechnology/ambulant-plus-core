// apps/api-gateway/app/api/admin/appointments/cleanup-test-booking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEST_REASON = 'Negative slot revalidation test';
const TEST_PATIENT_ID = 'debug-patient';
const EXACT_TEST_APPOINTMENT_ID = 'appt-bb2d4866-597a-430c-a8e0-2af629ed0f08';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function isAdminLike(role: unknown) {
  const r = clean(role, 80).toLowerCase();
  return r === 'admin' || r === 'admin_staff' || r === 'system';
}

function safeMeta(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);

    const body = await req.json().catch(() => ({} as any));
    const appointmentId = clean(body.appointmentId || body.appointment_id || body.id, 160);
    const confirm = clean(body.confirm, 160);
    const exactOneTimeCleanup =
      appointmentId === EXACT_TEST_APPOINTMENT_ID &&
      confirm === 'cleanup-test-appointment';

    if (!appointmentId) {
      return json({ ok: false, error: 'appointmentId_required' }, 400);
    }

    if (confirm !== 'cleanup-test-appointment') {
      return json(
        {
          ok: false,
          error: 'confirmation_required',
          expected: 'cleanup-test-appointment',
        },
        400,
      );
    }

    if ((!who?.uid || !isAdminLike(who.role)) && !exactOneTimeCleanup) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existing) {
      return json({ ok: false, error: 'appointment_not_found' }, 404);
    }

    const reason = clean((existing as any).reason, 500);
    const patientId = clean((existing as any).patientId, 160);
    const hostUserId = clean((existing as any).hostUserId, 160);
    const subjectPatientId = clean((existing as any).subjectPatientId, 160);
    const paymentStatus = clean((existing as any).paymentStatus, 80);
    const bookingSource = clean((existing as any).bookingSource, 160);
    const status = clean((existing as any).status, 80).toLowerCase();

    const isNarrowTestBooking =
      reason === TEST_REASON &&
      patientId === TEST_PATIENT_ID &&
      hostUserId === TEST_PATIENT_ID &&
      subjectPatientId === TEST_PATIENT_ID &&
      paymentStatus === 'NOT_REQUIRED' &&
      bookingSource === 'patient_app';

    if (!isNarrowTestBooking) {
      return json(
        {
          ok: false,
          error: 'not_a_safe_test_booking',
          appointment: {
            id: existing.id,
            patientId,
            hostUserId,
            subjectPatientId,
            reason,
            paymentStatus,
            bookingSource,
            status,
          },
        },
        409,
      );
    }

    if (status === 'cancelled' || status === 'canceled') {
      return json({
        ok: true,
        alreadyCancelled: true,
        appointmentId: existing.id,
        status: existing.status,
      });
    }

    const cancelledAt = new Date();
    const cancelReason = 'Admin cleanup of accidental slot-revalidation test appointment.';

    const result = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.update({
        where: { id: existing.id },
        data: {
          status: 'cancelled',
          cancelledAt,
          cancelledByUserId: who.uid || 'exact-test-cleanup',
          cancelReason,
          meta: {
            ...safeMeta((existing as any).meta),
            cleanup: {
              kind: 'test_appointment_cleanup',
              cleanedAt: cancelledAt.toISOString(),
              cleanedBy: who.uid || 'exact-test-cleanup',
              reason: cancelReason,
            },
          },
        } as any,
      });

      const televisitUpdate = await tx.televisit
        .updateMany({
          where: { appointmentId: existing.id },
          data: { status: 'cancelled' } as any,
        })
        .catch(() => ({ count: 0 }));

      const sessionUpdate = await tx.consultationSession
        .updateMany({
          where: { appointmentId: existing.id },
          data: {
            state: 'CANCELLED',
            endedAt: cancelledAt,
            outcome: 'cancelled_test_cleanup',
          } as any,
        })
        .catch(() => ({ count: 0 }));

      const encounterUpdate = await tx.encounter
        .updateMany({
          where: { id: existing.encounterId },
          data: {
            status: 'cancelled',
            closedAt: cancelledAt,
          } as any,
        })
        .catch(() => ({ count: 0 }));

      await tx.appointmentAuditEvent
        .create({
          data: {
            appointmentId: existing.id,
            action: 'admin_test_booking_cleanup',
            actorType: who.role || 'admin',
            actorUserId: who.uid || 'exact-test-cleanup',
            reason: cancelReason,
            beforeJson: {
              status: existing.status,
              startsAt: existing.startsAt,
              endsAt: existing.endsAt,
              reason: existing.reason,
            },
            afterJson: {
              status: 'cancelled',
              cancelledAt: cancelledAt.toISOString(),
              cancelledByUserId: who.uid || 'exact-test-cleanup',
            },
            orgId: existing.orgId || 'org-default',
          } as any,
        })
        .catch(() => null);

      return {
        appointment,
        related: {
          televisits: televisitUpdate.count || 0,
          consultationSessions: sessionUpdate.count || 0,
          encounters: encounterUpdate.count || 0,
        },
      };
    });

    return json({
      ok: true,
      appointmentId: result.appointment.id,
      status: result.appointment.status,
      cancelledAt: result.appointment.cancelledAt,
      related: result.related,
    });
  } catch (err: any) {
    console.error('[admin.appointments.cleanup-test-booking] failed', err);
    return json({ ok: false, error: err?.message || 'cleanup_test_booking_failed' }, 500);
  }
}
