// apps/api-gateway/app/api/settings/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

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

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function readConfig(): Promise<PlansConfig> {
  const file = await resolveConfigPath();

  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return {
      patientPlans: normalizeArray(parsed?.patientPlans),
      clinicianPlans: normalizeArray(parsed?.clinicianPlans),
    };
  } catch {
    return { patientPlans: [], clinicianPlans: [] };
  }
}

async function writeConfig(config: PlansConfig) {
  const file = await resolveConfigPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function isEnabled(plan: any) {
  return plan?.enabled !== false;
}

export async function GET(req: NextRequest) {
  const includeDisabled = new URL(req.url).searchParams.get('includeDisabled') === '1';
  const config = await readConfig();

  return NextResponse.json({
    patientPlans: includeDisabled ? config.patientPlans : config.patientPlans.filter(isEnabled),
    clinicianPlans: includeDisabled ? config.clinicianPlans : config.clinicianPlans.filter(isEnabled),
  });
}

export async function POST(req: NextRequest) {
  const current = await readConfig();
  const body = await req.json().catch(() => ({}));

  const next = {
    patientPlans: Array.isArray(body?.patientPlans) ? body.patientPlans : current.patientPlans,
    clinicianPlans: Array.isArray(body?.clinicianPlans) ? body.clinicianPlans : current.clinicianPlans,
  };

  await writeConfig(next);

  return NextResponse.json(next);
}
