// apps/admin-dashboard/app/api/settings/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

type PatientPlan = {
  id: string;
  actor: 'patient';
  label: string;
  description: string;
  currency: string;
  priceMonthlyZar: number;
  recommendedFor: string;
  highlight: boolean;
  enabled: boolean;
};

type ClinicianPlan = {
  id: string;
  actor: 'clinician';
  label: string;
  description: string;
  currency: string;
  monthlySubscriptionZar: number;
  payoutSharePct: number;
  includedAdminSlots: number;
  maxAdminSlots: number;
  extraAdminSlotZar: number | null;
  recommendedFor: string;
  highlight: boolean;
  enabled: boolean;
};

type PlansConfig = {
  patientPlans: PatientPlan[];
  clinicianPlans: ClinicianPlan[];
};

function configPathCandidates() {
  return [
    path.resolve(process.cwd(), 'packages', 'admin', 'plans.json'),
    path.resolve(process.cwd(), '..', '..', 'packages', 'admin', 'plans.json'),
    path.resolve(process.cwd(), '..', 'packages', 'admin', 'plans.json'),
  ];
}

async function resolveConfigPath() {
  for (const candidate of configPathCandidates()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  return configPathCandidates()[1];
}

function asText(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function asCurrency(value: unknown) {
  return String(value || 'ZAR').slice(0, 3).toUpperCase();
}

function asMoney(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizePatientPlan(input: any): PatientPlan | null {
  const id = asText(input?.id || input?.key).toLowerCase();
  if (!['free', 'premium', 'family'].includes(id)) return null;

  return {
    id,
    actor: 'patient',
    label: asText(input?.label || input?.name || id),
    description: asText(input?.description || input?.tagline),
    currency: asCurrency(input?.currency),
    priceMonthlyZar: asMoney(input?.priceMonthlyZar),
    recommendedFor: asText(input?.recommendedFor),
    highlight: asBool(input?.highlight),
    enabled: asBool(input?.enabled, true),
  };
}

function normalizeClinicianPlan(input: any): ClinicianPlan | null {
  const id = asText(input?.id).toLowerCase();
  if (!['solo', 'starter', 'team', 'group'].includes(id)) return null;

  return {
    id,
    actor: 'clinician',
    label: asText(input?.label || id),
    description: asText(input?.description),
    currency: asCurrency(input?.currency),
    monthlySubscriptionZar: asMoney(input?.monthlySubscriptionZar),
    payoutSharePct: asNumber(input?.payoutSharePct),
    includedAdminSlots: asMoney(input?.includedAdminSlots),
    maxAdminSlots: asMoney(input?.maxAdminSlots ?? input?.maxAdminStaffSlots),
    extraAdminSlotZar:
      input?.extraAdminSlotZar === null || input?.extraAdminSlotZar === undefined
        ? null
        : asMoney(input?.extraAdminSlotZar),
    recommendedFor: asText(input?.recommendedFor),
    highlight: asBool(input?.highlight),
    enabled: asBool(input?.enabled, true),
  };
}

function normalizeConfig(input: any): PlansConfig {
  const patientPlans = Array.isArray(input?.patientPlans)
    ? input.patientPlans.map(normalizePatientPlan).filter(Boolean) as PatientPlan[]
    : [];

  const clinicianPlans = Array.isArray(input?.clinicianPlans)
    ? input.clinicianPlans.map(normalizeClinicianPlan).filter(Boolean) as ClinicianPlan[]
    : [];

  return { patientPlans, clinicianPlans };
}

async function readConfig(): Promise<PlansConfig> {
  const file = await resolveConfigPath();

  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return normalizeConfig(parsed);
  } catch {
    return { patientPlans: [], clinicianPlans: [] };
  }
}

async function writeConfig(config: PlansConfig) {
  const file = await resolveConfigPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const current = await readConfig();
  const body = await req.json().catch(() => ({}));

  const next = normalizeConfig({
    patientPlans: Array.isArray(body?.patientPlans) ? body.patientPlans : current.patientPlans,
    clinicianPlans: Array.isArray(body?.clinicianPlans) ? body.clinicianPlans : current.clinicianPlans,
  });

  await writeConfig(next);

  return NextResponse.json(next);
}
