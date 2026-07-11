import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

async function riderCanAccessOrder(orderId: string, userId: string, orgId: string, isAdmin: boolean) {
  if (isAdmin) return true;

  const assignmentDelegate = (prisma as any).carePortRiderAssignment;
  if (assignmentDelegate) {
    const assignment = await assignmentDelegate.findFirst({
      where: { orgId, orderId, riderUserId: userId },
      select: { id: true },
    }).catch(() => null);
    if (assignment) return true;
  }

  const deliveryDelegate = (prisma as any).delivery;
  if (deliveryDelegate) {
    const delivery = await deliveryDelegate.findFirst({
      where: { orderId, riderId: userId },
      select: { id: true },
    }).catch(() => null);
    if (delivery) return true;
  }

  return false;
}

async function readCarePortRiderReadiness(userId: string) {
  if (!userId) return null;
  return (prisma as any).carePortRiderProfile.findUnique({ where: { userId } }).catch(() => null);
}

function riderReadinessError(profile: any) {
  if (!profile) return 'rider_profile_not_found';
  if (profile.isActive !== true) return 'rider_not_active';
  if (String(profile.kyiStatus || '').toUpperCase() !== 'VERIFIED' || !profile.kyiVerifiedAt) {
    return 'rider_not_kyi_verified';
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'rider']);

    const orderId = clean(params.orderId, 120);
    if (!orderId) return json({ ok: false, error: 'orderId_required' }, 400);

    const userId = clean(who.uid, 120);
    if (!userId && who.role !== 'admin') return json({ ok: false, error: 'missing_uid' }, 409);
    if (who.role !== 'admin') {
      const riderProfile = await readCarePortRiderReadiness(userId);
      const readinessError = riderReadinessError(riderProfile);

      if (readinessError) {
        return json(
          {
            ok: false,
            error: readinessError,
            riderReadinessRequired: true,
            kyiStatus: riderProfile?.kyiStatus || null,
            kyiVerifiedAt: riderProfile?.kyiVerifiedAt || null,
            isActive: riderProfile?.isActive ?? null,
          },
          403,
        );
      }
    }


    const allowed = await riderCanAccessOrder(orderId, userId, orgId, who.role === 'admin');
    if (!allowed) return json({ ok: false, error: 'forbidden' }, 403);

    const order = await (prisma as any).carePortOrder.findFirst({
      where: { id: orderId, orgId },
      include: {
        items: true,
        chosenPharmacy: true,
        chosenOffer: true,
        selections: true,
        payments: true,
        assignment: true,
        delivery: true,
      } as any,
    }).catch(async () => {
      return (prisma as any).carePortOrder.findFirst({
        where: { id: orderId, orgId },
        include: { items: true, chosenPharmacy: true, selections: true, payments: true } as any,
      });
    });

    if (!order) return json({ ok: false, error: 'order_not_found' }, 404);

    return json({ ok: true, order });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'rider_job_load_failed' }, error?.status || 500);
  }
}
