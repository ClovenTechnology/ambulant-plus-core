import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'subscription-plans.v1';

type PlansConfig = {
  patientPlans: any[];
  clinicianPlans: any[];
};

function configPathCandidates() {
  return [
    path.resolve(process.cwd(), 'packages', 'admin', 'plans.json'),
    path.resolve(process.cwd(), '..', '..', 'packages', 'admin', 'plans.json'),
    path.resolve(process.cwd(), '..', 'packages', 'admin', 'plans.json'),
  ];
}

async function readBundledDefaults(): Promise<PlansConfig> {
  for (const candidate of configPathCandidates()) {
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, 'utf8'));
      return normalizeConfig(parsed);
    } catch {
      // Try the next bundled source. Runtime writes never target these files.
    }
  }
  return { patientPlans: [], clinicianPlans: [] };
}

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function currency(value: unknown) {
  return text(value, 'ZAR').slice(0, 3).toUpperCase();
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function numberValue(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePatientPlan(input: any) {
  const id = text(input?.id || input?.key).toLowerCase();
  if (!['free', 'premium', 'family'].includes(id)) return null;
  return {
    id,
    actor: 'patient',
    label: text(input?.label || input?.name || id),
    description: text(input?.description || input?.tagline),
    currency: currency(input?.currency),
    priceMonthlyZar: money(input?.priceMonthlyZar),
    recommendedFor: text(input?.recommendedFor),
    highlight: bool(input?.highlight),
    enabled: bool(input?.enabled, true),
  };
}

function normalizeClinicianPlan(input: any) {
  const id = text(input?.id).toLowerCase();
  if (!['solo', 'starter', 'team', 'group'].includes(id)) return null;
  return {
    id,
    actor: 'clinician',
    label: text(input?.label || id),
    description: text(input?.description),
    currency: currency(input?.currency),
    monthlySubscriptionZar: money(input?.monthlySubscriptionZar),
    payoutSharePct: numberValue(input?.payoutSharePct),
    includedAdminSlots: money(input?.includedAdminSlots),
    maxAdminSlots: money(input?.maxAdminSlots ?? input?.maxAdminStaffSlots),
    extraAdminSlotZar:
      input?.extraAdminSlotZar === null || input?.extraAdminSlotZar === undefined
        ? null
        : money(input?.extraAdminSlotZar),
    recommendedFor: text(input?.recommendedFor),
    highlight: bool(input?.highlight),
    enabled: bool(input?.enabled, true),
  };
}

function normalizeConfig(input: any): PlansConfig {
  return {
    patientPlans: Array.isArray(input?.patientPlans)
      ? input.patientPlans.map(normalizePatientPlan).filter(Boolean)
      : [],
    clinicianPlans: Array.isArray(input?.clinicianPlans)
      ? input.clinicianPlans.map(normalizeClinicianPlan).filter(Boolean)
      : [],
  };
}

async function readConfig(): Promise<PlansConfig> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: SETTING_KEY },
    select: { value: true },
  });
  if (row?.value) return normalizeConfig(row.value);
  return readBundledDefaults();
}

function canManage(actor: any) {
  if (actor?.isSuperAdmin) return true;
  const values = new Set([...(actor?.roles || []), ...(actor?.scopes || [])]);
  return values.has('*') || values.has('admin:all') || values.has('admin:write') || values.has('finance:manage');
}

function isEnabled(plan: any) {
  return plan?.enabled !== false;
}

export async function GET(req: NextRequest) {
  try {
    const includeDisabled = req.nextUrl.searchParams.get('includeDisabled') === '1';
    const config = await readConfig();
    return NextResponse.json(
      {
        patientPlans: includeDisabled
          ? config.patientPlans
          : config.patientPlans.filter(isEnabled),
        clinicianPlans: includeDisabled
          ? config.clinicianPlans
          : config.clinicianPlans.filter(isEnabled),
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('[settings/plans] GET failed', error);
    return NextResponse.json({ error: 'plan_settings_unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canManage(actor)) {
      return NextResponse.json({ error: 'plan_settings_forbidden' }, { status: 403 });
    }

    const current = await readConfig();
    const body = await req.json().catch(() => ({}));
    const next = normalizeConfig({
      patientPlans: Array.isArray(body?.patientPlans)
        ? body.patientPlans
        : current.patientPlans,
      clinicianPlans: Array.isArray(body?.clinicianPlans)
        ? body.clinicianPlans
        : current.clinicianPlans,
    });

    await prisma.platformSetting.upsert({
      where: { key: SETTING_KEY },
      update: {
        category: 'commercial',
        value: next as Prisma.InputJsonValue,
        updatedByUserId: actor.userId,
      },
      create: {
        key: SETTING_KEY,
        category: 'commercial',
        value: next as Prisma.InputJsonValue,
        updatedByUserId: actor.userId,
      },
    });

    await prisma.auditLog
      .create({
        data: {
          actorUserId: actor.userId,
          actorType: 'ADMIN',
          actorRefId: actor.profileId,
          app: 'admin-dashboard',
          action: 'platform_settings.subscription_plans.updated',
          entityType: 'PlatformSetting',
          entityId: SETTING_KEY,
          description: 'Patient and clinician subscription plans updated',
          userAgent: req.headers.get('user-agent'),
          meta: {
            patientPlanCount: next.patientPlans.length,
            clinicianPlanCount: next.clinicianPlans.length,
          },
        },
      })
      .catch(() => undefined);

    return NextResponse.json(next, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[settings/plans] POST failed', error);
    return NextResponse.json({ error: 'plan_settings_save_failed' }, { status: 500 });
  }
}
