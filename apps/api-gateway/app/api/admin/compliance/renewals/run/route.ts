import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { runComplianceRenewalSweep } from '@/src/lib/compliance-renewals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(req: NextRequest) {
  const raw = String(req.headers.get('authorization') || '').trim();
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : '';
}

function canManage(actor: any) {
  if (actor?.isSuperAdmin) return true;
  const values = new Set(
    [...(actor?.roles || []), ...(actor?.scopes || [])]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean),
  );
  return ['*', 'admin:all', 'admin:write', 'compliance:manage', 'compliance.manage', 'manageroles'].some((value) => values.has(value));
}

async function authorisedActor(req: NextRequest) {
  const configured = String(
    process.env.COMPLIANCE_RENEWAL_CRON_SECRET || process.env.CRON_SECRET || '',
  ).trim();
  const supplied = bearer(req);

  if (configured && supplied && safeEqual(configured, supplied)) {
    return { mode: 'CRON' as const, userId: null, profileId: null };
  }

  const actor = await requireAdminStaffActor(req);
  if (!canManage(actor)) {
    throw Object.assign(new Error('compliance_manage_forbidden'), { status: 403 });
  }
  return { mode: 'ADMIN' as const, userId: actor.userId, profileId: actor.profileId };
}

async function run(req: NextRequest) {
  try {
    const actor = await authorisedActor(req);
    const result = await runComplianceRenewalSweep({
      actorUserId: actor.userId,
      actorProfileId: actor.profileId,
    });
    return NextResponse.json(
      {
        ok: true,
        mode: actor.mode,
        reminderThresholdDays: [30, 14, 7, 1, 0],
        enforcementMode: 'VISIBILITY_REMINDERS_ONLY_NO_NEW_AUTOMATIC_SUSPENSIONS',
        result,
      },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    if (error?.status === 403 || String(error?.message || '') === 'compliance_manage_forbidden') {
      return NextResponse.json({ ok: false, error: 'compliance_manage_forbidden' }, { status: 403 });
    }
    console.error('[admin/compliance/renewals/run] request failed', error);
    return NextResponse.json(
      { ok: false, error: 'compliance_renewal_sweep_failed' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}

// GET is cron-friendly (Vercel Cron invokes configured paths with GET).
export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
