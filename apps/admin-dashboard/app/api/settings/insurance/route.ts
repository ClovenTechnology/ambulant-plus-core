//apps/admin-dashboard/app/api/settings/insurance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const insurancePath = path.join(process.cwd(), '../../.data/settings/insurance.json');

type InsuranceSettings = {
  platformCoverEnabled: boolean;
  platformInsurerName?: string;
  platformPolicyNumber?: string;
  platformCoversVirtual?: boolean;
  platformCoverNotes?: string;
};

async function readSettings(): Promise<InsuranceSettings> {
  try {
    const raw = await fs.readFile(insurancePath, 'utf-8');
    const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(clean);
  } catch {
    // default: no platform cover yet
    return {
      platformCoverEnabled: false,
    };
  }
}

function sanitise(body: any): InsuranceSettings {
  return {
    platformCoverEnabled: Boolean(body.platformCoverEnabled),
    platformInsurerName: body.platformInsurerName ? String(body.platformInsurerName).trim() : undefined,
    platformPolicyNumber: body.platformPolicyNumber ? String(body.platformPolicyNumber).trim() : undefined,
    platformCoversVirtual: body.platformCoversVirtual != null ? Boolean(body.platformCoversVirtual) : undefined,
    platformCoverNotes: body.platformCoverNotes ? String(body.platformCoverNotes).trim() : undefined,
  };
}

export async function GET() {
  const s = await readSettings();
  return NextResponse.json(s);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const next = sanitise(body);
  await fs.mkdir(path.dirname(insurancePath), { recursive: true });
  await fs.writeFile(insurancePath, JSON.stringify(next, null, 2), 'utf-8');

  // optional: if platformCoverEnabled + body.applyToAllClinicians => call gateway to sync
  // (left as a hook so you can decide how aggressive you want this to be)
  // if (next.platformCoverEnabled && body.applyToAllClinicians) {
  //   const gateway = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';
  //   fetch(`${gateway}/api/admin/platform-insurance/sync`, {
  //     method: 'POST',
  //     headers: { 'content-type': 'application/json', 'x-role': 'admin' },
  //     body: JSON.stringify(next),
  //   }).catch(() => {});
  // }

  return NextResponse.json({ ok: true });
}
