//apps/api-gateway/app/api/settings/insurance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const insurancePath = path.join(process.cwd(), '../../.data/settings/insurance.json');

async function readSettings() {
  try {
    const raw = await fs.readFile(insurancePath, 'utf-8');
    const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(clean);
  } catch {
    return { platformCoverEnabled: false };
  }
}

export async function GET(_req: NextRequest) {
  const cfg = await readSettings();
  return NextResponse.json(cfg, {
    headers: { 'cache-control': 'no-store' },
  });
}
