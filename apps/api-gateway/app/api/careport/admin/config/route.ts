import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BroadcastPolicy = {
  initialRadiusKm: number;
  expansionIntervalMinutes: number;
  expansionStepKm: number;
  maxRadiusKm: number;
  minCoverageRatio: number;
  minAcceptedOffersBeforeExpansion: number;
};

type PricingPolicy = {
  country: string;
  currency: string;
  codEnabled: boolean;
  codLimitCents: number;
  baseDeliveryFeeCents: number;
  perKmDeliveryFeeCents: number;
  maxDeliveryFeeCents: number;
};

const DEFAULT_BROADCAST_POLICY: BroadcastPolicy = {
  initialRadiusKm: 10,
  expansionIntervalMinutes: 3,
  expansionStepKm: 10,
  maxRadiusKm: 50,
  minCoverageRatio: 0.6,
  minAcceptedOffersBeforeExpansion: 3,
};

const DEFAULT_PRICING_POLICY: PricingPolicy = {
  country: 'ZA',
  currency: 'ZAR',
  codEnabled: true,
  codLimitCents: 150000,
  baseDeliveryFeeCents: 3500,
  perKmDeliveryFeeCents: 550,
  maxDeliveryFeeCents: 12000,
};

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'enabled', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'disabled', 'off'].includes(raw)) return false;
  return fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asInt(value: unknown, fallback: number, min: number, max: number) {
  return Math.trunc(asNumber(value, fallback, min, max));
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

function readDelegate(name: string) {
  return (prisma as any)[name] || null;
}

function normalizeBroadcastPolicy(input: any): BroadcastPolicy {
  return {
    initialRadiusKm: asNumber(input?.initialRadiusKm, DEFAULT_BROADCAST_POLICY.initialRadiusKm, 1, 50),
    expansionIntervalMinutes: asNumber(input?.expansionIntervalMinutes, DEFAULT_BROADCAST_POLICY.expansionIntervalMinutes, 1, 60),
    expansionStepKm: asNumber(input?.expansionStepKm, DEFAULT_BROADCAST_POLICY.expansionStepKm, 1, 50),
    maxRadiusKm: asNumber(input?.maxRadiusKm, DEFAULT_BROADCAST_POLICY.maxRadiusKm, 1, 100),
    minCoverageRatio: asNumber(input?.minCoverageRatio, DEFAULT_BROADCAST_POLICY.minCoverageRatio, 0, 1),
    minAcceptedOffersBeforeExpansion: asInt(
      input?.minAcceptedOffersBeforeExpansion,
      DEFAULT_BROADCAST_POLICY.minAcceptedOffersBeforeExpansion,
      1,
      20,
    ),
  };
}

function normalizePricingPolicy(input: any): PricingPolicy {
  return {
    country: clean(input?.country, 10).toUpperCase() || DEFAULT_PRICING_POLICY.country,
    currency: clean(input?.currency, 10).toUpperCase() || DEFAULT_PRICING_POLICY.currency,
    codEnabled: asBool(input?.codEnabled, DEFAULT_PRICING_POLICY.codEnabled),
    codLimitCents: asInt(input?.codLimitCents, DEFAULT_PRICING_POLICY.codLimitCents, 0, 10_000_000),
    baseDeliveryFeeCents: asInt(input?.baseDeliveryFeeCents, DEFAULT_PRICING_POLICY.baseDeliveryFeeCents, 0, 1_000_000),
    perKmDeliveryFeeCents: asInt(input?.perKmDeliveryFeeCents, DEFAULT_PRICING_POLICY.perKmDeliveryFeeCents, 0, 1_000_000),
    maxDeliveryFeeCents: asInt(input?.maxDeliveryFeeCents, DEFAULT_PRICING_POLICY.maxDeliveryFeeCents, 0, 1_000_000),
  };
}

async function loadStoredConfig(orgId: string) {
  const settingsDelegate =
    readDelegate('carePortOperationalSetting') ||
    readDelegate('carePortSetting') ||
    readDelegate('careportSetting');

  let broadcastPolicy = DEFAULT_BROADCAST_POLICY;
  let pricingPolicy = DEFAULT_PRICING_POLICY;
  let storage: 'database' | 'defaults' = 'defaults';

  if (settingsDelegate?.findFirst) {
    const row = await settingsDelegate.findFirst({
      where: { orgId, key: 'careport.dispatch_policy' },
      orderBy: { updatedAt: 'desc' },
    }).catch(() => null);

    const raw = row?.value ?? row?.json ?? row?.payload ?? row?.metadata ?? null;
    if (raw && typeof raw === 'object') {
      broadcastPolicy = normalizeBroadcastPolicy((raw as any).broadcastPolicy ?? raw);
      pricingPolicy = normalizePricingPolicy((raw as any).pricingPolicy ?? DEFAULT_PRICING_POLICY);
      storage = 'database';
    }
  }

  return { broadcastPolicy, pricingPolicy, storage };
}

async function saveStoredConfig(orgId: string, body: any, actor: ReturnType<typeof readIdentity>) {
  const settingsDelegate =
    readDelegate('carePortOperationalSetting') ||
    readDelegate('carePortSetting') ||
    readDelegate('careportSetting');

  if (!settingsDelegate?.upsert && !settingsDelegate?.create) {
    throw Object.assign(new Error('careport_operational_settings_model_not_configured'), { status: 501 });
  }

  const payload = {
    broadcastPolicy: normalizeBroadcastPolicy(body?.broadcastPolicy ?? body),
    pricingPolicy: normalizePricingPolicy(body?.pricingPolicy ?? body),
  };

  const key = 'careport.dispatch_policy';

  if (settingsDelegate.upsert) {
    const saved = await settingsDelegate.upsert({
      where: { orgId_key: { orgId, key } },
      update: {
        value: payload,
        json: payload,
        payload,
        metadata: payload,
        updatedByUserId: actor.uid ?? null,
      } as any,
      create: {
        orgId,
        key,
        value: payload,
        json: payload,
        payload,
        metadata: payload,
        updatedByUserId: actor.uid ?? null,
      } as any,
    }).catch(async () => {
      return settingsDelegate.create({
        data: {
          orgId,
          key,
          value: payload,
          json: payload,
          payload,
          metadata: payload,
          updatedByUserId: actor.uid ?? null,
        } as any,
      });
    });

    return saved;
  }

  return settingsDelegate.create({
    data: {
      orgId,
      key,
      value: payload,
      json: payload,
      payload,
      metadata: payload,
      updatedByUserId: actor.uid ?? null,
    } as any,
  });
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin']);
    const config = await loadStoredConfig(orgId);
    return json({ ok: true, orgId, ...config });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_admin_config_load_failed' }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin']);
    const body = await req.json().catch(() => ({}));
    const saved = await saveStoredConfig(orgId, body, who);

    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_admin_config_updated',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: orgId,
        meta: {
          orgId,
          settingId: saved?.id ?? null,
          broadcastPolicy: normalizeBroadcastPolicy(body?.broadcastPolicy ?? body),
          pricingPolicy: normalizePricingPolicy(body?.pricingPolicy ?? body),
        },
      },
    }).catch(() => null);

    const config = await loadStoredConfig(orgId);
    return json({ ok: true, saved: true, ...config });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_admin_config_update_failed' }, error?.status || 500);
  }
}
