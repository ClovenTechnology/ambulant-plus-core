import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  listComplianceRenewals,
  sendManualComplianceReminders,
  type RenewalGroup,
} from '@/src/lib/compliance-renewals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorityValues(actor: any) {
  return new Set(
    [...(actor?.roles || []), ...(actor?.scopes || [])]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

function canRead(actor: any) {
  if (actor?.isSuperAdmin) return true;
  const values = authorityValues(actor);
  return [
    '*',
    'admin:all',
    'admin:read',
    'admin:write',
    'compliance',
    'compliance:read',
    'compliance:manage',
    'compliance.read',
    'compliance.manage',
    'manageroles',
  ].some((value) => values.has(value));
}

function canManage(actor: any) {
  if (actor?.isSuperAdmin) return true;
  const values = authorityValues(actor);
  return [
    '*',
    'admin:all',
    'admin:write',
    'compliance:manage',
    'compliance.manage',
    'manageroles',
  ].some((value) => values.has(value));
}

function group(value: string | null): RenewalGroup {
  const next = String(value || 'ALL').trim().toUpperCase();
  return ['ALL', 'CLINICIAN', 'CAREPORT', 'MEDREACH', 'CLIENT', 'PATIENT', 'STAFF', 'CORPORATE'].includes(next)
    ? (next as RenewalGroup)
    : 'ALL';
}

function due(value: string | null) {
  const next = String(value || 'month').trim().toLowerCase();
  return ['all', 'today', 'week', 'month', 'overdue', 'missing', 'range'].includes(next)
    ? (next as 'all' | 'today' | 'week' | 'month' | 'overdue' | 'missing' | 'range')
    : 'month';
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canRead(actor)) {
      return NextResponse.json({ ok: false, error: 'compliance_read_forbidden' }, { status: 403 });
    }

    const data = await listComplianceRenewals({
      group: group(req.nextUrl.searchParams.get('group')),
      due: due(req.nextUrl.searchParams.get('due')),
      from: req.nextUrl.searchParams.get('from') || undefined,
      to: req.nextUrl.searchParams.get('to') || undefined,
      q: req.nextUrl.searchParams.get('q') || undefined,
    });

    return NextResponse.json(
      { ok: true, ...data },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[admin/compliance/renewals] GET failed', error);
    return NextResponse.json(
      { ok: false, error: 'compliance_renewals_unavailable' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canManage(actor)) {
      return NextResponse.json({ ok: false, error: 'compliance_manage_forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toUpperCase();
    if (action !== 'SEND_REMINDERS') {
      return NextResponse.json({ ok: false, error: 'unsupported_compliance_action' }, { status: 400 });
    }

    const rawKeys: unknown[] = Array.isArray(body?.keys) ? body.keys : [];
    const keys: string[] = Array.from(
      new Set<string>(
        rawKeys
          .map((value: unknown) => String(value ?? '').trim())
          .filter((value: string) => value.length > 0),
      ),
    ).slice(0, 201);
    if (!keys.length) {
      return NextResponse.json({ ok: false, error: 'reminder_selection_required' }, { status: 400 });
    }
    if (keys.length > 200) {
      return NextResponse.json({ ok: false, error: 'bulk_reminder_limit_exceeded' }, { status: 400 });
    }

    const result = await sendManualComplianceReminders({
      keys,
      actorUserId: actor.userId,
      actorProfileId: actor.profileId,
    });

    return NextResponse.json(
      { ok: true, result },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const message = String(error?.message || error || '');
    if (message.includes('bulk_reminder_limit_exceeded')) {
      return NextResponse.json({ ok: false, error: 'bulk_reminder_limit_exceeded' }, { status: 400 });
    }
    console.error('[admin/compliance/renewals] POST failed', error);
    return NextResponse.json(
      { ok: false, error: 'compliance_reminder_send_failed' },
      { status: 500, headers: { 'cache-control': 'no-store' } },
    );
  }
}
