// apps/api-gateway/app/api/settings/plans/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const filePath = path.join(process.cwd(), '../../packages/admin/plans.json');

async function readJsonSafe(p: string) {
  try {
    const txt = await fs.readFile(p, 'utf-8');
    const clean = txt.replace(/^\uFEFF/, '');
    return JSON.parse(clean);
  } catch {
    return {
      clinicianPlans: [],
    };
  }
}

export async function GET() {
  const cfg = await readJsonSafe(filePath);
  const all = Array.isArray(cfg?.clinicianPlans)
    ? cfg.clinicianPlans
    : [];
  const enabled = all.filter((p: any) => p.enabled !== false);
  return NextResponse.json({ clinicianPlans: enabled });
}
