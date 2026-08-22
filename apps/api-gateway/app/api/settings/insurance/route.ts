import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTING_KEY = 'professional-indemnity.v1';
const DEFAULT_SETTINGS = {
  platformCoverEnabled: false,
  platformInsurerName: '',
  platformPolicyNumber: '',
  platformCoversVirtual: true,
  platformCoverNotes: '',
  policies: [],
};

function text(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function bool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function nullableMoney(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function stringArray(value: unknown, maxItems = 200) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => text(item, 180)).filter(Boolean)),
  ).slice(0, maxItems);
}

function normalizePolicy(input: any, index: number) {
  const product = text(input?.productType, 60);
  const scope = text(input?.scope, 60);
  return {
    id: text(input?.id, 180) || `policy-${index + 1}`,
    label: text(input?.label, 240) || 'Cover layer',
    insurerName: text(input?.insurerName, 240),
    policyNumber: text(input?.policyNumber, 240),
    productType: ['malpractice', 'professional_indemnity', 'combined'].includes(product)
      ? product
      : 'malpractice',
    country: text(input?.country, 3).toUpperCase() || 'ZA',
    currency: 'ZAR',
    coversVirtual: bool(input?.coversVirtual, true),
    coversInPerson: bool(input?.coversInPerson, true),
    coversProcedures: bool(input?.coversProcedures),
    coversHomeVisits: bool(input?.coversHomeVisits, true),
    perIncidentLimitZar: nullableMoney(input?.perIncidentLimitZar),
    perAnnumLimitZar: nullableMoney(input?.perAnnumLimitZar),
    excessZar: nullableMoney(input?.excessZar),
    retroactiveDate: text(input?.retroactiveDate, 20),
    expiryDate: text(input?.expiryDate, 20) || null,
    notesInternal: text(input?.notesInternal, 4000),
    notesExternal: text(input?.notesExternal, 4000),
    scope: ['platform', 'clinician_class', 'premium', 'clinician_ids'].includes(scope)
      ? scope
      : 'platform',
    targetClassIds: stringArray(input?.targetClassIds),
    targetClinicianIds: stringArray(input?.targetClinicianIds),
    isPrimary: bool(input?.isPrimary),
    active: bool(input?.active, true),
  };
}

function normalizeSettings(input: any) {
  const policies = Array.isArray(input?.policies)
    ? input.policies.slice(0, 50).map(normalizePolicy)
    : [];
  return {
    platformCoverEnabled: bool(input?.platformCoverEnabled),
    platformInsurerName: text(input?.platformInsurerName, 240),
    platformPolicyNumber: text(input?.platformPolicyNumber, 240),
    platformCoversVirtual: bool(input?.platformCoversVirtual, true),
    platformCoverNotes: text(input?.platformCoverNotes, 4000),
    policies,
  };
}

async function readSettings() {
  const row = await prisma.platformSetting.findUnique({
    where: { key: SETTING_KEY },
    select: { value: true },
  });
  return row?.value ? normalizeSettings(row.value) : { ...DEFAULT_SETTINGS };
}

function canManage(actor: any) {
  if (actor?.isSuperAdmin) return true;
  const values = new Set([...(actor?.roles || []), ...(actor?.scopes || [])]);
  return (
    values.has('*') ||
    values.has('admin:all') ||
    values.has('admin:write') ||
    values.has('compliance:manage')
  );
}

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(settings, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    console.error('[settings/insurance] GET failed', error);
    return NextResponse.json(
      { error: 'professional_indemnity_settings_unavailable' },
      { status: 503 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canManage(actor)) {
      return NextResponse.json(
        { error: 'professional_indemnity_settings_forbidden' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const next = normalizeSettings(body);

    await prisma.platformSetting.upsert({
      where: { key: SETTING_KEY },
      update: {
        category: 'professional-indemnity',
        value: next as Prisma.InputJsonValue,
        updatedByUserId: actor.userId,
      },
      create: {
        key: SETTING_KEY,
        category: 'professional-indemnity',
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
          action: 'platform_settings.professional_indemnity.updated',
          entityType: 'PlatformSetting',
          entityId: SETTING_KEY,
          description: 'Professional Indemnity / Medical Malpractice settings updated',
          userAgent: req.headers.get('user-agent'),
          meta: {
            platformCoverEnabled: next.platformCoverEnabled,
            policyCount: next.policies.length,
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
    console.error('[settings/insurance] PUT failed', error);
    return NextResponse.json(
      { error: 'professional_indemnity_settings_save_failed' },
      { status: 500 },
    );
  }
}
